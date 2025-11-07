/**
 * Event Team Matches Screen
 *
 * Description:
 * Displays all matches for a specific team within a VEX robotics event.
 * Shows match schedules, results, alliance partners, and provides access to
 * match notes and detailed performance analysis for individual team tracking.
 *
 * Navigation:
 * Accessed from team detail screens or team listings when users want to
 * view all matches for a specific team in a competition.
 *
 * Key Features:
 * - Complete match history for a specific team at an event
 * - Match results with scores and alliance information
 * - Alliance partner identification and team collaboration details
 * - Match notes integration with note-taking capabilities
 * - Win-loss tracking and team performance statistics
 * - Navigation to detailed match information and opponent analysis
 */
import React, { useState, useEffect, useMemo } from 'react';
import { createLogger } from '../utils/logger';

const logger = createLogger('EventTeamMatchesScreen');
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
  ScrollView,
} from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../contexts/SettingsContext';
import { useNotes, TeamMatchNote } from '../contexts/NotesContext';
import { robotEventsAPI } from '../services/apiRouter';
import { Event, Division, Team } from '../types';
import { getMatchDisplayConfig } from '../utils/matchDisplay';
import { isTeamVsTeamFormat, is2v0Format, useThemedScoreColors } from '../utils/programMappings';
import MatchCardSkeleton from '../components/MatchCardSkeleton';

type EventTeamMatchesScreenRouteProp = RouteProp<
  {
    EventTeamMatches: {
      event: Event;
      teamNumber: string;
      teamId: number;
      division?: Division;
      teamsMap?: Record<string, string>;
    };
  },
  'EventTeamMatches'
>;

type EventTeamMatchesScreenNavigationProp = StackNavigationProp<any>;

interface Props {
  route: EventTeamMatchesScreenRouteProp;
  navigation: EventTeamMatchesScreenNavigationProp;
}

interface Match {
  id: number;
  name: string;
  red_alliance: Team[];
  blue_alliance: Team[];
  red_score: number | null;
  blue_score: number | null;
  started?: Date;
  scheduled?: Date;
  division?: Division;
}

interface MatchListItem {
  id: number;
  displayName: string;
  redTeams: string[];
  blueTeams: string[];
  redScore: number | null;
  blueScore: number | null;
  time: string;
  teamAlliance: 'red' | 'blue' | null;
  winningAlliance: 'red' | 'blue' | 'tie' | null;
  scheduledTime?: Date | null;
  startedTime?: Date | null;
  alliances?: {
    red?: { score: number | null };
    blue?: { score: number | null };
  };
  rawMatch?: any; // Store raw match data with team details
}


const EventTeamMatchesScreen = ({ route, navigation }: Props) => {
  const { event, teamNumber, teamId, division, teamsMap = {} } = route.params;
  const settings = useSettings();
  const {
    backgroundColor,
    textColor,
    cardBackgroundColor,
    secondaryTextColor,
    iconColor,
    borderColor,
    buttonColor,
  } = settings;
  const { getNotesByTeam, deleteEmptyNotes } = useNotes();

  // Get match display configuration based on the current program
  const matchDisplayConfig = getMatchDisplayConfig(settings.selectedProgram);
  const isCooperative = is2v0Format(settings.selectedProgram); // 2v0 formats are cooperative

  // Determine if we should use themed colors or alliance colors for scores
  const shouldUseThemedColors = useThemedScoreColors(settings.selectedProgram);
  const redScoreColor = shouldUseThemedColors ? textColor : '#FF3B30';
  const blueScoreColor = shouldUseThemedColors ? textColor : '#007AFF';

  const [matches, setMatches] = useState<MatchListItem[]>([]);
  const [showLoading, setShowLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showingTeamNotes, setShowingTeamNotes] = useState(false);
  const [teamMatchNotes, setTeamMatchNotes] = useState<TeamMatchNote[]>([]);

  useEffect(() => {
    navigation.setOptions({
      title: `${teamNumber} Match List`,
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
  }, [teamNumber, settings.topBarColor, settings.topBarContentColor]);

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

  const determineTeamAlliance = (match: Match): 'red' | 'blue' | null => {
    const isRedTeam = match.red_alliance.some(team => team.id === teamId);
    const isBlueTeam = match.blue_alliance.some(team => team.id === teamId);

    if (isRedTeam) return 'red';
    if (isBlueTeam) return 'blue';
    return null;
  };

  const determineWinningAlliance = (match: Match): 'red' | 'blue' | 'tie' | null => {
    if (match.red_score === null || match.blue_score === null) return null;
    if (match.red_score > match.blue_score) return 'red';
    if (match.blue_score > match.red_score) return 'blue';
    return 'tie';
  };

  // Helper function to format scores
  const formatScore = (score: number | null, otherScore: number | null) => {
    if ((score === null || score === undefined) && (otherScore === null || otherScore === undefined)) {
      return '—';
    }

    if (score === 0 && otherScore === 0) {
      return '—';
    }

    if (score === null || score === undefined) {
      return '0';
    }

    // Otherwise show the actual score (including 0)
    return score.toString();
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
            return '#FF3B30'; // Red
          case 'blue':
            return '#007AFF'; // Blue
          case 'tie':
            return '#FFA500'; // Orange for ties
          default:
            return '#999999'; // Gray default
        }
      }

      // Default to gray for 2v0 format
      return '#999999';
    }

    // Original competitive logic
    const winner = getWinningAlliance(item);
    switch (winner) {
      case 'red':
        return '#FF3B30'; // Red
      case 'blue':
        return '#007AFF'; // Blue
      case 'tie':
        return '#FFA500'; // Orange for ties
      default:
        return borderColor; // Default border color for unplayed matches
    }
  };

  const fetchTeamMatches = async () => {
    try {
      logger.debug('Fetching matches for team:', teamNumber, 'ID:', teamId);

      if (!teamId) {
        logger.error('Team ID is undefined, cannot fetch matches');
        Alert.alert('Error', 'Team ID not found, cannot load matches');
        return;
      }

      // Use the correct API to get team matches at this event
      const teamMatchesResponse = await robotEventsAPI.getTeamMatches(teamId, { event: [event.id] });
      logger.debug('Found', teamMatchesResponse.data.length, 'matches for team', teamNumber || 'Unknown', 'at event', event.id || 'Unknown');

      const matchListItems: MatchListItem[] = teamMatchesResponse.data.map((match) => {
        const redTeams: string[] = [];
        const blueTeams: string[] = [];

        match.alliances.forEach((alliance: any) => {
          alliance.teams.forEach((teamData: any) => {
            const teamId = teamData.team.id;
            const extractedTeamNumber = teamData.team.name || teamId.toString();
            if (alliance.color === 'red') {
              redTeams.push(extractedTeamNumber);
            } else if (alliance.color === 'blue') {
              blueTeams.push(extractedTeamNumber);
            }
          });
        });

        // Determine which alliance this team is on
        let teamAlliance: 'red' | 'blue' | null = null;
        match.alliances.forEach((alliance: any) => {
          alliance.teams.forEach((teamData: any) => {
            if (teamData.team.id === teamId) {
              teamAlliance = alliance.color as 'red' | 'blue';
            }
          });
        });

        const redScore = match.alliances.find(a => a.color === 'red')?.score ?? null;
        const blueScore = match.alliances.find(a => a.color === 'blue')?.score ?? null;

        return {
          id: match.id,
          displayName: formatMatchName(match.name),
          redTeams,
          blueTeams,
          redScore,
          blueScore,
          time: formatTime(match.started ? new Date(match.started) : match.scheduled ? new Date(match.scheduled) : undefined),
          scheduledTime: match.scheduled ? new Date(match.scheduled) : null,
          startedTime: match.started ? new Date(match.started) : null,
          teamAlliance,
          winningAlliance: null, // Will be calculated dynamically using getWinningAlliance()
          rawMatch: match, // Store raw match data
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
    } catch (error) {
      logger.error('Failed to fetch team matches:', error);
      Alert.alert('Error', 'Failed to load team matches. Please try again.');
    } finally {
      setShowLoading(false);
      setRefreshing(false);
    }
  };

  const fetchTeamNotes = async () => {
    try {
      // Fetch team notes using the notes context
      const notes = getNotesByTeam(teamId, event.id);
      setTeamMatchNotes(notes);
      logger.debug('Loaded', notes.length, 'notes for team', teamNumber || 'Unknown');
    } catch (error) {
      logger.error('Failed to fetch team notes:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchTeamMatches();
  };

  useEffect(() => {
    fetchTeamMatches();
    fetchTeamNotes();

    // Cleanup empty notes when component unmounts
    return () => {
      deleteEmptyNotes();
    };
  }, [event.id, teamId, division?.id]);

  // Create dynamic styles that respect theme (memoized to prevent re-renders)
  const dynamicStyles = useMemo(() => StyleSheet.create({
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
    headerButtons: {
      flexDirection: 'row',
    },
    headerButton: {
      marginLeft: 16,
    },
    matchItem: {
      backgroundColor: cardBackgroundColor,
      marginHorizontal: 16,
      marginVertical: 4,
      borderRadius: 12,
      padding: 10,
      borderLeftWidth: 4,
      borderWidth: 2,
      borderColor: borderColor,
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 1,
      },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    matchHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    matchName: {
      fontSize: 18,
      fontWeight: '600',
      color: textColor,
    },
    matchTime: {
      fontSize: 14,
      color: secondaryTextColor,
    },
    matchContent: {
      gap: 4,
    },
    allianceSection: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 4,
    },
    allianceIndicator: {
      width: 4,
      height: 40,
      borderRadius: 2,
      marginRight: 12,
    },
    redIndicator: {
      backgroundColor: '#FF3B30',
    },
    blueIndicator: {
      backgroundColor: '#007AFF',
    },
    teamsContainer: {
      flex: 1,
      flexDirection: 'row',
      gap: 6,
    },
    teamChip: {
      backgroundColor: backgroundColor,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: borderColor,
    },
    highlightedTeamChip: {
      backgroundColor: buttonColor,
      borderColor: buttonColor,
    },
    teamNumber: {
      fontSize: 16,
      fontWeight: '500',
      color: textColor,
    },
    highlightedTeamNumber: {
      color: '#FFFFFF',
      fontWeight: 'bold',
    },
    scoreContainer: {
      minWidth: 40,
      alignItems: 'center',
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
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 60,
      paddingHorizontal: 40,
      backgroundColor: backgroundColor,
    },
    emptyList: {
      flexGrow: 1,
    },
    emptyText: {
      fontSize: 18,
      fontWeight: '600',
      color: textColor,
      marginTop: 16,
      textAlign: 'center',
    },
    emptySubtext: {
      fontSize: 14,
      color: secondaryTextColor,
      marginTop: 8,
      textAlign: 'center',
      lineHeight: 20,
    },
    modalContainer: {
      flex: 1,
      backgroundColor: backgroundColor,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      backgroundColor: cardBackgroundColor,
      borderBottomWidth: 1,
      borderBottomColor: borderColor,
    },
    modalCloseButton: {
      fontSize: 16,
      color: buttonColor,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: textColor,
    },
    emptyNotesContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyNotesText: {
      fontSize: 16,
      color: secondaryTextColor,
    },
    notesScrollView: {
      flex: 1,
      padding: 16,
    },
    noteItem: {
      backgroundColor: cardBackgroundColor,
      padding: 16,
      borderRadius: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: borderColor,
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 1,
      },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    noteMatchName: {
      fontSize: 18,
      fontWeight: '600',
      marginBottom: 8,
    },
    noteText: {
      fontSize: 16,
      color: textColor,
      lineHeight: 22,
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
      color: '#007AFF',
    },
    // Compact View Styles
    compactMatchItem: {
      borderRadius: 8,
      padding: 10,
      marginHorizontal: 16,
      marginVertical: 4,
      borderLeftWidth: 4,
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
      color: textColor,
    },
    compactMatchTime: {
      fontSize: 12,
      color: secondaryTextColor,
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
    compactTeamNumber: {
      fontSize: 13,
      fontWeight: '500',
    },
    compactRedTeam: {
      color: '#FF3B30',
    },
    compactBlueTeam: {
      color: '#007AFF',
    },
    compactWinnerTeam: {
      textDecorationLine: 'underline',
      fontWeight: '700',
    },
    compactTeamButton: {
      paddingHorizontal: 6,
      paddingVertical: 3,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: borderColor,
      backgroundColor: cardBackgroundColor,
    },
    compactHighlightedRedTeamButton: {
      backgroundColor: '#FF3B30',
      borderColor: '#FF3B30',
    },
    compactHighlightedBlueTeamButton: {
      backgroundColor: '#007AFF',
      borderColor: '#007AFF',
    },
    compactTeamNumberText: {
      fontSize: 13,
      fontWeight: '600',
      color: textColor,
    },
    compactHighlightedTeam: {
      fontWeight: '900',
      fontSize: 14,
    },
    compactHighlightedTeamText: {
      color: '#FFFFFF',
      fontWeight: '700',
    },
    compactScoreText: {
      fontSize: 16,
      fontWeight: '700',
    },
    compactRedScoreText: {
      color: shouldUseThemedColors ? textColor : '#FF3B30',
    },
    compactBlueScoreText: {
      color: shouldUseThemedColors ? textColor : '#007AFF',
    },
    compactWinnerScore: {
      fontSize: 18,
      fontWeight: '900',
      textDecorationLine: 'underline',
    },
    compactScoreDivider: {
      fontSize: 14,
      color: secondaryTextColor,
      fontWeight: '600',
    },
  }), [backgroundColor, textColor, cardBackgroundColor, secondaryTextColor, iconColor, borderColor, buttonColor, shouldUseThemedColors]);

  const getMatchStatusColor = (item: MatchListItem) => {
    if (!item.winningAlliance) return '#999'; // Not played
    if (item.winningAlliance === 'tie') return '#FFA500'; // Tie - Orange
    if (item.winningAlliance === item.teamAlliance) return '#28A745'; // Win - Green
    return '#DC3545'; // Loss - Red
  };

  const navigateToMatchNotes = (matchItem: MatchListItem) => {
    // Create a match object that matches the expected format for MatchNotes
    const matchForNotes = {
      id: matchItem.id,
      name: matchItem.displayName,
      red_teams: matchItem.redTeams,
      blue_teams: matchItem.blueTeams,
      red_score: matchItem.redScore,
      blue_score: matchItem.blueScore,
      started: matchItem.time
    };

    let matchTeamsMap = teamsMap;
    if (Object.keys(matchTeamsMap).length === 0 && matchItem.rawMatch && matchItem.rawMatch.alliances) {
      const builtMap: Record<string, string> = {};
      matchItem.rawMatch.alliances.forEach((alliance: any) => {
        alliance.teams.forEach((teamData: any) => {
          const teamId = teamData.team.id.toString();
          const extractedTeamNumber = teamData.team.name || teamId;
          builtMap[teamId] = extractedTeamNumber;
        });
      });
      matchTeamsMap = builtMap;
    }

    navigation.navigate('MatchNotes', {
      event,
      match: matchForNotes,
      teamsMap: matchTeamsMap,
    });
  };

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
        style={[dynamicStyles.compactMatchItem, {
          borderLeftColor: getMatchStatusColor(item),
          borderColor: winnerColor,
          borderWidth: winner ? 2 : 1,
          backgroundColor: cardBackgroundColor,
        }]}
        onPress={() => navigateToMatchNotes(item)}
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

        {/* Match name and time */}
        <View style={dynamicStyles.compactMatchHeader}>
          <Text style={dynamicStyles.compactMatchName}>{item.displayName}</Text>
          <Text style={dynamicStyles.compactMatchTime}>{item.time}</Text>
        </View>

        {/* Teams and Scores - Red left, Scores center, Blue right */}
        <View style={dynamicStyles.compactMatchContent}>
          {/* Red alliance - LEFT */}
          <View style={dynamicStyles.compactRedAlliance}>
            {item.redTeams.map((team, index) => (
              <TouchableOpacity
                key={`red-${index}`}
                style={[
                  dynamicStyles.compactTeamButton,
                  team === teamNumber && dynamicStyles.compactHighlightedRedTeamButton,
                ]}
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
                    dynamicStyles.compactTeamNumberText,
                    team === teamNumber && dynamicStyles.compactHighlightedTeamText,
                  ]}
                  numberOfLines={1}
                >
                  {team}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Scores - CENTER */}
          <View style={dynamicStyles.compactScoresCenter}>
            <Text style={[
              dynamicStyles.compactScoreText,
              dynamicStyles.compactRedScoreText,
              isRedWinner && dynamicStyles.compactWinnerScore,
            ]}>
              {formatScore(item.redScore, item.blueScore)}
            </Text>
            <Text style={dynamicStyles.compactScoreDivider}>-</Text>
            <Text style={[
              dynamicStyles.compactScoreText,
              dynamicStyles.compactBlueScoreText,
              isBlueWinner && dynamicStyles.compactWinnerScore,
            ]}>
              {formatScore(item.blueScore, item.redScore)}
            </Text>
          </View>

          {/* Blue alliance - RIGHT */}
          <View style={dynamicStyles.compactBlueAlliance}>
            {item.blueTeams.map((team, index) => (
              <TouchableOpacity
                key={`blue-${index}`}
                style={[
                  dynamicStyles.compactTeamButton,
                  team === teamNumber && dynamicStyles.compactHighlightedBlueTeamButton,
                ]}
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
                    dynamicStyles.compactTeamNumberText,
                    team === teamNumber && dynamicStyles.compactHighlightedTeamText,
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

  const renderMatchItem = ({ item }: { item: MatchListItem }) => (
    <TouchableOpacity
      style={[dynamicStyles.matchItem, {
        borderLeftColor: getMatchStatusColor(item),
        borderColor: getMatchBorderColor(item)
      }]}
      onPress={() => navigateToMatchNotes(item)}
    >
      {/* Match Header */}
      <View style={dynamicStyles.matchHeader}>
        <Text style={dynamicStyles.matchName}>{item.displayName}</Text>
        <Text style={dynamicStyles.matchTime}>{item.time}</Text>
      </View>

      {/* Teams and Scores */}
      <View style={dynamicStyles.matchContent}>
        {isCooperative ? (
          // Cooperative Display: Show teams working together with shared score
          <View style={dynamicStyles.vexIQTeamsSection}>
            <View style={dynamicStyles.allTeamsContainer}>
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
                    style={[
                      dynamicStyles.teamChip,
                      team === teamNumber && {
                        backgroundColor: '#FF3B30',
                        borderColor: '#FF3B30'
                      }
                    ]}
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
                      dynamicStyles.teamNumber,
                      team === teamNumber && dynamicStyles.highlightedTeamNumber,
                      isRedTeamZero ? { color: '#FF3B30', textDecorationLine: 'line-through' } :
                      isRedTeamWinner ? { color: '#007AFF' } : null
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
                    style={[
                      dynamicStyles.teamChip,
                      team === teamNumber && {
                        backgroundColor: '#007AFF',
                        borderColor: '#007AFF'
                      }
                    ]}
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
                      dynamicStyles.teamNumber,
                      team === teamNumber && dynamicStyles.highlightedTeamNumber,
                      isBlueTeamZero ? { color: '#FF3B30', textDecorationLine: 'line-through' } :
                      isBlueTeamWinner ? { color: '#007AFF' } : null
                    ]}>
                      {team}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Score - show single blue score unless they differ */}
            <View style={dynamicStyles.vexIQScoreContainer}>
              {item.redScore !== item.blueScore && item.redScore !== null && item.blueScore !== null ? (
                // Show both scores if they differ
                <View style={dynamicStyles.dualScoreContainer}>
                  <Text style={[
                    dynamicStyles.score,
                    (item.redScore === 0 && item.blueScore !== 0) ? { color: redScoreColor } : dynamicStyles.redScore,
                    item.redScore > item.blueScore && { textDecorationLine: 'underline' }
                  ]}>
                    {formatScore(item.redScore, item.blueScore)}
                  </Text>
                  <Text style={dynamicStyles.scoreSeparator}> / </Text>
                  <Text style={[
                    dynamicStyles.score,
                    (item.blueScore === 0 && item.redScore !== 0) ? { color: blueScoreColor } : dynamicStyles.blueScore,
                    item.blueScore > item.redScore && { textDecorationLine: 'underline' }
                  ]}>
                    {formatScore(item.blueScore, item.redScore)}
                  </Text>
                </View>
              ) : (
                // Show single blue score
                <Text style={[
                  dynamicStyles.score,
                  (item.blueScore === 0 && item.redScore !== 0) ? { color: redScoreColor } : dynamicStyles.vexIQScore
                ]}>
                  {formatScore(item.blueScore, item.redScore)}
                </Text>
              )}
            </View>
          </View>
        ) : (
          // Competitive Display: Red vs Blue with VS divider
          <>
            {/* Red Alliance */}
            <View style={dynamicStyles.allianceSection}>
              <View style={[dynamicStyles.allianceIndicator, dynamicStyles.redIndicator]} />
              <View style={dynamicStyles.teamsContainer}>
                {item.redTeams.map((team, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      dynamicStyles.teamChip,
                      team === teamNumber && {
                        backgroundColor: '#FF3B30',
                        borderColor: '#FF3B30'
                      }
                    ]}
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
                      dynamicStyles.teamNumber,
                      team === teamNumber && dynamicStyles.highlightedTeamNumber
                    ]}>
                      {team}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={dynamicStyles.scoreContainer}>
                <Text style={[
                  dynamicStyles.score,
                  dynamicStyles.redScore,
                  item.redScore !== null && item.blueScore !== null && item.redScore > item.blueScore && { textDecorationLine: 'underline' }
                ]}>
                  {formatScore(item.redScore, item.blueScore)}
                </Text>
              </View>
            </View>

            {/* Blue Alliance */}
            <View style={dynamicStyles.allianceSection}>
              <View style={[dynamicStyles.allianceIndicator, dynamicStyles.blueIndicator]} />
              <View style={dynamicStyles.teamsContainer}>
                {item.blueTeams.map((team, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      dynamicStyles.teamChip,
                      team === teamNumber && {
                        backgroundColor: '#007AFF',
                        borderColor: '#007AFF'
                      }
                    ]}
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
                      dynamicStyles.teamNumber,
                      team === teamNumber && dynamicStyles.highlightedTeamNumber
                    ]}>
                      {team}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={dynamicStyles.scoreContainer}>
                <Text style={[
                  dynamicStyles.score,
                  dynamicStyles.blueScore,
                  item.blueScore !== null && item.redScore !== null && item.blueScore > item.redScore && { textDecorationLine: 'underline' }
                ]}>
                  {formatScore(item.blueScore, item.redScore)}
                </Text>
              </View>
            </View>
          </>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderEmptyComponent = () => (
    <View style={dynamicStyles.emptyContainer}>
      <Ionicons name="trophy-outline" size={60} color={iconColor} />
      <Text style={dynamicStyles.emptyText}>No matches available</Text>
      <Text style={dynamicStyles.emptySubtext}>
        Team matches will appear here when available
      </Text>
    </View>
  );

  const renderNotesModal = () => (
    <Modal
      visible={showingTeamNotes}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View style={dynamicStyles.modalContainer}>
        <View style={dynamicStyles.modalHeader}>
          <TouchableOpacity onPress={() => setShowingTeamNotes(false)}>
            <Text style={dynamicStyles.modalCloseButton}>Done</Text>
          </TouchableOpacity>
          <Text style={dynamicStyles.modalTitle}>{teamNumber} Match Notes</Text>
          <View style={{ width: 50 }} />
        </View>

        {teamMatchNotes.filter(note => note.note.trim() !== '').length === 0 ? (
          <View style={dynamicStyles.emptyNotesContainer}>
            <Text style={dynamicStyles.emptyNotesText}>No notes.</Text>
          </View>
        ) : (
          <ScrollView style={dynamicStyles.notesScrollView}>
            {teamMatchNotes
              .filter(note => note.note.trim() !== '')
              .map((note, index) => (
                <View key={index} style={dynamicStyles.noteItem}>
                  <Text style={[
                    dynamicStyles.noteMatchName,
                    { color: note.winningAlliance === 0
                      ? (note.played ? '#FFA500' : '#333')
                      : (note.winningAlliance === note.teamAlliance ? '#28A745' : '#DC3545')
                    }
                  ]}>
                    {note.matchName}
                  </Text>
                  <Text style={dynamicStyles.noteText}>{note.note}</Text>
                </View>
              ))
            }
          </ScrollView>
        )}
      </View>
    </Modal>
  );

  if (showLoading) {
    return (
      <View style={dynamicStyles.container}>
        <FlatList
          data={Array(8).fill(null)}
          renderItem={() => <MatchCardSkeleton />}
          keyExtractor={(_, index) => `skeleton-${index}`}
          contentContainerStyle={{ paddingVertical: 8 }}
        />
      </View>
    );
  }

  return (
    <View style={dynamicStyles.container}>
      <FlatList
        data={matches}
        renderItem={settings.compactViewMatches ? renderCompactMatchItem : renderMatchItem}
        keyExtractor={(item) => item.id.toString()}
        ListEmptyComponent={renderEmptyComponent}
        contentContainerStyle={matches.length === 0 ? dynamicStyles.emptyList : undefined}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={settings.buttonColor}
          />
        }
      />
      {renderNotesModal()}
    </View>
  );
};


export default EventTeamMatchesScreen;