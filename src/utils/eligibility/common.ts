import { RobotProgram, TeamRanking, GradeLevel } from './types';

// Exact Dart rounding helper functions
export const roundHalfUp = (value: number): number => {
  return Math.round(value);
};

export const roundHalfToEven = (value: number): number => {
  if (value < 0) {
    throw new Error("This rounding function is intended for non-negative cutoff values.");
  }

  const fraction = value - Math.floor(value);
  if (Math.abs(fraction - 0.5) < Number.EPSILON) {
    if (Math.floor(value) % 2 === 0) {
      return Math.floor(value);
    } else {
      return Math.ceil(value);
    }
  }
  return Math.round(value);
};

export const applyProgramSpecificRounding = (calculatedValue: number, program: RobotProgram): number => {
  if (program === RobotProgram.ADC) {
    return roundHalfToEven(calculatedValue);
  } else {
    return roundHalfUp(calculatedValue);
  }
};

// Filter teams by grade level
export const filterTeamsByGrade = (teams: TeamRanking[], grade: GradeLevel): TeamRanking[] => {
  return teams.filter(ranking => {
    if (!ranking.team.grade) return grade === 'High School'; // Default to High School if no grade

    const teamGrade = ranking.team.grade.toLowerCase();

    if (grade === 'Elementary') {
      return teamGrade.includes('elementary');
    } else if (grade === 'Middle School') {
      return teamGrade.includes('middle') || teamGrade.includes('6') || teamGrade.includes('7') || teamGrade.includes('8');
    } else { // High School
      return !teamGrade.includes('elementary') && !teamGrade.includes('middle') &&
             !teamGrade.includes('6') && !teamGrade.includes('7') && !teamGrade.includes('8');
    }
  });
};

// Detect if awards are combined or split by grade
export const detectAwardType = (awardTitle: string): { isCombined: boolean; gradeLevel?: GradeLevel } => {
  const title = awardTitle.toLowerCase();

  if (title.includes('elementary')) {
    return { isCombined: false, gradeLevel: 'Elementary' };
  } else if (title.includes('middle school')) {
    return { isCombined: false, gradeLevel: 'Middle School' };
  } else if (title.includes('high school')) {
    return { isCombined: false, gradeLevel: 'High School' };
  }

  return { isCombined: true };
};

// Helper to get dynamic label based on program
export const getDynamicLabel = (program: RobotProgram, baseLabel: string): string => {
  if (program === RobotProgram.ADC) {
    switch (baseLabel) {
      case 'Programming':
        return 'Auton';
      case 'Driver':
        return 'Pilot';
      default:
        return baseLabel;
    }
  }
  return baseLabel;
};