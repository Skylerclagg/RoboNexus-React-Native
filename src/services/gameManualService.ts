/**
 * Game Manual Service
 *
 * Manages game manual rules, favorites, and data loading.
 * Fetches from GitHub, caches locally, and falls back to bundled JSON.
 */

import { createLogger } from '../utils/logger';
import { storage } from '../utils/webCompatibility';
import { GameManual, Rule, FavoriteRuleStorage } from '../types/gameManual';
import { getProgramShortName } from '../utils/programMappings';

const logger = createLogger('gameManualService');

// Flag to check if we should use bundled data only (set by settings)
let USE_BUNDLED_ONLY = false;

export const setUseBundledGameManuals = (value: boolean) => {
  USE_BUNDLED_ONLY = value;
  logger.debug(`Use bundled manuals only: ${value}`);
};

// Import bundled game manual data as fallback
import V5RC_2025_2026 from '../data/gameManuals/v5rc-2025-2026.json';
import VURC_2025_2026 from '../data/gameManuals/vurc-2025-2026.json';
import VAIRC_2025_2026 from '../data/gameManuals/vairc-2025-2026.json';
import VIQRC_2025_2026 from '../data/gameManuals/viqrc-2025-2026.json';

// GitHub configuration for remote game manual updates
const GITHUB_BASE_URL = 'https://raw.githubusercontent.com/Skylerclagg/Robonexus-gamemanual-json-files/main';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

class GameManualService {
  private readonly FAVORITES_KEY = 'game_manual_favorites';
  private readonly CACHE_KEY_PREFIX = 'game_manual_cache_';
  private readonly CACHE_TIMESTAMP_PREFIX = 'game_manual_timestamp_';

  // Cache for loaded manuals
  private manualsCache: Map<string, GameManual> = new Map();

  // Cache for favorites
  private favoritesCache: FavoriteRuleStorage | null = null;

  /**
   * Compare versions - returns true if version1 is newer than version2
   */
  private isNewerVersion(version1: string | undefined, version2: string | undefined): boolean {
    if (!version1 && !version2) return false;
    if (!version2) return true;  // If no comparison version, consider new version as newer
    if (!version1) return false;  // If no new version, consider old version as newer

    // Version format is YYYYMMDD, so simple string comparison works
    return version1 > version2;
  }

  /**
   * Get game manual for a specific program and season
   * Prefers bundled data, only uses GitHub/cache if newer
   */
  public async getManual(
    program: string,
    season: string,
    onProgress?: (progress: number, total: number) => void
  ): Promise<GameManual | null> {
    const cacheKey = `${program}_${season}`;

    // Check memory cache first
    if (this.manualsCache.has(cacheKey)) {
      return this.manualsCache.get(cacheKey)!;
    }

    // Load bundled manual first as baseline
    const bundledManual = this.loadLocalManual(program, season);
    const bundledVersion = bundledManual?.version;

    logger.debug(`Bundled manual version for ${program} ${season}: ${bundledVersion || 'unknown'}`);

    // If bundled-only mode is enabled, use bundled data immediately
    if (USE_BUNDLED_ONLY) {
      logger.debug(`Bundled-only mode enabled - using bundled data`);
      if (bundledManual) {
        this.manualsCache.set(cacheKey, bundledManual);
      }
      return bundledManual;
    }

    // Check cached version
    const cachedManual = await this.getCachedManual(program, season);
    const cacheValid = await this.isCacheValid(program, season);
    const cachedVersion = cachedManual?.version;

    // If cached is valid and newer than bundled, use cached
    if (cachedManual && cacheValid && this.isNewerVersion(cachedVersion, bundledVersion)) {
      logger.debug(`Using cached manual (v${cachedVersion}) - newer than bundled (v${bundledVersion})`);
      this.manualsCache.set(cacheKey, cachedManual);
      return cachedManual;
    }

    // Try to fetch from GitHub
    try {
      const githubManual = await this.fetchFromGitHub(program, season);
      const githubVersion = githubManual?.version;

      // Only use GitHub version if it's newer than bundled
      if (githubManual && this.isNewerVersion(githubVersion, bundledVersion)) {
        logger.debug(`Using GitHub manual (v${githubVersion}) - newer than bundled (v${bundledVersion})`);
        await this.cacheManual(program, season, githubManual);
        this.manualsCache.set(cacheKey, githubManual);
        return githubManual;
      } else if (githubManual) {
        logger.debug(`GitHub manual (v${githubVersion}) not newer than bundled (v${bundledVersion}) - using bundled`);
      }
    } catch (error) {
      logger.warn(`Failed to fetch from GitHub:`, error);
    }

    // Use bundled data (either no GitHub data, or bundled is newer/same)
    if (bundledManual) {
      logger.debug(`Using bundled data (v${bundledVersion})`);
      this.manualsCache.set(cacheKey, bundledManual);
    }

    return bundledManual;
  }

  /**
   * Fetch manual from GitHub
   */
  private async fetchFromGitHub(program: string, season: string): Promise<GameManual | null> {
    const shortName = getProgramShortName(program);
    const filename = `${shortName.toLowerCase()}-${season.replace(/\//g, '-')}.json`;
    const url = `${GITHUB_BASE_URL}/${filename}`;

    logger.debug(`Fetching from ${url}`);

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub fetch failed: ${response.status} ${response.statusText}`);
    }

    const manual: GameManual = await response.json();
    return manual;
  }

  /**
   * Check if cached manual is still valid
   */
  private async isCacheValid(program: string, season: string): Promise<boolean> {
    try {
      const shortName = getProgramShortName(program);
      const timestampKey = `${this.CACHE_TIMESTAMP_PREFIX}${shortName}_${season}`;
      const timestamp = await storage.getItem(timestampKey);

      if (!timestamp) return false;

      const cacheTime = parseInt(timestamp);
      const now = Date.now();
      return (now - cacheTime) < CACHE_DURATION;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get cached manual from storage
   */
  private async getCachedManual(program: string, season: string): Promise<GameManual | null> {
    try {
      const shortName = getProgramShortName(program);
      const cacheKey = `${this.CACHE_KEY_PREFIX}${shortName}_${season}`;
      const cached = await storage.getItem(cacheKey);

      if (cached) {
        return JSON.parse(cached) as GameManual;
      }
    } catch (error) {
      logger.error('Error loading cached manual:', error);
    }
    return null;
  }

  /**
   * Save manual to cache
   */
  private async cacheManual(program: string, season: string, manual: GameManual): Promise<void> {
    try {
      const shortName = getProgramShortName(program);
      const cacheKey = `${this.CACHE_KEY_PREFIX}${shortName}_${season}`;
      const timestampKey = `${this.CACHE_TIMESTAMP_PREFIX}${shortName}_${season}`;

      await storage.setItem(cacheKey, JSON.stringify(manual));
      await storage.setItem(timestampKey, Date.now().toString());

      logger.debug(`Cached manual for ${program} ${season}`);
    } catch (error) {
      logger.error('Error caching manual:', error);
    }
  }

  /**
   * Load manual from local bundled data
   */
  private loadLocalManual(program: string, season: string): GameManual | null {
    const shortName = getProgramShortName(program);

    // Map of available local manuals
    const localManuals: { [key: string]: GameManual } = {
      // 2025-2026 Season (Current)
      'V5RC_2025-2026': V5RC_2025_2026 as GameManual,
      'VURC_2025-2026': VURC_2025_2026 as GameManual,
      'VAIRC_2025-2026': VAIRC_2025_2026 as GameManual,
      'VIQRC_2025-2026': VIQRC_2025_2026 as GameManual,
    };

    const key = `${shortName}_${season}`;
    return localManuals[key] || null;
  }

  /**
   * Get Q&A URL from bundled manual data (synchronous)
   * This is useful for showing the Q&A button immediately during loading
   */
  public getQnAUrl(program: string, season: string): string | undefined {
    const bundledManual = this.loadLocalManual(program, season);
    return bundledManual?.qnaUrl;
  }

  /**
   * Get current season's manual for a program
   */
  public async getCurrentSeasonManual(program: string): Promise<GameManual | null> {
    // TODO: Determine current season dynamically
    return this.getManual(program, '2024-2025');
  }

  /**
   * Search rules by query string
   */
  public searchRules(manual: GameManual, query: string): Rule[] {
    if (!query || query.trim().length === 0) {
      return [];
    }

    const lowerQuery = query.toLowerCase();
    const results: Rule[] = [];

    manual.ruleGroups.forEach(group => {
      group.rules.forEach(rule => {
        const matches =
          rule.rule.toLowerCase().includes(lowerQuery) ||
          rule.title.toLowerCase().includes(lowerQuery) ||
          rule.description.toLowerCase().includes(lowerQuery) ||
          (rule.tags && rule.tags.some(tag => tag.toLowerCase().includes(lowerQuery))) ||
          rule.category.toLowerCase().includes(lowerQuery) ||
          (rule.fullText && rule.fullText.toLowerCase().includes(lowerQuery));

        if (matches) {
          results.push(rule);
        }
      });
    });

    return results;
  }

  /**
   * Get all rules from a manual (flattened)
   */
  public getAllRules(manual: GameManual): Rule[] {
    const rules: Rule[] = [];
    manual.ruleGroups.forEach(group => {
      rules.push(...group.rules);
    });
    return rules;
  }

  /**
   * Get a specific rule by ID
   */
  public getRuleById(manual: GameManual, ruleId: string): Rule | null {
    for (const group of manual.ruleGroups) {
      const rule = group.rules.find(r => r.id === ruleId);
      if (rule) return rule;
    }
    return null;
  }

  /**
   * Get related rules
   */
  public getRelatedRules(manual: GameManual, rule: Rule): Rule[] {
    if (!rule.relatedRules || rule.relatedRules.length === 0) {
      return [];
    }

    return rule.relatedRules
      .map(ruleId => this.getRuleById(manual, ruleId))
      .filter((r): r is Rule => r !== null);
  }

  // ============================================================================
  // FAVORITES MANAGEMENT
  // ============================================================================

  /**
   * Load favorites from storage
   */
  private async loadFavorites(): Promise<FavoriteRuleStorage> {
    if (this.favoritesCache !== null) {
      return this.favoritesCache;
    }

    try {
      const stored = await storage.getItem(this.FAVORITES_KEY);
      if (stored) {
        this.favoritesCache = JSON.parse(stored);
        return this.favoritesCache!;
      }
    } catch (error) {
      logger.error('Error loading favorites:', error);
    }

    this.favoritesCache = {};
    return this.favoritesCache;
  }

  /**
   * Save favorites to storage
   */
  private async saveFavorites(favorites: FavoriteRuleStorage): Promise<void> {
    try {
      await storage.setItem(this.FAVORITES_KEY, JSON.stringify(favorites));
      this.favoritesCache = favorites;
    } catch (error) {
      logger.error('Error saving favorites:', error);
      throw error;
    }
  }

  /**
   * Get storage key for program/season
   */
  private getFavoritesKey(program: string, season: string): string {
    const shortName = getProgramShortName(program);
    return `${shortName}_${season}`;
  }

  /**
   * Get favorite rule IDs for a program/season
   */
  public async getFavoriteRuleIds(program: string, season: string): Promise<string[]> {
    const favorites = await this.loadFavorites();
    const key = this.getFavoritesKey(program, season);
    return favorites[key] || [];
  }

  /**
   * Get favorite rules (full Rule objects)
   */
  public async getFavoriteRules(manual: GameManual): Promise<Rule[]> {
    const favoriteIds = await this.getFavoriteRuleIds(manual.program, manual.season);
    return favoriteIds
      .map(id => this.getRuleById(manual, id))
      .filter((r): r is Rule => r !== null);
  }

  /**
   * Check if a rule is favorited
   */
  public async isRuleFavorited(program: string, season: string, ruleId: string): Promise<boolean> {
    const favoriteIds = await this.getFavoriteRuleIds(program, season);
    return favoriteIds.includes(ruleId);
  }

  /**
   * Toggle favorite status of a rule
   */
  public async toggleFavorite(program: string, season: string, ruleId: string): Promise<boolean> {
    const favorites = await this.loadFavorites();
    const key = this.getFavoritesKey(program, season);

    if (!favorites[key]) {
      favorites[key] = [];
    }

    const index = favorites[key].indexOf(ruleId);
    const isFavorited = index !== -1;

    if (isFavorited) {
      // Remove from favorites
      favorites[key].splice(index, 1);
    } else {
      // Add to favorites
      favorites[key].push(ruleId);
    }

    await this.saveFavorites(favorites);
    return !isFavorited; // Return new state
  }

  /**
   * Add a rule to favorites
   */
  public async addFavorite(program: string, season: string, ruleId: string): Promise<void> {
    const isFavorited = await this.isRuleFavorited(program, season, ruleId);
    if (!isFavorited) {
      await this.toggleFavorite(program, season, ruleId);
    }
  }

  /**
   * Remove a rule from favorites
   */
  public async removeFavorite(program: string, season: string, ruleId: string): Promise<void> {
    const isFavorited = await this.isRuleFavorited(program, season, ruleId);
    if (isFavorited) {
      await this.toggleFavorite(program, season, ruleId);
    }
  }

  /**
   * Clear all favorites for a program/season
   */
  public async clearFavorites(program: string, season: string): Promise<void> {
    const favorites = await this.loadFavorites();
    const key = this.getFavoritesKey(program, season);
    delete favorites[key];
    await this.saveFavorites(favorites);
  }

  /**
   * Clear all favorites cache (force reload)
   */
  public clearCache(): void {
    this.favoritesCache = null;
    this.manualsCache.clear();
  }

  /**
   * Refresh manual (for bundled data, this just clears the cache)
   */
  public async refreshManual(
    program: string,
    season: string,
    onProgress?: (progress: number, total: number) => void
  ): Promise<GameManual | null> {
    const cacheKey = `${program}_${season}`;
    const shortName = getProgramShortName(program);
    const storageCacheKey = `${this.CACHE_KEY_PREFIX}${shortName}_${season}`;
    const timestampKey = `${this.CACHE_TIMESTAMP_PREFIX}${shortName}_${season}`;

    // Save current cached data as backup in case fetch fails
    const oldCachedData = await storage.getItem(storageCacheKey);
    const oldTimestamp = await storage.getItem(timestampKey);

    // Clear both in-memory and persistent storage caches
    this.manualsCache.delete(cacheKey);
    await storage.removeItem(storageCacheKey);
    await storage.removeItem(timestampKey);

    logger.debug(`Cleared cache for ${program} ${season}, fetching fresh data from GitHub...`);

    try {
      const manual = await this.getManual(program, season, onProgress);

      if (!manual && oldCachedData) {
        logger.debug(`Failed to fetch new data, restoring previous cache for ${program} ${season}`);
        await storage.setItem(storageCacheKey, oldCachedData);
        if (oldTimestamp) {
          await storage.setItem(timestampKey, oldTimestamp);
        }
        return JSON.parse(oldCachedData) as GameManual;
      }

      return manual;
    } catch (error) {
      // On error, restore old cache
      if (oldCachedData) {
        logger.debug(`Error during refresh, restoring previous cache for ${program} ${season}:`, error);
        await storage.setItem(storageCacheKey, oldCachedData);
        if (oldTimestamp) {
          await storage.setItem(timestampKey, oldTimestamp);
        }
        return JSON.parse(oldCachedData) as GameManual;
      }
      throw error;
    }
  }
}

// Export singleton instance
export const gameManualService = new GameManualService();
