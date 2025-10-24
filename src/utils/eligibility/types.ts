import { Team } from '../../types';

export interface TeamRanking {
  team: Team;
  rank: number;
  wins: number;
  losses: number;
  ties: number;
  wp: number;
  ap: number;
  sp: number;
  high_score: number;
  average_points: number;
  total_points: number;
}

export interface RawSkill {
  teamId: number;
  score: number;
  type: 'programming' | 'driver';
  attempts: number;
}

export interface TeamSkills {
  team: Team;
  qualifierRank: number;
  skillsRank: number;
  programmingScore: number;
  driverScore: number;
  programmingAttempts: number;
  driverAttempts: number;
  eligible: boolean;
  inRank: boolean;
  inSkill: boolean;
  qualifierRankCutoff: number;
  skillsRankCutoff: number;
  programmingOnlyRank: number;
  programmingOnlyRankCutoff: number;
  meetsProgrammingOnlyRankCriterion: boolean;
}

export interface ProgramRules {
  threshold: number;
  requiresProgrammingSkills: boolean;
  requiresDriverSkills: boolean;
  requiresRankInPositiveProgrammingSkills: boolean;
  programmingSkillsRankThreshold: number;
  hasMiddleSchoolHighSchoolDivisions: boolean;
  splitAwardGrades?: string[];
}

export enum RobotProgram {
  ADC = 'adc',
  V5RC = 'v5rc',
  VIQRC = 'viqrc'
}

export interface ProgramInfo {
  id: number;
  name: string;
  awardName: string;
  skuPrefix: string;
}

export const PROGRAM_CONFIGS: Record<RobotProgram, ProgramInfo> = {
  [RobotProgram.ADC]: {
    id: 37,
    name: 'Aerial Drone Competition',
    awardName: 'All Around Champion',
    skuPrefix: 'RE-ADC-'
  },
  [RobotProgram.V5RC]: {
    id: 1,
    name: 'VEX Robotics Competition',
    awardName: 'Excellence Award',
    skuPrefix: 'RE-V5RC-'
  },
  [RobotProgram.VIQRC]: {
    id: 41,
    name: 'VEX IQ Robotics Competition',
    awardName: 'Excellence Award',
    skuPrefix: 'RE-VIQRC-'
  }
};

export const PROGRAM_RULES: Record<RobotProgram, ProgramRules> = {
  [RobotProgram.ADC]: {
    threshold: 0.5,
    requiresProgrammingSkills: true,
    requiresDriverSkills: false,
    requiresRankInPositiveProgrammingSkills: false,
    programmingSkillsRankThreshold: 0.0,
    hasMiddleSchoolHighSchoolDivisions: false,
    splitAwardGrades: undefined
  },
  [RobotProgram.V5RC]: {
    threshold: 0.4,
    requiresProgrammingSkills: true,
    requiresDriverSkills: true,
    requiresRankInPositiveProgrammingSkills: true,
    programmingSkillsRankThreshold: 0.4,
    hasMiddleSchoolHighSchoolDivisions: true,
    splitAwardGrades: ['High School', 'Middle School']
  },
  [RobotProgram.VIQRC]: {
    threshold: 0.4,
    requiresProgrammingSkills: true,
    requiresDriverSkills: true,
    requiresRankInPositiveProgrammingSkills: true,
    programmingSkillsRankThreshold: 0.4,
    hasMiddleSchoolHighSchoolDivisions: true,
    splitAwardGrades: ['High School', 'Middle School', 'Elementary']
  }
};

export type GradeLevel = 'Elementary' | 'Middle School' | 'High School';

export interface EligibilityResult {
  team: Team;
  isEligible: boolean;
  reasons: string[];
  qualifierRank?: number;
  skillsRank?: number;
  programmingScore: number;
  driverScore: number;
  autoSkillsRank?: number;
}

export interface AwardEligibilityConfig {
  gradeLevel?: GradeLevel;
  isCombinedAward?: boolean;
  getDynamicLabel: (baseLabel: string) => string;
}