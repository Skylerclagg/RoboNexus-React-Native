/**
 * Event Division Matches Screen
 *
 * Description:
 * Displays all matches for a specific division within a VEX robotics event.
 * Shows match schedules, scores, participating teams, and provides access to
 * match notes and detailed match information for competition tracking.
 *
 * Navigation:
 * Accessed from event division screens or event detail screens when users
 * want to view matches for a specific competition division.
 *
 * Key Features:
 * - Complete match listings for a specific event division
 * - Real-time score display and match status indicators
 * - Team alliance information with color-coded displays
 * - Match notes integration and note-taking capabilities
 * - Refresh functionality for live match updates
 * - Navigation to individual match details and team information
 */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createLogger } from '../utils/logger';

const logger = createLogger('EventDivisionMatchesScreen');
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { RouteProp, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../contexts/SettingsContext';
import { useNotes } from '../contexts/NotesContext';
import { robotEventsAPI } from '../services/apiRouter';
import { Event, Division } from '../types';
import { is2v0Format, getCompetitionType, useThemedScoreColors } from '../utils/programMappings';
import AnimatedScrollBar from '../components/AnimatedScrollBar';
import MatchCardSkeleton from '../components/MatchCardSkeleton';

type EventDivisionMatchesScreenRouteProp = RouteProp<any, any>;

type EventDivisionMatchesScreenNavigationProp = StackNavigationProp<any>;

interface Props {
  route: EventDivisionMatchesScreenRouteProp;
  navigation: EventDivisionMatchesScreenNavigationProp;
}

interface Match {
  id: number;
  name: string;
  scored: boolean;
  matchnum: number;
  alliances: {
    color: 'red' | 'blue';
    score: number;
    teams: { team: { id: number; name: string } }[];
  }[];
  started?: string;
  scheduled?: string;
  field?: string;
}

interface MatchListItem {
  id: number;
  displayName: string;
  redTeams: string[];
  blueTeams: string[];
  redScore: number | null;
  blueScore: number | null;
  time: string;
  scheduledTime: Date | null;
  startedTime: Date | null;
  scored: boolean;
  matchnum: number;
  started_at: string | null;
  field?: string;
  alliances?: {
    red?: { score: number | null };
    blue?: { score: number | null };
  };
}

const EventDivisionMatchesScreen = ({ route, navigation }: Props) => {
  const { event, division, teamsMap = {} } = route.params || {};
  const settings = useSettings();
  const { getNotesByMatch } = useNotes();
  const {
    topBarColor,
    topBarContentColor,
    buttonColor,
    backgroundColor,
    textColor,
    cardBackgroundColor,
    secondaryTextColor,
    iconColor,
    borderColor
  } = settings;

  // Determine score colors early for use in styles
  const eventProgram = event?.program?.code || event?.program?.name || 'V5RC';
  const shouldUseThemedColors = useThemedScoreColors(eventProgram);
  const redScoreColor = shouldUseThemedColors ? textColor : settings.redAllianceColor;
  const blueScoreColor = shouldUseThemedColors ? textColor : settings.blueAllianceColor;

  // Create styles early to avoid hoisting issues
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: backgroundColor,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      marginTop: 16,
      fontSize: 16,
      color: secondaryTextColor,
    },
    matchItem: {
      backgroundColor: cardBackgroundColor,
      padding: 10,
      marginHorizontal: 16,
      marginVertical: 3,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: borderColor,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    matchHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    matchHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    matchName: {
      fontSize: 16,
      fontWeight: '600',
      color: textColor,
    },
    noteIndicator: {
      width: 20,
      height: 20,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    matchTime: {
      fontSize: 14,
      color: secondaryTextColor,
    },
    alliancesContainer: {
      gap: 4,
    },
    allianceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 2,
    },
    allianceIndicator: {
      width: 4,
      height: 20,
      marginRight: 12,
      borderRadius: 2,
    },
    redIndicator: {
      backgroundColor: settings.redAllianceColor,
    },
    blueIndicator: {
      backgroundColor: settings.blueAllianceColor,
    },
    teamsContainer: {
      flex: 1,
      flexDirection: 'row',
      gap: 8,
    },
    teamButton: {
      backgroundColor: cardBackgroundColor,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: borderColor,
    },
    teamNumber: {
      fontSize: 16,
      fontWeight: '500',
      color: textColor,
    },
    scoreContainer: {
      minWidth: 40,
      alignItems: 'center',
    },
    scoreText: {
      fontSize: 16,
      fontWeight: '600',
      color: textColor,
    },
    noScoreText: {
      fontSize: 14,
      color: secondaryTextColor,
      fontStyle: 'italic',
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 40,
    },
    emptyText: {
      fontSize: 18,
      fontWeight: '600',
      color: textColor,
      textAlign: 'center',
      marginBottom: 8,
    },
    emptySubtext: {
      fontSize: 14,
      color: secondaryTextColor,
      textAlign: 'center',
      lineHeight: 20,
    },
    matchContent: {
      gap: 4,
    },
    allianceSection: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 4,
    },
    score: {
      fontSize: 24,
      fontWeight: 'bold',
    },
    redScore: {
      color: redScoreColor,
    },
    blueScore: {
      color: blueScoreColor,
    },
    emptyList: {
      flexGrow: 1,
    },
    vexIQTeamsSection: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 4,
    },
    allTeamsContainer: {
      flex: 1,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    vexIQScoreContainer: {
      minWidth: 60,
      alignItems: 'center',
    },
    dualScoreContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    scoreSeparator: {
      fontSize: 16,
      color: secondaryTextColor,
      fontWeight: '600',
    },
    vexIQScore: {
      color: blueScoreColor,
    },
    // Compact View Styles
    compactMatchItem: {
      borderRadius: 8,
      padding: 10,
      marginHorizontal: 16,
      marginVertical: 4,
      borderWidth: 1,
    },
    compactMatchHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    compactMatchName: {
      fontSize: 14,
      fontWeight: '600',
    },
    compactMatchTime: {
      fontSize: 12,
    },
    compactMatchContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    compactRedAlliance: {
      flex: 1,
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: 4,
    },
    compactBlueAlliance: {
      flex: 1,
      alignItems: 'flex-end',
      flexDirection: 'row',
      gap: 4,
      justifyContent: 'flex-end',
    },
    compactScoresCenter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 12,
    },
    compactTeamButton: {
      paddingHorizontal: 6,
      paddingVertical: 3,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: settings.borderColor,
      backgroundColor: settings.cardBackgroundColor,
    },
    compactTeamNumberText: {
      fontSize: 13,
      fontWeight: '600',
      color: settings.textColor,
    },
    compactTeamNumber: {
      fontSize: 13,
      fontWeight: '500',
    },
    compactRedTeam: {
      color: redScoreColor,
    },
    compactBlueTeam: {
      color: blueScoreColor,
    },
    compactWinnerTeam: {
      textDecorationLine: 'underline',
      fontWeight: '700',
    },
    compactScoreText: {
      fontSize: 16,
      fontWeight: '700',
    },
    compactRedScoreText: {
      color: redScoreColor,
    },
    compactBlueScoreText: {
      color: blueScoreColor,
    },
    compactWinnerScore: {
      fontSize: 18,
      fontWeight: '900',
      textDecorationLine: 'underline',
    },
    compactScoreDivider: {
      fontSize: 14,
      fontWeight: '600',
    },
  });

  // Early return if essential params are missing
  if (!event || !division) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor }]}>
        <Text style={[styles.loadingText, { color: textColor }]}>Invalid parameters</Text>
      </View>
    );
  }

  // Use format-aware logic for cooperative display
  const competitionType = getCompetitionType(eventProgram);
  const isCooperative = is2v0Format(competitionType);

  // Helper function to format scores
  const formatScore = (score: number | null, otherScore: number | null, allMatches?: MatchListItem[], currentMatch?: MatchListItem) => {
    // Check if any match in the list has a score > 0 (indicates actual scoring has begun)
    const hasAnyRealScores = allMatches?.some(match =>
      (match.alliances?.red?.score ?? 0) > 0 || (match.alliances?.blue?.score ?? 0) > 0
    ) ?? false;

    // Check if this specific match's start time has passed
    const matchStartPassed = currentMatch?.started_at ?
      new Date(currentMatch.started_at) <= new Date() : false;

    // Check if the match is marked as scored in the API
    const isMatchScored = currentMatch?.scored === true;

    // Check if any later matches (higher matchnum) have been scored with non-zero scores
    const hasLaterScoredMatches = allMatches?.some(match =>
      match.matchnum > (currentMatch?.matchnum ?? 0) &&
      match.scored === true &&
      ((match.alliances?.red?.score ?? 0) > 0 || (match.alliances?.blue?.score ?? 0) > 0)
    ) ?? false;

    if ((score === null || score === undefined) && (otherScore === null || otherScore === undefined)) {
      return (hasAnyRealScores || matchStartPassed || isMatchScored || hasLaterScoredMatches) ? '0' : '—';
    }

    if (score === 0 && otherScore === 0) {
      return (hasAnyRealScores || matchStartPassed || isMatchScored || hasLaterScoredMatches) ? '0' : '—';
    }

    if (score === null || score === undefined) {
      return '0';
    }

    // Otherwise show the actual score (including 0)
    return score.toString();
  };

  const [matches, setMatches] = useState<MatchListItem[]>([]);
  const [showLoading, setShowLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const flatListRef = useRef<any>(null);

  useEffect(() => {
    navigation.setOptions({
      title: `${division.name} Match List`,
      headerStyle: {
        backgroundColor: topBarColor,
      },
      headerTintColor: topBarContentColor,
      headerTitleAlign: 'center',
      headerTitleStyle: {
        fontWeight: '500',
        fontSize: 19,
      },
    });
  }, [division.name, topBarColor, topBarContentColor]);

  const formatTime = (date?: Date): string => {
    if (!date) return ' ';
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatMatchName = (name: string): string => {
    return name
      .replace('Qualifier', 'Q')
      .replace('Practice', 'P')
      .replace('Match', 'F')
      .replace('TeamWork', 'Q')
      .replace('#', '');
  };

  const getWinningAlliance = (item: MatchListItem): 'red' | 'blue' | 'tie' | null => {
    if (item.redScore === null || item.blueScore === null) return null;
    // Treat 0-0 matches as unplayed rather than ties
    if (item.redScore === 0 && item.blueScore === 0) return null;
    if (item.redScore > item.blueScore) return 'red';
    if (item.blueScore > item.redScore) return 'blue';
    return 'tie';
  };

  const getMatchBorderColor = (item: MatchListItem): string => {
    if (isCooperative) {
      const redScore = item.alliances?.red?.score ?? null;
      const blueScore = item.alliances?.blue?.score ?? null;

      if (redScore !== null && blueScore !== null && redScore !== blueScore) {
        const winner = getWinningAlliance(item);
        switch (winner) {
          case 'red':
            return settings.redAllianceColor;
          case 'blue':
            return settings.blueAllianceColor;
          case 'tie':
            return settings.warningColor;
          default:
            return '#999999'; // Gray for cooperative format
        }
      }

      // Default to gray for cooperative format
      return '#999999';
    }

    // Original logic for competitive formats
    const winner = getWinningAlliance(item);
    switch (winner) {
      case 'red':
        return settings.redAllianceColor;
      case 'blue':
        return settings.blueAllianceColor;
      case 'tie':
        return settings.warningColor;
      default:
        return borderColor; // Default border color for unplayed matches
    }
  };

  const fetchMatches = async () => {
    try {
      logger.debug('Fetching matches for division:', division.name);

      // Fetch matches data from API
      const matchesResponse = await robotEventsAPI.getEventDivisionMatches(event.id, division.id);

      // Ensure matchesData is an array and handle undefined/null cases
      const safeMatchesData = Array.isArray(matchesResponse.data) ? matchesResponse.data : [];
      logger.debug('Matches data received:', safeMatchesData.length, 'matches');

      const matchListItems: MatchListItem[] = safeMatchesData.map((match: Match) => {
        const redAlliance = match.alliances.find((alliance: any) => alliance.color === 'red');
        const blueAlliance = match.alliances.find((alliance: any) => alliance.color === 'blue');

        const redTeams = redAlliance?.teams?.map((t: any) => {
          const teamId = t.team.id;
          const teamNumber = teamsMap[teamId.toString()] || t.team.name || teamId.toString();
          return teamNumber;
        }) || [];

        const blueTeams = blueAlliance?.teams?.map((t: any) => {
          const teamId = t.team.id;
          const teamNumber = teamsMap[teamId.toString()] || t.team.name || teamId.toString();
          return teamNumber;
        }) || [];

        const scheduledDate = match.scheduled ? new Date(match.scheduled) : undefined;
        const startedDate = match.started ? new Date(match.started) : undefined;
        const time = formatTime(startedDate || scheduledDate);

        return {
          id: match.id,
          displayName: formatMatchName(match.name),
          redTeams,
          blueTeams,
          redScore: redAlliance?.score ?? null,
          blueScore: blueAlliance?.score ?? null,
          time,
          scheduledTime: scheduledDate || null,
          startedTime: startedDate || null,
          scored: match.scored ?? false,
          matchnum: match.matchnum ?? 0,
          started_at: match.started || null,
          field: match.field,
          alliances: {
            red: { score: redAlliance?.score ?? null },
            blue: { score: blueAlliance?.score ?? null }
          }
        };
      });

      matchListItems.sort((a, b) => {
        const timeA = a.time ? new Date(a.time).getTime() : 0;
        const timeB = b.time ? new Date(b.time).getTime() : 0;

        if (timeA && timeB) {
          return timeA - timeB;
        }

        if (timeA && !timeB) return -1;
        if (!timeA && timeB) return 1;

        return a.id - b.id;
      });

      setMatches(matchListItems);
      logger.debug('Fetch complete –', matchListItems.length, 'matches loaded.');
    } catch (error) {
      logger.error('Failed to fetch division matches:', error);
      Alert.alert('Error', 'Failed to load division matches. Please try again.');
    } finally {
      setShowLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchMatches();
  };

  useEffect(() => {
    fetchMatches();
  }, [event.id, division.id]);

  // Refresh data when tab becomes focused
  useFocusEffect(
    React.useCallback(() => {
      fetchMatches();
    }, [event.id, division.id])
  );

  const renderCompactMatchItem = ({ item }: { item: MatchListItem }) => {
    // Use the same winner detection logic as regular mode
    const winner = getWinningAlliance(item);
    const winnerColor = getMatchBorderColor(item);

    // Light background color ONLY for scored matches with a winner
    // Unscored matches get the default card background (same as regular mode)
    // Using a light overlay on top of the card background to add subtle red/blue tint
    const winnerBackgroundColor = winner === 'red' ? 'rgba(255, 100, 100, 0.08)' :
                                  winner === 'blue' ? 'rgba(100, 150, 255, 0.08)' :
                                  winner === 'tie' ? 'rgba(255, 165, 0, 0.08)' :
                                  'transparent'; // Transparent for unscored matches to show card background

    const isRedWinner = winner === 'red';
    const isBlueWinner = winner === 'blue';

    return (
      <TouchableOpacity
        style={[styles.compactMatchItem, {
          backgroundColor: settings.cardBackgroundColor,
          borderColor: winnerColor,
          borderWidth: winner ? 2 : 1,
        }]}
        onPress={() => {
          navigation.navigate('MatchNotes', {
            event: event,
            match: {
              id: item.id,
              name: item.displayName,
              red_teams: item.redTeams,
              blue_teams: item.blueTeams,
              red_score: item.redScore,
              blue_score: item.blueScore,
              started: item.time
            },
            teamsMap: teamsMap
          });
        }}
      >
        {/* Color tint overlay */}
        {winner && (
          <View style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: winnerBackgroundColor,
            borderRadius: 8,
          }} />
        )}

        <View style={styles.compactMatchHeader}>
          <Text style={[styles.compactMatchName, { color: settings.textColor }]}>{item.displayName}</Text>
          <View style={{ alignItems: 'flex-end' }}>
            {item.field && (
              <Text style={[styles.compactMatchTime, { color: settings.textColor, fontWeight: '600' }]}>{item.field}</Text>
            )}
            <Text style={[styles.compactMatchTime, { color: settings.secondaryTextColor }]}>{item.time}</Text>
          </View>
        </View>

        <View style={styles.compactMatchContent}>
          <View style={styles.compactRedAlliance}>
            {item.redTeams.map((team, index) => (
              <TouchableOpacity
                key={`red-${index}`}
                style={styles.compactTeamButton}
                onPress={() => {
                  navigation.navigate('EventTeamInfo', {
                    event: event,
                    teamNumber: team,
                    teamData: null,
                    division: division,
                    defaultPage: 'information'
                  });
                }}
                hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
              >
                <Text
                  style={[
                    styles.compactTeamNumberText,
                  ]}
                  numberOfLines={1}
                >
                  {team}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.compactScoresCenter}>
            <Text style={[
              styles.compactScoreText,
              styles.compactRedScoreText,
              isRedWinner && styles.compactWinnerScore,
            ]}>
              {item.redScore ?? '—'}
            </Text>
            <Text style={[styles.compactScoreDivider, { color: settings.secondaryTextColor }]}>-</Text>
            <Text style={[
              styles.compactScoreText,
              styles.compactBlueScoreText,
              isBlueWinner && styles.compactWinnerScore,
            ]}>
              {item.blueScore ?? '—'}
            </Text>
          </View>

          <View style={styles.compactBlueAlliance}>
            {item.blueTeams.map((team, index) => (
              <TouchableOpacity
                key={`blue-${index}`}
                style={styles.compactTeamButton}
                onPress={() => {
                  navigation.navigate('EventTeamInfo', {
                    event: event,
                    teamNumber: team,
                    teamData: null,
                    division: division,
                    defaultPage: 'information'
                  });
                }}
                hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
              >
                <Text
                  style={[
                    styles.compactTeamNumberText,
                  ]}
                  numberOfLines={1}
                >
                  {team}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderMatchItem = ({ item }: { item: MatchListItem }) => {
    // Check if this match has any notes
    const matchNotes = getNotesByMatch(event.id, item.id);
    const hasNotes = matchNotes.length > 0;

    return (
      <TouchableOpacity
        style={[styles.matchItem, { borderColor: getMatchBorderColor(item) }]}
        onPress={() => {
          navigation.navigate('MatchNotes', {
            event: event,
            match: {
              id: item.id,
              name: item.displayName,
              red_teams: item.redTeams,
              blue_teams: item.blueTeams,
              red_score: item.redScore,
              blue_score: item.blueScore,
              started: item.time
            },
            teamsMap: teamsMap
          });
        }}
        activeOpacity={0.7}
      >
        {/* Match Header */}
        <View style={styles.matchHeader}>
          <View style={styles.matchHeaderLeft}>
            <Text style={styles.matchName}>{item.displayName}</Text>
            {hasNotes && (
              <View style={[styles.noteIndicator, { backgroundColor: buttonColor }]}>
                <Ionicons name="document-text" size={12} color="#fff" />
              </View>
            )}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            {item.field && (
              <Text style={[styles.matchTime, { fontWeight: '600' }]}>{item.field}</Text>
            )}
            <Text style={styles.matchTime}>{item.time}</Text>
          </View>
        </View>

      {/* Teams and Scores */}
      <View style={styles.matchContent}>
        {isCooperative ? (
          // Cooperative Display: Show teams together with single score
          <>
            <View style={styles.vexIQTeamsSection}>
              <View style={styles.allTeamsContainer}>
                {/* Red Teams */}
                {item.redTeams.map((team, index) => {
                  // Determine team color based on scores
                  const redScore = item.redScore || 0;
                  const blueScore = item.blueScore || 0;
                  const isRedTeamZero = redScore === 0 && blueScore !== 0;
                  const isRedTeamWinner = redScore > 0 && blueScore === 0;

                  return (
                    <TouchableOpacity
                      key={`red-${index}`}
                      style={styles.teamButton}
                      onPress={() => {
                        navigation.navigate('EventTeamInfo', {
                          event: event,
                          teamNumber: team,
                          teamData: null,
                          division: division,
                          defaultPage: 'information'
                        });
                      }}
                    >
                      <Text style={[
                        styles.teamNumber,
                        isRedTeamZero ? { color: settings.errorColor, textDecorationLine: 'line-through' } :
                        isRedTeamWinner ? { color: settings.infoColor } : null
                      ]}>
                        {team}
                      </Text>
                    </TouchableOpacity>
                  );
                })}

                {/* Blue Teams */}
                {item.blueTeams.map((team, index) => {
                  // Determine team color based on scores
                  const redScore = item.redScore || 0;
                  const blueScore = item.blueScore || 0;
                  const isBlueTeamZero = blueScore === 0 && redScore !== 0;
                  const isBlueTeamWinner = blueScore > 0 && redScore === 0;

                  return (
                    <TouchableOpacity
                      key={`blue-${index}`}
                      style={styles.teamButton}
                      onPress={() => {
                        navigation.navigate('EventTeamInfo', {
                          event: event,
                          teamNumber: team,
                          teamData: null,
                          division: division,
                          defaultPage: 'information'
                        });
                      }}
                    >
                      <Text style={[
                        styles.teamNumber,
                        isBlueTeamZero ? { color: settings.errorColor, textDecorationLine: 'line-through' } :
                        isBlueTeamWinner ? { color: settings.infoColor } : null
                      ]}>
                        {team}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Score - show single blue score unless they differ */}
              <View style={styles.vexIQScoreContainer}>
                {item.redScore !== item.blueScore && item.redScore !== null && item.blueScore !== null ? (
                  // Show both scores if they differ
                  <View style={styles.dualScoreContainer}>
                    <Text style={[
                      styles.score,
                      (item.redScore === 0 && item.blueScore !== 0) ? { color: redScoreColor } : styles.redScore,
                      item.redScore > item.blueScore && { textDecorationLine: 'underline' }
                    ]}>
                      {formatScore(item.redScore, item.blueScore, matches, item)}
                    </Text>
                    <Text style={styles.scoreSeparator}> / </Text>
                    <Text style={[
                      styles.score,
                      (item.blueScore === 0 && item.redScore !== 0) ? { color: blueScoreColor } : styles.blueScore,
                      item.blueScore > item.redScore && { textDecorationLine: 'underline' }
                    ]}>
                      {formatScore(item.blueScore, item.redScore, matches, item)}
                    </Text>
                  </View>
                ) : (
                  // Show single blue score
                  <Text style={[
                    styles.score,
                    (item.blueScore === 0 && item.redScore !== 0) ? { color: redScoreColor } : styles.vexIQScore
                  ]}>
                    {formatScore(item.blueScore, item.redScore, matches, item)}
                  </Text>
                )}
              </View>
            </View>
          </>
        ) : (
          // Standard Display: Red vs Blue with VS divider
          <>
            {/* Red Alliance */}
            <View style={styles.allianceSection}>
              <View style={[styles.allianceIndicator, styles.redIndicator]} />
              <View style={styles.teamsContainer}>
                {item.redTeams.map((team, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.teamButton}
                    onPress={() => {
                      navigation.navigate('EventTeamInfo', {
                        event: event,
                        teamNumber: team,
                        teamData: null,
                        division: division,
                        defaultPage: 'information'
                      });
                    }}
                  >
                    <Text style={styles.teamNumber}>{team}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.scoreContainer}>
                <Text style={[
                  styles.score,
                  styles.redScore,
                  item.redScore !== null && item.blueScore !== null && item.redScore > item.blueScore && { textDecorationLine: 'underline' }
                ]}>
                  {formatScore(item.redScore, item.blueScore, matches, item)}
                </Text>
              </View>
            </View>

            {/* Blue Alliance */}
            <View style={styles.allianceSection}>
              <View style={[styles.allianceIndicator, styles.blueIndicator]} />
              <View style={styles.teamsContainer}>
                {item.blueTeams.map((team, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.teamButton}
                    onPress={() => {
                      navigation.navigate('EventTeamInfo', {
                        event: event,
                        teamNumber: team,
                        teamData: null,
                        division: division,
                        defaultPage: 'information'
                      });
                    }}
                  >
                    <Text style={styles.teamNumber}>{team}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.scoreContainer}>
                <Text style={[
                  styles.score,
                  styles.blueScore,
                  item.blueScore !== null && item.redScore !== null && item.blueScore > item.redScore && { textDecorationLine: 'underline' }
                ]}>
                  {formatScore(item.blueScore, item.redScore, matches, item)}
                </Text>
              </View>
            </View>
          </>
        )}
      </View>
    </TouchableOpacity>
  );
  };

  const renderEmptyComponent = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="trophy-outline" size={60} color={iconColor} />
      <Text style={styles.emptyText}>No matches available</Text>
      <Text style={styles.emptySubtext}>
        Matches will appear here when available
      </Text>
    </View>
  );

  if (showLoading && matches.length === 0) {
    return (
      <View style={styles.container}>
        <FlatList
          data={Array(8).fill(null)}
          renderItem={() => <MatchCardSkeleton compact={settings.compactViewMatches} />}
          keyExtractor={(_, index) => `skeleton-${index}`}
          contentContainerStyle={{ paddingVertical: 8 }}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={{ flex: 1 }}>
        <FlatList
          ref={flatListRef}
          data={matches}
          renderItem={settings.compactViewMatches ? renderCompactMatchItem : renderMatchItem}
          keyExtractor={(item) => item.id.toString()}
          ListEmptyComponent={renderEmptyComponent}
          contentContainerStyle={matches.length === 0 ? styles.emptyList : undefined}
          showsVerticalScrollIndicator={settings.scrollBarEnabled && settings.scrollBarMatches ? false : false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={buttonColor}
            />
          }
          onScroll={(event) => {
            const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
            setScrollY(contentOffset.y);
            setContentHeight(contentSize.height);
            setViewportHeight(layoutMeasurement.height);
          }}
          scrollEventThrottle={16}
        />
        <AnimatedScrollBar
          scrollY={scrollY}
          contentHeight={contentHeight}
          viewportHeight={viewportHeight}
          color={buttonColor}
          enabled={settings.scrollBarEnabled && settings.scrollBarMatches}
          scrollViewRef={flatListRef}
        />
      </View>
    </View>
  );
};

export default EventDivisionMatchesScreen;
