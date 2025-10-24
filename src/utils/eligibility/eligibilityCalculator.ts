import {
  TeamSkills,
  RawSkill,
  TeamRanking,
  RobotProgram,
  ProgramRules,
  PROGRAM_RULES,
  PROGRAM_CONFIGS
} from './types';
import { Team } from '../../types';
import { applyProgramSpecificRounding, getDynamicLabel } from './common';

/**
 * Main eligibility calculation function that mirrors the Dart tableRecords getter exactly
 */
export const calculateEligibility = (
  teams: Team[],
  rawRankings: any[],
  rawSkills: RawSkill[],
  awards: any[],
  selectedProgram: RobotProgram,
  eventHasSplitGradeAwards: boolean
): TeamSkills[] => {
  const programRules = PROGRAM_RULES[selectedProgram];
  const programConfig = PROGRAM_CONFIGS[selectedProgram];

  if (!programRules || !programConfig || teams.length === 0) {
    return [];
  }

  const attendingTeams = teams.filter(team => {
    // Check if team has a qualification ranking (indicating they attended)
    return rawRankings.some(ranking => (ranking.team?.id || ranking.teamId) === team.id && ranking.rank > 0);
  });

  console.log('Eligibility calculation:', teams.length, 'total teams,', attendingTeams.length, 'attending teams with qualification rankings');

  const teamMap = new Map<number, Team>();
  attendingTeams.forEach(team => {
    teamMap.set(team.id, team);
  });

  // Process best skills runs exactly like Dart
  const bestProgrammingRuns = new Map<number, RawSkill>();
  const bestDriverRuns = new Map<number, RawSkill>();

  teamMap.forEach((team, teamId) => {
    const teamRawSkills = rawSkills.filter(s => s.teamId === teamId);

    // Find best programming run
    const programmingRuns = teamRawSkills.filter(s => s.type === 'programming');
    if (programmingRuns.length > 0) {
      const best = programmingRuns.reduce((prev, current) =>
        (current.score > prev.score) ? current : prev
      );
      bestProgrammingRuns.set(teamId, best);
    }

    // Find best driver run
    const driverRuns = teamRawSkills.filter(s => s.type === 'driver');
    if (driverRuns.length > 0) {
      const best = driverRuns.reduce((prev, current) =>
        (current.score > prev.score) ? current : prev
      );
      bestDriverRuns.set(teamId, best);
    }
  });

  // Create overall skills rankings (combined scores)
  const teamsWithCombinedScoresForOverallRank: Array<{teamId: number, combinedScore: number}> = [];

  teamMap.forEach((team, teamId) => {
    const programmingScore = bestProgrammingRuns.get(teamId)?.score || 0;
    const driverScore = bestDriverRuns.get(teamId)?.score || 0;
    const combinedScore = programmingScore + driverScore;

    if (combinedScore > 0 || bestProgrammingRuns.has(teamId) || bestDriverRuns.has(teamId)) {
      teamsWithCombinedScoresForOverallRank.push({ teamId, combinedScore });
    }
  });

  teamsWithCombinedScoresForOverallRank.sort((a, b) => b.combinedScore - a.combinedScore);

  const overallSkillsRanksMap = new Map<number, number>();
  teamsWithCombinedScoresForOverallRank.forEach((teamData, index) => {
    overallSkillsRanksMap.set(teamData.teamId, index + 1);
  });

  // Grade-specific rankings logic
  const gradeQualifierRankingsMap = new Map<string, any[]>();
  const gradeSkillsRankingsMap = new Map<string, Array<{teamId: number, rank: number}>>();
  const gradeProgrammingOnlyRankingsMap = new Map<string, Array<{teamId: number, rank: number}>>();

  const isCombinedDivisionEvent = !programRules.hasMiddleSchoolHighSchoolDivisions || !eventHasSplitGradeAwards;
  const checkProgRankRule = programRules.requiresRankInPositiveProgrammingSkills;

  if (!isCombinedDivisionEvent || checkProgRankRule) {
    const grades = new Set(attendingTeams.map(t => t.grade?.toLowerCase() || '').filter(g => g));
    const contextsToProcess: string[] = [];

    if (isCombinedDivisionEvent && checkProgRankRule) {
      contextsToProcess.push("overall_for_prog_rank");
    } else if (!isCombinedDivisionEvent) {
      contextsToProcess.push(...grades);
      if (attendingTeams.some(t => !t.grade)) {
        contextsToProcess.push("no_grade_for_prog_rank");
      }
    }

    for (const gradeOrContext of contextsToProcess) {
      // Qualifier rankings by grade
      if (!isCombinedDivisionEvent && gradeOrContext !== "overall_for_prog_rank" && gradeOrContext !== "no_grade_for_prog_rank") {
        const gradeQualifiers = rawRankings
          .filter(r => {
            const rTeam = teamMap.get(r.team?.id || r.teamId);
            return rTeam && (rTeam.grade?.toLowerCase() || '') === gradeOrContext && r.rank > 0;
          })
          .sort((a, b) => a.rank - b.rank);
        gradeQualifierRankingsMap.set(gradeOrContext, gradeQualifiers);
      }

      // Skills rankings by grade
      if (!isCombinedDivisionEvent && gradeOrContext !== "overall_for_prog_rank" && gradeOrContext !== "no_grade_for_prog_rank") {
        const gradeTeamsWithCombinedScores: Array<{teamId: number, combinedScore: number}> = [];

        teamMap.forEach((team, teamId) => {
          if ((team.grade?.toLowerCase() || '') === gradeOrContext) {
            const programmingScore = bestProgrammingRuns.get(teamId)?.score || 0;
            const driverScore = bestDriverRuns.get(teamId)?.score || 0;
            const combinedScore = programmingScore + driverScore;

            if (combinedScore > 0 || bestProgrammingRuns.has(teamId) || bestDriverRuns.has(teamId)) {
              gradeTeamsWithCombinedScores.push({ teamId, combinedScore });
            }
          }
        });

        gradeTeamsWithCombinedScores.sort((a, b) => b.combinedScore - a.combinedScore);

        const gradeSkillRanks = gradeTeamsWithCombinedScores.map((teamData, index) => ({
          teamId: teamData.teamId,
          rank: index + 1
        }));

        gradeSkillsRankingsMap.set(gradeOrContext, gradeSkillRanks);
      }

      // Programming-only rankings
      if (checkProgRankRule) {
        const programmingOnlyPool: Array<{teamId: number, score: number}> = [];

        teamMap.forEach((team, teamId) => {
          let include = false;
          if (gradeOrContext === "overall_for_prog_rank") {
            include = true;
          } else if (gradeOrContext === "no_grade_for_prog_rank" && !team.grade) {
            include = true;
          } else if ((team.grade?.toLowerCase() || '') === gradeOrContext) {
            include = true;
          }

          if (include) {
            const progRun = bestProgrammingRuns.get(teamId);
            if (progRun && progRun.score > 0) {
              programmingOnlyPool.push({ teamId, score: progRun.score });
            }
          }
        });

        programmingOnlyPool.sort((a, b) => b.score - a.score);

        const progOnlyRanks = programmingOnlyPool.map((teamData, index) => ({
          teamId: teamData.teamId,
          rank: index + 1
        }));

        gradeProgrammingOnlyRankingsMap.set(gradeOrContext, progOnlyRanks);
      }
    }
  }

  // Calculate eligibility for each attending team
  return attendingTeams.map(team => {
    const bestProgRun = bestProgrammingRuns.get(team.id);
    const bestDriverRun = bestDriverRuns.get(team.id);

    const teamProgrammingScore = bestProgRun?.score || 0;
    const teamProgrammingAttempts = bestProgRun?.attempts || 0;
    const teamDriverScore = bestDriverRun?.score || 0;
    const teamDriverAttempts = bestDriverRun?.attempts || 0;

    const overallRankingData = rawRankings.find(r => (r.team?.id || r.teamId) === team.id);

    let displayQualRank = overallRankingData?.rank > 0 ? overallRankingData.rank : -1;
    let displaySkillsRank = overallSkillsRanksMap.get(team.id) || -1;

    let isInQualifyingRank: boolean;
    let isInSkillsRank: boolean;
    let qualCutoffValue: number;
    let skillsCutoffValue: number;
    let teamProgrammingOnlyRank = -1;
    let programmingOnlyRankCutoffValue = -1;
    let meetsProgOnlyRankCriterion = true;

    if (isCombinedDivisionEvent) {
      const totalRankedTeamsInDivision = rawRankings.filter(r => r.rank > 0).length;
      qualCutoffValue = Math.max(1, applyProgramSpecificRounding(totalRankedTeamsInDivision * programRules.threshold, selectedProgram));
      isInQualifyingRank = displayQualRank > 0 && displayQualRank <= qualCutoffValue;

      skillsCutoffValue = Math.max(1, applyProgramSpecificRounding(totalRankedTeamsInDivision * programRules.threshold, selectedProgram));
      isInSkillsRank = displaySkillsRank > 0 && displaySkillsRank <= skillsCutoffValue;

      if (programRules.requiresRankInPositiveProgrammingSkills) {
        const progOnlyPool = gradeProgrammingOnlyRankingsMap.get("overall_for_prog_rank");
        if (teamProgrammingScore > 0 && progOnlyPool && progOnlyPool.length > 0) {
          const teamEntryInPool = progOnlyPool.find(e => e.teamId === team.id);
          teamProgrammingOnlyRank = teamEntryInPool?.rank || -1;

          programmingOnlyRankCutoffValue = Math.max(1, applyProgramSpecificRounding(totalRankedTeamsInDivision * programRules.programmingSkillsRankThreshold, selectedProgram));
          meetsProgOnlyRankCriterion = teamProgrammingOnlyRank > 0 && teamProgrammingOnlyRank <= programmingOnlyRankCutoffValue;
        } else {
          meetsProgOnlyRankCriterion = false;
        }
      }
    } else {
      // Grade-specific logic
      const teamGrade = (team.grade?.toLowerCase() || '');
      const gradeContextKey = teamGrade || "no_grade_for_prog_rank";

      if (teamGrade && gradeQualifierRankingsMap.has(teamGrade)) {
        const gradeQualifiers = gradeQualifierRankingsMap.get(teamGrade)!;
        const gradeSpecificQualifierCount = gradeQualifiers.length;
        qualCutoffValue = Math.max(1, applyProgramSpecificRounding(gradeSpecificQualifierCount * programRules.threshold, selectedProgram));

        const teamIndexInGradeQual = gradeQualifiers.findIndex(r => (r.team?.id || r.teamId) === team.id);
        displayQualRank = (teamIndexInGradeQual !== -1) ? teamIndexInGradeQual + 1 : -1;
        isInQualifyingRank = displayQualRank > 0 && displayQualRank <= qualCutoffValue;

        skillsCutoffValue = Math.max(1, applyProgramSpecificRounding(gradeSpecificQualifierCount * programRules.threshold, selectedProgram));

        const gradeSkillsRankList = gradeSkillsRankingsMap.get(teamGrade);
        const gradeSkillEntryForTeam = gradeSkillsRankList?.find(s => s.teamId === team.id);
        displaySkillsRank = gradeSkillEntryForTeam?.rank || -1;
        isInSkillsRank = displaySkillsRank > 0 && displaySkillsRank <= skillsCutoffValue;

        if (programRules.requiresRankInPositiveProgrammingSkills) {
          const progOnlyPool = gradeProgrammingOnlyRankingsMap.get(gradeContextKey);
          if (teamProgrammingScore > 0 && progOnlyPool && progOnlyPool.length > 0) {
            const teamEntryInPool = progOnlyPool.find(e => e.teamId === team.id);
            teamProgrammingOnlyRank = teamEntryInPool?.rank || -1;

            programmingOnlyRankCutoffValue = Math.max(1, applyProgramSpecificRounding(gradeSpecificQualifierCount * programRules.programmingSkillsRankThreshold, selectedProgram));
            meetsProgOnlyRankCriterion = teamProgrammingOnlyRank > 0 && teamProgrammingOnlyRank <= programmingOnlyRankCutoffValue;
          } else {
            meetsProgOnlyRankCriterion = false;
          }
        }
      } else {
        isInQualifyingRank = false;
        isInSkillsRank = false;
        qualCutoffValue = -1;
        skillsCutoffValue = -1;
        displayQualRank = overallRankingData?.rank > 0 ? overallRankingData.rank : -1;
        meetsProgOnlyRankCriterion = false;
      }
    }

    const isEligible = isInQualifyingRank &&
                      isInSkillsRank &&
                      meetsProgOnlyRankCriterion &&
                      (programRules.requiresProgrammingSkills ? (teamProgrammingScore > 0) : true) &&
                      (programRules.requiresDriverSkills ? (teamDriverScore > 0) : true);

    return {
      team,
      qualifierRank: displayQualRank,
      skillsRank: displaySkillsRank,
      programmingScore: teamProgrammingScore,
      driverScore: teamDriverScore,
      programmingAttempts: teamProgrammingAttempts,
      driverAttempts: teamDriverAttempts,
      eligible: isEligible,
      inRank: isInQualifyingRank,
      inSkill: isInSkillsRank,
      qualifierRankCutoff: qualCutoffValue,
      skillsRankCutoff: skillsCutoffValue,
      programmingOnlyRank: teamProgrammingOnlyRank,
      programmingOnlyRankCutoff: programmingOnlyRankCutoffValue,
      meetsProgrammingOnlyRankCriterion: meetsProgOnlyRankCriterion,
    };
  });
};

/**
 * Sort teams with exact Dart logic
 */
export const sortTeamSkills = (teams: TeamSkills[], sortColumn?: string, sortAscending: boolean = true): TeamSkills[] => {
  return teams.sort((a, b) => {
    let result = 0;

    if (!sortColumn) {
      // Default sort: eligible first, then by qualifier rank, then by team number
      if (a.eligible !== b.eligible) return b.eligible ? 1 : -1;
      if (a.qualifierRank > 0 && b.qualifierRank > 0) return a.qualifierRank - b.qualifierRank;
      if (a.qualifierRank > 0) return -1;
      if (b.qualifierRank > 0) return 1;
      return a.team.number.localeCompare(b.team.number);
    }

    switch (sortColumn) {
      case 'teamNumber':
        result = a.team.number.localeCompare(b.team.number);
        break;
      case 'grade':
        result = (a.team.grade || '').localeCompare(b.team.grade || '');
        break;
      case 'organization':
        result = (a.team.organization || '').localeCompare(b.team.organization || '');
        break;
      case 'state':
        result = (a.team.location?.region || '').localeCompare(b.team.location?.region || '');
        break;
      case 'eligible':
        result = (a.eligible ? 1 : 0) - (b.eligible ? 1 : 0);
        break;
      case 'qualifierRank':
        if (a.qualifierRank === -1 && b.qualifierRank === -1) result = 0;
        else if (a.qualifierRank === -1) result = 1;
        else if (b.qualifierRank === -1) result = -1;
        else result = a.qualifierRank - b.qualifierRank;
        break;
      case 'skillsRank':
        if (a.skillsRank === -1 && b.skillsRank === -1) result = 0;
        else if (a.skillsRank === -1) result = 1;
        else if (b.skillsRank === -1) result = -1;
        else result = a.skillsRank - b.skillsRank;
        break;
      case 'driverScore':
        result = a.driverScore - b.driverScore;
        break;
      case 'programmingScore':
        result = a.programmingScore - b.programmingScore;
        break;
      default:
        result = 0;
    }

    return sortAscending ? result : -result;
  });
};

/**
 * Get program requirements description
 */
export const getProgramRequirements = (program: RobotProgram): string[] => {
  const rules = PROGRAM_RULES[program];
  const config = PROGRAM_CONFIGS[program];

  if (!rules || !config) return [];

  const requirements: string[] = [];

  requirements.push(`Top ${(rules.threshold * 100).toFixed(0)}% of qualification rankings`);
  requirements.push(`Top ${(rules.threshold * 100).toFixed(0)}% of combined skills rankings`);

  if (rules.requiresProgrammingSkills) {
    requirements.push(`${getDynamicLabel(program, 'Programming')} score above zero required`);
  }

  if (rules.requiresDriverSkills) {
    requirements.push(`${getDynamicLabel(program, 'Driver')} score above zero required`);
  }

  if (rules.requiresRankInPositiveProgrammingSkills) {
    requirements.push(`Top ${(rules.programmingSkillsRankThreshold * 100).toFixed(0)}% of ${getDynamicLabel(program, 'Programming').toLowerCase()}-only rankings`);
  }

  return requirements;
};