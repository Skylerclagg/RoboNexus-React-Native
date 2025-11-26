/**
 * Favorite Teams Matches Screen
 *
 * Description:
 * Displays upcoming and completed matches featuring the user's favorite teams
 * across VEX robotics competitions. Features different layouts optimized for
 * VEX IQ and standard competition formats with comprehensive match details.
 *
 * Navigation:
 * Accessed from the main navigation tab or through favorite teams management
 * when users want to track matches for their selected teams.
 *
 * Key Features:
 * - Favorite teams match tracking across competitions
 * - VEX IQ optimized layout vs standard competition display
 * - Real-time match status and scoring information
 * - Team highlighting within match listings
 * - Match navigation and detailed match information
 * - Refresh functionality and loading state management
 */
import React, { useState, useEffect, useMemo } from 'react';
import { createLogger } from '../utils/logger';

const logger = createLogger('FavoriteTeamsMatchesScreen');
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { robotEventsAPI } from '../services/apiRouter';
import { useSettings } from '../contexts/SettingsContext';
import { useFavorites } from '../contexts/FavoritesContext';
import { Event, Team } from '../types';
import { is2v0Format, useThemedScoreColors } from '../utils/programMappings';
import MatchCardSkeleton from '../components/MatchCardSkeleton';

interface Props {
  route: {
    params: {
      event: Event;
      teamsMap: { [key: string]: string };
      eventTeams: Team[];
    };
  };
  navigation: any;
}

interface Match {
  id: number;
  name: string;
  started?: string;
  scheduled?: string;
  field?: string;
  alliances: Array<{
    color: string;
    score?: number;
    teams: Array<{
      team: {
        id: number;
        name: string;
      };
    }>;
  }>;
}

interface MatchListItem {
  id: number;
  displayName: string;
  redTeams: string[];
  blueTeams: string[];
  redScore: number | null;
  blueScore: number | null;
  time: string;
  field?: string;
  alliances?: {
    red?: { score: number | null };
    blue?: { score: number | null };
  };
}

const FavoriteTeamsMatchesScreen = ({ route, navigation }: Props) => {
  const { event, teamsMap, eventTeams } = route.params;
  const settings = useSettings();
  const {
    topBarColor,
    topBarContentColor,
    backgroundColor,
    textColor,
    cardBackgroundColor,
    secondaryTextColor,
    iconColor,
    borderColor,
    buttonColor,
  } = settings;
  const { favoriteTeams } = useFavorites();
  const [matches, setMatches] = useState<MatchListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    navigation.setOptions({
      title: 'Favorite Teams Matches',
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

    fetchFavoriteTeamsMatches();
  }, []);

  // Check if this is a cooperative format (2v0)
  const isCooperative = is2v0Format(settings.selectedProgram);

  // Determine if we should use themed colors or alliance colors for scores
  const shouldUseThemedColors = useThemedScoreColors(settings.selectedProgram);
  const redScoreColor = shouldUseThemedColors ? textColor : settings.redAllianceColor;
  const blueScoreColor = shouldUseThemedColors ? textColor : settings.blueAllianceColor;

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

  // Create styles to match EventDivisionMatchesScreen
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
    headerInfo: {
      backgroundColor: cardBackgroundColor,
      padding: 12,
      marginBottom: 4,
      borderBottomWidth: 1,
      borderBottomColor: borderColor,
    },
    headerText: {
      fontSize: 16,
      fontWeight: '500',
      color: textColor,
      marginBottom: 4,
    },
    favoriteTeamsList: {
      fontSize: 14,
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
    matchName: {
      fontSize: 16,
      fontWeight: '600',
      color: textColor,
    },
    matchTime: {
      fontSize: 14,
      color: secondaryTextColor,
    },
    matchContent: {
      // Content container for teams and scores
    },
    allianceSection: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
    },
    allianceIndicator: {
      width: 4,
      height: 20,
      marginRight: 12,
      borderRadius: 2,
    },
    redIndicator: {
      backgroundColor: redScoreColor,
    },
    blueIndicator: {
      backgroundColor: blueScoreColor,
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
    favoriteRedTeamButton: {
      backgroundColor: redScoreColor,
      borderColor: redScoreColor,
    },
    favoriteBlueTeamButton: {
      backgroundColor: blueScoreColor,
      borderColor: blueScoreColor,
    },
    teamNumber: {
      fontSize: 16,
      fontWeight: '500',
      color: textColor,
    },
    favoriteTeamNumber: {
      color: '#FFFFFF',
      fontWeight: '600',
    },
    scoreContainer: {
      minWidth: 40,
      alignItems: 'center',
    },
    score: {
      fontSize: 16,
      fontWeight: '600',
      color: textColor,
    },
    redScore: {
      color: redScoreColor,
    },
    blueScore: {
      color: blueScoreColor,
    },
    // VEX IQ specific styles
    vexIQTeamsSection: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    allTeamsContainer: {
      flex: 1,
      flexDirection: 'row',
      gap: 8,
      flexWrap: 'wrap',
    },
    vexIQScoreContainer: {
      minWidth: 60,
      alignItems: 'center',
    },
    vexIQScore: {
      color: blueScoreColor,
    },
    dualScoreContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    scoreSeparator: {
      fontSize: 14,
      color: secondaryTextColor,
      fontWeight: '500',
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
    compactTeamButton: {
      paddingHorizontal: 6,
      paddingVertical: 3,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: settings.borderColor,
      backgroundColor: settings.cardBackgroundColor,
    },
    compactHighlightedRedTeamButton: {
      backgroundColor: redScoreColor,
      borderColor: redScoreColor,
    },
    compactHighlightedBlueTeamButton: {
      backgroundColor: blueScoreColor,
      borderColor: blueScoreColor,
    },
    compactTeamNumberText: {
      fontSize: 13,
      fontWeight: '600',
      color: settings.textColor,
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

  // Get favorite teams that are in this event
  const favoriteEventTeams = eventTeams.filter(team =>
    favoriteTeams.includes(team.number)
  );

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
            return settings.redAllianceColor; // Red
          case 'blue':
            return settings.blueAllianceColor; // Blue
          case 'tie':
            return settings.warningColor; // Tie warning
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
        return settings.redAllianceColor; // Red
      case 'blue':
        return settings.blueAllianceColor; // Blue
      case 'tie':
        return settings.warningColor; // Tie warning
      default:
        return borderColor; // Default border color for unplayed matches
    }
  };

  const fetchFavoriteTeamsMatches = async () => {
    try {
      setLoading(true);

      // Get favorite team IDs for quick lookup
      const favoriteTeamIds = favoriteEventTeams.map(team => team.id);
      const favoriteTeamNumbers = favoriteEventTeams.map(team => team.number);

      logger.debug('Fetching matches for', favoriteEventTeams.length, 'favorite teams:', favoriteTeamNumbers);

      let allMatches: any[] = [];

      // Approach 1: Try to get matches from event divisions (if available)
      if (event.divisions && event.divisions.length > 0) {
        logger.debug('Event has', event.divisions.length, 'divisions, fetching matches by division');

        for (const division of event.divisions) {
          try {
            const divisionMatchesResponse = await robotEventsAPI.getEventDivisionMatches(event.id, division.id);
            logger.debug('Division', division.name || 'Unknown', 'has', divisionMatchesResponse.data.length, 'matches');
            allMatches = allMatches.concat(divisionMatchesResponse.data);
          } catch (error) {
            logger.error('Failed to fetch matches for division', division.name || 'Unknown', ':', error);
          }
        }

        // Filter matches that include any favorite teams
        const filteredMatches = allMatches.filter(match => {
          return match.alliances.some((alliance: any) =>
            alliance.teams.some((teamData: any) => {
              const teamNumber = teamsMap[teamData.team.id.toString()];
              return favoriteTeamIds.includes(teamData.team.id) ||
                     favoriteTeamNumbers.includes(teamNumber);
            })
          );
        });

        logger.debug('Found', filteredMatches.length, 'matches featuring favorite teams from divisions');

        // Transform matches to MatchListItem format
        const transformedMatches = filteredMatches.map(match => {
          const redAlliance = match.alliances.find((a: any) => a.color === 'red');
          const blueAlliance = match.alliances.find((a: any) => a.color === 'blue');

          const redTeams = redAlliance?.teams.map((t: any) => teamsMap[t.team.id.toString()] || t.team.name) || [];
          const blueTeams = blueAlliance?.teams.map((t: any) => teamsMap[t.team.id.toString()] || t.team.name) || [];

          const formatTime = (match: any) => {
            if (match.started) {
              return new Date(match.started).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
              });
            } else if (match.scheduled) {
              return new Date(match.scheduled).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
              });
            }
            return 'TBD';
          };

          return {
            id: match.id,
            displayName: match.name,
            redTeams,
            blueTeams,
            redScore: redAlliance?.score ?? null,
            blueScore: blueAlliance?.score ?? null,
            time: formatTime(match),
            field: match.field
          };
        });

        // Sort matches by scheduled/started time
        transformedMatches.sort((a, b) => {
          const dateA = new Date(filteredMatches.find(m => m.id === a.id)?.started || filteredMatches.find(m => m.id === a.id)?.scheduled || 0);
          const dateB = new Date(filteredMatches.find(m => m.id === b.id)?.started || filteredMatches.find(m => m.id === b.id)?.scheduled || 0);
          return dateA.getTime() - dateB.getTime();
        });

        setMatches(transformedMatches as any);

      } else {
        // Approach 2: Fallback - get matches for each favorite team individually
        logger.debug('No divisions found, fetching matches per team');

        const matchesMap = new Map();

        for (const team of favoriteEventTeams) {
          try {
            const teamMatchesResponse = await robotEventsAPI.getTeamMatches(team.id, { event: [event.id] });
            logger.debug('Team', team.number || 'Unknown', 'has', teamMatchesResponse.data.length, 'matches');

            // Add matches to map to avoid duplicates
            teamMatchesResponse.data.forEach(match => {
              matchesMap.set(match.id, match);
            });
          } catch (error) {
            logger.error('Failed to fetch matches for team', team.number || 'Unknown', ':', error);
          }
        }

        const uniqueMatches = Array.from(matchesMap.values());
        logger.debug('Found', uniqueMatches.length, 'unique matches featuring favorite teams');

        // Transform matches to MatchListItem format
        const transformedMatches = uniqueMatches.map(match => {
          const redAlliance = match.alliances.find((a: any) => a.color === 'red');
          const blueAlliance = match.alliances.find((a: any) => a.color === 'blue');

          const redTeams = redAlliance?.teams.map((t: any) => teamsMap[t.team.id.toString()] || t.team.name) || [];
          const blueTeams = blueAlliance?.teams.map((t: any) => teamsMap[t.team.id.toString()] || t.team.name) || [];

          const formatTime = (match: any) => {
            if (match.started) {
              return new Date(match.started).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
              });
            } else if (match.scheduled) {
              return new Date(match.scheduled).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
              });
            }
            return 'TBD';
          };

          return {
            id: match.id,
            displayName: match.name,
            redTeams,
            blueTeams,
            redScore: redAlliance?.score ?? null,
            blueScore: blueAlliance?.score ?? null,
            time: formatTime(match),
            field: match.field
          };
        });

        // Sort matches by scheduled/started time
        transformedMatches.sort((a, b) => {
          const dateA = new Date(uniqueMatches.find(m => m.id === a.id)?.started || uniqueMatches.find(m => m.id === a.id)?.scheduled || 0);
          const dateB = new Date(uniqueMatches.find(m => m.id === b.id)?.started || uniqueMatches.find(m => m.id === b.id)?.scheduled || 0);
          return dateA.getTime() - dateB.getTime();
        });

        setMatches(transformedMatches as any);
      }

    } catch (error) {
      logger.error('Failed to fetch favorite teams matches:', error);
      Alert.alert('Error', 'Failed to load matches. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchFavoriteTeamsMatches();
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

    // Check if any favorite team is in this match
    const favoriteTeamInMatch = [...item.redTeams, ...item.blueTeams].find(team =>
      favoriteTeams.includes(team)
    );

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
                style={[
                  styles.compactTeamButton,
                  team === favoriteTeamInMatch && styles.compactHighlightedRedTeamButton,
                ]}
                onPress={() => {
                  navigation.navigate('EventTeamInfo', {
                    event: event,
                    teamNumber: team,
                    teamData: null,
                    division: undefined,
                    defaultPage: 'information'
                  });
                }}
                hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
              >
                <Text
                  style={[
                    styles.compactTeamNumberText,
                    team === favoriteTeamInMatch && styles.compactHighlightedTeamText,
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
                style={[
                  styles.compactTeamButton,
                  team === favoriteTeamInMatch && styles.compactHighlightedBlueTeamButton,
                ]}
                onPress={() => {
                  navigation.navigate('EventTeamInfo', {
                    event: event,
                    teamNumber: team,
                    teamData: null,
                    division: undefined,
                    defaultPage: 'information'
                  });
                }}
                hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
              >
                <Text
                  style={[
                    styles.compactTeamNumberText,
                    team === favoriteTeamInMatch && styles.compactHighlightedTeamText,
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
        <Text style={styles.matchName}>{item.displayName}</Text>
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
          // Cooperative Display: Show teams working together with shared score
          <>
            <View style={styles.vexIQTeamsSection}>
              <View style={styles.allTeamsContainer}>
                {/* Red Teams */}
                {item.redTeams.map((team, index) => {
                  const isFavorite = favoriteTeams.includes(team);
                  const redScore = item.redScore || 0;
                  const blueScore = item.blueScore || 0;
                  const isRedTeamZero = redScore === 0 && blueScore !== 0;
                  const isRedTeamWinner = redScore > 0 && blueScore === 0;

                  return (
                    <TouchableOpacity
                      key={`red-${index}`}
                      style={[styles.teamButton, isFavorite && styles.favoriteRedTeamButton]}
                      onPress={() => {
                        navigation.navigate('EventTeamInfo', {
                          event: event,
                          teamNumber: team,
                          teamData: null,
                          division: null,
                          defaultPage: 'information'
                        });
                      }}
                    >
                      <Text style={[
                        styles.teamNumber,
                        isFavorite && styles.favoriteTeamNumber,
                        isRedTeamZero ? { color: redScoreColor, textDecorationLine: 'line-through' } :
                        isRedTeamWinner ? { color: blueScoreColor } : null
                      ]}>
                        {team}
                      </Text>
                    </TouchableOpacity>
                  );
                })}

                {/* Blue Teams */}
                {item.blueTeams.map((team, index) => {
                  const isFavorite = favoriteTeams.includes(team);
                  const redScore = item.redScore || 0;
                  const blueScore = item.blueScore || 0;
                  const isBlueTeamZero = blueScore === 0 && redScore !== 0;
                  const isBlueTeamWinner = blueScore > 0 && redScore === 0;

                  return (
                    <TouchableOpacity
                      key={`blue-${index}`}
                      style={[styles.teamButton, isFavorite && styles.favoriteBlueTeamButton]}
                      onPress={() => {
                        navigation.navigate('EventTeamInfo', {
                          event: event,
                          teamNumber: team,
                          teamData: null,
                          division: null,
                          defaultPage: 'information'
                        });
                      }}
                    >
                      <Text style={[
                        styles.teamNumber,
                        isFavorite && styles.favoriteTeamNumber,
                        isBlueTeamZero ? { color: redScoreColor, textDecorationLine: 'line-through' } :
                        isBlueTeamWinner ? { color: blueScoreColor } : null
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
                      {formatScore(item.redScore, item.blueScore)}
                    </Text>
                    <Text style={styles.scoreSeparator}> / </Text>
                    <Text style={[
                      styles.score,
                      (item.blueScore === 0 && item.redScore !== 0) ? { color: blueScoreColor } : styles.blueScore,
                      item.blueScore > item.redScore && { textDecorationLine: 'underline' }
                    ]}>
                      {formatScore(item.blueScore, item.redScore)}
                    </Text>
                  </View>
                ) : (
                  // Show single blue score
                  <Text style={[
                    styles.score,
                    (item.blueScore === 0 && item.redScore !== 0) ? { color: redScoreColor } : styles.vexIQScore
                  ]}>
                    {formatScore(item.blueScore, item.redScore)}
                  </Text>
                )}
              </View>
            </View>
          </>
        ) : (
          // Competitive Display: Red vs Blue
          <>
            {/* Red Alliance */}
            <View style={styles.allianceSection}>
              <View style={[styles.allianceIndicator, styles.redIndicator]} />
              <View style={styles.teamsContainer}>
                {item.redTeams.map((team, index) => {
                  const isFavorite = favoriteTeams.includes(team);
                  return (
                    <TouchableOpacity
                      key={index}
                      style={[styles.teamButton, isFavorite && styles.favoriteRedTeamButton]}
                      onPress={() => {
                        navigation.navigate('EventTeamInfo', {
                          event: event,
                          teamNumber: team,
                          teamData: null,
                          division: null,
                          defaultPage: 'information'
                        });
                      }}
                    >
                      <Text style={[styles.teamNumber, isFavorite && styles.favoriteTeamNumber]}>{team}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={styles.scoreContainer}>
                <Text style={[
                  styles.score,
                  styles.redScore,
                  item.redScore !== null && item.blueScore !== null && item.redScore > item.blueScore && { textDecorationLine: 'underline' }
                ]}>
                  {formatScore(item.redScore, item.blueScore)}
                </Text>
              </View>
            </View>

            {/* Blue Alliance */}
            <View style={styles.allianceSection}>
              <View style={[styles.allianceIndicator, styles.blueIndicator]} />
              <View style={styles.teamsContainer}>
                {item.blueTeams.map((team, index) => {
                  const isFavorite = favoriteTeams.includes(team);
                  return (
                    <TouchableOpacity
                      key={index}
                      style={[styles.teamButton, isFavorite && styles.favoriteBlueTeamButton]}
                      onPress={() => {
                        navigation.navigate('EventTeamInfo', {
                          event: event,
                          teamNumber: team,
                          teamData: null,
                          division: null,
                          defaultPage: 'information'
                        });
                      }}
                    >
                      <Text style={[styles.teamNumber, isFavorite && styles.favoriteTeamNumber]}>{team}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={styles.scoreContainer}>
                <Text style={[
                  styles.score,
                  styles.blueScore,
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
    <View style={styles.emptyContainer}>
      <Ionicons name="star-outline" size={60} color={iconColor} />
      <Text style={styles.emptyText}>No matches found</Text>
      <Text style={styles.emptySubtext}>
        None of your favorite teams have matches in this event
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
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
    <View style={styles.container}>
      {favoriteEventTeams.length > 0 && (
        <View style={styles.headerInfo}>
          <Text style={styles.headerText}>
            {`Matches featuring ${favoriteEventTeams.length} favorite team${favoriteEventTeams.length !== 1 ? 's' : ''}:`}
          </Text>
          <Text style={styles.favoriteTeamsList}>
            {favoriteEventTeams.map(team => team.number).join(', ')}
          </Text>
        </View>
      )}

      <FlatList
        data={matches}
        renderItem={settings.compactViewMatches ? renderCompactMatchItem : renderMatchItem}
        keyExtractor={(item) => item.id.toString()}
        ListEmptyComponent={renderEmptyComponent}
        contentContainerStyle={matches.length === 0 ? { flexGrow: 1 } : { paddingBottom: 16 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={settings.buttonColor}
          />
        }
      />
    </View>
  );
};


export default FavoriteTeamsMatchesScreen;