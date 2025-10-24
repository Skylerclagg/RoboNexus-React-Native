/**
 * MATCH DISPLAY UTILITIES
 *
 * Uses centralized program configurations to determine how matches should be displayed
 */

import {
  isTeamVsTeamFormat,
  is2v0Format,
  getCompetitionType,
  programHasMatches
} from './programMappings';
import { ProgramType } from '../contexts/SettingsContext';

/**
 * Match display configuration
 */
export interface MatchDisplayConfig {
  showOpponent: boolean;
  showAlliance: boolean;
  showScore: boolean;
  showRanking: boolean;
  titleFormat: 'vs' | 'performance' | 'flight' | 'run';
  scoreLabel: string;
  opponentLabel: string;
}

/**
 * Get match display configuration for a program
 * @param program Program name
 * @returns Configuration for how matches should be displayed
 */
export const getMatchDisplayConfig = (program: ProgramType | string): MatchDisplayConfig => {
  if (!programHasMatches(program)) {
    // Programs without matches (like drone competitions) show performance/ranking data
    const competitionType = getCompetitionType(program);
    return {
      showOpponent: false,
      showAlliance: false,
      showScore: true,
      showRanking: true,
      titleFormat: competitionType === 'drone' ? 'flight' : 'performance',
      scoreLabel: competitionType === 'drone' ? 'Flight Score' : 'Performance Score',
      opponentLabel: '',
    };
  }

  if (isTeamVsTeamFormat(program)) {
    // Competitive formats: 2v2 (VEX V5) or 1v1 (VEX U, VEX AI)
    return {
      showOpponent: true,
      showAlliance: true,
      showScore: true,
      showRanking: false,
      titleFormat: 'vs',
      scoreLabel: 'Match Score',
      opponentLabel: '', // Remove 'vs' to save space
    };
  }

  if (is2v0Format(program)) {
    // 2v0 format - assume cooperative (teams working together)
    return {
      showOpponent: false,
      showAlliance: true,
      showScore: true,
      showRanking: false,
      titleFormat: 'performance',
      scoreLabel: 'Alliance Score',
      opponentLabel: '&',
    };
  }

  // Default fallback
  return {
    showOpponent: true,
    showAlliance: true,
    showScore: true,
    showRanking: false,
    titleFormat: 'vs',
    scoreLabel: 'Score',
    opponentLabel: '', // Remove 'vs' to save space
  };
};

/**
 * Format match title based on program configuration
 * @param program Program name
 * @param team1 First team name/number
 * @param team2 Second team name/number (optional for individual formats)
 * @param matchNumber Match number (optional)
 * @returns Formatted match title
 */
export const formatMatchTitle = (
  program: ProgramType | string,
  team1: string,
  team2?: string,
  matchNumber?: number
): string => {
  const config = getMatchDisplayConfig(program);
  const matchPrefix = matchNumber ? `Match ${matchNumber}: ` : '';

  switch (config.titleFormat) {
    case 'vs':
      // Remove 'vs' text - just show teams with space between
      return team2 ? `${matchPrefix}${team1} ${team2}` : `${matchPrefix}${team1}`;
    case 'performance':
      return team2 ? `${matchPrefix}${team1} ${config.opponentLabel} ${team2}` : `${matchPrefix}${team1}`;
    case 'flight':
      return `${matchPrefix}${team1} Flight`;
    case 'run':
      return `${matchPrefix}${team1} Run`;
    default:
      return `${matchPrefix}${team1}`;
  }
};

/**
 * Get appropriate skills display for a program with proper labels
 * @param program Program name
 * @returns Object with skills information and display labels
 */
export const getSkillsDisplayInfo = (program: ProgramType | string) => {
  // Import program config to get skill flags
  const { getProgramConfig } = require('./programMappings');
  const config = getProgramConfig(program);

  switch (program) {
    case 'VEX AI Robotics Competition':
      return {
        types: ['Autonomous'],
        primaryLabel: 'Autonomous Skills',
        secondaryLabel: null,
        hasPrimarySkill: config.hasDriverSkills,      // From program mappings
        hasSecondarySkill: config.hasProgrammingSkills, // From program mappings
        competitorType: 'robot'
      };
    case 'Aerial Drone Competition':
      return {
        types: ['Piloting Skills', 'Autonomous Flight'],
        primaryLabel: 'Piloting Skills',
        secondaryLabel: 'Autonomous Flight',
        hasPrimarySkill: config.hasDriverSkills,      // From program mappings
        hasSecondarySkill: config.hasProgrammingSkills, // From program mappings
        competitorType: 'drone'
      };
    case 'VEX AIR Drone Competition':
      return {
        types: ['Flight Skills', 'Autonomous Flight'],
        primaryLabel: 'Flight Skills',
        secondaryLabel: 'Autonomous Flight',
        hasPrimarySkill: config.hasDriverSkills,      // From program mappings
        hasSecondarySkill: config.hasProgrammingSkills, // From program mappings
        competitorType: 'drone'
      };
    default:
      // Default robotics programs (V5, IQ, U)
      return {
        types: ['Driver Skills', 'Programming Skills'],
        primaryLabel: 'Driver Skills',
        secondaryLabel: 'Programming Skills',
        hasPrimarySkill: config.hasDriverSkills,      // From program mappings
        hasSecondarySkill: config.hasProgrammingSkills, // From program mappings
        competitorType: 'robot'
      };
  }
};

/**
 * Get appropriate skills display for a program (backwards compatibility)
 * @param program Program name
 * @returns Array of skills types that should be displayed
 */
export const getSkillsDisplayTypes = (program: ProgramType | string): string[] => {
  return getSkillsDisplayInfo(program).types;
};

/**
 * Check if a program should show alliance information
 * @param program Program name
 * @returns True if alliances should be displayed
 */
export const shouldShowAlliances = (program: ProgramType | string): boolean => {
  return getMatchDisplayConfig(program).showAlliance;
};

/**
 * Check if a program should show opponent information
 * @param program Program name
 * @returns True if opponents should be displayed
 */
export const shouldShowOpponents = (program: ProgramType | string): boolean => {
  return getMatchDisplayConfig(program).showOpponent;
};

/**
 * Check if a program uses 2v0 format
 * @param program Program name
 * @returns True if program uses 2v0 format
 */
export const is2v0FormatProgram = (program: ProgramType | string): boolean => {
  
  
  return is2v0Format(program);
};