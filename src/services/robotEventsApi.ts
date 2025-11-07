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
} from '../types/api';
import { WorldSkillsResponse } from '../types';
import { getProgramId } from '../utils/programMappings';
import { createLogger } from '../utils/logger';

const logger = createLogger('robotEventsApi');
/**
 * Comprehensive RobotEvents API Service
 *
 * This service provides complete coverage of the RobotEvents API v2 endpoints
 * with automatic API key rotation, error handling, and caching capabilities.
 *
 * Features:
 * - Complete endpoint coverage for all RobotEvents API operations
 * - Automatic API key rotation with failure detection
 * - Request rate limiting and retry logic
 * - Team caching for improved performance
 * - Type-safe interfaces for all operations
 */
class ComprehensiveRobotEventsAPI {
  private baseUrl = 'https://www.robotevents.com/api/v2';
  private selectedProgram: string = 'VEX V5 Robotics Competition';

  // API key management - General pool
  private apiKeys: string[] = [];
  private currentKeyIndex = 0;
  private failedKeys: Set<number> = new Set();
  private keyResetTime = 60 * 60 * 1000; // Reset failed keys after 1 hour
  private lastKeyResetTime = 0;
  private generalCycleAttempts = 0; // Track how many full cycles we've attempted
  private generalSuccessfulCallsInCurrentCycle = 0; // Track successful calls in current cycle only
  private generalConsecutiveFailedCycles = 0; // Track consecutive cycles with 0 successful calls

  // API key management - Team Browser pool
  private teamBrowserApiKeys: string[] = [];
  private teamBrowserCurrentKeyIndex = 0;
  private teamBrowserFailedKeys: Set<number> = new Set();
  private teamBrowserLastKeyResetTime = 0;
  private teamBrowserCycleAttempts = 0; // Track how many full cycles we've attempted
  private teamBrowserSuccessfulCallsInCurrentCycle = 0; // Track successful calls in current cycle only
  private teamBrowserConsecutiveFailedCycles = 0; // Track consecutive cycles with 0 successful calls

  // Usage statistics
  private generalKeyUsageCount = 0;
  private teamBrowserKeyUsageCount = 0;

  // Key rotation tracking
  private generalKeyCallsSinceRotation = 0;
  private teamBrowserKeyCallsSinceRotation = 0;
  private readonly CALLS_BEFORE_ROTATION = 20; // Rotate keys every 20 calls
  private readonly MAX_CYCLES_BEFORE_FALLBACK = 2; // Try cycling through all keys 2 times before fallback

  // API failure tracking
  private allKeysFailedTimestamp: number | null = null;
  private apiFailureNotificationShown: boolean = false;

  // Caching
  private teamIdCache: Map<string, { id: number; data: any; timestamp: number }> = new Map();
  private cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours
  private readonly CACHE_STORAGE_KEY = 'robotevents_team_cache';

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
    const teamBrowserKeys: string[] = [];

    // Load numbered general API keys (1-20)
    // Note: Must explicitly reference each env var for Expo's build-time bundling
    const generalEnvKeys = [
      process.env.EXPO_PUBLIC_ROBOTEVENTS_API_KEY_1,
      process.env.EXPO_PUBLIC_ROBOTEVENTS_API_KEY_2,
      process.env.EXPO_PUBLIC_ROBOTEVENTS_API_KEY_3,
      process.env.EXPO_PUBLIC_ROBOTEVENTS_API_KEY_4,
      process.env.EXPO_PUBLIC_ROBOTEVENTS_API_KEY_5,
      process.env.EXPO_PUBLIC_ROBOTEVENTS_API_KEY_6,
      process.env.EXPO_PUBLIC_ROBOTEVENTS_API_KEY_7,
      process.env.EXPO_PUBLIC_ROBOTEVENTS_API_KEY_8,
      process.env.EXPO_PUBLIC_ROBOTEVENTS_API_KEY_9,
      process.env.EXPO_PUBLIC_ROBOTEVENTS_API_KEY_10,
      process.env.EXPO_PUBLIC_ROBOTEVENTS_API_KEY_11,
      process.env.EXPO_PUBLIC_ROBOTEVENTS_API_KEY_12,
      process.env.EXPO_PUBLIC_ROBOTEVENTS_API_KEY_13,
      process.env.EXPO_PUBLIC_ROBOTEVENTS_API_KEY_14,
      process.env.EXPO_PUBLIC_ROBOTEVENTS_API_KEY_15,
      process.env.EXPO_PUBLIC_ROBOTEVENTS_API_KEY_16,
      process.env.EXPO_PUBLIC_ROBOTEVENTS_API_KEY_17,
      process.env.EXPO_PUBLIC_ROBOTEVENTS_API_KEY_18,
      process.env.EXPO_PUBLIC_ROBOTEVENTS_API_KEY_19,
      process.env.EXPO_PUBLIC_ROBOTEVENTS_API_KEY_20,
    ];

    for (const key of generalEnvKeys) {
      if (key && key.trim()) {
        keys.push(key.trim());
      }
    }

    // Load numbered team browser API keys (1-20)
    const teamBrowserEnvKeys = [
      process.env.EXPO_PUBLIC_ROBOTEVENTS_TEAM_BROWSER_KEY_1,
      process.env.EXPO_PUBLIC_ROBOTEVENTS_TEAM_BROWSER_KEY_2,
      process.env.EXPO_PUBLIC_ROBOTEVENTS_TEAM_BROWSER_KEY_3,
      process.env.EXPO_PUBLIC_ROBOTEVENTS_TEAM_BROWSER_KEY_4,
      process.env.EXPO_PUBLIC_ROBOTEVENTS_TEAM_BROWSER_KEY_5,
      process.env.EXPO_PUBLIC_ROBOTEVENTS_TEAM_BROWSER_KEY_6,
      process.env.EXPO_PUBLIC_ROBOTEVENTS_TEAM_BROWSER_KEY_7,
      process.env.EXPO_PUBLIC_ROBOTEVENTS_TEAM_BROWSER_KEY_8,
      process.env.EXPO_PUBLIC_ROBOTEVENTS_TEAM_BROWSER_KEY_9,
      process.env.EXPO_PUBLIC_ROBOTEVENTS_TEAM_BROWSER_KEY_10,
      process.env.EXPO_PUBLIC_ROBOTEVENTS_TEAM_BROWSER_KEY_11,
      process.env.EXPO_PUBLIC_ROBOTEVENTS_TEAM_BROWSER_KEY_12,
      process.env.EXPO_PUBLIC_ROBOTEVENTS_TEAM_BROWSER_KEY_13,
      process.env.EXPO_PUBLIC_ROBOTEVENTS_TEAM_BROWSER_KEY_14,
      process.env.EXPO_PUBLIC_ROBOTEVENTS_TEAM_BROWSER_KEY_15,
      process.env.EXPO_PUBLIC_ROBOTEVENTS_TEAM_BROWSER_KEY_16,
      process.env.EXPO_PUBLIC_ROBOTEVENTS_TEAM_BROWSER_KEY_17,
      process.env.EXPO_PUBLIC_ROBOTEVENTS_TEAM_BROWSER_KEY_18,
      process.env.EXPO_PUBLIC_ROBOTEVENTS_TEAM_BROWSER_KEY_19,
      process.env.EXPO_PUBLIC_ROBOTEVENTS_TEAM_BROWSER_KEY_20,
    ];

    for (const key of teamBrowserEnvKeys) {
      if (key && key.trim()) {
        teamBrowserKeys.push(key.trim());
      }
    }

    if (keys.length === 0) {
      const legacyKey = process.env.EXPO_PUBLIC_ROBOTEVENTS_API_KEY;
      if (legacyKey && legacyKey.trim()) {
        keys.push(legacyKey.trim());
      }
    }

    this.apiKeys = keys;
    this.teamBrowserApiKeys = teamBrowserKeys;

    logger.debug('Loaded', this.apiKeys.length, 'general API keys for rotation');
    logger.debug('Loaded', this.teamBrowserApiKeys.length, 'team browser API keys for rotation');

    if (this.apiKeys.length === 0) {
      logger.warn('No general API keys found! API calls will fail.');
    }

    if (this.teamBrowserApiKeys.length === 0) {
      logger.debug('No team browser API keys found. Will fall back to general keys for team browser operations.');
    }
  }

  private getCurrentApiKey(allowTeamBrowserFallback: boolean = true): string | null {
    if (this.apiKeys.length === 0) {
      // No general keys available, try team browser pool as fallback
      if (allowTeamBrowserFallback && this.teamBrowserApiKeys.length > 0) {
        logger.warn('No general keys available, falling back to team browser pool');
        return this.getTeamBrowserApiKey();
      }
      return null;
    }

    // Reset failed keys periodically
    const now = Date.now();
    if (now - this.lastKeyResetTime > this.keyResetTime) {
      logger.debug('Resetting general failed keys list and cycle tracking');
      this.failedKeys.clear();
      this.lastKeyResetTime = now;
      this.generalCycleAttempts = 0;
      this.generalSuccessfulCallsInCurrentCycle = 0;
      this.generalConsecutiveFailedCycles = 0;
    }

    // Rotate to next key every 20 calls to distribute load
    if (this.generalKeyCallsSinceRotation >= this.CALLS_BEFORE_ROTATION && this.apiKeys.length > 1) {
      const oldIndex = this.currentKeyIndex;
      this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
      this.generalKeyCallsSinceRotation = 0;
      logger.debug('Auto-rotating general key from', oldIndex + 1, 'to', this.currentKeyIndex + 1, 'after', this.CALLS_BEFORE_ROTATION, 'calls');
    }

    // Find next available key that hasn't failed
    let attempts = 0;
    const startIndex = this.currentKeyIndex;
    while (attempts < this.apiKeys.length) {
      if (!this.failedKeys.has(this.currentKeyIndex)) {
        logger.debug(`Using General Pool - Key #${this.currentKeyIndex + 1}/${this.apiKeys.length} (failed keys: ${this.failedKeys.size}/${this.apiKeys.length})`);
        this.generalKeyUsageCount++;
        this.generalKeyCallsSinceRotation++;
        return this.apiKeys[this.currentKeyIndex];
      }

      logger.debug(`Skipping General Pool - Key #${this.currentKeyIndex + 1} (marked as failed), trying next...`);
      this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
      attempts++;
    }

    logger.debug(`All ${this.apiKeys.length} general keys have been marked as failed in this cycle`);

    // All keys in current cycle have failed
    this.generalCycleAttempts++;

    // Check if this cycle had any successful calls
    if (this.generalSuccessfulCallsInCurrentCycle === 0) {
      this.generalConsecutiveFailedCycles++;
      logger.warn('Completed cycle', this.generalCycleAttempts, 'with 0 successful calls (consecutive failed cycles:', this.generalConsecutiveFailedCycles, ')');
    } else {
      logger.debug('Completed cycle', this.generalCycleAttempts, 'with', this.generalSuccessfulCallsInCurrentCycle, 'successful calls - resetting consecutive failed cycle count');
      this.generalConsecutiveFailedCycles = 0; // Reset if we had any successes
    }

    // Check if we should try another cycle or fall back
    const shouldFallback = this.generalConsecutiveFailedCycles >= this.MAX_CYCLES_BEFORE_FALLBACK;

    if (shouldFallback && allowTeamBrowserFallback && this.teamBrowserApiKeys.length > 0) {
      logger.warn('All general keys failed for', this.generalConsecutiveFailedCycles, 'consecutive cycles with no successful calls, falling back to team browser pool');
      const browserKey = this.getTeamBrowserApiKey();

      if (!browserKey && this.checkIfAllKeysFailed()) {
        this.handleAllKeysFailure();
      }

      // Reset cycle tracking for next attempt
      this.failedKeys.clear();
      this.currentKeyIndex = 0;
      this.generalCycleAttempts = 0;
      this.generalSuccessfulCallsInCurrentCycle = 0;
      this.generalConsecutiveFailedCycles = 0;
      return browserKey;
    }

    // Try another cycle through the keys
    logger.debug('Resetting failed keys and trying another cycle (consecutive failed cycles:', this.generalConsecutiveFailedCycles, '/', this.MAX_CYCLES_BEFORE_FALLBACK, ')');
    this.failedKeys.clear();
    this.currentKeyIndex = 0;
    this.generalSuccessfulCallsInCurrentCycle = 0; // Reset success counter for new cycle

    // Return first key to try again
    this.generalKeyUsageCount++;
    this.generalKeyCallsSinceRotation++;
    return this.apiKeys[0];
  }

  private markCurrentKeyAsFailed(): void {
    logger.warn(`Marking General Pool - Key #${this.currentKeyIndex + 1} as failed`);
    this.failedKeys.add(this.currentKeyIndex);
    this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
  }

  /**
   * Get current team browser API key with rotation (no fallback)
   */
  private getTeamBrowserApiKey(): string | null {
    if (this.teamBrowserApiKeys.length === 0) {
      logger.debug('No team browser keys available');
      return null;
    }

    // Reset failed keys periodically
    const now = Date.now();
    if (now - this.teamBrowserLastKeyResetTime > this.keyResetTime) {
      logger.debug('Resetting team browser failed keys list and cycle tracking');
      this.teamBrowserFailedKeys.clear();
      this.teamBrowserLastKeyResetTime = now;
      this.teamBrowserCycleAttempts = 0;
      this.teamBrowserSuccessfulCallsInCurrentCycle = 0;
      this.teamBrowserConsecutiveFailedCycles = 0;
    }

    // Rotate to next key every 20 calls to distribute load
    if (this.teamBrowserKeyCallsSinceRotation >= this.CALLS_BEFORE_ROTATION && this.teamBrowserApiKeys.length > 1) {
      const oldIndex = this.teamBrowserCurrentKeyIndex;
      this.teamBrowserCurrentKeyIndex = (this.teamBrowserCurrentKeyIndex + 1) % this.teamBrowserApiKeys.length;
      this.teamBrowserKeyCallsSinceRotation = 0;
      logger.debug('Auto-rotating team browser key from', oldIndex + 1, 'to', this.teamBrowserCurrentKeyIndex + 1, 'after', this.CALLS_BEFORE_ROTATION, 'calls');
    }

    // Find next available key that hasn't failed
    let attempts = 0;
    const startIndex = this.teamBrowserCurrentKeyIndex;
    while (attempts < this.teamBrowserApiKeys.length) {
      if (!this.teamBrowserFailedKeys.has(this.teamBrowserCurrentKeyIndex)) {
        logger.debug(`Using Team Browser Pool - Key #${this.teamBrowserCurrentKeyIndex + 1}/${this.teamBrowserApiKeys.length} (failed keys: ${this.teamBrowserFailedKeys.size}/${this.teamBrowserApiKeys.length})`);
        this.teamBrowserKeyUsageCount++;
        this.teamBrowserKeyCallsSinceRotation++;
        return this.teamBrowserApiKeys[this.teamBrowserCurrentKeyIndex];
      }

      logger.debug(`Skipping Team Browser Pool - Key #${this.teamBrowserCurrentKeyIndex + 1} (marked as failed), trying next...`);
      this.teamBrowserCurrentKeyIndex = (this.teamBrowserCurrentKeyIndex + 1) % this.teamBrowserApiKeys.length;
      attempts++;
    }

    logger.debug(`All ${this.teamBrowserApiKeys.length} team browser keys have been marked as failed in this cycle`);

    // All keys in current cycle have failed
    this.teamBrowserCycleAttempts++;

    // Check if this cycle had any successful calls
    if (this.teamBrowserSuccessfulCallsInCurrentCycle === 0) {
      this.teamBrowserConsecutiveFailedCycles++;
      logger.warn('Completed cycle', this.teamBrowserCycleAttempts, 'with 0 successful calls (consecutive failed cycles:', this.teamBrowserConsecutiveFailedCycles, ')');
    } else {
      logger.debug('Completed cycle', this.teamBrowserCycleAttempts, 'with', this.teamBrowserSuccessfulCallsInCurrentCycle, 'successful calls - resetting consecutive failed cycle count');
      this.teamBrowserConsecutiveFailedCycles = 0; // Reset if we had any successes
    }

    // Check if we've had too many consecutive failed cycles
    const shouldGiveUp = this.teamBrowserConsecutiveFailedCycles >= this.MAX_CYCLES_BEFORE_FALLBACK;

    if (shouldGiveUp) {
      logger.error('All team browser keys failed for', this.teamBrowserConsecutiveFailedCycles, 'consecutive cycles with no successful calls');

      // Reset cycle tracking
      this.teamBrowserFailedKeys.clear();
      this.teamBrowserCurrentKeyIndex = 0;
      this.teamBrowserCycleAttempts = 0;
      this.teamBrowserSuccessfulCallsInCurrentCycle = 0;
      this.teamBrowserConsecutiveFailedCycles = 0;

      // Return null - caller should handle the failure
      return null;
    }

    // Try another cycle through the keys
    logger.debug('Resetting failed team browser keys and trying another cycle (consecutive failed cycles:', this.teamBrowserConsecutiveFailedCycles, '/', this.MAX_CYCLES_BEFORE_FALLBACK, ')');
    this.teamBrowserFailedKeys.clear();
    this.teamBrowserCurrentKeyIndex = 0;
    this.teamBrowserSuccessfulCallsInCurrentCycle = 0; // Reset success counter for new cycle

    // Return first key to try again
    this.teamBrowserKeyUsageCount++;
    this.teamBrowserKeyCallsSinceRotation++;
    return this.teamBrowserApiKeys[0];
  }

  private markTeamBrowserKeyAsFailed(): void {
    if (this.teamBrowserApiKeys.length > 0) {
      logger.warn(`Marking Team Browser Pool - Key #${this.teamBrowserCurrentKeyIndex + 1} as failed`);
      this.teamBrowserFailedKeys.add(this.teamBrowserCurrentKeyIndex);
      this.teamBrowserCurrentKeyIndex = (this.teamBrowserCurrentKeyIndex + 1) % this.teamBrowserApiKeys.length;
    } else {
      // Fall back to marking general key as failed
      this.markCurrentKeyAsFailed();
    }
  }

  /**
   * Get API usage statistics for developer mode
   */
  public getApiUsageStats() {
    return {
      general: {
        totalKeys: this.apiKeys.length,
        currentKeyIndex: this.currentKeyIndex + 1,
        failedKeys: this.failedKeys.size,
        usageCount: this.generalKeyUsageCount,
      },
      teamBrowser: {
        totalKeys: this.teamBrowserApiKeys.length,
        currentKeyIndex: this.teamBrowserCurrentKeyIndex + 1,
        failedKeys: this.teamBrowserFailedKeys.size,
        usageCount: this.teamBrowserKeyUsageCount,
      },
    };
  }

  /**
   * Reset API usage statistics
   */
  public resetApiUsageStats(): void {
    this.generalKeyUsageCount = 0;
    this.teamBrowserKeyUsageCount = 0;
    logger.debug('API usage statistics reset');
  }

  /**
   * Check if all API keys have failed across both pools
   */
  private checkIfAllKeysFailed(): boolean {
    const allGeneralKeysFailed = this.apiKeys.length > 0 && this.failedKeys.size >= this.apiKeys.length;
    const allBrowserKeysFailed = this.teamBrowserApiKeys.length > 0 && this.teamBrowserFailedKeys.size >= this.teamBrowserApiKeys.length;

    if (this.apiKeys.length > 0 && this.teamBrowserApiKeys.length > 0) {
      return allGeneralKeysFailed && allBrowserKeysFailed;
    }

    if (this.apiKeys.length > 0 && this.teamBrowserApiKeys.length === 0) {
      return allGeneralKeysFailed;
    }

    if (this.apiKeys.length === 0 && this.teamBrowserApiKeys.length > 0) {
      return allBrowserKeysFailed;
    }

    // No keys at all
    return this.apiKeys.length === 0 && this.teamBrowserApiKeys.length === 0;
  }

  /**
   * Mark that all keys have failed and trigger limited mode
   */
  private handleAllKeysFailure(): void {
    if (!this.allKeysFailedTimestamp) {
      this.allKeysFailedTimestamp = Date.now();
      logger.error('⚠️ CRITICAL: All API keys have failed across both pools!');
      logger.error('App will enter limited mode temporarily.');
    }
  }

  /**
   * Check if API is currently in failure state
   */
  public isInFailureState(): boolean {
    return this.allKeysFailedTimestamp !== null;
  }

  /**
   * Get failure information for display to user
   */
  public getFailureInfo(): {
    inFailure: boolean;
    timestamp: number | null;
    message: string;
    shouldShowNotification: boolean;
  } {
    const inFailure = this.isInFailureState();

    if (!inFailure) {
      return {
        inFailure: false,
        timestamp: null,
        message: '',
        shouldShowNotification: false
      };
    }

    const shouldShow = !this.apiFailureNotificationShown;

    return {
      inFailure: true,
      timestamp: this.allKeysFailedTimestamp,
      message: `All API keys have been rate-limited or are unavailable. Some features may be temporarily limited. This will reset automatically when you restart the app, or keys may recover within an hour. Note: This does not affect programs with permanent limited mode settings.`,
      shouldShowNotification: shouldShow
    };
  }

  /**
   * Mark notification as shown
   */
  public markNotificationShown(): void {
    this.apiFailureNotificationShown = true;
  }

  /**
   * Reset failure state (called on app launch)
   *
   * IMPORTANT: This resets the TEMPORARY API failure state caused by rate limiting
   * or key exhaustion. This does NOT affect program-specific limited mode settings
   * configured in programMappings.ts (e.g., Aerial Drone Competition).
   *
   * Program limited mode is permanent until manually changed in code.
   * API failure mode is temporary and resets on app restart.
   */
  public resetFailureState(): void {
    logger.debug('Resetting TEMPORARY API failure state on app launch');
    logger.debug('NOTE: This does NOT reset program-specific limited mode from programMappings');
    this.allKeysFailedTimestamp = null;
    this.apiFailureNotificationShown = false;
    this.failedKeys.clear();
    this.teamBrowserFailedKeys.clear();
    this.currentKeyIndex = 0;
    this.teamBrowserCurrentKeyIndex = 0;
    this.generalCycleAttempts = 0;
    this.generalSuccessfulCallsInCurrentCycle = 0;
    this.generalConsecutiveFailedCycles = 0;
    this.teamBrowserCycleAttempts = 0;
    this.teamBrowserSuccessfulCallsInCurrentCycle = 0;
    this.teamBrowserConsecutiveFailedCycles = 0;
  }

  private getProgramId(program: string): number {
    const programId = getProgramId(program);
    logger.debug('Getting program ID for', program || 'Unknown', ':', programId);
    return programId;
  }

  private getDefaultSeasonId(program: string): number {
    const defaults: Record<string, number> = {
      'VEX IQ Robotics Competition': 173,
      'VEX V5 Robotics Competition': 173,
      'VEX U Robotics Competition': 173,
      'VEX AI Robotics Competition': 173,
    };
    return defaults[program] || 173;
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
      // logger.debug('[DEBUG] Stack trace:', stackLines);

      // Try to find the first line that contains src/ or src\ (for native/Windows)
      // or http://localhost for web/Chrome
      for (let i = 0; i < stackLines.length; i++) {
        const line = stackLines[i];

        // Skip internal API files
        if (line.includes('robotEventsApi.ts') ||
            line.includes('recfEventsAPI.ts') ||
            line.includes('apiRouter.ts')) {
          continue;
        }

        // Chrome format: at functionName (http://localhost:....:lineNumber:columnNumber)
        // or: at async functionName (http://localhost:....:lineNumber:columnNumber)
        let match = line.match(/at\s+(?:async\s+)?(\w+)\s+\(.*?:(\d+):\d+\)/);
        if (match) {
          const functionName = match[1];
          const lineNumber = match[2];
          return `${functionName}():${lineNumber}`;
        }

        // Web/Chrome format: at functionName (http://localhost:8081/src/path/file.tsx:123:45)
        match = line.match(/http:\/\/[^/]+\/src\/([\w/]+\.tsx?):(\d+)/);
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

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers,
      });

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

      try {
        const result = JSON.parse(responseText);
        // Track successful call for general pool (current cycle)
        this.generalSuccessfulCallsInCurrentCycle++;
        return result;
      } catch (parseError) {
        logger.error('JSON parse error for endpoint:', endpoint || 'Unknown');
        logger.error('Full URL:', url.toString());
        logger.error('Parse error details:', parseError);
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
      logger.error('Request failed for endpoint:', endpoint || 'Unknown');
      logger.error('Full URL:', url.toString());
      logger.error('Error details:', error);
      throw error;
    }
  }

  /**
   * Team Browser request method - uses dedicated team browser API keys
   * Identical to regular request but uses team browser key pool
   */
  private async teamBrowserRequest<T>(endpoint: string, params: Record<string, any> = {}, retryCount: number = 0): Promise<T> {

    // Rate limiting
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.requestDelay) {
      const delayNeeded = this.requestDelay - timeSinceLastRequest;
      logger.debug('[Team Browser] Rate limiting: waiting', delayNeeded, 'ms before request');
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

    const currentApiKey = this.getTeamBrowserApiKey();
    if (currentApiKey) {
      headers['Authorization'] = `Bearer ${currentApiKey}`;
    }

    logger.debug('[Team Browser] Making request to endpoint:', endpoint || 'Unknown');
    const poolType = this.teamBrowserApiKeys.length > 0 ? 'Team Browser Pool' : 'General Pool (fallback)';
    const keyNum = this.teamBrowserApiKeys.length > 0 ? this.teamBrowserCurrentKeyIndex + 1 : this.currentKeyIndex + 1;
    const totalKeys = this.teamBrowserApiKeys.length > 0 ? this.teamBrowserApiKeys.length : this.apiKeys.length;
    logger.debug(`[Team Browser] Using ${poolType} - Key #${keyNum}/${totalKeys}`);

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers,
      });

      logger.debug('[Team Browser] Response status:', response.status);

      // Handle rate limiting responses
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 5000;
        logger.warn('[Team Browser] Rate limited! Waiting', waitTime, 'ms before retry');
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return this.teamBrowserRequest(endpoint, params, retryCount);
      }

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('[Team Browser] Error response body:', errorText);

        // Check if it's an HTML login page (indicates auth failure)
        if (errorText.includes('<!DOCTYPE html>') && errorText.includes('login')) {
          logger.warn('[Team Browser] Authentication failed with current key, marking as failed');
          this.markTeamBrowserKeyAsFailed();

          // Retry with next key if we haven't exceeded retry limit
          const maxRetries = this.teamBrowserApiKeys.length > 0 ? this.teamBrowserApiKeys.length - 1 : this.apiKeys.length - 1;
          if (retryCount < maxRetries) {
            logger.debug('[Team Browser] Retrying with next API key (attempt', retryCount + 1, ')');
            return this.teamBrowserRequest(endpoint, params, retryCount + 1);
          }

          throw new Error(`[Team Browser] API Authentication failed - all API keys may be expired or invalid`);
        }

        throw new Error(`[Team Browser] HTTP error! status: ${response.status}, body: ${errorText}`);
      }

      const responseText = await response.text();
      logger.debug('[Team Browser] Response body length:', responseText.length, 'characters');

      try {
        const result = JSON.parse(responseText);
        // Track successful call for team browser pool (current cycle)
        this.teamBrowserSuccessfulCallsInCurrentCycle++;
        return result;
      } catch (parseError) {
        logger.error('[Team Browser] JSON parse error for endpoint:', endpoint || 'Unknown');
        logger.error('[Team Browser] Parse error details:', parseError);

        if (responseText.includes('<!DOCTYPE html>')) {
          logger.warn('[Team Browser] Received HTML instead of JSON, marking current key as failed');
          this.markTeamBrowserKeyAsFailed();

          // Retry with next key if we haven't exceeded retry limit
          const maxRetries = this.teamBrowserApiKeys.length > 0 ? this.teamBrowserApiKeys.length - 1 : this.apiKeys.length - 1;
          if (retryCount < maxRetries) {
            logger.debug('[Team Browser] Retrying with next API key (attempt', retryCount + 1, ')');
            return this.teamBrowserRequest(endpoint, params, retryCount + 1);
          }

          throw new Error(`[Team Browser] JSON parse error - received HTML instead of JSON, all API keys failed: ${parseError}`);
        }

        throw new Error(`[Team Browser] JSON parse error: ${parseError}`);
      }
    } catch (error) {
      logger.error('[Team Browser] Request failed for endpoint:', endpoint || 'Unknown');
      logger.error('[Team Browser] Error details:', error);
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
  // PROGRAMS API
  // =============================================================================

  /**
   * Get all programs
   * GET /programs
   */
  public async getPrograms(filters?: ProgramFilters): Promise<ProgramsResponse> {
    try {
      const params: Record<string, any> = {};

      if (filters?.id) params.id = filters.id;
      if (filters?.page) params.page = filters.page;
      if (filters?.per_page) params.per_page = filters.per_page;

      const response = await this.request<ProgramsResponse>('/programs', params);
      return response;
    } catch (error) {
      logger.error('Failed to get programs:', error);
      return { data: [], meta: {} as any };
    }
  }

  /**
   * Get single program by ID
   * GET /programs/{id}
   */
  public async getProgramById(programId: number): Promise<Program | null> {
    try {
      const response = await this.request<Program>(`/programs/${programId}`);
      return response;
    } catch (error) {
      logger.error('Failed to get program', programId || 'Unknown', ':', error);
      return null;
    }
  }

  // =============================================================================
  // SEASONS API
  // =============================================================================

  /**
   * Get all seasons
   * GET /seasons
   */
  public async getSeasons(filters?: SeasonFilters): Promise<SeasonsResponse> {
    try {
      const params: Record<string, any> = {};

      if (filters?.id) params.id = filters.id;
      if (filters?.program) params.program = filters.program;
      if (filters?.team) params.team = filters.team;
      if (filters?.start) params.start = filters.start;
      if (filters?.end) params.end = filters.end;
      if (filters?.active !== undefined) params.active = filters.active;
      if (filters?.page) params.page = filters.page;
      if (filters?.per_page) params.per_page = filters.per_page;

      const response = await this.request<SeasonsResponse>('/seasons', params);
      return response;
    } catch (error) {
      logger.error('Failed to get seasons:', error);
      return { data: [], meta: {} as any };
    }
  }

  /**
   * Get single season by ID
   * GET /seasons/{id}
   */
  public async getSeasonById(seasonId: number): Promise<Season | null> {
    try {
      const response = await this.request<Season>(`/seasons/${seasonId}`);
      return response;
    } catch (error) {
      logger.error('Failed to get season', seasonId || 'Unknown', ':', error);
      return null;
    }
  }

  /**
   * Get events for a season
   * GET /seasons/{id}/events
   */
  public async getSeasonEvents(seasonId: number, filters?: EventFilters): Promise<EventsResponse> {
    try {
      const params: Record<string, any> = {};

      if (filters?.sku) params.sku = filters.sku;
      if (filters?.team) params.team = filters.team;
      if (filters?.start) params.start = filters.start;
      if (filters?.end) params.end = filters.end;
      if (filters?.level) params.level = filters.level;
      if (filters?.page) params.page = filters.page;
      if (filters?.per_page) params.per_page = filters.per_page;

      const response = await this.request<EventsResponse>(`/seasons/${seasonId}/events`, params);
      return response;
    } catch (error) {
      logger.error('Failed to get events for season', seasonId || 'Unknown', ':', error);
      return { data: [], meta: {} as any };
    }
  }

  /**
   * Get current season ID for a program
   */
  public async getCurrentSeasonId(program?: string): Promise<number> {
    try {
      const selectedProgram = program || this.selectedProgram;
      const programId = this.getProgramId(selectedProgram);

      const response = await this.getSeasons({
        program: [programId],
        per_page: 1
      });

      const currentSeason = response.data?.[0];
      return currentSeason?.id || this.getDefaultSeasonId(selectedProgram);
    } catch (error) {
      logger.error('Failed to get current season:', error);
      return this.getDefaultSeasonId(program || this.selectedProgram);
    }
  }

  // =============================================================================
  // EVENTS API
  // =============================================================================

  /**
   * Get all events
   * GET /events
   */
  public async getEvents(filters?: EventFilters): Promise<EventsResponse> {
    try {
      const params: Record<string, any> = {};

      if (filters?.id) params.id = filters.id;
      if (filters?.sku) params.sku = filters.sku;
      if (filters?.team) params.team = filters.team;
      if (filters?.season) params.season = filters.season;
      if (filters?.start) params.start = filters.start;
      if (filters?.end) params.end = filters.end;
      if (filters?.region) params.region = filters.region;
      if (filters?.level) params.level = filters.level;
      if (filters?.myEvents !== undefined) params.myEvents = filters.myEvents;
      if (filters?.eventTypes) params.eventTypes = filters.eventTypes;
      if (filters?.program) params.program = filters.program;
      if (filters?.search) params.search = filters.search;
      if (filters?.page) params.page = filters.page;
      if (filters?.per_page) params.per_page = filters.per_page;

      const response = await this.request<EventsResponse>('/events', params);
      return response;
    } catch (error) {
      logger.error('Failed to get events:', error);
      return { data: [], meta: {} as any };
    }
  }

  /**
   * Get single event by ID
   * GET /events/{id}
   */
  public async getEventById(eventId: number): Promise<Event | null> {
    try {
      const response = await this.request<Event>(`/events/${eventId}`);
      return response;
    } catch (error) {
      logger.error('Failed to get event', eventId || 'Unknown', ':', error);
      return null;
    }
  }

  /**
   * Get teams for an event
   * GET /events/{id}/teams
   */
  public async getEventTeams(eventId: number, filters?: EventTeamFilters): Promise<TeamsResponse> {
    try {
      const params: Record<string, any> = {};

      if (filters?.number) params.number = filters.number;
      if (filters?.registered !== undefined) params.registered = filters.registered;
      if (filters?.grade) params.grade = filters.grade;
      if (filters?.country) params.country = filters.country;
      if (filters?.myTeams !== undefined) params.myTeams = filters.myTeams;
      if (filters?.page) params.page = filters.page;
      if (filters?.per_page) params.per_page = filters.per_page;

      const response = await this.request<TeamsResponse>(`/events/${eventId}/teams`, params);
      return response;
    } catch (error) {
      logger.error('Failed to get teams for event', eventId || 'Unknown', ':', error);
      return { data: [], meta: {} as any };
    }
  }

  /**
   * Get skills for an event
   * GET /events/{id}/skills
   */
  public async getEventSkills(eventId: number, filters?: SkillFilters): Promise<SkillsResponse> {
    try {
      const params: Record<string, any> = {};

      if (filters?.team) params.team = filters.team;
      if (filters?.type) params.type = filters.type;
      if (filters?.page) params.page = filters.page;
      if (filters?.per_page) params.per_page = filters.per_page;

      const response = await this.request<SkillsResponse>(`/events/${eventId}/skills`, params);
      return response;
    } catch (error) {
      logger.error('Failed to get skills for event', eventId || 'Unknown', ':', error);
      return { data: [], meta: {} as any };
    }
  }

  /**
   * Get awards for an event
   * GET /events/{id}/awards
   */
  public async getEventAwards(eventId: number, filters?: AwardFilters): Promise<AwardsResponse> {
    try {
      const params: Record<string, any> = {};

      if (filters?.team) params.team = filters.team;
      if (filters?.winner) params.winner = filters.winner;
      if (filters?.page) params.page = filters.page;
      if (filters?.per_page) params.per_page = filters.per_page;

      const response = await this.request<AwardsResponse>(`/events/${eventId}/awards`, params);
      return response;
    } catch (error) {
      logger.error('Failed to get awards for event', eventId || 'Unknown', ':', error);
      return { data: [], meta: {} as any };
    }
  }

  /**
   * Get matches for a division in an event
   * GET /events/{id}/divisions/{div}/matches
   */
  public async getEventDivisionMatches(eventId: number, divisionId: number, filters?: MatchFilters): Promise<MatchesResponse> {
    try {
      const params: Record<string, any> = {};

      if (filters?.team) params.team = filters.team;
      if (filters?.round) params.round = filters.round;
      if (filters?.instance) params.instance = filters.instance;
      if (filters?.matchnum) params.matchnum = filters.matchnum;
      if (filters?.page) params.page = filters.page;
      if (filters?.per_page) params.per_page = filters.per_page;

      const response = await this.request<MatchesResponse>(`/events/${eventId}/divisions/${divisionId}/matches`, params);
      return response;
    } catch (error) {
      logger.error('Failed to get matches for event', eventId || 'Unknown', ', division', divisionId || 'Unknown', ':', error);
      return { data: [], meta: {} as any };
    }
  }

  /**
   * Get finalist rankings for a division in an event
   * GET /events/{id}/divisions/{div}/finalistRankings
   */
  public async getEventDivisionFinalistRankings(eventId: number, divisionId: number, filters?: RankingFilters): Promise<RankingsResponse> {
    try {
      const params: Record<string, any> = {};

      if (filters?.team) params.team = filters.team;
      if (filters?.rank) params.rank = filters.rank;
      if (filters?.page) params.page = filters.page;
      if (filters?.per_page) params.per_page = filters.per_page;

      const response = await this.request<RankingsResponse>(`/events/${eventId}/divisions/${divisionId}/finalistRankings`, params);
      return response;
    } catch (error) {
      logger.error('Failed to get finalist rankings for event', eventId || 'Unknown', ', division', divisionId || 'Unknown', ':', error);
      return { data: [], meta: {} as any };
    }
  }

  /**
   * Get rankings for a division in an event
   * GET /events/{id}/divisions/{div}/rankings
   */
  public async getEventDivisionRankings(eventId: number, divisionId: number, filters?: RankingFilters): Promise<RankingsResponse> {
    try {
      let allRankings: Ranking[] = [];
      let currentPage = 1;
      let hasMorePages = true;

      while (hasMorePages) {
        const params: Record<string, any> = {
          page: currentPage,
          per_page: 250
        };

        if (filters?.team) params.team = filters.team;
        if (filters?.rank) params.rank = filters.rank;

        const response = await this.request<RankingsResponse>(`/events/${eventId}/divisions/${divisionId}/rankings`, params);

        if (!response.data || response.data.length === 0) {
          hasMorePages = false;
        } else {
          allRankings.push(...response.data);

          // Check if we have more pages based on pagination metadata
          if (response.meta && response.meta.current_page && response.meta.last_page) {
            hasMorePages = response.meta.current_page < response.meta.last_page;
          } else {
            hasMorePages = response.data.length === 250;
          }

          currentPage++;

          // Safety check to prevent infinite loops
          if (currentPage > 200) {
            logger.warn('Reached maximum page limit (200), stopping pagination');
            break;
          }
        }
      }

      logger.debug('Total rankings fetched:', allRankings.length);

      // Return in the expected format
      return {
        data: allRankings,
        meta: {
          current_page: 1,
          total: allRankings.length,
          per_page: allRankings.length,
          last_page: 1
        } as any
      };
    } catch (error) {
      logger.error('Failed to get rankings for event', eventId || 'Unknown', ', division', divisionId || 'Unknown', ':', error);
      return { data: [], meta: {} as any };
    }
  }

  // =============================================================================
  // TEAMS API
  // =============================================================================

  /**
   * Get all teams
   * GET /teams
   */
  public async getTeams(filters?: TeamFilters): Promise<TeamsResponse> {
    try {
      const params: Record<string, any> = {};

      if (filters?.id) params.id = filters.id;
      if (filters?.number) params.number = filters.number;
      if (filters?.event) params.event = filters.event;
      if (filters?.registered !== undefined) params.registered = filters.registered;
      if (filters?.program) params.program = filters.program;
      if (filters?.grade) params.grade = filters.grade;
      if (filters?.country) params.country = filters.country;
      if (filters?.myTeams !== undefined) params.myTeams = filters.myTeams;
      if (filters?.page) params.page = filters.page;
      if (filters?.per_page) params.per_page = filters.per_page;

      const response = await this.request<TeamsResponse>('/teams', params);
      return response;
    } catch (error) {
      logger.error('Failed to get teams:', error);
      return { data: [], meta: {} as any };
    }
  }

  /**
   * Get teams using team browser dedicated API keys
   * Identical to getTeams but uses the team browser key pool
   * Use this for bulk team loading in the team browser feature
   */
  public async getTeamsForBrowser(filters?: TeamFilters): Promise<TeamsResponse> {
    try {
      const params: Record<string, any> = {};

      if (filters?.id) params.id = filters.id;
      if (filters?.number) params.number = filters.number;
      if (filters?.event) params.event = filters.event;
      if (filters?.registered !== undefined) params.registered = filters.registered;
      if (filters?.program) params.program = filters.program;
      if (filters?.grade) params.grade = filters.grade;
      if (filters?.country) params.country = filters.country;
      if (filters?.myTeams !== undefined) params.myTeams = filters.myTeams;
      if (filters?.page) params.page = filters.page;
      if (filters?.per_page) params.per_page = filters.per_page;

      const response = await this.teamBrowserRequest<TeamsResponse>('/teams', params);
      return response;
    } catch (error) {
      logger.error('[Team Browser] Failed to get teams:', error);
      return { data: [], meta: {} as any };
    }
  }

  /**
   * Get single team by ID
   * GET /teams/{id}
   */
  public async getTeamById(teamId: number): Promise<Team | null> {
    try {
      const response = await this.request<Team>(`/teams/${teamId}`);
      return response;
    } catch (error) {
      logger.error('Failed to get team', teamId || 'Unknown', ':', error);
      return null;
    }
  }

  /**
   * Get team by number with caching and fallback patterns
   */
  public async getTeamByNumber(teamNumber: string, program?: string): Promise<Team | null> {
    try {
      const selectedProgram = program || this.selectedProgram;
      const programId = this.getProgramId(selectedProgram);

      logger.debug('Looking up team', teamNumber || 'Unknown', 'for program', selectedProgram || 'Unknown', '(ID:', programId || 'Unknown', ')');

      // Check cache first
      const cached = this.getCachedTeam(teamNumber, selectedProgram);
      if (cached) {
        return cached.data;
      }

      // Try multiple parameter patterns to find the team
      const patterns: TeamFilters[] = [
        // Pattern 1: Array format with program filter
        {
          number: [teamNumber],
          program: [programId],
          per_page: 250
        }
        // Note: Removed Pattern 2 (unfiltered search) to prevent cross-program contamination
      ];

      for (let i = 0; i < patterns.length; i++) {
        const filters = patterns[i];
        logger.debug('Trying pattern', i + 1, ':', filters);

        try {
          const response = await this.getTeams(filters);
          const teams = response.data || [];

          logger.debug('Pattern', i + 1, 'returned', teams.length, 'teams');

          if (teams.length > 0) {
            let selectedTeam = null;

            if (filters.program) {
              const exactMatch = teams.find((team: Team) => team.number === teamNumber);
              if (exactMatch) {
                selectedTeam = exactMatch;
                logger.debug('Found exact team match:', exactMatch.number || 'Unknown', '-', exactMatch.team_name || 'Unknown');
              }
            }

            if (!selectedTeam) {
              selectedTeam = teams[0];
              logger.debug('Using first team:', selectedTeam.number || 'Unknown', '-', selectedTeam.team_name || 'Unknown');
            }

            // Cache the successful result
            this.setCachedTeam(teamNumber, selectedProgram, selectedTeam.id, selectedTeam);

            return selectedTeam;
          }
        } catch (patternError) {
          logger.warn('Pattern', i + 1, 'failed:', patternError);

          if (patternError instanceof Error && patternError.message.includes('Authentication failed')) {
            logger.error('Authentication failed, stopping pattern attempts');
            break;
          }
        }
      }

      logger.debug('No team found for number', teamNumber || 'Unknown', 'after trying all patterns');
      return null;
    } catch (error) {
      logger.error('Failed to get team by number "' + (teamNumber || 'Unknown') + '":', error);
      return null;
    }
  }

  /**
   * Get events for a team
   * GET /teams/{id}/events
   */
  public async getTeamEvents(teamId: number, filters?: EventFilters): Promise<EventsResponse> {
    try {
      const params: Record<string, any> = {};

      if (filters?.sku) params.sku = filters.sku;
      if (filters?.season) params.season = filters.season;
      if (filters?.start) params.start = filters.start;
      if (filters?.end) params.end = filters.end;
      if (filters?.level) params.level = filters.level;
      if (filters?.page) params.page = filters.page;
      if (filters?.per_page) params.per_page = filters.per_page;

      const response = await this.request<EventsResponse>(`/teams/${teamId}/events`, params);
      return response;
    } catch (error) {
      logger.error('Failed to get events for team', teamId || 'Unknown', ':', error);
      return { data: [], meta: {} as any };
    }
  }

  /**
   * Get matches for a team
   * GET /teams/{id}/matches
   */
  public async getTeamMatches(teamId: number, filters?: MatchFilters): Promise<MatchesResponse> {
    try {
      const params: Record<string, any> = {};

      if (filters?.event) params.event = filters.event;
      if (filters?.season) params.season = filters.season;
      if (filters?.round) params.round = filters.round;
      if (filters?.instance) params.instance = filters.instance;
      if (filters?.matchnum) params.matchnum = filters.matchnum;
      if (filters?.page) params.page = filters.page;
      if (filters?.per_page) params.per_page = filters.per_page;

      const response = await this.request<MatchesResponse>(`/teams/${teamId}/matches`, params);
      return response;
    } catch (error) {
      logger.error('Failed to get matches for team', teamId || 'Unknown', ':', error);
      return { data: [], meta: {} as any };
    }
  }

  /**
   * Get rankings for a team
   * GET /teams/{id}/rankings
   */
  public async getTeamRankings(teamId: number, filters?: RankingFilters): Promise<RankingsResponse> {
    try {
      const params: Record<string, any> = {};

      if (filters?.event) params.event = filters.event;
      if (filters?.rank) params.rank = filters.rank;
      if (filters?.season) params.season = filters.season;
      if (filters?.page) params.page = filters.page;
      if (filters?.per_page) params.per_page = filters.per_page;

      const response = await this.request<RankingsResponse>(`/teams/${teamId}/rankings`, params);
      return response;
    } catch (error) {
      logger.error('Failed to get rankings for team', teamId || 'Unknown', ':', error);
      return { data: [], meta: {} as any };
    }
  }

  /**
   * Get skills for a team
   * GET /teams/{id}/skills
   */
  public async getTeamSkills(teamId: number, filters?: SkillFilters): Promise<SkillsResponse> {
    try {
      const params: Record<string, any> = {};

      if (filters?.event) params.event = filters.event;
      if (filters?.type) params.type = filters.type;
      if (filters?.season) params.season = filters.season;
      if (filters?.page) params.page = filters.page;
      if (filters?.per_page) params.per_page = filters.per_page;

      const response = await this.request<SkillsResponse>(`/teams/${teamId}/skills`, params);
      return response;
    } catch (error) {
      logger.error('Failed to get skills for team', teamId || 'Unknown', ':', error);
      return { data: [], meta: {} as any };
    }
  }

  /**
   * Get awards for a team
   * GET /teams/{id}/awards
   */
  public async getTeamAwards(teamId: number, filters?: AwardFilters): Promise<AwardsResponse> {
    try {
      const params: Record<string, any> = {};

      if (filters?.event) params.event = filters.event;
      if (filters?.season) params.season = filters.season;
      if (filters?.page) params.page = filters.page;
      if (filters?.per_page) params.per_page = filters.per_page;

      const response = await this.request<AwardsResponse>(`/teams/${teamId}/awards`, params);
      return response;
    } catch (error) {
      logger.error('Failed to get awards for team', teamId || 'Unknown', ':', error);
      return { data: [], meta: {} as any };
    }
  }

  // =============================================================================
  // WORLD SKILLS API
  // =============================================================================

  /**
   * Get World Skills rankings from the skills endpoint with token rotation support
   */
  public async getWorldSkillsRankings(seasonId: number, gradeLevel: string): Promise<WorldSkillsResponse[]> {
    try {
      // Use the older World Skills API structure (not v2) without authentication - matches Swift implementation
      const url = new URL(`https://www.robotevents.com/api/seasons/${seasonId}/skills`);
      url.searchParams.append('grade_level', gradeLevel);

      logger.debug('Getting World Skills rankings for season:', seasonId, 'grade:', gradeLevel);
      logger.debug('World Skills URL:', url.toString());

      // World Skills API doesn't require authentication - matches Swift implementation
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('World Skills request failed with status:', response.status);
        logger.error('Request URL that failed:', url.toString());
        logger.error('Request parameters - seasonId:', seasonId, 'gradeLevel:', gradeLevel);
        logger.error('Error response:', errorText.substring(0, 500));
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Transform API response to match UI type expectations
      const transformedData: WorldSkillsResponse[] = (data || []).map((item: any, index: number) => ({
        id: `${item.team?.id || index}`, // Generate ID if missing
        rank: item.rank || 0,
        team: {
          id: item.team?.id || 0,
          team: item.team?.number || item.team?.team || '',
          teamName: item.team?.name || item.team?.teamName || '',
          organization: item.team?.organization || '',
          city: item.team?.location?.city || item.team?.city || '',
          region: item.team?.location?.region || item.team?.region || '',
          country: item.team?.location?.country || item.team?.country || '',
          grade: item.team?.grade || ''
        },
        scores: {
          score: item.scores?.score || 0,
          programming: item.scores?.programming || 0,
          driver: item.scores?.driver || 0,
          maxProgramming: item.scores?.maxProgramming || item.scores?.programming || 0,
          maxDriver: item.scores?.maxDriver || item.scores?.driver || 0,
          tier: item.scores?.tier || ''
        },
        event: {
          id: item.event?.id || 0,
          name: item.event?.name || '',
          code: item.event?.code || ''
        }
      }));

      return transformedData;
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

  private getCacheKey(teamNumber: string, program: string): string {
    return `${teamNumber}-${program}`;
  }

  private getCachedTeam(teamNumber: string, program: string): { id: number; data: any } | null {
    const cacheKey = this.getCacheKey(teamNumber, program);
    const cached = this.teamIdCache.get(cacheKey);

    if (cached && (Date.now() - cached.timestamp) < this.cacheExpiry) {
      logger.debug('Using cached team data for', teamNumber || 'Unknown', '(ID:', cached.id || 'Unknown', ')');
      return { id: cached.id, data: cached.data };
    }

    if (cached) {
      logger.debug('Cached data for', teamNumber || 'Unknown', 'has expired, removing');
      this.teamIdCache.delete(cacheKey);
      this.saveCacheToStorage();
    }

    return null;
  }

  private setCachedTeam(teamNumber: string, program: string, id: number, data: any): void {
    const cacheKey = this.getCacheKey(teamNumber, program);
    this.teamIdCache.set(cacheKey, {
      id,
      data,
      timestamp: Date.now()
    });
    logger.debug('Cached team data for', teamNumber || 'Unknown', '(ID:', id || 'Unknown', ')');

    this.saveCacheToStorage();
  }

  public clearCache(): void {
    this.teamIdCache.clear();
    storage.removeItem(this.CACHE_STORAGE_KEY);
    logger.debug('Cache cleared');
  }

  // =============================================================================
  // CONVENIENCE METHODS (Legacy compatibility)
  // =============================================================================

  /**
   * Search teams (legacy compatibility method)
   */
  public async searchTeams(query: string, program?: string, seasonId?: number): Promise<Team[]> {
    const selectedProgram = program || this.selectedProgram;
    const programId = this.getProgramId(selectedProgram);

    const filters: TeamFilters = {
      number: [query],
      program: [programId],
      per_page: 250,
    };

    const response = await this.getTeams(filters);
    return response.data;
  }

  /**
   * Search events (legacy compatibility method)
   */
  public async searchEvents(filters?: EventFilters): Promise<Event[]> {
    const response = await this.getEvents(filters);
    return response.data;
  }

  /**
   * Get event details (legacy compatibility method)
   */
  public async getEventDetails(eventId: number): Promise<Event | null> {
    return this.getEventById(eventId);
  }
}

// Export singleton instance
export const comprehensiveRobotEventsAPI = new ComprehensiveRobotEventsAPI();
export default comprehensiveRobotEventsAPI;