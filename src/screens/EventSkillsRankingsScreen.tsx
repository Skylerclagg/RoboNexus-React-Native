/**
 * Event Skills Rankings Screen
 *
 * Description:
 * Displays skills rankings for teams at a VEX robotics event, showing combined
 * programming and driver skills scores. Features search functionality and
 * detailed skills performance metrics for competition analysis.
 *
 * Navigation:
 * Accessed from event detail screens or skills-related sections when users
 * want to view skills rankings for a specific competition.
 *
 * Key Features:
 * - Combined skills rankings with programming and driver scores
 * - Individual skills component breakdown and analysis
 * - Team search functionality within skills rankings
 * - Skills score comparisons and attempt tracking
 * - Real-time rankings updates with refresh capability
 * - Navigation to detailed team skills information
 */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createLogger } from '../utils/logger';

const logger = createLogger('EventSkillsRankingsScreen');
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  TextInput,
} from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../contexts/SettingsContext';
import { robotEventsAPI } from '../services/apiRouter';
import AnimatedScrollBar from '../components/AnimatedScrollBar';
import { Event, Team } from '../types';
import {
  getSkillsDisplayInfo,
  getSkillsDisplayTypes
} from '../utils/matchDisplay';
import { getCompetitionType, getProgramConfig, useThemedScoreColors } from '../utils/programMappings';
import { getDynamicLabel } from '../utils/eligibility/common';
import { RobotProgram } from '../utils/eligibility/types';
import type { ProgramType } from '../contexts/SettingsContext';

type EventSkillsRankingsScreenRouteProp = RouteProp<
  {
    EventSkillsRankings: {
      event: Event;
      teamsMap: Record<string, string>;
    };
  },
  'EventSkillsRankings'
>;

type EventSkillsRankingsScreenNavigationProp = StackNavigationProp<any>;

interface Props {
  route: EventSkillsRankingsScreenRouteProp;
  navigation: EventSkillsRankingsScreenNavigationProp;
}

interface SkillsRankingAPI {
  id: number;
  rank: number;
  team: {
    id: number;
    name: string;
  };
  combined_score: number;
  programming_score: number;
  programming_attempts: number;
  driver_score: number;
  driver_attempts: number;
}

interface SkillsRanking {
  id: number;
  rank: number;
  teamId: number;
  teamNumber: string;
  teamName: string;
  combined_score: number;
  programming_score: number;
  programming_attempts: number;
  driver_score: number;
  driver_attempts: number;
}

// Helper function to convert ProgramType to RobotProgram
const programToRobotProgram = (program: ProgramType): RobotProgram | null => {
  if (program.includes('VEX V5') || program.includes('VEX U')) {
    return RobotProgram.V5RC;
  } else if (program.includes('VEX IQ')) {
    return RobotProgram.VIQRC;
  } else if (program.includes('Aerial Drone')) {
    return RobotProgram.ADC;
  }
  return null;
};

const EventSkillsRankingsScreen = ({ route, navigation }: Props) => {
  const { event, teamsMap = {} } = route.params || {};
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

  const [skillsRankings, setSkillsRankings] = useState<SkillsRanking[]>([]);
  const [filteredRankings, setFilteredRankings] = useState<SkillsRanking[]>([]);
  const [teamNumberQuery, setTeamNumberQuery] = useState('');
  const [showLoading, setShowLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const flatListRef = useRef<any>(null);

  // Use enhanced format-aware system for skills display
  const skillsDisplayInfo = getSkillsDisplayInfo(selectedProgram);
  const competitionType = getCompetitionType(selectedProgram);
  const robotProgram = programToRobotProgram(selectedProgram);
  const programConfig = getProgramConfig(selectedProgram);

  // Get proper labels using program-specific mappings
  const primaryLabel = skillsDisplayInfo.primaryLabel; // Driver, Piloting, Flight, or Autonomous
  const secondaryLabel = skillsDisplayInfo.secondaryLabel; // Programming or Autonomous Flight
  const competitorType = skillsDisplayInfo.competitorType;

  // Check if secondary skills should be shown based on program mappings
  const showSecondarySkills = programConfig.hasDriverSkills && programConfig.hasProgrammingSkills;

  // Determine if we should use themed colors or button color for scores
  const shouldUseThemedColors = useThemedScoreColors(selectedProgram);
  const scoreColor = shouldUseThemedColors ? textColor : buttonColor;

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
    headerButton: {
      marginRight: 16,
    },
    searchContainer: {
      padding: 16,
      paddingBottom: 12,
      backgroundColor: backgroundColor,
    },
    searchInput: {
      flex: 1,
      paddingVertical: 10,
      fontSize: 16,
      color: textColor,
    },
    rankingItem: {
      backgroundColor: cardBackgroundColor,
      padding: 12,
      marginHorizontal: 16,
      marginVertical: 4,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: borderColor,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    teamHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    teamInfo: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 8,
    },
    teamNumber: {
      fontSize: 18,
      fontWeight: '700',
      color: textColor,
      letterSpacing: 0.2,
    },
    teamName: {
      fontSize: 13,
      color: secondaryTextColor,
      fontWeight: '500',
      flex: 1,
    },
    rankBadge: {
      backgroundColor: buttonColor,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 16,
      minWidth: 45,
      alignItems: 'center',
      shadowColor: buttonColor,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 2,
      elevation: 2,
    },
    rankBadgeText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '700',
    },
    scoresContainer: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-evenly',
      borderTopWidth: 1,
      borderTopColor: borderColor,
      paddingTop: 10,
    },
    scoreCard: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 0,
      paddingHorizontal: 8,
    },
    scoreCardWithBorder: {
      borderRightWidth: 1,
      borderRightColor: borderColor,
    },
    combinedScoreSection: {
      flex: 1.2,
      alignItems: 'center',
      paddingVertical: 0,
      paddingHorizontal: 4,
    },
    sectionLabel: {
      fontSize: 10,
      color: secondaryTextColor,
      marginBottom: 4,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.2,
      includeFontPadding: false,
    },
    combinedScoreLabel: {
      fontSize: 9,
      color: secondaryTextColor,
      marginBottom: 3,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.2,
      includeFontPadding: false,
    },
    scoreValue: {
      fontSize: 18,
      fontWeight: '700',
      color: scoreColor,
      marginBottom: 2,
      includeFontPadding: false,
    },
    combinedScoreValue: {
      fontSize: 18,
      fontWeight: '700',
      color: textColor,
      includeFontPadding: false,
    },
    scoreAttempts: {
      fontSize: 10,
      color: secondaryTextColor,
      fontWeight: '500',
      includeFontPadding: false,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 40,
    },
    emptyIconContainer: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: borderColor,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 20,
    },
    emptyText: {
      fontSize: 20,
      fontWeight: '700',
      color: textColor,
      textAlign: 'center',
      marginBottom: 8,
    },
    emptySubtext: {
      fontSize: 15,
      color: secondaryTextColor,
      textAlign: 'center',
      lineHeight: 22,
    },
    emptyList: {
      flexGrow: 1,
    },
    searchInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: cardBackgroundColor,
      borderColor: borderColor,
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 14,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    searchIcon: {
      marginRight: 8,
    },
    clearButton: {
      marginLeft: 8,
    },
    // Compact View Styles
    compactSkillsItem: {
      backgroundColor: '#FFFFFF',
      borderRadius: 8,
      padding: 10,
      marginHorizontal: 16,
      marginVertical: 4,
      borderWidth: 1,
    },
    compactSkillsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 4,
    },
    compactRankNumber: {
      fontSize: 14,
      fontWeight: '700',
      minWidth: 32,
    },
    compactTeamNumber: {
      fontSize: 14,
      fontWeight: '600',
    },
    compactTeamName: {
      fontSize: 13,
      flex: 1,
    },
    compactTotalScore: {
      fontSize: 14,
      fontWeight: '700',
    },
    compactSkillsStatsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    compactSkillStat: {
      fontSize: 12,
    },
    compactStatSeparator: {
      fontSize: 10,
    },
  });

  useEffect(() => {
    navigation.setOptions({
      title: 'Skills Rankings',
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
  }, [settings.topBarColor, settings.topBarContentColor]);

  const fetchSkillsRankings = async () => {
    try {
      if (!event?.id) {
       logger.error('No event ID available for skills rankings');
        setShowLoading(false);
        setRefreshing(false);
        return;
      }

     logger.debug('Fetching skills rankings for event:', event.id);

      // Fetch both skills data AND team data to get full team information
      const [skillsResponse, teamsResponse] = await Promise.all([
        robotEventsAPI.getEventSkills(event.id),
        robotEventsAPI.getEventTeams(event.id)
      ]);

      // Ensure skillsData is an array and handle undefined/null cases
      const safeSkillsData = Array.isArray(skillsResponse.data) ? skillsResponse.data : [];
      const teamsData = Array.isArray(teamsResponse.data) ? teamsResponse.data : [];
     logger.debug('Skills data received:', safeSkillsData.length, 'skills entries');
     logger.debug('Teams data received:', teamsData.length, 'teams');

      // Create a map of team ID to full team data
      const teamsById = new Map(teamsData.map(team => [team.id, team]));

      const teamSkillsMap = new Map<number, {
        teamId: number;
        teamNumber: string;
        teamName: string;
        programming_score: number;
        programming_attempts: number;
        driver_score: number;
        driver_attempts: number;
        combined_score: number;
      }>();

      safeSkillsData.forEach((skill: any) => {
        try {
          if (!skill || !skill.team || !skill.team.id) return;

          const teamId = skill.team.id;
          const apiTeamNumber = skill.team.name;
          const fullTeamData = teamsById.get(teamId);

          const teamNumber = teamsMap[teamId.toString()] || fullTeamData?.number || apiTeamNumber || '';
          const teamName = fullTeamData?.team_name || '';

          const existing = teamSkillsMap.get(teamId) || {
            teamId: teamId,
            teamNumber: teamNumber,
            teamName: teamName,
            programming_score: 0,
            programming_attempts: 0,
            driver_score: 0,
            driver_attempts: 0,
            combined_score: 0,
          };

          // Update scores based on skill type
          if (skill.type === 'programming') {
            existing.programming_score = Math.max(existing.programming_score, skill.score || 0);
            existing.programming_attempts = skill.attempts || 0;
          } else if (skill.type === 'driver') {
            existing.driver_score = Math.max(existing.driver_score, skill.score || 0);
            existing.driver_attempts = skill.attempts || 0;
          }

          // Calculate combined score
          existing.combined_score = existing.programming_score + existing.driver_score;

          teamSkillsMap.set(teamId, existing);
        } catch (error) {
         logger.error('Error processing skill entry:', skill, error);
        }
      });

      const rankingsArray: SkillsRanking[] = Array.from(teamSkillsMap.entries()).map(([teamId, data]) => ({
        id: teamId,
        rank: 0, // Will be set after sorting
        teamId: data.teamId,
        teamNumber: data.teamNumber,
        teamName: data.teamName,
        combined_score: data.combined_score,
        programming_score: data.programming_score,
        programming_attempts: data.programming_attempts,
        driver_score: data.driver_score,
        driver_attempts: data.driver_attempts,
      }));

      // Sort by combined score (descending) and assign ranks
      rankingsArray.sort((a, b) => b.combined_score - a.combined_score);
      rankingsArray.forEach((ranking, index) => {
        ranking.rank = index + 1;
      });

     logger.debug('Processed skills rankings:', rankingsArray.length, 'teams');

      setSkillsRankings(rankingsArray);
      setFilteredRankings(rankingsArray);
    } catch (error) {
     logger.error('Failed to fetch skills rankings:', error);
      Alert.alert('Error', 'Failed to load skills rankings. Please try again.');
    } finally {
      setShowLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchSkillsRankings();
  };

  useEffect(() => {
    fetchSkillsRankings();
  }, [event.id]);

  useEffect(() => {
    if (teamNumberQuery.trim() === '') {
      setFilteredRankings(skillsRankings);
    } else {
      const filtered = skillsRankings.filter(ranking => {
        const query = teamNumberQuery.toLowerCase();
        return ranking.teamNumber.toLowerCase().includes(query) ||
               ranking.teamName.toLowerCase().includes(query);
      });
      setFilteredRankings(filtered);
    }
  }, [teamNumberQuery, skillsRankings]);

  const renderCompactSkillsItem = ({ item }: { item: SkillsRanking }) => {
    const teamId = item.teamId;
    const teamNumber = item.teamNumber;
    const teamName = item.teamName;

    const handleTeamPress = () => {
      navigation.navigate('EventTeamInfo', {
        event: event,
        teamNumber: teamNumber,
        teamData: null,
      });
    };

    return (
      <TouchableOpacity
        style={[styles.compactSkillsItem, {
          backgroundColor: settings.cardBackgroundColor,
          borderColor: settings.borderColor,
        }]}
        onPress={handleTeamPress}
        activeOpacity={0.7}
      >
        <View style={styles.compactSkillsRow}>
          <Text style={[styles.compactRankNumber, { color: settings.buttonColor }]}>
            #{item.rank}
          </Text>
          <Text style={[styles.compactTeamNumber, { color: settings.textColor }]}>{teamNumber}</Text>
          {teamName && (
            <Text style={[styles.compactTeamName, { color: settings.secondaryTextColor }]} numberOfLines={1}>
              {teamName}
            </Text>
          )}
          <Text style={[styles.compactTotalScore, { color: settings.buttonColor }]}>
            {item.combined_score}
          </Text>
        </View>
        <View style={styles.compactSkillsStatsRow}>
          <Text style={[styles.compactSkillStat, { color: settings.textColor }]}>
            {primaryLabel}: {programConfig.hasDriverSkills ? item.driver_score : item.programming_score} ({programConfig.hasDriverSkills ? item.driver_attempts : item.programming_attempts})
          </Text>
          {showSecondarySkills && (
            <>
              <Text style={[styles.compactStatSeparator, { color: settings.secondaryTextColor }]}>•</Text>
              <Text style={[styles.compactSkillStat, { color: settings.textColor }]}>
                {secondaryLabel}: {item.programming_score} ({item.programming_attempts})
              </Text>
            </>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderSkillsRankingItem = ({ item }: { item: SkillsRanking }) => {
    const teamId = item.teamId;
    const teamNumber = item.teamNumber;
    const teamName = item.teamName;

    const handleTeamPress = () => {
      navigation.navigate('EventTeamInfo', {
        event: event,
        teamNumber: teamNumber,
        teamData: null,
      });
    };

    return (
      <TouchableOpacity
        style={styles.rankingItem}
        onPress={handleTeamPress}
        activeOpacity={0.7}
      >
        {/* Team Header */}
        <View style={styles.teamHeader}>
          <View style={styles.teamInfo}>
            <Text style={styles.teamNumber}>{teamNumber}</Text>
            {teamName && (
              <Text style={styles.teamName}>{teamName}</Text>
            )}
          </View>
          <View style={styles.rankBadge}>
            <Text style={styles.rankBadgeText}>#{item.rank}</Text>
          </View>
        </View>

        {/* Scores Detail */}
        <View style={styles.scoresContainer}>
          {/* Combined Score */}
          <View style={[styles.combinedScoreSection, showSecondarySkills && styles.scoreCardWithBorder]}>
            <Text style={styles.combinedScoreLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              Combined
            </Text>
            <Text style={styles.combinedScoreValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              {item.combined_score}
            </Text>
          </View>

          {/* Primary Skills Section - check hasDriverSkills to determine which score field to use */}
          <View style={[styles.scoreCard, showSecondarySkills && styles.scoreCardWithBorder]}>
            <Text style={styles.sectionLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {primaryLabel}
            </Text>
            <Text style={styles.scoreValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              {programConfig.hasDriverSkills ? item.driver_score : item.programming_score}
            </Text>
            <Text style={styles.scoreAttempts} numberOfLines={1}>
              {programConfig.hasDriverSkills
                ? (competitorType === 'drone' ? item.driver_attempts + ' runs' : item.driver_attempts + ' attempts')
                : (competitorType === 'drone' ? item.programming_attempts + ' runs' : item.programming_attempts + ' attempts')
              }
            </Text>
          </View>

          {/* Secondary Skills Section (API: programming) - only shown if program has both driver AND programming skills */}
          {showSecondarySkills && (
            <View style={styles.scoreCard}>
              <Text style={styles.sectionLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                {secondaryLabel}
              </Text>
              <Text style={styles.scoreValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                {item.programming_score}
              </Text>
              <Text style={styles.scoreAttempts} numberOfLines={1}>
                {competitorType === 'drone' ? item.programming_attempts + ' runs' : item.programming_attempts + ' attempts'}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyComponent = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Ionicons name="trophy-outline" size={50} color={iconColor} />
      </View>
      <Text style={styles.emptyText}>No Skills Rankings</Text>
      <Text style={styles.emptySubtext}>
        {teamNumberQuery ? 'No teams match your search criteria.\nTry adjusting your search terms.' : 'Skills rankings will appear here once teams\nhave completed their skills runs.'}
      </Text>
    </View>
  );

  if (showLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={settings.buttonColor} />
        <Text style={styles.loadingText}>Loading skills rankings...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color={iconColor} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Enter a team number..."
            value={teamNumberQuery}
            onChangeText={setTeamNumberQuery}
            placeholderTextColor="#999"
          />
          {teamNumberQuery.length > 0 && (
            <TouchableOpacity onPress={() => setTeamNumberQuery('')} style={styles.clearButton}>
              <Ionicons name="close-circle" size={20} color={iconColor} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={{ flex: 1 }}>
        <FlatList
          data={filteredRankings}
          renderItem={settings.compactViewSkills ? renderCompactSkillsItem : renderSkillsRankingItem}
          keyExtractor={(item) => item.id.toString()}
          ListEmptyComponent={renderEmptyComponent}
          contentContainerStyle={filteredRankings.length === 0 ? styles.emptyList : { paddingBottom: 16, paddingTop: 8 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={settings.buttonColor}
            />
          }
          onScroll={(event) => {
            const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
            setScrollY(contentOffset.y);
            setContentHeight(contentSize.height);
            setViewportHeight(layoutMeasurement.height);
          }}
          scrollEventThrottle={16}
          ref={flatListRef}
        />
        <AnimatedScrollBar
          scrollY={scrollY}
          contentHeight={contentHeight}
          viewportHeight={viewportHeight}
          color={settings.buttonColor}
          enabled={settings.scrollBarEnabled && settings.scrollBarSkills}
          scrollViewRef={flatListRef}
        />
      </View>
    </View>
  );
};

export default EventSkillsRankingsScreen;
