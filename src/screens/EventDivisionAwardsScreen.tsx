/**
 * Event Division Awards Screen
 *
 * Description:
 * Displays award eligibility information for teams in a specific division of a
 * VEX robotics event. Shows qualification criteria, team eligibility status,
 * and detailed award requirements with filtering and export capabilities.
 *
 * Navigation:
 * Accessed from event division screens or awards sections when users want to
 * view award eligibility for teams in a specific competition division.
 *
 * Key Features:
 * - Division-specific award eligibility tracking and analysis
 * - Team eligibility status with detailed qualification requirements
 * - Filterable award listings with multiple criteria options
 * - Export functionality for award data and team lists
 * - Detailed team eligibility breakdown with requirement explanations
 * - Integration with team profiles and performance data
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createLogger } from '../utils/logger';

const logger = createLogger('EventDivisionAwardsScreen');
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  ScrollView,
  ActionSheetIOS,
  Platform,
} from 'react-native';
import { RouteProp, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../contexts/SettingsContext';
import { alerts } from '../utils/webCompatibility';
import { robotEventsAPI } from '../services/apiRouter';
import { Event, Division, Team } from '../types';
import {
  TeamSkills,
  RawSkill,
  RobotProgram,
  ProgramRules,
  PROGRAM_RULES,
  PROGRAM_CONFIGS
} from '../utils/eligibility/types';
import { calculateEligibility, sortTeamSkills, getProgramRequirements } from '../utils/eligibility/eligibilityCalculator';
import { detectAwardType, getDynamicLabel } from '../utils/eligibility/common';

// Feature toggle for All Around Champion eligibility features
const allAroundChampionEligibilityFeaturesEnabled: boolean = true;

type EventDivisionAwardsScreenRouteProp = RouteProp<
  {
    EventDivisionAwards: {
      event: Event;
      division: Division;
    };
  },
  'EventDivisionAwards'
>;

type EventDivisionAwardsScreenNavigationProp = StackNavigationProp<any>;

interface Props {
  route: EventDivisionAwardsScreenRouteProp;
  navigation: EventDivisionAwardsScreenNavigationProp;
}

interface Award {
  id: number;
  title: string;
  qualifications: string[];
  teamWinners: {
    team: {
      id: number;
      name: string;
    };
    division?: {
      id: number;
      name: string;
    };
  }[];
  individualWinners?: string[];
}

const EventDivisionAwardsScreen = ({ route, navigation }: Props) => {
  const { event, division } = route.params;
  const settings = useSettings();
  const {
    backgroundColor,
    textColor,
    cardBackgroundColor,
    secondaryTextColor,
    iconColor,
    borderColor,
    buttonColor,
    selectedProgram,
  } = settings;

  const [awards, setAwards] = useState<Award[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [rawRankings, setRawRankings] = useState<any[]>([]);
  const [rawSkills, setRawSkills] = useState<RawSkill[]>([]);
  const [teamSkills, setTeamSkills] = useState<TeamSkills[]>([]);
  const [showLoading, setShowLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showEligibilityModal, setShowEligibilityModal] = useState(false);
  const [showRequirementsModal, setShowRequirementsModal] = useState(false);
  const [selectedRequirements, setSelectedRequirements] = useState<string[]>([]);
  const [selectedTeamSkills, setSelectedTeamSkills] = useState<TeamSkills | null>(null);
  const [searchText, setSearchText] = useState('');
  const [showQualificationTooltip, setShowQualificationTooltip] = useState<string | null>(null);
  const [selectedQualifications, setSelectedQualifications] = useState<string[]>([]);
  const [selectedGradeLevel, setSelectedGradeLevel] = useState<string | null>(null);
  const [shouldReopenModal, setShouldReopenModal] = useState(false);
  const [isNavigatingToTeamDetail, setIsNavigatingToTeamDetail] = useState(false);

  // Detect program and awards
  const currentProgram = detectCurrentProgram();
  const programRules = currentProgram ? PROGRAM_RULES[currentProgram] : null;
  const programConfig = currentProgram ? PROGRAM_CONFIGS[currentProgram] : null;

  function detectCurrentProgram(): RobotProgram | null {
    if (selectedProgram === 'Aerial Drone Competition') {
      return RobotProgram.ADC;
    } else if (selectedProgram === 'VEX V5 Robotics Competition') {
      return RobotProgram.V5RC;
    } else if (selectedProgram === 'VEX IQ Robotics Competition') {
      return RobotProgram.VIQRC;
    }
    return null;
  }

  function detectSplitGradeAwards(awardsData: Award[]): boolean {
    if (!programRules?.hasMiddleSchoolHighSchoolDivisions || !programRules.splitAwardGrades) {
      return false;
    }

    const baseAwardName = programConfig?.awardName?.toLowerCase() || '';
    return programRules.splitAwardGrades.every(gradeLevel => {
      const lowerGrade = gradeLevel.toLowerCase();
      return awardsData.some(award => {
        const lowerApiTitle = award.title.toLowerCase();
        return lowerApiTitle.includes(baseAwardName) && lowerApiTitle.includes(lowerGrade);
      });
    });
  }

  function shouldShowAllAroundButton(): boolean {
    // All Around Champion eligibility should show when:
    // 1. Program is ADC (Aerial Drone Competition)
    // 2. AND one of these conditions:
    //    - allAroundChampionEligibilityFeaturesEnabled is true (feature toggle)
    //    - OR testingEligibilityEnabled is true (for testing on any event)
    //    - OR there are All-Around Champion awards with no winners yet

    if (selectedProgram !== 'Aerial Drone Competition') {
      return false; // All Around Champion is only for ADC
    }

    // Show if feature is enabled
    if (allAroundChampionEligibilityFeaturesEnabled) {
      return true;
    }

    // Show if testing is enabled (allows verification on any event)
    if (settings.testingEligibilityEnabled) {
      return true;
    }

    // Show if there are All-Around Champion awards with no winners yet
    const hasEmptyAllAroundAwards = awards.some(award =>
      award.title.includes('All-Around Champion') && award.teamWinners.length === 0
    );

    return hasEmptyAllAroundAwards;
  }

  function shouldShowExcellenceButton(): boolean {
    // Excellence eligibility should show when:
    // 1. Program is not ADC (All Around Champion is for ADC only)
    // 2. AND one of these conditions:
    //    - testingEligibilityEnabled is true (for testing on any event)
    //    - OR there are excellence awards with no winners yet
    // 3. AND program is not VEX AI

    if (selectedProgram === 'Aerial Drone Competition') {
      return false; // ADC uses All Around Champion, not Excellence
    }

    if (selectedProgram === 'VEX AI Robotics Competition') {
      return false; // VEX AI doesn't have Excellence awards
    }

    // Show if testing is enabled (allows verification on any event)
    if (settings.testingEligibilityEnabled) {
      return true;
    }

    // Show if there are Excellence awards with no winners yet
    const hasEmptyExcellenceAwards = awards.some(award =>
      award.title.includes('Excellence Award') && award.teamWinners.length === 0
    );

    return hasEmptyExcellenceAwards;
  }

  function shouldShowEligibilityButtonForAward(award: Award): boolean {
    // Show eligibility button for Excellence awards when:
    // 1. Award is an Excellence Award
    // 2. AND (testing is enabled OR award has no winners)
    // 3. AND program supports it

    if (!award.title.includes('Excellence Award')) {
      return false;
    }

    if (selectedProgram === 'Aerial Drone Competition' || selectedProgram === 'VEX AI Robotics Competition') {
      return false;
    }

    // Show if testing is enabled OR award has no winners
    return settings.testingEligibilityEnabled || award.teamWinners.length === 0;
  }

  function extractGradeLevelFromAward(awardTitle: string): string | null {
    const lowerTitle = awardTitle.toLowerCase();
    if (lowerTitle.includes('elementary')) return 'Elementary';
    if (lowerTitle.includes('middle school') || lowerTitle.includes('middle')) return 'Middle School';
    if (lowerTitle.includes('high school') || lowerTitle.includes('high')) return 'High School';
    return null;
  }

  const showEligibilityWarningAndOpen = (gradeLevel: string | null = null) => {
    if (settings.eligibilityWarningDismissed) {
      setSelectedGradeLevel(gradeLevel);
      setShowEligibilityModal(true);
      return;
    }

    // Get the appropriate disclaimer message based on program
    let disclaimerMessage = '';

    if (currentProgram === RobotProgram.ADC) {
      // ADC (All Around Champion) disclaimer
      disclaimerMessage = 'This is Unofficial, and is only accurate after both Qualification and Skills matches finish. It will no longer be accurate after Alliance Selection is completed. Please keep in mind that there are other factors that the app cannot calculate – this is solely based on field performance.';
    } else {
      // Excellence Award disclaimer (V5RC/VIQRC)
      disclaimerMessage = 'This is Unofficial and may be inaccurate, and can only possibly be accurate after both Qualification and Skills matches finish. Please keep in mind that there are other factors that no app can calculate – this is solely based on field performance.';
    }

    alerts.showConfirm(
      'Disclaimer',
      disclaimerMessage,
      'I Understand',
      'Cancel'
    ).then((confirmed) => {
      if (confirmed) {
        setSelectedGradeLevel(gradeLevel);
        setShowEligibilityModal(true);
      }
    });
  };

  const openEligibilityModalForGrade = (gradeLevel: string | null) => {
    if (!currentProgram || !programConfig) {
      alerts.showAlert('Error', 'Unable to determine program type for eligibility checking.');
      return;
    }

    if (teamSkills.length === 0) {
      alerts.showAlert('No Data', 'No team data available for eligibility checking.');
      return;
    }

    showEligibilityWarningAndOpen(gradeLevel);
  };

  // Custom award sorting function
  const getAwardPriority = (awardTitle: string): number => {
    const title = awardTitle.toLowerCase();

    // Desired order: Excellence, Tournament Champions, Finalists, Design, Robot Skills Champion, Innovate, Other, Judges

    // Excellence Award (highest priority)
    if (title.includes('excellence')) return 1;

    // Tournament Champions
    if (title.includes('tournament champions') ||
        title.includes('tournament champion') ||
        title.includes('champions alliance') ||
        title.includes('champion alliance')) return 2;

    // Finalists
    if (title.includes('finalist') || title.includes('finalists')) return 3;

    // Design Award
    if (title.includes('design')) return 4;

    // Robot Skills Champion
    if (title.includes('robot skills champion') ||
        title.includes('skills champion') ||
        title.includes('robot skills') ||
        title.includes('programming skills champion') ||
        title.includes('driver skills champion')) return 5;

    // Innovate Award
    if (title.includes('innovate')) return 6;

    // Judges Award (lowest priority)
    if (title.includes('judges') || title.includes('judge')) return 8;

    // Any other award goes between Innovate and Judges
    return 7;
  };

  const sortedAwards = useMemo(() => {
    return [...awards].sort((a, b) => {
      const priorityA = getAwardPriority(a.title);
      const priorityB = getAwardPriority(b.title);

      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      return a.title.localeCompare(b.title);
    });
  }, [awards]);

  // Calculate summary statistics (must be here with other hooks to maintain order)
  const awardStats = useMemo(() => {
    const totalAwards = awards.length;
    const awardsWithWinners = awards.filter(a => a.teamWinners.length > 0 || (a.individualWinners && a.individualWinners.length > 0)).length;
    const awardsPending = totalAwards - awardsWithWinners;

    return { totalAwards, awardsWithWinners, awardsPending };
  }, [awards]);

  // Create dynamic styles
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: backgroundColor,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: backgroundColor,
    },
    loadingText: {
      marginTop: 16,
      fontSize: 16,
      color: textColor,
    },
    headerContainer: {
      backgroundColor: cardBackgroundColor,
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: borderColor,
    },
    controlsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    switchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    switchLabel: {
      fontSize: 14,
      color: textColor,
      marginRight: 8,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: backgroundColor,
      borderColor: borderColor,
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: 16,
      color: textColor,
      marginLeft: 8,
    },
    awardItem: {
      backgroundColor: cardBackgroundColor,
      padding: 18,
      marginHorizontal: 16,
      marginVertical: 6,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: borderColor,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
      elevation: 4,
    },
    awardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 8,
    },
    awardTitleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      justifyContent: 'space-between',
    },
    awardTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: textColor,
      flex: 1,
      letterSpacing: 0.2,
      lineHeight: 24,
      marginRight: 8,
    },
    qualificationIconsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    qualificationIconBadge: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: 'rgba(0, 0, 0, 0.04)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    winnerContainer: {
      marginTop: 8,
    },
    winnerText: {
      fontSize: 15,
      color: textColor,
      marginBottom: 6,
      lineHeight: 20,
      fontWeight: '500',
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 40,
      paddingVertical: 60,
    },
    emptyIconContainer: {
      width: 140,
      height: 140,
      borderRadius: 70,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 24,
      borderWidth: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 4,
    },
    emptyText: {
      fontSize: 22,
      fontWeight: '700',
      textAlign: 'center',
      marginBottom: 12,
      letterSpacing: 0.3,
    },
    emptySubtext: {
      fontSize: 15,
      textAlign: 'center',
      lineHeight: 22,
      opacity: 0.8,
    },
    emptyRefreshHint: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 24,
      borderWidth: 1,
      marginTop: 24,
      gap: 8,
    },
    emptyRefreshText: {
      fontSize: 14,
      fontWeight: '500',
    },
    summaryHeader: {
      marginHorizontal: 16,
      marginTop: 16,
      marginBottom: 8,
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 3,
    },
    summaryStatContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
    },
    summaryStatItem: {
      flex: 1,
      alignItems: 'center',
    },
    summaryStatValue: {
      fontSize: 28,
      fontWeight: '700',
      marginBottom: 4,
      letterSpacing: 0.5,
    },
    summaryStatLabel: {
      fontSize: 13,
      fontWeight: '500',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      opacity: 0.7,
    },
    summaryDivider: {
      width: 1,
      height: 40,
      opacity: 0.3,
    },
    eligibilityItem: {
      backgroundColor: cardBackgroundColor,
      padding: 16,
      marginHorizontal: 16,
      marginVertical: 4,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: borderColor,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    eligibilityInfo: {
      flex: 1,
    },
    eligibilityTeam: {
      fontSize: 16,
      fontWeight: '600',
      color: textColor,
    },
    eligibilityDetails: {
      fontSize: 14,
      color: secondaryTextColor,
      marginTop: 4,
    },
    eligibilityStatus: {
      marginLeft: 16,
      alignItems: 'center',
    },
    eligibilityText: {
      fontSize: 12,
      color: secondaryTextColor,
      marginTop: 4,
    },
    buttonsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      padding: 16,
      backgroundColor: cardBackgroundColor,
      borderTopWidth: 1,
      borderTopColor: borderColor,
    },
    eligibilityButton: {
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 8,
      minWidth: 120,
      alignItems: 'center',
    },
    eligibilityButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
    compactEligibilityButton: {
      alignSelf: 'flex-start',
      paddingVertical: 8,
      paddingHorizontal: 12,
      backgroundColor: 'rgba(59, 130, 246, 0.08)',
      borderRadius: 8,
      marginTop: 4,
    },
    compactEligibilityButtonText: {
      color: '#3b82f6',
      fontSize: 14,
      fontWeight: '600',
      letterSpacing: 0.3,
    },
    modalContainer: {
      flex: 1,
    },
    modalContentContainer: {
      flex: 1,
    },
    swipeIndicator: {
      alignItems: 'center',
      paddingVertical: 8,
    },
    swipeHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      opacity: 0.5,
    },
    modalHeader: {
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: borderColor,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    modalTitleContainer: {
      flex: 1,
      marginRight: 12,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: textColor,
    },
    modalSubtitle: {
      fontSize: 16,
      fontWeight: '500',
      color: secondaryTextColor,
      marginTop: 4,
    },
    closeButton: {
      padding: 4,
    },
    modalBody: {
      padding: 20,
    },
    summaryContainer: {
      padding: 16,
      backgroundColor: backgroundColor,
      borderRadius: 8,
      marginBottom: 8,
    },
    summaryText: {
      fontSize: 16,
      color: textColor,
      marginBottom: 8,
    },
    awardTypeText: {
      fontSize: 14,
      color: buttonColor,
      fontWeight: '600',
    },
    requirementsList: {
      marginBottom: 16,
    },
    requirementItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
    },
    requirementText: {
      flex: 1,
      fontSize: 14,
      color: textColor,
      marginLeft: 8,
    },
    requirementNote: {
      fontSize: 12,
      color: secondaryTextColor,
      fontStyle: 'italic',
      lineHeight: 18,
    },
    awardCard: {
      backgroundColor: cardBackgroundColor,
      padding: 18,
      marginHorizontal: 16,
      marginVertical: 6,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: borderColor,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
      elevation: 4,
    },
    winnersContainer: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: borderColor,
    },
    winnersLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: secondaryTextColor,
      marginBottom: 8,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      opacity: 0.7,
    },
    modalControls: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      padding: 16,
      backgroundColor: backgroundColor,
      borderBottomWidth: 1,
      borderBottomColor: borderColor,
    },
    teamRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      marginHorizontal: 8,
      marginVertical: 2,
      borderRadius: 8,
    },
    teamInfo: {
      flex: 1,
    },
    teamNumber: {
      fontSize: 16,
      fontWeight: '600',
      color: textColor,
    },
    teamName: {
      fontSize: 14,
      color: secondaryTextColor,
      marginTop: 2,
    },
    teamStats: {
      alignItems: 'flex-end',
      marginRight: 12,
    },
    statText: {
      fontSize: 12,
      color: secondaryTextColor,
      marginVertical: 1,
    },
    listContainer: {
      paddingBottom: 16,
    },
    tooltipContainer: {
      position: 'absolute',
      top: 50,
      right: 0,
      zIndex: 1000,
      alignItems: 'flex-end',
    },
    tooltip: {
      backgroundColor: cardBackgroundColor,
      borderRadius: 8,
      padding: 12,
      minWidth: 200,
      maxWidth: 280,
      borderWidth: 1,
      borderColor: borderColor,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 12,
      elevation: 8,
    },
    tooltipArrow: {
      position: 'absolute',
      top: -6,
      right: 20,
      width: 12,
      height: 12,
      backgroundColor: cardBackgroundColor,
      borderLeftWidth: 1,
      borderTopWidth: 1,
      borderColor: borderColor,
      transform: [{ rotate: '45deg' }],
      zIndex: 1001,
    },
    tooltipHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    tooltipTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: textColor,
      marginLeft: 6,
    },
    tooltipText: {
      fontSize: 13,
      color: textColor,
      lineHeight: 18,
      marginBottom: 2,
    },
    // Team Card Styles
    teamCard: {
      borderRadius: 12,
      marginBottom: 12,
      borderWidth: 1,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    teamCardHeader: {
      flexDirection: 'row',
      padding: 16,
      alignItems: 'flex-start',
    },
    teamCardNumber: {
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 4,
    },
    teamCardName: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 4,
    },
    teamCardOrg: {
      fontSize: 14,
      marginTop: 2,
    },
    teamCardLocation: {
      fontSize: 14,
      marginTop: 2,
    },
    teamCardStats: {
      flexDirection: 'row',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderTopWidth: 1,
      justifyContent: 'space-around',
    },
    statItem: {
      alignItems: 'center',
      flex: 1,
    },
    statLabel: {
      fontSize: 12,
      marginBottom: 4,
    },
    statValue: {
      fontSize: 16,
      fontWeight: '600',
    },
    // Team Detail View Styles
    backButton: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 8,
      marginBottom: 16,
    },
    backButtonText: {
      fontSize: 16,
      marginLeft: 8,
      fontWeight: '500',
    },
    detailHeaderCard: {
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    detailHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    detailTeamNumber: {
      fontSize: 28,
      fontWeight: 'bold',
      marginBottom: 4,
    },
    detailTeamName: {
      fontSize: 18,
      fontWeight: '600',
      marginBottom: 4,
    },
    detailOrganization: {
      fontSize: 14,
      marginTop: 4,
    },
    detailLocation: {
      fontSize: 14,
      marginTop: 2,
    },
    detailEligibilityBadge: {
      alignItems: 'center',
    },
    detailEligibilityText: {
      fontSize: 14,
      fontWeight: '600',
      marginTop: 4,
    },
    detailSection: {
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    detailSectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      marginBottom: 12,
    },
    detailStatRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 8,
    },
    detailStatLabel: {
      fontSize: 14,
    },
    detailStatValue: {
      fontSize: 14,
      fontWeight: '500',
    },
    detailRequirementRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingVertical: 12,
      borderBottomWidth: 1,
    },
    detailRequirementIcon: {
      marginRight: 12,
      marginTop: 2,
    },
    detailRequirementLabel: {
      fontSize: 14,
      fontWeight: '500',
      marginBottom: 4,
    },
    detailRequirementDetails: {
      fontSize: 13,
    },
  });

  useEffect(() => {
    navigation.setOptions({
      title: `${division.name} Awards`,
      headerStyle: {
        backgroundColor: settings.topBarColor,
      },
      headerTintColor: settings.topBarContentColor,
      headerTitleAlign: 'center',
      headerTitleStyle: {
        fontWeight: '500',
        fontSize: 19,
      },
    });
  }, [division.name, settings.topBarColor, settings.topBarContentColor]);

  const loadAllData = useCallback(async () => {
    try {
      setShowLoading(true);

      // Load all data in parallel
      const [awardsData, teamsData, rankingsData, skillsData] = await Promise.all([
        robotEventsAPI.getEventAwards(event.id),
        robotEventsAPI.getEventTeams(event.id),
        robotEventsAPI.getEventDivisionRankings(event.id, division.id),
        robotEventsAPI.getEventSkills(event.id)
      ]);

      setAwards(awardsData.data);
      // Transform API teams to UI teams (ensure organization is not undefined and program has code)
      const uiTeams = teamsData.data.map(team => ({
        ...team,
        organization: team.organization || '',
        program: {
          id: team.program.id,
          name: team.program.name,
          code: team.program.code || 'UNKNOWN',
        },
      }));
      setTeams(uiTeams);
      setRawRankings(rankingsData.data);

      // Convert skills data to RawSkill format
      const formattedSkills: RawSkill[] = skillsData.data.map(skill => ({
        teamId: skill.team?.id || 0,
        score: skill.score || 0,
        type: skill.type as 'programming' | 'driver',
        attempts: skill.attempts || 0
      }));
      setRawSkills(formattedSkills);

      // Calculate eligibility if program is detected
      if (currentProgram && programRules) {
        const eventHasSplitGradeAwards = detectSplitGradeAwards(awardsData.data);
        const calculatedTeamSkills = calculateEligibility(
          uiTeams,
          rankingsData.data,
          formattedSkills,
          awardsData.data,
          currentProgram,
          eventHasSplitGradeAwards
        );
        setTeamSkills(calculatedTeamSkills);
      }

    } catch (error) {
      logger.error('Error loading data:', error);
      alerts.showAlert('Error', 'Failed to load event data. Please try again.');
    } finally {
      setShowLoading(false);
    }
  }, [event.id, division.id, currentProgram, programRules]);

  // Load data when component mounts
  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Refresh data when tab becomes focused
  useFocusEffect(
    React.useCallback(() => {
      loadAllData();
    }, [loadAllData])
  );

  // Handle returning from team detail screen
  useFocusEffect(
    React.useCallback(() => {
      if (shouldReopenModal && !isNavigatingToTeamDetail) {
        // Small delay to ensure screen transition is complete
        setTimeout(() => {
          setShowEligibilityModal(true);
          setShouldReopenModal(false);
        }, 300);
      }
    }, [shouldReopenModal, isNavigatingToTeamDetail])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAllData();
    setRefreshing(false);
  }, [loadAllData]);

  const openEligibilityModal = () => {
    if (!currentProgram || !programConfig) {
      alerts.showAlert('Error', 'Unable to determine program type for eligibility checking.');
      return;
    }

    if (teamSkills.length === 0) {
      alerts.showAlert('No Data', 'No team data available for eligibility checking.');
      return;
    }

    setShowEligibilityModal(true);
  };

  const openRequirementsModal = () => {
    if (!currentProgram) {
      alerts.showAlert('Error', 'Unable to determine program type.');
      return;
    }

    const requirements = getProgramRequirements(currentProgram);
    setSelectedRequirements(requirements);
    setShowRequirementsModal(true);
  };

  const handleTeamPress = useCallback((teamSkillsData: TeamSkills) => {
    if (!currentProgram || !programRules) return;

    // Show team details within the modal
    setSelectedTeamSkills(teamSkillsData);
  }, [currentProgram, programRules]);


  const getFilteredAndSortedTeams = useMemo((): TeamSkills[] => {
    let filtered = [...teamSkills];

    // Apply grade level filter when specific grade is selected
    if (selectedGradeLevel) {
      filtered = filtered.filter(ts => {
        if (selectedProgram === 'VEX IQ Robotics Competition') {
          if (selectedGradeLevel === 'Elementary') {
            return ts.team.grade?.toLowerCase().includes('elementary');
          } else if (selectedGradeLevel === 'Middle School') {
            return ts.team.grade?.toLowerCase().includes('middle');
          }
        }

        if (selectedGradeLevel === 'Middle School') {
          return ts.team.grade?.toLowerCase().includes('middle');
        } else if (selectedGradeLevel === 'High School') {
          return ts.team.grade?.toLowerCase().includes('high') ||
                 (!ts.team.grade?.toLowerCase().includes('middle') &&
                  !ts.team.grade?.toLowerCase().includes('elementary'));
        }

        return true;
      });
    }

    // Apply search filter
    if (searchText.trim()) {
      const searchLower = searchText.toLowerCase();
      filtered = filtered.filter(ts =>
        ts.team.number.toLowerCase().includes(searchLower) ||
        ts.team.team_name.toLowerCase().includes(searchLower) ||
        (ts.team.organization || '').toLowerCase().includes(searchLower)
      );
    }

    return sortTeamSkills(filtered);
  }, [teamSkills, searchText, selectedGradeLevel, selectedProgram]);

  const handleQualificationPress = (awardId: string, qualifications: string[]) => {
    setSelectedQualifications(qualifications);
    if (showQualificationTooltip === awardId) {
      setShowQualificationTooltip(null);
    } else {
      setShowQualificationTooltip(awardId);
    }
  };

  const renderAward = ({ item }: { item: Award }) => {
    // Determine qualification icons based on qualifications array
    const qualifiesForRegionals = item.qualifications && item.qualifications.some(q =>
      q.toLowerCase().includes('regional') ||
      q.toLowerCase().includes('state') ||
      q.toLowerCase().includes('signature')
    );
    const qualifiesForWorlds = item.qualifications && item.qualifications.some(q =>
      q.toLowerCase().includes('world')
    );

    return (
      <View style={styles.awardCard}>
        <View style={styles.awardHeader}>
          <View style={styles.awardTitleContainer}>
            <Text style={styles.awardTitle}>{item.title}</Text>
            <View style={styles.qualificationIconsContainer}>
              {qualifiesForRegionals && (
                <TouchableOpacity
                  style={styles.qualificationIconBadge}
                  onPress={() => handleQualificationPress(item.id.toString(), item.qualifications)}
                >
                  <Ionicons name="trophy" size={16} color="#FFD700" />
                </TouchableOpacity>
              )}
              {qualifiesForWorlds && (
                <TouchableOpacity
                  style={styles.qualificationIconBadge}
                  onPress={() => handleQualificationPress(item.id.toString(), item.qualifications)}
                >
                  <Ionicons name="globe" size={16} color="#4A90E2" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

      {/* Qualification Tooltip */}
      {showQualificationTooltip === item.id.toString() && (
        <View style={styles.tooltipContainer}>
          <View style={styles.tooltip}>
            <View style={styles.tooltipHeader}>
              <Ionicons name="globe" size={16} color="#4A90E2" />
              <Text style={styles.tooltipTitle}>Qualifies For:</Text>
            </View>
            {selectedQualifications.map((qualification, index) => (
              <Text key={index} style={styles.tooltipText}>• {qualification}</Text>
            ))}
          </View>
          <View style={styles.tooltipArrow} />
        </View>
      )}

      {/* Show eligibility button for Excellence awards or show winners */}
      {shouldShowEligibilityButtonForAward(item) ? (
        <View style={styles.winnersContainer}>
          <TouchableOpacity
            onPress={() => openEligibilityModalForGrade(extractGradeLevelFromAward(item.title))}
            style={styles.compactEligibilityButton}
          >
            <Text style={styles.compactEligibilityButtonText}>
              Show Eligible Teams{extractGradeLevelFromAward(item.title) ? ` (${extractGradeLevelFromAward(item.title)})` : ''}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {item.teamWinners.length > 0 && (
            <View style={styles.winnersContainer}>
              <Text style={styles.winnersLabel}>Team Winners:</Text>
              {item.teamWinners.map((winner, index) => (
                <Text key={index} style={styles.winnerText}>
                  {winner.team.name}
                  {winner.division && ` (${winner.division.name})`}
                </Text>
              ))}
            </View>
          )}
          {item.individualWinners && item.individualWinners.length > 0 && (
            <View style={styles.winnersContainer}>
              <Text style={styles.winnersLabel}>Individual Winners:</Text>
              {item.individualWinners.map((winner, index) => (
                <Text key={index} style={styles.winnerText}>{winner}</Text>
              ))}
            </View>
          )}
        </>
      )}
      </View>
    );
  };

  const renderTeamCard = ({ item }: { item: TeamSkills }) => {
    const team = item.team;

    // Construct location string
    const locationParts: string[] = [];
    if (team.location?.city) locationParts.push(team.location.city);
    if (team.location?.region) locationParts.push(team.location.region);
    if (team.location?.country) locationParts.push(team.location.country);
    const locationString = locationParts.join(', ');

    return (
      <TouchableOpacity
        style={[styles.teamCard, { backgroundColor: cardBackgroundColor, borderColor: borderColor }]}
        onPress={() => handleTeamPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.teamCardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.teamCardNumber, { color: item.eligible ? '#22c55e' : '#ef4444' }]}>
              {team.number}
            </Text>
            <Text style={[styles.teamCardName, { color: textColor }]} numberOfLines={1}>
              {team.team_name}
            </Text>
            {team.organization && (
              <Text style={[styles.teamCardOrg, { color: secondaryTextColor }]} numberOfLines={1}>
                {team.organization}
              </Text>
            )}
            {locationString && (
              <Text style={[styles.teamCardLocation, { color: secondaryTextColor }]} numberOfLines={1}>
                {locationString}
              </Text>
            )}
          </View>
          <Ionicons
            name={item.eligible ? "checkmark-circle" : "close-circle"}
            size={32}
            color={item.eligible ? '#22c55e' : '#ef4444'}
          />
        </View>

        <View style={[styles.teamCardStats, { borderTopColor: borderColor }]}>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: secondaryTextColor }]}>Qual Rank</Text>
            <Text style={[styles.statValue, { color: textColor }]}>
              {item.qualifierRank > 0 ? `#${item.qualifierRank}` : 'N/A'}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: secondaryTextColor }]}>Skills Rank</Text>
            <Text style={[styles.statValue, { color: textColor }]}>
              {item.skillsRank > 0 ? `#${item.skillsRank}` : 'N/A'}
            </Text>
          </View>
          {currentProgram && programRules?.requiresProgrammingSkills && (
            <View style={styles.statItem}>
              <Text style={[styles.statLabel, { color: secondaryTextColor }]}>
                {getDynamicLabel(currentProgram, 'Programming')}
              </Text>
              <Text style={[styles.statValue, { color: textColor }]}>
                {item.programmingScore}
              </Text>
            </View>
          )}
          {currentProgram && programRules?.requiresDriverSkills && (
            <View style={styles.statItem}>
              <Text style={[styles.statLabel, { color: secondaryTextColor }]}>
                {getDynamicLabel(currentProgram, 'Driver')}
              </Text>
              <Text style={[styles.statValue, { color: textColor }]}>
                {item.driverScore}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderTeamDetailView = () => {
    if (!selectedTeamSkills || !currentProgram || !programRules) return null;

    const team = selectedTeamSkills.team;
    const programConfig = PROGRAM_CONFIGS[currentProgram];

    // Build location string
    const locationParts: string[] = [];
    if (team.location?.city) locationParts.push(team.location.city);
    if (team.location?.region) locationParts.push(team.location.region);
    if (team.location?.country) locationParts.push(team.location.country);
    const locationString = locationParts.join(', ');

    const formatRank = (rank: number): string => {
      return rank < 0 ? 'N/A' : `#${rank}`;
    };

    const formatScore = (score: number, attempts: number): string => {
      return `${score} (${attempts} attempts)`;
    };

    // Calculate requirement details
    const requirements = [];

    // Qualifier rank requirement
    const qualMet = selectedTeamSkills.inRank;
    const qualDetail = selectedTeamSkills.qualifierRankCutoff > 0
      ? `Rank: ${formatRank(selectedTeamSkills.qualifierRank)} (cutoff: #${selectedTeamSkills.qualifierRankCutoff})`
      : `Rank: ${formatRank(selectedTeamSkills.qualifierRank)}`;
    requirements.push({
      label: `Top ${(programRules.threshold * 100).toFixed(0)}% of qualification rankings`,
      met: qualMet,
      details: qualDetail
    });

    // Skills rank requirement
    const skillsMet = selectedTeamSkills.inSkill;
    const skillsDetail = selectedTeamSkills.skillsRankCutoff > 0
      ? `Rank: ${formatRank(selectedTeamSkills.skillsRank)} (cutoff: #${selectedTeamSkills.skillsRankCutoff})`
      : `Rank: ${formatRank(selectedTeamSkills.skillsRank)}`;
    requirements.push({
      label: `Top ${(programRules.threshold * 100).toFixed(0)}% of combined skills rankings`,
      met: skillsMet,
      details: skillsDetail
    });

    // Programming requirement
    if (programRules.requiresProgrammingSkills) {
      const progMet = selectedTeamSkills.programmingScore > 0;
      const progLabel = getDynamicLabel(currentProgram, 'Programming');
      requirements.push({
        label: `${progLabel} score above zero required`,
        met: progMet,
        details: formatScore(selectedTeamSkills.programmingScore, selectedTeamSkills.programmingAttempts)
      });
    }

    // Driver requirement
    if (programRules.requiresDriverSkills) {
      const driverMet = selectedTeamSkills.driverScore > 0;
      const driverLabel = getDynamicLabel(currentProgram, 'Driver');
      requirements.push({
        label: `${driverLabel} score above zero required`,
        met: driverMet,
        details: formatScore(selectedTeamSkills.driverScore, selectedTeamSkills.driverAttempts)
      });
    }

    // Programming-only rank requirement
    if (programRules.requiresRankInPositiveProgrammingSkills) {
      const progOnlyMet = selectedTeamSkills.meetsProgrammingOnlyRankCriterion;
      const progLabel = getDynamicLabel(currentProgram, 'Programming');
      const progOnlyDetail = selectedTeamSkills.programmingOnlyRankCutoff > 0
        ? `Rank: ${formatRank(selectedTeamSkills.programmingOnlyRank)} (cutoff: #${selectedTeamSkills.programmingOnlyRankCutoff})`
        : `Rank: ${formatRank(selectedTeamSkills.programmingOnlyRank)}`;
      requirements.push({
        label: `Top ${(programRules.programmingSkillsRankThreshold * 100).toFixed(0)}% of ${progLabel.toLowerCase()}-only rankings`,
        met: progOnlyMet,
        details: progOnlyDetail
      });
    }

    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
        {/* Back Button */}
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: cardBackgroundColor }]}
          onPress={() => setSelectedTeamSkills(null)}
        >
          <Ionicons name="arrow-back" size={20} color={iconColor} />
          <Text style={[styles.backButtonText, { color: textColor }]}>Back to List</Text>
        </TouchableOpacity>

        {/* Team Header */}
        <View style={[styles.detailHeaderCard, { backgroundColor: cardBackgroundColor }]}>
          <View style={styles.detailHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.detailTeamNumber, { color: textColor }]}>{team.number}</Text>
              <Text style={[styles.detailTeamName, { color: textColor }]}>{team.team_name}</Text>
              {team.organization && (
                <Text style={[styles.detailOrganization, { color: secondaryTextColor }]}>{team.organization}</Text>
              )}
              {locationString && (
                <Text style={[styles.detailLocation, { color: secondaryTextColor }]}>{locationString}</Text>
              )}
            </View>
            <View style={styles.detailEligibilityBadge}>
              <Ionicons
                name={selectedTeamSkills.eligible ? "checkmark-circle" : "close-circle"}
                size={32}
                color={selectedTeamSkills.eligible ? '#22c55e' : '#ef4444'}
              />
              <Text style={[
                styles.detailEligibilityText,
                { color: selectedTeamSkills.eligible ? '#22c55e' : '#ef4444' }
              ]}>
                {selectedTeamSkills.eligible ? 'Eligible' : 'Not Eligible'}
              </Text>
            </View>
          </View>
        </View>

        {/* Performance Stats */}
        <View style={[styles.detailSection, { backgroundColor: cardBackgroundColor }]}>
          <Text style={[styles.detailSectionTitle, { color: buttonColor }]}>Performance</Text>
          <View style={styles.detailStatRow}>
            <Text style={[styles.detailStatLabel, { color: secondaryTextColor }]}>Qualification Rank:</Text>
            <Text style={[styles.detailStatValue, { color: textColor }]}>
              {formatRank(selectedTeamSkills.qualifierRank)}
            </Text>
          </View>
          <View style={styles.detailStatRow}>
            <Text style={[styles.detailStatLabel, { color: secondaryTextColor }]}>Skills Rank:</Text>
            <Text style={[styles.detailStatValue, { color: textColor }]}>
              {formatRank(selectedTeamSkills.skillsRank)}
            </Text>
          </View>
          {programRules.requiresProgrammingSkills && (
            <View style={styles.detailStatRow}>
              <Text style={[styles.detailStatLabel, { color: secondaryTextColor }]}>
                {getDynamicLabel(currentProgram, 'Programming')} Score:
              </Text>
              <Text style={[styles.detailStatValue, { color: textColor }]}>
                {formatScore(selectedTeamSkills.programmingScore, selectedTeamSkills.programmingAttempts)}
              </Text>
            </View>
          )}
          {programRules.requiresDriverSkills && (
            <View style={styles.detailStatRow}>
              <Text style={[styles.detailStatLabel, { color: secondaryTextColor }]}>
                {getDynamicLabel(currentProgram, 'Driver')} Score:
              </Text>
              <Text style={[styles.detailStatValue, { color: textColor }]}>
                {formatScore(selectedTeamSkills.driverScore, selectedTeamSkills.driverAttempts)}
              </Text>
            </View>
          )}
        </View>

        {/* Requirements */}
        <View style={[styles.detailSection, { backgroundColor: cardBackgroundColor }]}>
          <Text style={[styles.detailSectionTitle, { color: buttonColor }]}>Requirements</Text>
          {requirements.map((req, index) => (
            <View key={index} style={[styles.detailRequirementRow, { borderBottomColor: borderColor }]}>
              <Ionicons
                name={req.met ? "checkmark-circle" : "close-circle"}
                size={20}
                color={req.met ? '#22c55e' : '#ef4444'}
                style={styles.detailRequirementIcon}
              />
              <View style={{ flex: 1 }}>
                <Text style={[
                  styles.detailRequirementLabel,
                  { color: req.met ? '#22c55e' : '#ef4444' }
                ]}>
                  {req.label}
                </Text>
                <Text style={[styles.detailRequirementDetails, { color: secondaryTextColor }]}>
                  {req.details}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    );
  };

  const renderEligibilityModal = () => {
    if (!currentProgram || !programConfig) return null;

    const filteredTeams = getFilteredAndSortedTeams;
    const eligibleTeams = filteredTeams.filter(ts => ts.eligible);
    const ineligibleTeams = filteredTeams.filter(ts => !ts.eligible);

    return (
      <Modal
        visible={showEligibilityModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setShowEligibilityModal(false);
          setSelectedGradeLevel(null);
          setShouldReopenModal(false);
          setIsNavigatingToTeamDetail(false);
        }}
      >
        <View style={[styles.modalContainer, { backgroundColor }]}>
          {/* Swipe indicator */}
          <View style={styles.swipeIndicator}>
            <View style={[styles.swipeHandle, { backgroundColor: secondaryTextColor }]} />
          </View>

          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.modalTitleContainer}>
              <Text style={styles.modalTitle}>
                {programConfig.awardName} Eligibility
              </Text>
              {selectedGradeLevel && (
                <Text style={styles.modalSubtitle}>
                  {selectedGradeLevel}
                </Text>
              )}
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => {
                setShowEligibilityModal(false);
                setSelectedGradeLevel(null);
                setShouldReopenModal(false);
                setIsNavigatingToTeamDetail(false);
              }}
            >
              <Ionicons name="close" size={24} color={iconColor} />
            </TouchableOpacity>
          </View>

          {/* Summary */}
          <View style={styles.summaryContainer}>
            <Text style={styles.summaryText}>
              Eligible Teams: {eligibleTeams.length} | Ineligible: {ineligibleTeams.length}
            </Text>
            {detectSplitGradeAwards(awards) && (
              <Text style={styles.awardTypeText}>Split Grade Awards Detected</Text>
            )}
          </View>

          {/* Content */}
          {selectedTeamSkills ? (
            renderTeamDetailView()
          ) : (
            <FlatList
              data={filteredTeams}
              renderItem={renderTeamCard}
              keyExtractor={(item) => item.team.id.toString()}
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 }}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </Modal>
    );
  };

  const renderRequirementsModal = () => (
    <Modal
      visible={showRequirementsModal}
      animationType="slide"
      presentationStyle="formSheet"
      onRequestClose={() => setShowRequirementsModal(false)}
    >
      <View style={[styles.modalContainer, { backgroundColor }]}>
        {/* Swipe indicator */}
        <View style={styles.swipeIndicator}>
          <View style={[styles.swipeHandle, { backgroundColor: secondaryTextColor }]} />
        </View>

        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Award Requirements</Text>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setShowRequirementsModal(false)}
          >
            <Ionicons name="close" size={24} color={iconColor} />
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.modalContentContainer} contentContainerStyle={{ padding: 20 }}>
          <View style={styles.requirementsList}>
            {selectedRequirements.map((requirement, index) => (
              <View key={index} style={styles.requirementItem}>
                <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                <Text style={styles.requirementText}>{requirement}</Text>
              </View>
            ))}
          </View>
          {currentProgram && (
            <Text style={styles.requirementNote}>
              These requirements apply to {PROGRAM_CONFIGS[currentProgram]?.name} events.
              {detectSplitGradeAwards(awards) ? ' Split grade awards detected for this event.' : ''}
            </Text>
          )}
        </ScrollView>
      </View>
    </Modal>
  );

  if (showLoading && awards.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={settings.topBarColor} />
        <Text style={styles.loadingText}>Loading awards and eligibility data...</Text>
      </View>
    );
  }

  const renderSummaryHeader = () => {
    if (!settings.isDeveloperMode || !settings.showAwardsSummary || awards.length === 0) {
      return null;
    }

    return (
      <View style={[styles.summaryHeader, { backgroundColor: cardBackgroundColor, borderColor: borderColor }]}>
        <View style={styles.summaryStatContainer}>
          <View style={styles.summaryStatItem}>
            <Text style={[styles.summaryStatValue, { color: textColor }]}>{awardStats.totalAwards}</Text>
            <Text style={[styles.summaryStatLabel, { color: secondaryTextColor }]}>Total Awards</Text>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: borderColor }]} />
          <View style={styles.summaryStatItem}>
            <Text style={[styles.summaryStatValue, { color: '#22c55e' }]}>{awardStats.awardsWithWinners}</Text>
            <Text style={[styles.summaryStatLabel, { color: secondaryTextColor }]}>Awarded</Text>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: borderColor }]} />
          <View style={styles.summaryStatItem}>
            <Text style={[styles.summaryStatValue, { color: '#f59e0b' }]}>{awardStats.awardsPending}</Text>
            <Text style={[styles.summaryStatLabel, { color: secondaryTextColor }]}>Pending</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor }]}>
      {/* Awards List */}
      {awards.length > 0 ? (
        <FlatList
          data={sortedAwards}
          renderItem={renderAward}
          keyExtractor={(item) => item.id.toString()}
          ListHeaderComponent={renderSummaryHeader}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={settings.topBarColor}
            />
          }
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <ScrollView
          contentContainerStyle={{ flex: 1 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={settings.topBarColor}
            />
          }
        >
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconContainer, { backgroundColor: cardBackgroundColor, borderColor: borderColor }]}>
              <Ionicons name="trophy-outline" size={80} color={secondaryTextColor} style={{ opacity: 0.5 }} />
            </View>
            <Text style={[styles.emptyText, { color: textColor }]}>No Awards Available</Text>
            <Text style={[styles.emptySubtext, { color: secondaryTextColor }]}>
              Awards information is not yet available for this division.
            </Text>
            <Text style={[styles.emptySubtext, { color: secondaryTextColor, marginTop: 8 }]}>
              Awards are typically announced after the event concludes or during the awards ceremony.
            </Text>
            <View style={[styles.emptyRefreshHint, { backgroundColor: cardBackgroundColor, borderColor: borderColor }]}>
              <Ionicons name="refresh" size={16} color={buttonColor} />
              <Text style={[styles.emptyRefreshText, { color: secondaryTextColor }]}>
                Pull down to refresh and check for updates
              </Text>
            </View>
          </View>
        </ScrollView>
      )}

      {renderEligibilityModal()}
      {renderRequirementsModal()}
    </View>
  );
};


export default EventDivisionAwardsScreen;
