/**
 * Main API Router Service
 *
 * This service acts as a router that determines which underlying API to use
 * based on the selected program. API routing is now configured via programMappings.ts
 * using the `apiType` field in each program's configuration.
 *
 * - RobotEvents API: Programs with apiType: 'RobotEvents'
 * - RECF Events API: Programs with apiType: 'RECFEvents'
 *
 * This provides a unified interface that automatically routes requests
 * to the appropriate API service while maintaining complete backward compatibility.
 */

import { createLogger } from '../utils/logger';
import { comprehensiveRobotEventsAPI } from './robotEventsApi';
import { recfEventsAPI } from './recfEventsAPI';

const logger = createLogger('apiRouter');
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
import { getAPIType, getAllProgramNames, PROGRAM_CONFIGS } from '../utils/programMappings';

class APIRouter {
  private selectedProgram: string = 'VEX V5 Robotics Competition';
  private cachedAPIService: any = null;
  private lastCachedProgram: string = '';
  private cacheHits: number = 0;
  private cacheMisses: number = 0;
  private enableDetailedLogging: boolean = true; // Set to true to enable detailed API call logging
  private enableDetailedErrorLogging: boolean = false; // Set to true to enable detailed error logging with stack traces

  constructor() {
    logger.info('Initialized with default program: VEX V5 Robotics Competition');
    // Initialize the cached API service for the default program
    this.updateCachedAPIService();
  }

  /**
   * Gets caller information from the stack trace
   */
  private getCallerInfo(): string {
    try {
      const stack = new Error().stack;
      if (!stack) return 'Unknown caller';

      const stackLines = stack.split('\n');
      // Skip the first 3 lines: Error, getCallerInfo, and the logAPICall method
      for (let i = 3; i < Math.min(stackLines.length, 8); i++) {
        const line = stackLines[i];

        // Look for lines that contain file paths (not node_modules or native code)
        if (line.includes('/src/') || line.includes('\\src\\')) {
          // Extract file name and line number
          const match = line.match(/\/([\w\/]+\.tsx?)(?::(\d+))?/);
          if (match) {
            const filePath = match[1];
            const lineNumber = match[2] || '?';
            return `${filePath}:${lineNumber}`;
          }
        }
      }

      return 'Unknown caller';
    } catch (e) {
      return 'Error getting caller info';
    }
  }

  /**
   * Logs detailed API call information when there's an error or unexpected response
   */
  private logAPIError(method: string, params?: any, error?: any, response?: any): void {
    if (!this.enableDetailedErrorLogging) {
      return;
    }

    const caller = this.getCallerInfo();
    const apiType = this.shouldUseRECFAPI() ? 'RECFEvents' : 'RobotEvents';
    const statusCode = response?.status || error?.response?.status || error?.status || 'Unknown';

    console.error('═══════════════════════════════════════════════════════════');
    console.error(`[API ERROR - Status ${statusCode}] ${method}`);
    console.error(`  HTTP Status Code: ${statusCode}`);
    console.error(`  API Type: ${apiType}`);
    console.error(`  Program: ${this.selectedProgram}`);
    console.error(`  Called from: ${caller}`);
    if (params) {
      console.error(`  Parameters:`, JSON.stringify(params, null, 2));
    }
    if (error) {
      console.error(`  Error:`, error);
    }
    if (response) {
      console.error(`  Response Data:`, response.data || response);
    }
    console.error('═══════════════════════════════════════════════════════════');
  }

  /**
   * Wraps API calls with error logging
   */
  private async wrapAPICall<T>(method: string, params: any, apiCall: () => Promise<T>): Promise<T> {
    try {
      const result = await apiCall();

      // Check if result is unexpectedly empty or malformed (status 200 but bad data)
      if (result === null || result === undefined) {
        this.logAPIError(method, params, null, { status: 200, data: result });
      } else if (typeof result === 'object' && 'data' in result) {
        // Check for paginated responses with empty data
        const resultAny = result as any;
        if (Array.isArray(resultAny.data) && resultAny.data.length === 0 && resultAny.meta?.total > 0) {
          this.logAPIError(method, params, null, {
            status: 200,
            data: 'Empty data array despite meta.total > 0',
            meta: resultAny.meta
          });
        }
      }

      return result;
    } catch (error: any) {
      // Log the error with full context
      this.logAPIError(method, params, error, error.response);
      throw error; // Re-throw so normal error handling continues
    }
  }

  // =============================================================================
  // ROUTING LOGIC
  // =============================================================================

  /**
   * Determines if the current/specified program should use RECF Events API
   * Now uses program mappings instead of hardcoded lists
   */
  private shouldUseRECFAPI(program?: string): boolean {
    const targetProgram = program || this.selectedProgram;
    const apiType = getAPIType(targetProgram);
    return apiType === 'RECFEvents';
  }

  /**
   * Updates the cached API service when the program changes
   */
  private updateCachedAPIService(program?: string): void {
    const targetProgram = program || this.selectedProgram;

    if (this.cachedAPIService && this.lastCachedProgram === targetProgram) {
      // Already cached for this program, no need to update
      return;
    }

    if (this.shouldUseRECFAPI(targetProgram)) {
      logger.debug('Caching RECF Events API for program:', targetProgram || 'Unknown');
      this.cachedAPIService = recfEventsAPI;
    } else {
      logger.debug('Caching RobotEvents API for program:', targetProgram || 'Unknown');
      this.cachedAPIService = comprehensiveRobotEventsAPI;
    }

    this.lastCachedProgram = targetProgram;
    this.cacheMisses++;
  }

  /**
   * Gets the appropriate API service based on the program (optimized with caching)
   */
  private getAPIService(program?: string) {
    const targetProgram = program || this.selectedProgram;

    if (targetProgram !== this.lastCachedProgram) {
      this.updateCachedAPIService(targetProgram);
    }

    // use direct routing (less common case)
    if (program && program !== this.selectedProgram) {
      if (this.shouldUseRECFAPI(program)) {
        return recfEventsAPI;
      } else {
        return comprehensiveRobotEventsAPI;
      }
    }

    // Return cached service for the selected program (most common case)
    this.cacheHits++;
    return this.cachedAPIService;
  }

  // =============================================================================
  // CONFIGURATION METHODS
  // =============================================================================

  public setSelectedProgram(program: string): void {
    logger.info('Setting selected program to:', program || 'Unknown');
    const oldProgram = this.selectedProgram;
    this.selectedProgram = program;

    // Update cached API service if program changed
    if (oldProgram !== program) {
      logger.info('Program changed from', oldProgram || 'Unknown', 'to', program || 'Unknown', ', updating cached API service');
      this.updateCachedAPIService(program);
    }

    // Set the program on both APIs
    comprehensiveRobotEventsAPI.setSelectedProgram(program);
    recfEventsAPI.setSelectedProgram(program);
  }

  public getSelectedProgram(): string {
    return this.selectedProgram;
  }

  public getApiKeyStatus(): APIKeyStatus {
    const service = this.getAPIService();
    return service.getApiKeyStatus();
  }

  public getSupportedPrograms(): { robotEvents: string[], recfEvents: string[] } {
    const allPrograms = getAllProgramNames();
    const robotEvents: string[] = [];
    const recfEvents: string[] = [];

    // Dynamically categorize programs based on their API type from program mappings
    allPrograms.forEach(program => {
      const apiType = PROGRAM_CONFIGS[program].apiType;
      if (apiType === 'RobotEvents') {
        robotEvents.push(program);
      } else if (apiType === 'RECFEvents') {
        recfEvents.push(program);
      }
    });

    return { robotEvents, recfEvents };
  }

  /**
   * Notify the API router that the program has changed (called by Settings context)
   */
  public onProgramChanged(newProgram: string): void {
    this.setSelectedProgram(newProgram);
  }

  /**
   * Get cache status for debugging
   */
  public getCacheStatus(): {
    currentProgram: string;
    lastCachedProgram: string;
    isServiceCached: boolean;
    currentAPI: 'RobotEvents' | 'RECF Events';
    cacheHits: number;
    cacheMisses: number;
    cacheEfficiency: string;
  } {
    const totalRequests = this.cacheHits + this.cacheMisses;
    const efficiency = totalRequests > 0 ? ((this.cacheHits / totalRequests) * 100).toFixed(1) + '%' : 'N/A';

    return {
      currentProgram: this.selectedProgram,
      lastCachedProgram: this.lastCachedProgram,
      isServiceCached: this.cachedAPIService !== null,
      currentAPI: this.shouldUseRECFAPI(this.selectedProgram) ? 'RECF Events' : 'RobotEvents',
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      cacheEfficiency: efficiency
    };
  }

  // =============================================================================
  // PROGRAMS API
  // =============================================================================

  public async getPrograms(filters?: ProgramFilters): Promise<ProgramsResponse> {
    return this.wrapAPICall('getPrograms', filters, async () => {
      const service = this.getAPIService();
      return service.getPrograms(filters);
    });
  }

  public async getProgramById(programId: number): Promise<Program | null> {
    return this.wrapAPICall('getProgramById', { programId }, async () => {
      const service = this.getAPIService();
      return service.getProgramById(programId);
    });
  }

  // =============================================================================
  // SEASONS API
  // =============================================================================

  public async getSeasons(filters?: SeasonFilters): Promise<SeasonsResponse> {
    return this.wrapAPICall('getSeasons', filters, async () => {
      const service = this.getAPIService();
      return service.getSeasons(filters);
    });
  }

  public async getSeasonById(seasonId: number): Promise<Season | null> {
    return this.wrapAPICall('getSeasonById', { seasonId }, async () => {
      const service = this.getAPIService();
      return service.getSeasonById(seasonId);
    });
  }

  public async getSeasonEvents(seasonId: number, filters?: EventFilters): Promise<EventsResponse> {
    return this.wrapAPICall('getSeasonEvents', { seasonId, ...filters }, async () => {
      const service = this.getAPIService();
      return service.getSeasonEvents(seasonId, filters);
    });
  }

  public async getCurrentSeasonId(program?: string): Promise<number> {
    return this.wrapAPICall('getCurrentSeasonId', { program }, async () => {
      const service = this.getAPIService(program);
      return service.getCurrentSeasonId(program);
    });
  }

  // =============================================================================
  // EVENTS API
  // =============================================================================

  public async getEvents(filters?: EventFilters): Promise<EventsResponse> {
    return this.wrapAPICall('getEvents', filters, async () => {
      const service = this.getAPIService();
      return service.getEvents(filters);
    });
  }

  public async getEventById(eventId: number): Promise<Event | null> {
    return this.wrapAPICall('getEventById', { eventId }, async () => {
      const service = this.getAPIService();
      return service.getEventById(eventId);
    });
  }

  public async getEventTeams(eventId: number, filters?: EventTeamFilters): Promise<TeamsResponse> {
    return this.wrapAPICall('getEventTeams', { eventId, ...filters }, async () => {
      const service = this.getAPIService();
      return service.getEventTeams(eventId, filters);
    });
  }

  public async getEventSkills(eventId: number, filters?: SkillFilters): Promise<SkillsResponse> {
    return this.wrapAPICall('getEventSkills', { eventId, ...filters }, async () => {
      const service = this.getAPIService();
      return service.getEventSkills(eventId, filters);
    });
  }

  public async getEventAwards(eventId: number, filters?: AwardFilters): Promise<AwardsResponse> {
    return this.wrapAPICall('getEventAwards', { eventId, ...filters }, async () => {
      const service = this.getAPIService();
      return service.getEventAwards(eventId, filters);
    });
  }

  public async getEventDivisionMatches(eventId: number, divisionId: number, filters?: MatchFilters): Promise<MatchesResponse> {
    return this.wrapAPICall('getEventDivisionMatches', { eventId, divisionId, ...filters }, async () => {
      const service = this.getAPIService();
      return service.getEventDivisionMatches(eventId, divisionId, filters);
    });
  }

  public async getEventDivisionRankings(eventId: number, divisionId: number, filters?: RankingFilters): Promise<RankingsResponse> {
    return this.wrapAPICall('getEventDivisionRankings', { eventId, divisionId, ...filters }, async () => {
      const service = this.getAPIService();
      return service.getEventDivisionRankings(eventId, divisionId, filters);
    });
  }

  public async getEventDivisionFinalistRankings(eventId: number, divisionId: number, filters?: RankingFilters): Promise<RankingsResponse> {
    return this.wrapAPICall('getEventDivisionFinalistRankings', { eventId, divisionId, ...filters }, async () => {
      const service = this.getAPIService();
      return service.getEventDivisionFinalistRankings(eventId, divisionId, filters);
    });
  }

  // =============================================================================
  // TEAMS API
  // =============================================================================

  public async getTeams(filters?: TeamFilters): Promise<TeamsResponse> {
    return this.wrapAPICall('getTeams', filters, async () => {
      const service = this.getAPIService();
      return service.getTeams(filters);
    });
  }

  public async getTeamById(teamId: number): Promise<Team | null> {
    return this.wrapAPICall('getTeamById', { teamId }, async () => {
      const service = this.getAPIService();
      return service.getTeamById(teamId);
    });
  }

  public async getTeamByNumber(teamNumber: string, program?: string): Promise<Team | null> {
    return this.wrapAPICall('getTeamByNumber', { teamNumber, program }, async () => {
      const service = this.getAPIService(program);
      return service.getTeamByNumber(teamNumber, program);
    });
  }

  public async getTeamEvents(teamId: number, filters?: EventFilters): Promise<EventsResponse> {
    return this.wrapAPICall('getTeamEvents', { teamId, ...filters }, async () => {
      const service = this.getAPIService();
      return service.getTeamEvents(teamId, filters);
    });
  }

  public async getTeamMatches(teamId: number, filters?: MatchFilters): Promise<MatchesResponse> {
    return this.wrapAPICall('getTeamMatches', { teamId, ...filters }, async () => {
      const service = this.getAPIService();
      return service.getTeamMatches(teamId, filters);
    });
  }

  public async getTeamRankings(teamId: number, filters?: RankingFilters): Promise<RankingsResponse> {
    return this.wrapAPICall('getTeamRankings', { teamId, ...filters }, async () => {
      const service = this.getAPIService();
      return service.getTeamRankings(teamId, filters);
    });
  }

  public async getTeamSkills(teamId: number, filters?: SkillFilters): Promise<SkillsResponse> {
    const service = this.getAPIService();
    return service.getTeamSkills(teamId, filters);
  }

  public async getTeamAwards(teamId: number, filters?: AwardFilters): Promise<AwardsResponse> {
    const service = this.getAPIService();
    return service.getTeamAwards(teamId, filters);
  }

  /**
   * Get teams using the team browser key pool
   * Identical to getTeams but uses dedicated team browser API keys
   */
  public async getTeamsForBrowser(filters?: TeamFilters): Promise<TeamsResponse> {
    const service = this.getAPIService();
    return service.getTeamsForBrowser(filters);
  }

  // =============================================================================
  // WORLD SKILLS API
  // =============================================================================

  public async getWorldSkillsRankings(seasonId: number, gradeLevel: string): Promise<WorldSkillsResponse[]> {
    const service = this.getAPIService();
    return service.getWorldSkillsRankings(seasonId, gradeLevel);
  }

  // =============================================================================
  // CACHE MANAGEMENT
  // =============================================================================

  public async initializeCache(): Promise<void> {
    // Initialize cache for both APIs
    await Promise.all([
      comprehensiveRobotEventsAPI.initializeCache(),
      recfEventsAPI.initializeCache()
    ]);
    logger.info('Cache initialized for both APIs');
  }

  public clearCache(): void {
    comprehensiveRobotEventsAPI.clearCache();
    recfEventsAPI.clearCache();
    logger.info('Cache cleared for both APIs');
  }

  // =============================================================================
  // CONVENIENCE METHODS (Legacy compatibility)
  // =============================================================================

  public async searchTeams(query: string, program?: string, seasonId?: number): Promise<Team[]> {
    const service = this.getAPIService(program);
    return service.searchTeams(query, program, seasonId);
  }

  public async searchEvents(filters?: EventFilters): Promise<Event[]> {
    const service = this.getAPIService();
    return service.searchEvents(filters);
  }

  public async getEventDetails(eventId: number): Promise<Event | null> {
    return this.getEventById(eventId);
  }

  // =============================================================================
  // DIAGNOSTICS AND DEBUGGING
  // =============================================================================

  public getRoutingInfo(): {
    selectedProgram: string;
    currentAPI: 'RobotEvents' | 'RECF Events';
    supportedPrograms: { robotEvents: string[], recfEvents: string[] };
    robotEventsApiStatus: APIKeyStatus;
    recfEventsApiStatus: APIKeyStatus;
    usingFallback: boolean;
  } {
    const shouldUseRECF = this.shouldUseRECFAPI();
    const apiType = getAPIType(this.selectedProgram);
    const isRECFProgram = apiType === 'RECFEvents';
    const usingFallback = isRECFProgram && !shouldUseRECF;

    return {
      selectedProgram: this.selectedProgram,
      currentAPI: shouldUseRECF ? 'RECF Events' : 'RobotEvents',
      supportedPrograms: this.getSupportedPrograms(),
      robotEventsApiStatus: comprehensiveRobotEventsAPI.getApiKeyStatus(),
      recfEventsApiStatus: recfEventsAPI.getApiKeyStatus(),
      usingFallback
    };
  }

  public logRoutingStatus(): void {
    const info = this.getRoutingInfo();
    const cacheInfo = this.getCacheStatus();
    logger.debug('Current Routing Status:', JSON.stringify(info, null, 2));
    logger.debug('Cache Status:', JSON.stringify(cacheInfo, null, 2));
  }

  /**
   * Get API usage statistics for developer mode
   */
  public getApiUsageStats() {
    return comprehensiveRobotEventsAPI.getApiUsageStats();
  }

  /**
   * Reset API usage statistics
   */
  public resetApiUsageStats(): void {
    comprehensiveRobotEventsAPI.resetApiUsageStats();
  }

  /**
   * Check if API is in failure state (all keys failed)
   */
  public isInFailureState(): boolean {
    return comprehensiveRobotEventsAPI.isInFailureState();
  }

  /**
   * Get API failure information for user notification
   */
  public getFailureInfo() {
    return comprehensiveRobotEventsAPI.getFailureInfo();
  }

  /**
   * Mark failure notification as shown
   */
  public markNotificationShown(): void {
    comprehensiveRobotEventsAPI.markNotificationShown();
  }

  /**
   * Reset API failure state (called on app launch)
   */
  public resetFailureState(): void {
    comprehensiveRobotEventsAPI.resetFailureState();
  }
}

// Export singleton instance
export const robotEventsAPI = new APIRouter();
export default robotEventsAPI;

// Re-export types for convenience
export * from '../types/api';