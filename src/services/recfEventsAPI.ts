import { createLogger } from '../utils/logger';
import { storage } from '../utils/webCompatibility';
import {
  APIKeyStatus,
  EventFilters,
  TeamFilters,
  SeasonFilters,
  ProgramFilters,
  MatchFilters,
  RankingFilters,
  SkillFilters,
  AwardFilters,
  EventTeamFilters,
  Event,
  Team,
  Season,
  Program,
  Match,
  Ranking,
  Skill,
  Award,
  EventsResponse,
  TeamsResponse,
  SeasonsResponse,
  ProgramsResponse,
  MatchesResponse,
  RankingsResponse,
  SkillsResponse,
  AwardsResponse,
  RECFEvent,
  RECFTeam,
} from '../types/api';
import { WorldSkillsResponse } from '../types';

const logger = createLogger('recfEventsAPI');

/**
 * RECF Events API Service
 * - Unimplemented due to API not yet existing
 * 
 * This service handles all API calls for programs on RECFEvents.
 * Currently used for:
 * - Aerial Drone Competition
 */
class RECFEventsAPI {
  private baseUrl = 'https://api.recf.org/v1';
  private selectedProgram: string = 'Aerial Drone Competition';

  // API key management
  private apiKeys: string[] = [];
  private currentKeyIndex = 0;
  private failedKeys: Set<number> = new Set();
  private keyResetTime = 60 * 60 * 1000; // Reset failed keys after 1 hour
  private lastKeyResetTime = 0;

  // Caching
  private teamIdCache: Map<string, { id: number; data: any; timestamp: number }> = new Map();
  private cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours
  private readonly CACHE_STORAGE_KEY = 'recfevents_team_cache';

  // Rate limiting
  private lastRequestTime = 0;
  private requestDelay = 100; // Minimum delay between requests in milliseconds

  constructor() {
    this.initializeApiKeys();
  }

  // =============================================================================
  // INITIALIZATION AND UTILITY METHODS
  // =============================================================================

  private initializeApiKeys(): void {
    const keys: string[] = [];

    // Load numbered RECF API keys (1-10)
    for (let i = 1; i <= 10; i++) {
      const key = process.env[`EXPO_PUBLIC_RECFEVENTS_API_KEY_${i}`];
      if (key && key.trim()) {
        keys.push(key.trim());
      }
    }

    if (keys.length === 0) {
      const legacyKey = process.env.EXPO_PUBLIC_RECFEVENTS_API_KEY;
      if (legacyKey && legacyKey.trim()) {
        keys.push(legacyKey.trim());
      }
    }

    this.apiKeys = keys;
    logger.debug('Loaded', this.apiKeys.length, 'API keys for rotation');

    if (this.apiKeys.length === 0) {
      logger.warn('No API keys found! API calls will fail.');
    }
  }

  private getCurrentApiKey(): string | null {
    if (this.apiKeys.length === 0) {
      return null;
    }

    // Reset failed keys periodically
    const now = Date.now();
    if (now - this.lastKeyResetTime > this.keyResetTime) {
      logger.debug('Resetting failed keys list');
      this.failedKeys.clear();
      this.lastKeyResetTime = now;
    }

    // Find next available key that hasn't failed
    let attempts = 0;
    while (attempts < this.apiKeys.length) {
      if (!this.failedKeys.has(this.currentKeyIndex)) {
        logger.debug('Using key', this.currentKeyIndex + 1, '/', this.apiKeys.length);
        return this.apiKeys[this.currentKeyIndex];
      }

      this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
      attempts++;
    }

    // All keys have failed, reset and use the first one
    logger.warn('All keys have failed, resetting failed list and retrying');
    this.failedKeys.clear();
    this.currentKeyIndex = 0;
    return this.apiKeys[0] || null;
  }

  private markCurrentKeyAsFailed(): void {
    logger.warn('Marking key', this.currentKeyIndex + 1, 'as failed');
    this.failedKeys.add(this.currentKeyIndex);
    this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
  }

  private getProgramId(program: string): number {
    const mapping: Record<string, number> = {
      'Aerial Drone Competition': 1,
      // Add more RECF programs as they become available
    };
    return mapping[program] || 1;
  }

  private getDefaultSeasonId(program: string): number {
    const defaults: Record<string, number> = {
      'Aerial Drone Competition': 1,
      // Add more RECF programs as they become available
    };
    return defaults[program] || 1;
  }

  /**
   * Gets caller information from the stack trace
   */
  private getCallerInfo(): string {
    try {
      const stack = new Error().stack;
      if (!stack) return 'Unknown caller';

      const stackLines = stack.split('\n');

      // Debug: Uncomment to see raw stack traces
      // logger.debug('Stack trace:', stackLines);

      
      for (let i = 0; i < stackLines.length; i++) {
        const line = stackLines[i];

        // Skip internal API files
        if (line.includes('robotEventsApi.ts') ||
            line.includes('recfEventsAPI.ts') ||
            line.includes('apiRouter.ts')) {
          continue;
        }

        // Web/Chrome format: at functionName (http://localhost:8081/src/path/file.tsx:123:45)
        let match = line.match(/http:\/\/[^/]+\/src\/([\w/]+\.tsx?):(\d+)/);
        if (match) {
          const filePath = match[1];
          const lineNumber = match[2];
          return `src/${filePath}:${lineNumber}`;
        }

        // Native format: Look for lines that contain file paths with src
        if (line.includes('/src/') || line.includes('\\src\\')) {
          // Handle both Unix and Windows paths
          match = line.match(/[/\\]src[/\\]([\w/\\]+\.tsx?)(?::(\d+))?/);
          if (match) {
            const filePath = match[1].replace(/\\/g, '/');
            const lineNumber = match[2] || '?';
            return `src/${filePath}:${lineNumber}`;
          }

          // Alternative pattern for some stack trace formats
          match = line.match(/at\s+.*?\(.*?[/\\]src[/\\]([\w/\\]+\.tsx?):(\d+)/);
          if (match) {
            const filePath = match[1].replace(/\\/g, '/');
            const lineNumber = match[2] || '?';
            return `src/${filePath}:${lineNumber}`;
          }
        }
      }

      return 'Unknown caller';
    } catch (e) {
      return 'Error getting caller info';
    }
  }

  // Core request method with authentication and retry logic
  private async request<T>(endpoint: string, params: Record<string, any> = {}, retryCount: number = 0): Promise<T> {
    // Rate limiting
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.requestDelay) {
      const delayNeeded = this.requestDelay - timeSinceLastRequest;
      logger.debug('Rate limiting: waiting', delayNeeded, 'ms before request');
      await new Promise(resolve => setTimeout(resolve, delayNeeded));
    }
    this.lastRequestTime = Date.now();

    const url = new URL(`${this.baseUrl}${endpoint}`);

    // Add pagination defaults for list endpoints
    const isListEndpoint = endpoint.includes('/teams') || endpoint.includes('/events') ||
                          endpoint.includes('/rankings') || endpoint.includes('/awards') ||
                          endpoint.includes('/skills') || endpoint.includes('/matches') ||
                          endpoint.includes('/seasons') || endpoint.includes('/programs');
    const isSingleResource = /\/\d+$/.test(endpoint);

    if (!params.per_page && isListEndpoint && !isSingleResource) {
      params.per_page = 250; // Maximum allowed by API
    }

    // Build URL parameters
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null) {
        if (Array.isArray(params[key])) {
          // Handle array parameters properly for API
          params[key].forEach((value: any) => {
            url.searchParams.append(key + '[]', value.toString());
          });
        } else {
          url.searchParams.append(key, params[key].toString());
        }
      }
    });

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const currentApiKey = this.getCurrentApiKey();
    if (currentApiKey) {
      headers['Authorization'] = `Bearer ${currentApiKey}`;
    }

    const caller = this.getCallerInfo();

    console.log('═══════════════════════════════════════════════════════════');
    console.log('[RECF Events API Request]');
    console.log('  Endpoint:', endpoint || 'Unknown');
    console.log('  Called from:', caller);
    console.log('  Full URL:', url.toString());
    console.log('───────────────────────────────────────────────────────────');

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers,
      });

      console.log(`[RECF Events API - Status ${response.status}] ${endpoint}`);
      console.log('  HTTP Status Code:', response.status);
      console.log('  Called from:', caller);
      console.log('═══════════════════════════════════════════════════════════');

      // Handle rate limiting responses
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 5000;
        logger.warn('Rate limited! Waiting', waitTime, 'ms before retry');
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return this.request(endpoint, params, retryCount);
      }

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Error response body:', errorText);

        // Check if it's an HTML login page (indicates auth failure)
        if (errorText.includes('<!DOCTYPE html>') && errorText.includes('login')) {
          logger.warn('Authentication failed with current key, marking as failed');
          this.markCurrentKeyAsFailed();

          // Retry with next key if we haven't exceeded retry limit
          if (retryCount < this.apiKeys.length - 1) {
            logger.debug('Retrying with next API key (attempt', retryCount + 1, ')');
            return this.request(endpoint, params, retryCount + 1);
          }

          throw new Error(`API Authentication failed - all API keys may be expired or invalid`);
        }

        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      }

      const responseText = await response.text();
      logger.debug('Response body length:', responseText.length, 'characters');

      try {
        return JSON.parse(responseText);
      } catch (parseError) {
        logger.error('JSON parse error:', parseError);
        logger.error('Raw response text:', responseText.substring(0, 500) + '...');

        if (responseText.includes('<!DOCTYPE html>')) {
          logger.warn('Received HTML instead of JSON, marking current key as failed');
          this.markCurrentKeyAsFailed();

          // Retry with next key if we haven't exceeded retry limit
          if (retryCount < this.apiKeys.length - 1) {
            logger.debug('Retrying with next API key (attempt', retryCount + 1, ')');
            return this.request(endpoint, params, retryCount + 1);
          }

          throw new Error(`JSON parse error - received HTML instead of JSON, all API keys failed: ${parseError}`);
        }

        throw new Error(`JSON parse error: ${parseError}`);
      }
    } catch (error) {
      logger.error('Request failed for', url.toString(), ':', error);

      // TODO: Remove this when RECF API is actually available
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('RECF Events API is not yet available. This is a placeholder implementation.');
      }

      throw error;
    }
  }

  // =============================================================================
  // PUBLIC CONFIGURATION METHODS
  // =============================================================================

  public setSelectedProgram(program: string): void {
    this.selectedProgram = program;
    logger.debug('Selected program set to:', program || 'Unknown');
  }

  public getSelectedProgram(): string {
    return this.selectedProgram;
  }

  public getApiKeyStatus(): APIKeyStatus {
    return {
      total: this.apiKeys.length,
      active: this.apiKeys.length - this.failedKeys.size,
      failed: this.failedKeys.size,
      current: this.currentKeyIndex + 1
    };
  }

  // =============================================================================
  // PROGRAMS API (RECF-style endpoints)
  // =============================================================================

  public async getPrograms(filters?: ProgramFilters): Promise<ProgramsResponse> {
    try {
      logger.debug('getPrograms called - implementing RECF endpoint');

      // TODO: Implement actual RECF API call when available
      const mockPrograms: Program[] = [
        {
          id: 1,
          name: 'Aerial Drone Competition',
          abbr: 'ADC'
        }
      ];

      return {
        data: mockPrograms,
        meta: {
          current_page: 1,
          total: mockPrograms.length,
          per_page: mockPrograms.length,
          last_page: 1
        } as any
      };
    } catch (error) {
      logger.error('Failed to get programs:', error);
      return { data: [], meta: {} as any };
    }
  }

  public async getProgramById(programId: number): Promise<Program | null> {
    try {
      logger.debug('getProgramById called for ID:', programId || 'Unknown');

      // TODO: Implement actual RECF API call when available
      if (programId === 1) {
        return {
          id: 1,
          name: 'Aerial Drone Competition',
          abbr: 'ADC'
        };
      }

      return null;
    } catch (error) {
      logger.error('Failed to get program', programId || 'Unknown', ':', error);
      return null;
    }
  }

  // =============================================================================
  // SEASONS API (RECF-style endpoints)
  // =============================================================================

  public async getSeasons(filters?: SeasonFilters): Promise<SeasonsResponse> {
    try {
      logger.debug('getSeasons called - implementing RECF endpoint');

      // TODO: Implement actual RECF API call when available
      const mockSeasons: Season[] = [
        {
          id: 182,
          name: 'Mission Time Warp',
          program: { id: 1, name: 'Aerial Drone Competition', code: 'ADC' },
          start: '2025-08-01T00:00:00Z',
          end: '2026-07-31T23:59:59Z',
          years_start: 2025,
          years_end: 2026
        }
      ];

      return {
        data: mockSeasons,
        meta: {
          current_page: 1,
          total: mockSeasons.length,
          per_page: mockSeasons.length,
          last_page: 1
        } as any
      };
    } catch (error) {
      logger.error('Failed to get seasons:', error);
      return { data: [], meta: {} as any };
    }
  }

  public async getSeasonById(seasonId: number): Promise<Season | null> {
    try {
      logger.debug('getSeasonById called for ID:', seasonId || 'Unknown');

      // TODO: Implement actual RECF API call when available
      if (seasonId === 182) {
        return {
          id: 182,
          name: 'Mission Time Warp',
          program: { id: 1, name: 'Aerial Drone Competition', code: 'ADC' },
          start: '2025-08-01T00:00:00Z',
          end: '2026-07-31T23:59:59Z',
          years_start: 2025,
          years_end: 2026
        };
      }

      return null;
    } catch (error) {
      logger.error('Failed to get season', seasonId || 'Unknown', ':', error);
      return null;
    }
  }

  public async getSeasonEvents(seasonId: number, filters?: EventFilters): Promise<EventsResponse> {
    try {
      logger.debug('getSeasonEvents called for season:', seasonId || 'Unknown');

      // TODO: Implement actual RECF API call when available
      throw new Error('RECF Events API is not yet implemented for season events');
    } catch (error) {
      logger.error('Failed to get events for season', seasonId || 'Unknown', ':', error);
      return { data: [], meta: {} as any };
    }
  }

  public async getCurrentSeasonId(program?: string): Promise<number> {
    try {
      const selectedProgram = program || this.selectedProgram;
      logger.debug('getCurrentSeasonId called for program:', selectedProgram || 'Unknown');

      // TODO: Implement actual RECF API call when available
      return this.getDefaultSeasonId(selectedProgram);
    } catch (error) {
      logger.error('Failed to get current season:', error);
      return this.getDefaultSeasonId(program || this.selectedProgram);
    }
  }

  // =============================================================================
  // EVENTS API (RECF-style endpoints)
  // =============================================================================

  public async getEvents(filters?: EventFilters): Promise<EventsResponse> {
    try {
      logger.debug('getEvents called - implementing RECF endpoint');

      // TODO: Implement actual RECF API call when available
      throw new Error('RECF Events API is not yet implemented for events');
    } catch (error) {
      logger.error('Failed to get events:', error);
      return { data: [], meta: {} as any };
    }
  }

  public async getEventById(eventId: number): Promise<Event | null> {
    try {
      logger.debug('getEventById called for ID:', eventId || 'Unknown');

      // TODO: Implement actual RECF API call when available
      throw new Error('RECF Events API is not yet implemented for single events');
    } catch (error) {
      logger.error('Failed to get event', eventId || 'Unknown', ':', error);
      return null;
    }
  }

  public async getEventTeams(eventId: number, filters?: EventTeamFilters): Promise<TeamsResponse> {
    try {
      logger.debug('getEventTeams called for event:', eventId || 'Unknown');

      // TODO: Implement actual RECF API call when available
      throw new Error('RECF Events API is not yet implemented for event teams');
    } catch (error) {
      logger.error('Failed to get teams for event', eventId || 'Unknown', ':', error);
      return { data: [], meta: {} as any };
    }
  }

  public async getEventSkills(eventId: number, filters?: SkillFilters): Promise<SkillsResponse> {
    try {
      logger.debug('getEventSkills called for event:', eventId || 'Unknown');

      // TODO: Implement actual RECF API call when available
      throw new Error('RECF Events API is not yet implemented for event skills');
    } catch (error) {
      logger.error('Failed to get skills for event', eventId || 'Unknown', ':', error);
      return { data: [], meta: {} as any };
    }
  }

  public async getEventAwards(eventId: number, filters?: AwardFilters): Promise<AwardsResponse> {
    try {
      logger.debug('getEventAwards called for event:', eventId || 'Unknown');

      // TODO: Implement actual RECF API call when available
      throw new Error('RECF Events API is not yet implemented for event awards');
    } catch (error) {
      logger.error('Failed to get awards for event', eventId || 'Unknown', ':', error);
      return { data: [], meta: {} as any };
    }
  }

  public async getEventDivisionMatches(eventId: number, divisionId: number, filters?: MatchFilters): Promise<MatchesResponse> {
    try {
      logger.debug('getEventDivisionMatches called for event:', eventId || 'Unknown', ', division:', divisionId || 'Unknown');

      // TODO: Implement actual RECF API call when available
      throw new Error('RECF Events API is not yet implemented for division matches');
    } catch (error) {
      logger.error('Failed to get matches for event', eventId || 'Unknown', ', division', divisionId || 'Unknown', ':', error);
      return { data: [], meta: {} as any };
    }
  }

  public async getEventDivisionRankings(eventId: number, divisionId: number, filters?: RankingFilters): Promise<RankingsResponse> {
    try {
      logger.debug('getEventDivisionRankings called for event:', eventId || 'Unknown', ', division:', divisionId || 'Unknown');

      // TODO: Implement actual RECF API call when available
      throw new Error('RECF Events API is not yet implemented for division rankings');
    } catch (error) {
      logger.error('Failed to get rankings for event', eventId || 'Unknown', ', division', divisionId || 'Unknown', ':', error);
      return { data: [], meta: {} as any };
    }
  }

  public async getEventDivisionFinalistRankings(eventId: number, divisionId: number, filters?: RankingFilters): Promise<RankingsResponse> {
    try {
      logger.debug('getEventDivisionFinalistRankings called for event:', eventId || 'Unknown', ', division:', divisionId || 'Unknown');

      // TODO: Implement actual RECF API call when available
      throw new Error('RECF Events API is not yet implemented for finalist rankings');
    } catch (error) {
      logger.error('Failed to get finalist rankings for event', eventId || 'Unknown', ', division', divisionId || 'Unknown', ':', error);
      return { data: [], meta: {} as any };
    }
  }

  // =============================================================================
  // TEAMS API (RECF-style endpoints)
  // =============================================================================

  public async getTeams(filters?: TeamFilters): Promise<TeamsResponse> {
    try {
      logger.debug('getTeams called - implementing RECF endpoint');

      // TODO: Implement actual RECF API call when available
      throw new Error('RECF Events API is not yet implemented for teams');
    } catch (error) {
      logger.error('Failed to get teams:', error);
      return { data: [], meta: {} as any };
    }
  }

  public async getTeamById(teamId: number): Promise<Team | null> {
    try {
      logger.debug('getTeamById called for ID:', teamId || 'Unknown');

      // TODO: Implement actual RECF API call when available
      throw new Error('RECF Events API is not yet implemented for single teams');
    } catch (error) {
      logger.error('Failed to get team', teamId || 'Unknown', ':', error);
      return null;
    }
  }

  /**
   * Get teams using the team browser key pool
   * For RECF Events API, this is identical to getTeams (no separate key pool)
   */
  public async getTeamsForBrowser(filters?: TeamFilters): Promise<TeamsResponse> {
    // RECF Events API doesn't have separate key pools, so just use regular getTeams
    return this.getTeams(filters);
  }

  public async getTeamByNumber(teamNumber: string, program?: string): Promise<Team | null> {
    try {
      const selectedProgram = program || this.selectedProgram;
      logger.debug('getTeamByNumber called for team:', teamNumber || 'Unknown', ', program:', selectedProgram || 'Unknown');

      // TODO: Implement actual RECF API call when available
      throw new Error('RECF Events API is not yet implemented for team lookup by number');
    } catch (error) {
      logger.error('Failed to get team by number "' + (teamNumber || 'Unknown') + '":', error);
      return null;
    }
  }

  public async getTeamEvents(teamId: number, filters?: EventFilters): Promise<EventsResponse> {
    try {
      logger.debug('getTeamEvents called for team:', teamId || 'Unknown');

      // TODO: Implement actual RECF API call when available
      throw new Error('RECF Events API is not yet implemented for team events');
    } catch (error) {
      logger.error('Failed to get events for team', teamId || 'Unknown', ':', error);
      return { data: [], meta: {} as any };
    }
  }

  public async getTeamMatches(teamId: number, filters?: MatchFilters): Promise<MatchesResponse> {
    try {
      logger.debug('getTeamMatches called for team:', teamId || 'Unknown');

      // TODO: Implement actual RECF API call when available
      throw new Error('RECF Events API is not yet implemented for team matches');
    } catch (error) {
      logger.error('Failed to get matches for team', teamId || 'Unknown', ':', error);
      return { data: [], meta: {} as any };
    }
  }

  public async getTeamRankings(teamId: number, filters?: RankingFilters): Promise<RankingsResponse> {
    try {
      logger.debug('getTeamRankings called for team:', teamId || 'Unknown');

      // TODO: Implement actual RECF API call when available
      throw new Error('RECF Events API is not yet implemented for team rankings');
    } catch (error) {
      logger.error('Failed to get rankings for team', teamId || 'Unknown', ':', error);
      return { data: [], meta: {} as any };
    }
  }

  public async getTeamSkills(teamId: number, filters?: SkillFilters): Promise<SkillsResponse> {
    try {
      logger.debug('getTeamSkills called for team:', teamId || 'Unknown');

      // TODO: Implement actual RECF API call when available
      throw new Error('RECF Events API is not yet implemented for team skills');
    } catch (error) {
      logger.error('Failed to get skills for team', teamId || 'Unknown', ':', error);
      return { data: [], meta: {} as any };
    }
  }

  public async getTeamAwards(teamId: number, filters?: AwardFilters): Promise<AwardsResponse> {
    try {
      logger.debug('getTeamAwards called for team:', teamId || 'Unknown');

      // TODO: Implement actual RECF API call when available
      throw new Error('RECF Events API is not yet implemented for team awards');
    } catch (error) {
      logger.error('Failed to get awards for team', teamId || 'Unknown', ':', error);
      return { data: [], meta: {} as any };
    }
  }

  // =============================================================================
  // WORLD SKILLS API (RECF-style endpoints)
  // =============================================================================

  public async getWorldSkillsRankings(seasonId: number, gradeLevel: string): Promise<WorldSkillsResponse[]> {
    try {
      logger.debug('getWorldSkillsRankings called for season:', seasonId || 'Unknown', ', grade:', gradeLevel || 'Unknown');

      // TODO: Implement actual RECF API call when available
      throw new Error('RECF Events API is not yet implemented for World Skills rankings');
    } catch (error) {
      logger.error('Failed to get world skills rankings:', error);
      return [];
    }
  }

  // =============================================================================
  // CACHING METHODS
  // =============================================================================

  public async initializeCache(): Promise<void> {
    try {
      const storedCache = await storage.getItem(this.CACHE_STORAGE_KEY);
      if (storedCache) {
        const cacheData = JSON.parse(storedCache);
        this.teamIdCache = new Map(Object.entries(cacheData));
        logger.debug('Loaded', this.teamIdCache.size, 'cached teams from storage');
      }
    } catch (error) {
      logger.error('Failed to load cache from storage:', error);
    }
  }

  private async saveCacheToStorage(): Promise<void> {
    try {
      const cacheData = Object.fromEntries(this.teamIdCache);
      await storage.setItem(this.CACHE_STORAGE_KEY, JSON.stringify(cacheData));
      logger.debug('Saved', this.teamIdCache.size, 'cached teams to storage');
    } catch (error) {
      logger.error('Failed to save cache to storage:', error);
    }
  }

  public clearCache(): void {
    this.teamIdCache.clear();
    storage.removeItem(this.CACHE_STORAGE_KEY);
    logger.debug('Cache cleared');
  }

  // =============================================================================
  // CONVENIENCE METHODS (Legacy compatibility)
  // =============================================================================

  public async searchTeams(query: string, program?: string, seasonId?: number): Promise<Team[]> {
    logger.debug('searchTeams called with query:', query || 'Unknown');
    const response = await this.getTeams({
      number: [query],
      program: program ? [this.getProgramId(program)] : undefined,
    });
    return response.data;
  }

  public async searchEvents(filters?: EventFilters): Promise<Event[]> {
    logger.debug('searchEvents called');
    const response = await this.getEvents(filters);
    return response.data;
  }
}

// Export singleton instance
export const recfEventsAPI = new RECFEventsAPI();
export default recfEventsAPI;