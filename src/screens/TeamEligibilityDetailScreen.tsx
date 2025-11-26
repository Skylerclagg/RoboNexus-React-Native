/**
 * Team Eligibility Detail Screen
 *
 * Description:
 * Displays comprehensive eligibility information for a specific team, showing detailed
 * performance data, award requirements, and qualification status. Provides in-depth
 * analysis of team standings and eligibility criteria for various VEX competitions.
 *
 * Navigation:
 * Accessed by tapping on a team from eligibility lists, team search results,
 * or team ranking screens throughout the app.
 *
 * Key Features:
 * - Complete team information display with location and organization
 * - Detailed performance metrics (qualification rank, skills rank, scores)
 * - Visual eligibility status indicators with pass/fail requirements
 * - Program-specific award requirements and thresholds
 * - Dynamic labeling for different competition types
 * - Color-coded requirement status with detailed explanations
 */
import React from 'react';
import { View, Text, ScrollView, StyleSheet, SafeAreaView } from 'react-native';
import { StackScreenProps } from '@react-navigation/stack';
import { TeamSkills, RobotProgram, ProgramRules, PROGRAM_CONFIGS } from '../utils/eligibility/types';
import { getDynamicLabel } from '../utils/eligibility/common';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../contexts/SettingsContext';

interface TeamEligibilityDetailParams {
  teamSkills: TeamSkills;
  selectedProgram: RobotProgram;
  programRules: ProgramRules;
  fromModal?: boolean;
}

type Props = StackScreenProps<{ TeamEligibilityDetail: TeamEligibilityDetailParams }, 'TeamEligibilityDetail'>;

export const TeamEligibilityDetailScreen = ({ route, navigation }: Props) => {
  const { teamSkills, selectedProgram, programRules, fromModal } = route.params;
  const settings = useSettings();
  const {
    backgroundColor,
    textColor,
    cardBackgroundColor,
    secondaryTextColor,
    iconColor,
    borderColor,
  } = settings;
  const team = teamSkills.team;
  const programConfig = PROGRAM_CONFIGS[selectedProgram];

  React.useLayoutEffect(() => {
    navigation.setOptions({
      title: `${team.number} - ${programConfig?.awardName || 'Eligibility'}`,
      headerStyle: {
        backgroundColor: settings.topBarColor,
      },
      headerTintColor: settings.topBarContentColor,
      headerTitleAlign: 'center',
      headerTitleStyle: {
        fontSize: 16,
        color: settings.topBarContentColor,
      },
    });
  }, [navigation, team.number, programConfig, settings.topBarColor, settings.topBarContentColor]);

  const formatRank = (rank: number): string => {
    return rank < 0 ? 'N/A' : `#${rank}`;
  };

  const formatScore = (score: number, attempts: number): string => {
    return `${score} (${attempts} attempts)`;
  };

  // Create dynamic styles using theme colors
  const dynamicStyles = {
    headerCard: {
      ...styles.headerCard,
      backgroundColor: cardBackgroundColor,
    },
    section: {
      ...styles.section,
      backgroundColor: cardBackgroundColor,
    },
    sectionTitle: {
      ...styles.sectionTitle,
      color: textColor,
      borderBottomColor: borderColor,
    },
    infoLabel: {
      ...styles.infoLabel,
      color: textColor,
    },
    infoValue: {
      ...styles.infoValue,
      color: textColor,
    },
    infoRow: {
      ...styles.infoRow,
      borderBottomColor: borderColor,
    },
    teamNumber: {
      ...styles.teamNumber,
      color: textColor,
    },
    teamName: {
      ...styles.teamName,
      color: textColor,
    },
    organizationText: {
      ...styles.organizationText,
      color: secondaryTextColor,
    },
    locationText: {
      ...styles.locationText,
      color: secondaryTextColor,
    },
    requirementRow: {
      ...styles.requirementRow,
      borderBottomColor: borderColor,
    },
    requirementDetails: {
      ...styles.requirementDetails,
      color: secondaryTextColor,
    },
    resultSubtext: {
      ...styles.resultSubtext,
      color: secondaryTextColor,
    },
  };

  const buildInfoRow = (label: string, value: string, isPositive?: boolean) => (
    <View style={dynamicStyles.infoRow} key={label}>
      <Text style={dynamicStyles.infoLabel}>{label}:</Text>
      <Text style={[
        dynamicStyles.infoValue,
        isPositive === true && styles.positiveValue,
        isPositive === false && styles.negativeValue
      ]}>
        {value}
      </Text>
    </View>
  );

  const buildRequirementRow = (requirement: string, met: boolean, details?: string, index?: number) => (
    <View style={dynamicStyles.requirementRow} key={index}>
      <Ionicons
        name={met ? "checkmark-circle" : "close-circle"}
        size={20}
        color={met ? settings.successColor : settings.errorColor}
        style={styles.requirementIcon}
      />
      <View style={styles.requirementText}>
        <Text style={[
          styles.requirementLabel,
          { color: met ? settings.successColor : settings.errorColor }
        ]}>
          {requirement}
        </Text>
        {details && (
          <Text style={dynamicStyles.requirementDetails}>{details}</Text>
        )}
      </View>
    </View>
  );

  // Build location string
  const locationParts: string[] = [];
  if (team.location?.city) locationParts.push(team.location.city);
  if (team.location?.region) locationParts.push(team.location.region);
  if (team.location?.country) locationParts.push(team.location.country);
  const locationString = locationParts.join(', ');

  // Calculate requirement details
  const requirements = [];

  // Qualifier rank requirement
  const qualMet = teamSkills.inRank;
  const qualDetail = teamSkills.qualifierRankCutoff > 0
    ? `Rank: ${formatRank(teamSkills.qualifierRank)} (cutoff: #${teamSkills.qualifierRankCutoff})`
    : `Rank: ${formatRank(teamSkills.qualifierRank)}`;
  requirements.push({
    label: `Top ${(programRules.threshold * 100).toFixed(0)}% of qualification rankings`,
    met: qualMet,
    details: qualDetail
  });

  // Skills rank requirement
  const skillsMet = teamSkills.inSkill;
  const skillsDetail = teamSkills.skillsRankCutoff > 0
    ? `Rank: ${formatRank(teamSkills.skillsRank)} (cutoff: #${teamSkills.skillsRankCutoff})`
    : `Rank: ${formatRank(teamSkills.skillsRank)}`;
  requirements.push({
    label: `Top ${(programRules.threshold * 100).toFixed(0)}% of combined skills rankings`,
    met: skillsMet,
    details: skillsDetail
  });

  // Programming requirement
  if (programRules.requiresProgrammingSkills) {
    const progMet = teamSkills.programmingScore > 0;
    const progLabel = getDynamicLabel(selectedProgram, 'Programming');
    requirements.push({
      label: `${progLabel} score above zero required`,
      met: progMet,
      details: formatScore(teamSkills.programmingScore, teamSkills.programmingAttempts)
    });
  }

  // Driver requirement
  if (programRules.requiresDriverSkills) {
    const driverMet = teamSkills.driverScore > 0;
    const driverLabel = getDynamicLabel(selectedProgram, 'Driver');
    requirements.push({
      label: `${driverLabel} score above zero required`,
      met: driverMet,
      details: formatScore(teamSkills.driverScore, teamSkills.driverAttempts)
    });
  }

  // Programming-only rank requirement
  if (programRules.requiresRankInPositiveProgrammingSkills) {
    const progOnlyMet = teamSkills.meetsProgrammingOnlyRankCriterion;
    const progLabel = getDynamicLabel(selectedProgram, 'Programming');
    const progOnlyDetail = teamSkills.programmingOnlyRankCutoff > 0
      ? `Rank: ${formatRank(teamSkills.programmingOnlyRank)} (cutoff: #${teamSkills.programmingOnlyRankCutoff})`
      : `Rank: ${formatRank(teamSkills.programmingOnlyRank)}`;
    requirements.push({
      label: `Top ${(programRules.programmingSkillsRankThreshold * 100).toFixed(0)}% of ${progLabel.toLowerCase()}-only rankings`,
      met: progOnlyMet,
      details: progOnlyDetail
    });
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: settings.backgroundColor }]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        {/* Team Header */}
        <View style={dynamicStyles.headerCard}>
          <View style={styles.headerRow}>
            <View style={styles.teamNumberContainer}>
              <Text style={dynamicStyles.teamNumber}>{team.number}</Text>
            </View>
            <View style={styles.eligibilityContainer}>
              <Ionicons
                name={teamSkills.eligible ? "checkmark-circle" : "close-circle"}
                size={32}
                color={teamSkills.eligible ? settings.successColor : settings.errorColor}
              />
              <Text style={[
                styles.eligibilityText,
                { color: teamSkills.eligible ? settings.successColor : settings.errorColor }
              ]}>
                {teamSkills.eligible ? 'ELIGIBLE' : 'NOT ELIGIBLE'}
              </Text>
            </View>
          </View>

          <Text style={dynamicStyles.teamName}>{team.team_name}</Text>

          {team.organization && (
            <Text style={dynamicStyles.organizationText}>{team.organization}</Text>
          )}

          {locationString && (
            <Text style={dynamicStyles.locationText}>{locationString}</Text>
          )}
        </View>

        {/* Team Information */}
        <View style={dynamicStyles.section}>
          <Text style={dynamicStyles.sectionTitle}>Team Information</Text>
          <View style={styles.sectionContent}>
            {buildInfoRow('Team Number', team.number)}
            {buildInfoRow('Team Name', team.team_name)}
            {team.organization && buildInfoRow('Organization', team.organization)}
            {team.grade && buildInfoRow('Grade Level', team.grade)}
            {locationString && buildInfoRow('Location', locationString)}
          </View>
        </View>

        {/* Performance Data */}
        <View style={dynamicStyles.section}>
          <Text style={dynamicStyles.sectionTitle}>Performance Data</Text>
          <View style={styles.sectionContent}>
            {buildInfoRow(
              'Qualification Rank',
              formatRank(teamSkills.qualifierRank),
              teamSkills.inRank
            )}
            {buildInfoRow(
              'Skills Rank',
              formatRank(teamSkills.skillsRank),
              teamSkills.inSkill
            )}
            {buildInfoRow(
              getDynamicLabel(selectedProgram, 'Programming'),
              formatScore(teamSkills.programmingScore, teamSkills.programmingAttempts),
              teamSkills.programmingScore > 0
            )}
            {buildInfoRow(
              getDynamicLabel(selectedProgram, 'Driver'),
              formatScore(teamSkills.driverScore, teamSkills.driverAttempts),
              teamSkills.driverScore > 0
            )}
            {programRules.requiresRankInPositiveProgrammingSkills && (
              buildInfoRow(
                `${getDynamicLabel(selectedProgram, 'Programming')}-only Rank`,
                formatRank(teamSkills.programmingOnlyRank),
                teamSkills.meetsProgrammingOnlyRankCriterion
              )
            )}
          </View>
        </View>

        {/* Eligibility Requirements */}
        <View style={dynamicStyles.section}>
          <Text style={dynamicStyles.sectionTitle}>
            {programConfig?.awardName || 'Award'} Requirements
          </Text>
          <View style={styles.sectionContent}>
            {requirements.map((req, index) =>
              buildRequirementRow(req.label, req.met, req.details, index)
            )}
          </View>
        </View>

        {/* Overall Result */}
        <View style={[
          styles.resultCard,
          { backgroundColor: teamSkills.eligible ? (settings.successColor + '20') : (settings.errorColor + '20') }
        ]}>
          <View style={styles.resultHeader}>
            <Ionicons
              name={teamSkills.eligible ? "trophy" : "alert-circle"}
              size={24}
              color={teamSkills.eligible ? settings.successColor : settings.errorColor}
            />
            <Text style={[
              styles.resultTitle,
              { color: teamSkills.eligible ? settings.successColor : settings.errorColor }
            ]}>
              {teamSkills.eligible
                ? `Team ${team.number} is eligible for ${programConfig?.awardName || 'the award'}!`
                : `Team ${team.number} is not eligible for ${programConfig?.awardName || 'the award'}.`
              }
            </Text>
          </View>

          {!teamSkills.eligible && (
            <Text style={dynamicStyles.resultSubtext}>
              Review the requirements above to see what criteria need to be met.
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  headerCard: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  teamNumberContainer: {
    flex: 1,
  },
  teamNumber: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  eligibilityContainer: {
    alignItems: 'center',
  },
  eligibilityText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  teamName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  organizationText: {
    fontSize: 14,
    marginBottom: 2,
  },
  locationText: {
    fontSize: 14,
  },
  section: {
    borderRadius: 12,
    marginBottom: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    padding: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  sectionContent: {
    padding: 16,
    paddingTop: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  infoLabel: {
    fontSize: 14,
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'right',
    flex: 1,
  },
  positiveValue: {
    // Color will be applied dynamically via settings.successColor
  },
  negativeValue: {
    // Color will be applied dynamically via settings.errorColor
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  requirementIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  requirementText: {
    flex: 1,
  },
  requirementLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  requirementDetails: {
    fontSize: 12,
  },
  resultCard: {
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },
  resultSubtext: {
    fontSize: 14,
    marginLeft: 32,
  },
});