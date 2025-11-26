/**
 * VRC Data Analysis API Service
 *
 * Provides access to TrueSkill rankings and advanced statistics from vrc-data-analysis.com
 * This is a third-party API that provides enhanced analytics for VEX V5 Robotics Competition.
 *
 * API Documentation: See VRC_DATA_ANALYSIS_API.md in project root
 * Base URL: https://vrc-data-analysis.com/v1
 *
 * Features:
 * - TrueSkill rankings for all VRC teams
 * - Advanced statistics (OPR, DPR, CCWM)
 * - Match prediction capabilities
 * - In-memory caching with 30-minute expiry
 * - No authentication required
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createLogger } from '../utils/logger';

const logger = createLogger('vrcDataAnalysisAPI');

// AsyncStorage keys
const CACHE_KEY = '@vrc_data_analysis_cache';
const CACHE_TIMESTAMP_KEY = '@vrc_data_analysis_cache_timestamp';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Complete team data from /allteams endpoint
 * Contains 40+ fields including TrueSkill, performance ratings, and match statistics
 */
export interface VRCDataAnalysisTeam {
  // Team Identification & Basic Info
  ts_ranking: number;
  ranking_change: number;
  ts_ranking_region: number;
  team_link: string;
  team_number: string;
  team_name: string;
  id: number;
  grade: string;

  // Location Data
  event_region: string;
  loc_region: string;
  loc_country: string;

  // TrueSkill Metrics
  trueskill: number | null;
  mu: number | null;
  ts_sigma: number | null;

  // Performance Ratings
  ccwm: number | null;
  opr: number | null;
  dpr: number | null;

  // Match Statistics - Total
  total_wins: number | null;
  total_losses: number | null;
  total_ties: number | null;
  total_matches: number | null;
  total_winning_percent: number | null;

  // Match Statistics - Qualification
  qual_wins: number;
  qual_losses: number;
  qual_ties: number;
  qual_winning_percent: number;

  // Match Statistics - Elimination
  elimination_wins: number;
  elimination_losses: number;
  elimination_ties: number;
  elimination_winning_percent: number;

  // Average Points per Match
  ap_per_match: number;
  awp_per_match: number;
  wp_per_match: number;

  // Skills Rankings
  total_skills_ranking: number;
  region_grade_skills_ranking: number;
  score_driver_max: number;
  score_auto_max: number;
  score_total_max: number;

  // Qualification Status
  qualified_for_regionals: number;
  qualified_for_worlds: number;
  unqualed_worlds_grade_skills_ranking: number;
  unqualed_region_grade_skills_ranking: number;
}

/**
 * Simplified team info from /team/{teamNumber} endpoint
 * Contains subset of fields (18 fields vs 40+ in /allteams)
 */
export interface VRCDataAnalysisTeamInfo {
  team_number: string;
  team_name: string;
  trueskill_ranking: number;
  trueskill: number;
  mu: number;
  sigma: number;
  opr: number;
  dpr: number;
  ccwm: number;
  total_wins: number;
  total_losses: number;
  total_ties: number;
  ap_per_match: number;
  awp_per_match: number;
  wp_per_match: number;
  score_driver_max: number;
  score_auto_max: number;
  score_total_max: number;
}

/**
 * Error response from /team endpoint
 */
export interface VRCDataAnalysisTeamError {
  Error: string;
}

/**
 * Match prediction from /predict endpoint
 * Note: Win probability is 0-100, NOT 0-1
 */
export interface VRCDataAnalysisMatchPrediction {
  red1: string;
  red2: string;
  blue1: string;
  blue2: string;
  red_win_probability: number; // 0-100, not 0-1
  prediction_msg: string;
}

// =============================================================================
// API SERVICE CLASS
// =============================================================================

class VRCDataAnalysisAPI {
  private baseUrl = 'https://vrc-data-analysis.com/v1';

  // Caching
  private cachedTeams: VRCDataAnalysisTeam[] | null = null;
  private cacheTimestamp: number | null = null;
  private cacheExpiryMs = 30 * 60 * 1000; // 30 minutes

  constructor() {
    logger.info('VRC Data Analysis API initialized');
  }

  // =============================================================================
  // MAIN API METHODS
  // =============================================================================

  /**
   * Get all teams data
   *
   * Returns comprehensive data for all ~10,000+ VEX V5 teams.
   * Response is large (~5-10MB) so it's cached for 30 minutes.
   *
   * @param forceRefresh - Skip cache and fetch fresh data
   * @returns Array of all teams with TrueSkill rankings
   */
  async getAllTeams(forceRefresh: boolean = false): Promise<VRCDataAnalysisTeam[]> {
    try {
      // Check in-memory cache first unless force refresh
      if (!forceRefresh && this.cachedTeams && this.cacheTimestamp) {
        const age = Date.now() - this.cacheTimestamp;
        if (age < this.cacheExpiryMs) {
          logger.debug('Returning in-memory cached TrueSkill data (age:', Math.round(age / 1000), 'seconds)');
          return this.cachedTeams;
        } else {
          logger.debug('In-memory cache expired (age:', Math.round(age / 1000), 'seconds)');
        }
      }

      // Check persistent cache (AsyncStorage) if not in memory
      if (!forceRefresh) {
        try {
          const cachedDataStr = await AsyncStorage.getItem(CACHE_KEY);
          const cachedTimestampStr = await AsyncStorage.getItem(CACHE_TIMESTAMP_KEY);

          if (cachedDataStr && cachedTimestampStr) {
            const timestamp = parseInt(cachedTimestampStr);
            const age = Date.now() - timestamp;

            if (age < this.cacheExpiryMs) {
              logger.debug('Restoring TrueSkill data from persistent cache (age:', Math.round(age / 1000), 'seconds)');
              const data: VRCDataAnalysisTeam[] = JSON.parse(cachedDataStr);

              // Restore to in-memory cache
              this.cachedTeams = data;
              this.cacheTimestamp = timestamp;

              return data;
            } else {
              logger.debug('Persistent cache expired (age:', Math.round(age / 1000), 'seconds)');
            }
          }
        } catch (storageError) {
          logger.warn('Failed to read from persistent cache:', storageError);
        }
      }

      logger.info('Fetching all teams from VRC Data Analysis API...');
      const startTime = Date.now();

      const response = await fetch(`${this.baseUrl}/allteams`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: VRCDataAnalysisTeam[] = await response.json();
      const duration = Date.now() - startTime;

      logger.info('Successfully fetched', data.length, 'teams in', duration, 'ms');

      // Update in-memory cache
      this.cachedTeams = data;
      this.cacheTimestamp = Date.now();

      // Update persistent cache (AsyncStorage)
      try {
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data));
        await AsyncStorage.setItem(CACHE_TIMESTAMP_KEY, this.cacheTimestamp.toString());
        logger.debug('TrueSkill data saved to persistent cache');
      } catch (storageError) {
        logger.warn('Failed to save to persistent cache:', storageError);
      }

      return data;
    } catch (error) {
      logger.error('Failed to fetch all teams:', error);
      throw error;
    }
  }

  /**
   * Get single team info by team number
   *
   * Returns simplified data compared to /allteams (18 fields vs 40+).
   * Useful for quick lookups of individual teams.
   *
   * @param teamNumber - Team number (e.g., "10085A")
   * @returns Team info or error object
   */
  async getTeamInfo(teamNumber: string): Promise<VRCDataAnalysisTeamInfo | VRCDataAnalysisTeamError> {
    try {
      logger.debug('Fetching team info for:', teamNumber);

      const response = await fetch(`${this.baseUrl}/team/${teamNumber}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Check for error response
      if ('Error' in data) {
        logger.warn('Team not found:', teamNumber);
        return data as VRCDataAnalysisTeamError;
      }

      return data as VRCDataAnalysisTeamInfo;
    } catch (error) {
      logger.error('Failed to fetch team info:', error);
      throw error;
    }
  }

  /**
   * Predict match outcome
   *
   * Returns win probability (0-100) for a match.
   * Supports "AVG" as team number for average team.
   * Invalid teams default to 50% win probability.
   *
   * @param red1 - Red alliance team 1 (or "AVG")
   * @param red2 - Red alliance team 2 (or "AVG")
   * @param blue1 - Blue alliance team 1 (or "AVG")
   * @param blue2 - Blue alliance team 2 (or "AVG")
   * @returns Match prediction with win probabilities
   */
  async predictMatch(
    red1: string,
    red2: string,
    blue1: string,
    blue2: string
  ): Promise<VRCDataAnalysisMatchPrediction> {
    try {
      logger.debug('Predicting match:', red1, red2, 'vs', blue1, blue2);

      const response = await fetch(
        `${this.baseUrl}/predict/${red1}/${red2}/${blue1}/${blue2}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      logger.error('Failed to predict match:', error);
      throw error;
    }
  }

  // =============================================================================
  // HELPER METHODS FOR WORKING WITH CACHED DATA
  // =============================================================================

  /**
   * Find team by RobotEvents ID in cached data
   */
  getTeamById(teamId: number, cachedTeams: VRCDataAnalysisTeam[]): VRCDataAnalysisTeam | undefined {
    return cachedTeams.find(team => team.id === teamId);
  }

  /**
   * Find team by team number in cached data
   */
  getTeamByNumber(teamNumber: string, cachedTeams: VRCDataAnalysisTeam[]): VRCDataAnalysisTeam | undefined {
    return cachedTeams.find(team => team.team_number === teamNumber);
  }

  /**
   * Get teams by region
   */
  getTeamsByRegion(region: string, cachedTeams: VRCDataAnalysisTeam[]): VRCDataAnalysisTeam[] {
    return cachedTeams.filter(team => team.loc_region === region);
  }

  /**
   * Get teams by letter (last character of team number)
   */
  getTeamsByLetter(letter: string, cachedTeams: VRCDataAnalysisTeam[]): VRCDataAnalysisTeam[] {
    return cachedTeams.filter(team => team.team_number.endsWith(letter.toUpperCase()));
  }

  /**
   * Get teams by team numbers (useful for favorites filtering)
   */
  getTeamsByNumbers(teamNumbers: string[], cachedTeams: VRCDataAnalysisTeam[]): VRCDataAnalysisTeam[] {
    const numbersSet = new Set(teamNumbers);
    return cachedTeams.filter(team => numbersSet.has(team.team_number));
  }

  /**
   * Get all unique regions from cached data
   */
  getUniqueRegions(cachedTeams: VRCDataAnalysisTeam[]): string[] {
    return [...new Set(cachedTeams.map(team => team.loc_region))].sort();
  }

  // =============================================================================
  // CACHE MANAGEMENT
  // =============================================================================

  /**
   * Clear cached data (both in-memory and persistent)
   */
  async clearCache(): Promise<void> {
    // Clear in-memory cache
    this.cachedTeams = null;
    this.cacheTimestamp = null;

    // Clear persistent cache
    try {
      await AsyncStorage.removeItem(CACHE_KEY);
      await AsyncStorage.removeItem(CACHE_TIMESTAMP_KEY);
      logger.info('TrueSkill cache cleared (in-memory and persistent)');
    } catch (error) {
      logger.warn('Failed to clear persistent cache:', error);
    }
  }

  /**
   * Get cache information
   */
  getCacheInfo(): { cached: boolean; age?: number; teams?: number } {
    if (!this.cachedTeams || !this.cacheTimestamp) {
      return { cached: false };
    }

    const age = Date.now() - this.cacheTimestamp;
    return {
      cached: true,
      age: Math.round(age / 1000), // seconds
      teams: this.cachedTeams.length,
    };
  }

  /**
   * Check if cache is valid (exists and not expired)
   */
  isCacheValid(): boolean {
    if (!this.cachedTeams || !this.cacheTimestamp) {
      return false;
    }

    const age = Date.now() - this.cacheTimestamp;
    return age < this.cacheExpiryMs;
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const vrcDataAnalysisAPI = new VRCDataAnalysisAPI();
export default vrcDataAnalysisAPI;
