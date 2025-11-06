/**
 * CENTRALIZED PROGRAM MAPPINGS
 *
 * This file contains all program-related mappings and configurations.
 * To add a new program:
 * 1. Add it to the PROGRAM_CONFIGS mapping below with all metadata
 * 2. Add it to the appropriate API list in src/services/apiRouter.ts
 * 3. Add theme colors in src/contexts/SettingsContext.tsx (optional)
 */

import { ProgramType } from '../contexts/SettingsContext';

/**
 * Match format types
 */
export type MatchFormat = '2v2' | '1v1' | '2v0';

/**
 * Competition types
 */
export type CompetitionType = 'robotics' | 'drone';

/**
 * API types - determines which API service to use for this program
 */
export type APIType = 'RobotEvents' | 'RECFEvents';

/**
 * Skills types available for each program
 */
export type SkillsType = 'driver' | 'programming' | 'autonomous' | 'piloting' | 'teamwork' | 'flight';

/**
 * Grade levels available for programs
 */
export type GradeLevel = 'Elementary' | 'Middle School' | 'High School' | 'College';

/**
 * Score calculator types - maps to calculator files
 */
export type ScoreCalculatorType = 'v5rc' | 'viqrc' | 'vurc' | 'vairc' | 'adc' | 'vadc' | null;

/**
 * Calculator screen configuration
 * Maps calculator types to screen names and display information
 */
export interface CalculatorScreenConfig {
  screenName: string;
  displayName: string;
  description?: string;
}

/**
 * Calculator screen mappings
 * Defines which screens are available for each calculator type
 */
export const CALCULATOR_SCREENS: Record<Exclude<ScoreCalculatorType, null>, CalculatorScreenConfig[]> = {
  v5rc: [
    {
      screenName: 'VEXv5ScoreCalculator',
      displayName: 'VEX V5 Score Calculator',
      description: 'Calculate match scores for VEX V5 competitions',
    },
  ],
  viqrc: [
    
  ],
  vurc: [
    
  ],
  vairc: [

  ],
  adc: [
    {
      screenName: 'TeamworkScoreCalculator',
      displayName: 'Teamwork Match Calculator',
      description: 'Calculate teamwork match scores for Aerial Drone Competition',
    },
    {
      screenName: 'PilotingSkillsCalculator',
      displayName: 'Piloting Skills Calculator',
      description: 'Calculate piloting skills scores for Aerial Drone Competition',
    },
    {
      screenName: 'AutonomousFlightSkillsCalculator',
      displayName: 'Autonomous Flight Calculator',
      description: 'Calculate autonomous flight scores for Aerial Drone Competition',
    },
  ],
  vadc: [
  ],
};

/**
 * Program configuration interface
 *
 * FIELD DESCRIPTIONS:
 *
 * BASIC INFO:
 * - id: RobotEvents API program ID
 * - shortName: Abbreviated program name (e.g., "V5RC")
 * - competitionType: Type of competition (robotics, drone, esports)
 * - apiType: Which API service to use ('RobotEvents' or 'RECFEvents')
 *
 * MATCH DISPLAY:
 * - matchFormat: How matches are displayed (2v2, 1v1, 2v0)
 *   - '2v2': 4 teams competing (2 vs 2) - shows red/blue alliances
 *   - '1v1': 2 teams competing (1 vs 1) - shows opponent
 *   - '2v0': 2 teams cooperative or individual - shows alliance only
 * - useThemedScoreColors: If true, scores use text color (white/black based on theme)
 *                          If false, scores use alliance colors (red/blue)
 *
 * SKILLS:
 * - skillsTypes: Types of skills runs available for this program
 * - hasSkills: Whether program has skills challenges
 * - hasWorldSkills: Whether program has world skills rankings
 * - hasDriverSkills: Whether program has driver/primary skill type (API: driver)
 * - hasProgrammingSkills: Whether program has programming/secondary skill type (API: programming)
 *
 * FEATURES (controls screen/tab visibility):
 * - hasTeams: Show Teams tab/screens
 * - hasMatches: Show Match List tab/screens
 * - hasRankings: Show Rankings tab/screens
 * - hasAwards: Show Awards tab/screens
 * - hasScoreCalculators: Show Score Calculator tab/screens (set to false to hide entirely)
 *
 * GRADE LEVELS:
 * - availableGrades: Grade levels that can compete in this program
 *   (affects filter options in World Skills, Teams Map, etc.)
 *
 * SCORE CALCULATOR:
 * - scoreCalculator: Which score calculator file to use (null if no calculator available)
 * - scoreCalculatorRequiresDev: If true, only show calculators when developer mode is enabled
 *
 * DEVELOPER / LIMITED MODE:
 * - devOnly: If true, only show program when developer mode is enabled
 * - limitedMode: If true, show limited dashboard with only calculators and game manual
 * - limitedModeMessage: Custom message to display on dashboard when in limited mode
 */
export interface ProgramConfig {
  id: number;
  shortName: string;
  competitionType: CompetitionType;
  apiType: APIType;
  matchFormat: MatchFormat;
  skillsTypes: SkillsType[];
  availableGrades: GradeLevel[];

  // Display preferences
  useThemedScoreColors: boolean; // If true, use textColor for scores; if false, use red/blue alliance colors

  // Feature flags (control screen visibility)
  hasSkills: boolean;
  hasTeams: boolean;
  hasMatches: boolean;
  hasRankings: boolean;
  hasAwards: boolean;
  hasWorldSkills: boolean;
  hasScoreCalculators: boolean;

  // Skills-specific flags (maps to API skill types)
  hasDriverSkills: boolean;      // Has driver/primary skill (API: type='driver')
  hasProgrammingSkills: boolean; // Has programming/secondary skill (API: type='programming')

  // Rankings
  hasFinalistRankings: boolean;  // Has finalist rankings in addition to qualification rankings

  // Score calculator
  scoreCalculator: ScoreCalculatorType;
  scoreCalculatorRequiresDev: boolean;

  // Developer / Limited Mode
  devOnly: boolean;
  limitedMode: boolean;
  limitedModeMessage?: string;
}

/**
 * Complete program configuration
 * This is the single source of truth for all program data
 */
export const PROGRAM_CONFIGS: Record<ProgramType, ProgramConfig> = {
  'VEX V5 Robotics Competition': {
    id: 1,
    shortName: 'V5RC',
    competitionType: 'robotics',
    apiType: 'RobotEvents',
    matchFormat: '2v2', // 4 teams: 2 vs 2 competitive
    skillsTypes: ['driver', 'programming'],
    availableGrades: ['High School', 'Middle School'],
    useThemedScoreColors: false, // Competitive 2v2 - use red/blue alliance colors
    hasSkills: true,
    hasTeams: true,
    hasMatches: true,
    hasRankings: true,
    hasAwards: true,
    hasWorldSkills: true,
    hasScoreCalculators: true,
    hasDriverSkills: true,      // Driver Skills
    hasProgrammingSkills: true, // Programming Skills
    hasFinalistRankings: false,
    scoreCalculator: 'v5rc',
    scoreCalculatorRequiresDev: true,
    devOnly: false,
    limitedMode: false,
  },
  'VEX IQ Robotics Competition': {
    id: 41,
    shortName: 'VIQRC',
    competitionType: 'robotics',
    useThemedScoreColors: false,  // Cooperative 2v0 - use themed text colors
    apiType: 'RobotEvents',
    matchFormat: '2v0', // 2 teams working together cooperatively
    skillsTypes: ['driver', 'programming'],
    availableGrades: ['Elementary', 'Middle School'],
    hasSkills: true,
    hasTeams: true,
    hasMatches: true,
    hasRankings: true,
    hasAwards: true,
    hasWorldSkills: true,
    hasScoreCalculators: false,
    hasDriverSkills: true,      // Driver Skills
    hasProgrammingSkills: true, // Programming Skills
    hasFinalistRankings: true,  // VEX IQ has finalist rankings
    scoreCalculator: 'viqrc',
    scoreCalculatorRequiresDev: true,
    devOnly: false,
    limitedMode: false,
  },
  'VEX U Robotics Competition': {
    id: 4,
    shortName: 'VURC',
    useThemedScoreColors: false, // Competitive 1v1 - use red/blue alliance colors
    competitionType: 'robotics',
    apiType: 'RobotEvents',
    matchFormat: '1v1',
    skillsTypes: ['driver', 'programming'],
    availableGrades: ['College'],
    hasSkills: true,
    hasTeams: true,
    hasMatches: true,
    hasRankings: true,
    hasAwards: true,
    hasWorldSkills: true,
    hasScoreCalculators: false, // No calculators yet
    hasDriverSkills: true,      // Driver Skills
    hasProgrammingSkills: true, // Programming Skills
    hasFinalistRankings: false,
    scoreCalculator: 'vurc',
    scoreCalculatorRequiresDev: true,
    devOnly: false,
    limitedMode: false,
  },
  'VEX AI Robotics Competition': {
    id: 57,
    useThemedScoreColors: true,
    shortName: 'VAIRC',
    competitionType: 'robotics',
    apiType: 'RobotEvents',
    matchFormat: '1v1',
    skillsTypes: ['autonomous'],
    availableGrades: ['High School', 'College'],
    hasSkills: true,
    hasTeams: true,
    hasMatches: true,
    hasRankings: true,
    hasAwards: true,
    hasWorldSkills: true,
    hasScoreCalculators: false,
    hasDriverSkills: false,
    hasProgrammingSkills: true,
    hasFinalistRankings: false,
    scoreCalculator: 'vairc',
    scoreCalculatorRequiresDev: true,
    devOnly: false,
    limitedMode: false,
  },
  'Aerial Drone Competition': {
    id: 44,
    shortName: 'ADC',
    competitionType: 'drone',
    apiType: 'RECFEvents',
    matchFormat: '2v0',
    useThemedScoreColors: false,
    skillsTypes: ['piloting', 'autonomous'],
    availableGrades: ['High School', 'Middle School'],
    hasSkills: true,
    hasTeams: true,
    hasMatches: true,
    hasRankings: true,
    hasAwards: true,
    hasWorldSkills: false,
    hasScoreCalculators: true,
    scoreCalculator: 'adc',
    scoreCalculatorRequiresDev: false,
    hasDriverSkills: true,
    hasProgrammingSkills: true,
    hasFinalistRankings: false,
    devOnly: false,
    limitedMode: true, // Show limited dashboard until API is ready
    limitedModeMessage: 'Due to the change in website for the Aerial Drone Competition, the app is currently unable to access data for this program. In the meantime, you can access score calculators and the game manual.',
  },
  'VEX AIR Drone Competition': {
    id: 58,
    shortName: 'VADC',
    competitionType: 'drone',
    apiType: 'RobotEvents',
    matchFormat: '2v0', // Individual performance/flights
    useThemedScoreColors: false,
    skillsTypes: ['flight', 'autonomous'],
    availableGrades: ['High School'],
    hasSkills: true,
    hasTeams: true,
    hasMatches: true,
    hasRankings: true,
    hasAwards: true,
    hasWorldSkills: false,
    hasScoreCalculators: false,
    hasDriverSkills: true,      // Flight Skills (API stores as 'driver')
    hasProgrammingSkills: true, // Autonomous Flight (API stores as 'programming')
    hasFinalistRankings: false,
    scoreCalculator: 'vadc',
    scoreCalculatorRequiresDev: true, // Available to all users
    devOnly: true,
    limitedMode: false,
  },
};

/**
 * Legacy program ID mapping for backward compatibility
 */
export const PROGRAM_IDS: Record<ProgramType, number> = Object.fromEntries(
  Object.entries(PROGRAM_CONFIGS).map(([name, config]) => [name, config.id])
) as Record<ProgramType, number>;

/**
 * Get program ID from program name
 * @param program Program name
 * @returns Program ID (defaults to 1 for VEX V5 if program not found)
 */
export const getProgramId = (program: ProgramType | string): number => {
  return PROGRAM_IDS[program as ProgramType] || 1;
};

/**
 * Get full program configuration
 * @param program Program name
 * @returns Program configuration object
 */
export const getProgramConfig = (program: ProgramType | string): ProgramConfig => {
  return PROGRAM_CONFIGS[program as ProgramType] || PROGRAM_CONFIGS['VEX V5 Robotics Competition'];
};

/**
 * Get match format for a program
 * @param program Program name
 * @returns Match format (2v2, 2v0, etc.)
 */
export const getMatchFormat = (program: ProgramType | string): MatchFormat => {
  return getProgramConfig(program).matchFormat;
};

/**
 * Get competition type for a program
 * @param program Program name
 * @returns Competition type (robotics, drone, esports)
 */
export const getCompetitionType = (program: ProgramType | string): CompetitionType => {
  return getProgramConfig(program).competitionType;
};

/**
 * Get available skills types for a program
 * @param program Program name
 * @returns Array of skills types
 */
export const getSkillsTypes = (program: ProgramType | string): SkillsType[] => {
  return getProgramConfig(program).skillsTypes;
};

/**
 * Check if a program has specific features
 */
export const programHasMatches = (program: ProgramType | string): boolean => {
  return getProgramConfig(program).hasMatches;
};

export const programHasSkills = (program: ProgramType | string): boolean => {
  return getProgramConfig(program).hasSkills;
};

export const programHasWorldSkills = (program: ProgramType | string): boolean => {
  return getProgramConfig(program).hasWorldSkills;
};

export const programHasRankings = (program: ProgramType | string): boolean => {
  return getProgramConfig(program).hasRankings;
};

export const programHasAwards = (program: ProgramType | string): boolean => {
  return getProgramConfig(program).hasAwards;
};

/**
 * Check if matches should be displayed as team vs team
 * @param program Program name
 * @returns True if matches involve teams competing against each other
 */
export const isTeamVsTeamFormat = (program: ProgramType | string): boolean => {
  const format = getMatchFormat(program);
  return format === '2v2' || format === '1v1';
};

/**
 * Check if matches should be displayed as 2v0 format
 * @param program Program name
 * @returns True if format is 2v0 (individual or cooperative)
 */
export const is2v0Format = (program: ProgramType | string): boolean => {
  const format = getMatchFormat(program);
  return format === '2v0';
};

/**
 * Get short name for a program
 * @param program Program name
 * @returns Short name (e.g., "V5RC", "VIQRC")
 */
export const getProgramShortName = (program: ProgramType | string): string => {
  return getProgramConfig(program).shortName;
};

/**
 * Get all available program IDs as an array
 */
export const getAllProgramIds = (): number[] => {
  return Object.values(PROGRAM_IDS);
};

/**
 * Get all available program names as an array
 */
export const getAllProgramNames = (): ProgramType[] => {
  return Object.keys(PROGRAM_IDS) as ProgramType[];
};

/**
 * Check if a program exists in our mappings
 */
export const isValidProgram = (program: string): program is ProgramType => {
  return program in PROGRAM_IDS;
};

/**
 * Get programs by competition type
 * @param competitionType Type of competition
 * @returns Array of program names matching the type
 */
export const getProgramsByType = (competitionType: CompetitionType): ProgramType[] => {
  return Object.entries(PROGRAM_CONFIGS)
    .filter(([_, config]) => config.competitionType === competitionType)
    .map(([name, _]) => name as ProgramType);
};

/**
 * Get programs that support a specific feature
 * @param feature Feature to check for
 * @returns Array of program names that support the feature
 */
export const getProgramsWithFeature = (feature: keyof Pick<ProgramConfig, 'hasSkills' | 'hasMatches' | 'hasRankings' | 'hasAwards' | 'hasWorldSkills'>): ProgramType[] => {
  return Object.entries(PROGRAM_CONFIGS)
    .filter(([_, config]) => config[feature])
    .map(([name, _]) => name as ProgramType);
};

/**
 * Get available grade levels for a program
 * @param program Program name
 * @returns Array of grade levels available for the program
 */
export const getAvailableGrades = (program: ProgramType | string): GradeLevel[] => {
  return getProgramConfig(program).availableGrades;
};

/**
 * Check if a program supports a specific grade level
 * @param program Program name
 * @param grade Grade level to check
 * @returns True if the program supports the grade level
 */
export const programSupportsGrade = (program: ProgramType | string, grade: GradeLevel): boolean => {
  return getAvailableGrades(program).includes(grade);
};

/**
 * Get programs that support a specific grade level
 * @param grade Grade level to filter by
 * @returns Array of program names that support the grade level
 */
export const getProgramsByGrade = (grade: GradeLevel): ProgramType[] => {
  return Object.entries(PROGRAM_CONFIGS)
    .filter(([_, config]) => config.availableGrades.includes(grade))
    .map(([name, _]) => name as ProgramType);
};

/**
 * Get score calculator type for a program
 * @param program Program name
 * @returns Score calculator type (or null if no calculator available)
 */
export const getScoreCalculator = (program: ProgramType | string): ScoreCalculatorType => {
  return getProgramConfig(program).scoreCalculator;
};

/**
 * Check if a program has a score calculator
 * @param program Program name
 * @returns True if program has a score calculator
 */
export const hasScoreCalculator = (program: ProgramType | string): boolean => {
  return getScoreCalculator(program) !== null;
};

/**
 * Get available calculator screens for a program
 * @param program Program name
 * @returns Array of calculator screen configurations
 */
export const getCalculatorScreens = (program: ProgramType | string): CalculatorScreenConfig[] => {
  const calculatorType = getScoreCalculator(program);
  if (!calculatorType) return [];
  return CALCULATOR_SCREENS[calculatorType] || [];
};

/**
 * Get all calculator screen names for a program
 * @param program Program name
 * @returns Array of screen names
 */
export const getCalculatorScreenNames = (program: ProgramType | string): string[] => {
  return getCalculatorScreens(program).map(screen => screen.screenName);
};

/**
 * Check if a specific calculator screen is available for a program
 * @param program Program name
 * @param screenName Screen name to check
 * @returns True if the screen is available for this program
 */
export const isCalculatorAvailableForProgram = (program: ProgramType | string, screenName: string): boolean => {
  return getCalculatorScreenNames(program).includes(screenName);
};
/**
 * Check if score calculators should be shown for a program
 * Takes into account program config, developer mode, and the score calculator toggle
 * @param program Program name
 * @param isDeveloperMode Whether developer mode is enabled
 * @param scoreCalculatorToggle Whether the score calculator dev toggle is enabled (only affects dev-required calculators)
 * @returns True if calculators should be visible
 */
export const shouldShowScoreCalculators = (
  program: ProgramType | string,
  isDeveloperMode: boolean = false,
  scoreCalculatorToggle: boolean = true
): boolean => {
  const config = getProgramConfig(program);

  if (!config.hasScoreCalculators) {
    return false;
  }

  if (config.scoreCalculatorRequiresDev) {
    // Must have dev mode enabled AND the score calculator toggle enabled
    if (!isDeveloperMode || !scoreCalculatorToggle) {
      return false;
    }
  }

  // Otherwise, show if there are calculators available
  return config.scoreCalculator !== null;
};

/**
 * Check if a program has score calculators feature enabled
 * @param program Program name
 * @returns True if program has calculators enabled (regardless of dev mode)
 */
export const programHasScoreCalculators = (program: ProgramType | string): boolean => {
  return getProgramConfig(program).hasScoreCalculators;
};

/**
 * Check if a program is in limited mode
 * @param program Program name
 * @returns True if program is in limited mode (calculators and manual only)
 */
export const isProgramLimitedMode = (program: ProgramType | string): boolean => {
  return getProgramConfig(program).limitedMode;
};

/**
 * Check if a program requires developer mode to access
 * @param program Program name
 * @returns True if program requires developer mode
 */
export const isProgramDevOnly = (program: ProgramType | string): boolean => {
  return getProgramConfig(program).devOnly;
};

/**
 * Get limited mode message for a program
 * @param program Program name
 * @returns Custom message for limited mode, or undefined if not in limited mode
 */
export const getLimitedModeMessage = (program: ProgramType | string): string | undefined => {
  return getProgramConfig(program).limitedModeMessage;
};

/**
 * Get API type for a program
 * @param program Program name
 * @returns API type ('RobotEvents' or 'RECFEvents')
 */
export const getAPIType = (program: ProgramType | string): APIType => {
  return getProgramConfig(program).apiType;
};

/**
 * Check if a program uses themed score colors or alliance colors
 * @param program Program name
 * @returns true if scores should use textColor (themed), false if scores should use red/blue alliance colors
 */
export const useThemedScoreColors = (program: ProgramType | string): boolean => {
  return getProgramConfig(program).useThemedScoreColors;
};

/**
 * Get score color for a program based on alliance and theme
 * @param program Program name
 * @param alliance Alliance color ('red' or 'blue')
 * @param textColor Current theme text color
 * @returns Color to use for the score
 */
export const getScoreColor = (
  program: ProgramType | string,
  alliance: 'red' | 'blue',
  textColor: string
): string => {
  const usedThemedColors = useThemedScoreColors(program);
  
  if (usedThemedColors) {
    return textColor;
  }
  
  // Use alliance colors
  return alliance === 'red' ? '#FF3B30' : '#007AFF';
};
