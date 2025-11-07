/**
 * Event Division Rankings Screen
 *
 * Description:
 * Displays qualification rankings for teams within a specific division of a VEX
 * robotics event. Shows comprehensive ranking data including win-loss records,
 * points, and statistical performance with search and sorting capabilities.
 *
 * Navigation:
 * Accessed from event division screens or event detail screens when users
 * want to view current rankings for teams in a competition division.
 *
 * Key Features:
 * - Complete qualification rankings with detailed statistics
 * - Win-loss-tie records and point calculations (WP, AP, SP)
 * - Team search functionality within rankings
 * - Sortable ranking display with multiple criteria
 * - Team navigation and detailed team performance access
 * - Real-time ranking updates with refresh capability
 */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createLogger } from '../utils/logger';

const logger = createLogger('EventDivisionRankingsScreen');
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
import { RouteProp, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../contexts/SettingsContext';
import { robotEventsAPI } from '../services/apiRouter';
import { Event, Team, Division } from '../types';
import { getMatchDisplayConfig } from '../utils/matchDisplay';
import { getCompetitionType, is2v0Format, getProgramConfig } from '../utils/programMappings';
import AnimatedScrollBar from '../components/AnimatedScrollBar';
import RankingCardSkeleton from '../components/RankingCardSkeleton';

type EventDivisionRankingsScreenRouteProp = RouteProp<any, any>;

type EventDivisionRankingsScreenNavigationProp = StackNavigationProp<any>;

interface Props {
  route: EventDivisionRankingsScreenRouteProp;
  navigation: EventDivisionRankingsScreenNavigationProp;
}

interface TeamRanking {
  id: number;
  rank: number;
  team: Team;
  wins: number;
  losses: number;
  ties: number;
  wp: number;
  ap: number;
  sp: number;
  high_score: number;
  total_points: number;
  average_points: number;
}

const EventDivisionRankingsScreen = ({ route, navigation }: Props) => {
  const { event, division, eventTeams = [], teamsMap = {} } = route.params || {};
  const settings = useSettings();
  const { selectedProgram } = settings;

  // Early return if essential params are missing
  if (!event || !division) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: settings.backgroundColor }]}>
        <Text style={[styles.loadingText, { color: settings.textColor }]}>Invalid parameters</Text>
      </View>
    );
  }

  const [rankings, setRankings] = useState<TeamRanking[]>([]);
  const [filteredRankings, setFilteredRankings] = useState<TeamRanking[]>([]);
  const [teamNumberQuery, setTeamNumberQuery] = useState('');
  const [showLoading, setShowLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const flatListRef = useRef<any>(null);
  const [showFinalistRankings, setShowFinalistRankings] = useState(false);
  const [hasFinalistRankings, setHasFinalistRankings] = useState(false);

  // Use format-aware logic instead of hardcoded program checks
  const matchDisplayConfig = getMatchDisplayConfig(selectedProgram || 'VEX V5 Robotics Competition');
  const competitionType = getCompetitionType(selectedProgram || 'VEX V5 Robotics Competition');
  const isCooperative = is2v0Format(selectedProgram || 'VEX V5 Robotics Competition');
  const programConfig = getProgramConfig(selectedProgram || 'VEX V5 Robotics Competition');
  const programSupportsFinalistRankings = programConfig.hasFinalistRankings;

  // Programs with individual/cooperative formats get simplified display
  const showSimplifiedStats = isCooperative || competitionType === 'drone';

  // For rankings, we want different labels than match displays
  // Finalist rankings show high score, qualification rankings show average score
  const getRankingsScoreLabel = () => {
    if (showFinalistRankings) {
      return 'High Score';
    }
    if (isCooperative || competitionType === 'drone') {
      return 'Avg Score';
    }
    return matchDisplayConfig.scoreLabel;
  };

  useEffect(() => {
    navigation.setOptions({
      title: `${division.name} Rankings`,
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

  const displayRounded = (number: number | null | undefined): string => {
    if (number === null || number === undefined) {
      return '0.0';
    }
    return number.toFixed(1);
  };

  const fetchRankings = async (fetchFinalist: boolean = false) => {
    try {
      if (!event?.id || !division?.id) {
        logger.error('Missing event ID or division ID for rankings');
        setShowLoading(false);
        setRefreshing(false);
        return;
      }

      logger.debug(`Fetching division ${fetchFinalist ? 'finalist' : 'qualification'} rankings for event:`, event.id, 'division:', division.id);

      // Fetch rankings data from API (qualification or finalist)
      const rankingsResponse = fetchFinalist
        ? await robotEventsAPI.getEventDivisionFinalistRankings(event.id, division.id)
        : await robotEventsAPI.getEventDivisionRankings(event.id, division.id);

      // Ensure rankingsData is an array and handle undefined/null cases
      const safeRankingsData = Array.isArray(rankingsResponse.data) ? rankingsResponse.data : [];
      logger.debug(`${fetchFinalist ? 'Finalist' : 'Qualification'} rankings data received:`, safeRankingsData.length, 'rankings');

      if (safeRankingsData.length > 0) {
        logger.debug('First ranking sample:', JSON.stringify(safeRankingsData[0], null, 2));
      }


      // Create a lookup map from eventTeams for full team information
      let eventTeamsMap = Array.isArray(eventTeams) ? eventTeams.reduce((acc, team) => {
        if (team && team.id) {
          acc[team.id.toString()] = team;
        }
        return acc;
      }, {} as { [key: string]: Team }) : {};

      try {
        // Fetch ALL event teams with pagination
        let allEventTeams: Team[] = [];
        let page = 1;
        let hasMorePages = true;

        while (hasMorePages) {
          const teamsResponse = await robotEventsAPI.getEventTeams(event.id, { page, per_page: 250 });
          const pageTeams = Array.isArray(teamsResponse.data) ? teamsResponse.data : [];

          allEventTeams = allEventTeams.concat(pageTeams as Team[]);

          // Check if there are more pages
          if (pageTeams.length < 250) {
            hasMorePages = false;
          } else {
            page++;
          }
        }

        eventTeamsMap = allEventTeams.reduce((acc, team) => {
          if (team && team.id) {
            acc[team.id.toString()] = team;
          }
          return acc;
        }, {} as { [key: string]: Team });
      } catch (error) {
        logger.error('Failed to fetch event teams:', error);
      }

      // Transform API rankings to UI rankings (convert team IdInfo to Team)
      // Note: Finalist rankings may have null id, so we check for team.id instead
      const transformedRankings: TeamRanking[] = safeRankingsData.filter(ranking =>
        ranking && ranking.team && ranking.team.id
      ).map(ranking => {
        try {
          const teamId = ranking.team.id;
          const fullTeamData = eventTeamsMap[teamId.toString()];

          const teamNumber = teamsMap[teamId.toString()]
            || fullTeamData?.number
            || ranking.team.name
            || '';

          const teamName = fullTeamData?.team_name || '';

          return {
            ...ranking,
            // Finalist rankings have null id, so we generate a unique one
            id: ranking.id || parseInt(`${event.id}${division.id}${ranking.rank}${teamId}`, 10),
            team: fullTeamData ? {
              ...fullTeamData,
              number: teamNumber,
            } : {
              id: teamId,
              number: teamNumber,
              team_name: teamName,
              organization: '',
              location: {
                city: '',
                region: '',
                country: '',
              },
              registered: true,
              program: {
                id: 1,
                name: 'VEX V5 Robotics Competition',
                code: 'V5RC',
              },
              grade: 'High School',
            } as Team
          };
        } catch (error) {
          logger.error('Error processing ranking:', ranking, error);
          return null;
        }
      }).filter(Boolean) as TeamRanking[];

      // Sort rankings by rank in ascending order (1, 2, 3, etc.)
      // Filter out any null/undefined items as a safety check
      const sortedRankings = transformedRankings
        .filter(r => r && r.team && r.rank)
        .sort((a, b) => a.rank - b.rank);

      logger.debug(`After transformation: ${sortedRankings.length} rankings ready to display`);

      // Debug: Log first few transformed rankings to verify structure
      if (sortedRankings.length > 0) {
        logger.debug('First transformed ranking:', JSON.stringify({
          id: sortedRankings[0].id,
          rank: sortedRankings[0].rank,
          teamId: sortedRankings[0].team?.id,
          teamNumber: sortedRankings[0].team?.number,
          teamName: sortedRankings[0].team?.team_name,
          wins: sortedRankings[0].wins,
          losses: sortedRankings[0].losses,
          ties: sortedRankings[0].ties,
          wp: sortedRankings[0].wp,
          ap: sortedRankings[0].ap,
          sp: sortedRankings[0].sp,
          high_score: sortedRankings[0].high_score,
          average_points: sortedRankings[0].average_points,
          total_points: sortedRankings[0].total_points,
        }, null, 2));
      }

      setRankings(sortedRankings);
      setFilteredRankings(sortedRankings);

      // Check if finalist rankings exist (only if program supports them and we're fetching qualification rankings)
      if (programSupportsFinalistRankings && !fetchFinalist) {
        try {
          const finalistResponse = await robotEventsAPI.getEventDivisionFinalistRankings(event.id, division.id);
          const finalistData = Array.isArray(finalistResponse.data) ? finalistResponse.data : [];
          setHasFinalistRankings(finalistData.length > 0);
        } catch (error) {
          logger.debug('No finalist rankings available or error fetching:', error);
          setHasFinalistRankings(false);
        }
      }
    } catch (error) {
      logger.error('Failed to fetch division rankings:', error);
      Alert.alert('Error', 'Failed to load division rankings. Please try again.');
    } finally {
      setShowLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchRankings(showFinalistRankings);
  };

  const handleToggleRankingsType = async () => {
    setShowLoading(true);
    setShowFinalistRankings(!showFinalistRankings);
    await fetchRankings(!showFinalistRankings);
  };

  useEffect(() => {
    fetchRankings(showFinalistRankings);
  }, [event.id, division.id]);

  // Refresh data when tab becomes focused
  useFocusEffect(
    React.useCallback(() => {
      fetchRankings(showFinalistRankings);
    }, [event.id, division.id, showFinalistRankings])
  );

  useEffect(() => {
    if (teamNumberQuery.trim() === '') {
      setFilteredRankings(rankings);
    } else {
      const filtered = rankings.filter(ranking => {
        const teamNumber = teamsMap[ranking.team.id.toString()] || ranking.team.number || '';
        const teamName = ranking.team.team_name || '';
        const query = teamNumberQuery.toLowerCase();
        return teamNumber.toLowerCase().includes(query) ||
               teamName.toLowerCase().includes(query);
      });
      setFilteredRankings(filtered);
    }
  }, [teamNumberQuery, rankings, teamsMap]);

  const navigateToTeamView = (teamNumber: string) => {
    navigation.navigate('EventTeamInfo', {
      event,
      teamNumber,
      teamData: null,
      division,
    });
  };

  const renderCompactRankingItem = ({ item }: { item: TeamRanking }) => {
    try {
      const teamNumber = teamsMap[item.team.id.toString()] || item.team.number || '';
      const teamName = item.team.team_name || '';

      return (
        <TouchableOpacity
          style={[styles.compactRankingItem, {
            backgroundColor: settings.cardBackgroundColor,
            borderColor: settings.borderColor,
          }]}
          onPress={() => navigateToTeamView(teamNumber)}
        >
          <View style={styles.compactRankingRow}>
            <Text style={[styles.compactRankNumber, { color: settings.buttonColor }]}>#{item.rank}</Text>
            <Text style={[styles.compactTeamNumber, { color: settings.textColor }]}>{teamNumber}</Text>
            <Text style={[styles.compactTeamName, { color: settings.secondaryTextColor }]} numberOfLines={1}>
              {teamName || 'Unknown Team'}
            </Text>
          </View>
          <View style={styles.compactStatsRow}>
            {showSimplifiedStats ? (
              <>
                <Text style={[styles.compactStat, { color: settings.textColor }]}>
                  {getRankingsScoreLabel()}: {showFinalistRankings ? (item.high_score || 0) : displayRounded(item.average_points)}
                </Text>
              </>
            ) : (
              <>
                <Text style={[styles.compactStat, { color: settings.textColor }]}>
                  {item.wins || 0}-{item.losses || 0}-{item.ties || 0}
                </Text>
                <Text style={[styles.compactStat, { color: settings.textColor }]}>WP:{item.wp || 0}</Text>
                <Text style={[styles.compactStat, { color: settings.textColor }]}>AP:{item.ap || 0}</Text>
                <Text style={[styles.compactStat, { color: settings.textColor }]}>SP:{item.sp || 0}</Text>
              </>
            )}
          </View>
        </TouchableOpacity>
      );
    } catch (error) {
      logger.error('Error rendering compact ranking item:', item, error);
      return null;
    }
  };

  const renderTeamRankingRow = ({ item }: { item: TeamRanking }) => {
    try {
      const teamNumber = teamsMap[item.team.id.toString()] || item.team.number || '';
      const teamName = item.team.team_name || '';
      const isFavorite = false;

      return (
        <TouchableOpacity
          style={[styles.rankingItem, {
            backgroundColor: settings.cardBackgroundColor,
            borderColor: settings.borderColor,
            shadowColor: settings.colorScheme === 'dark' ? '#FFFFFF' : '#000000'
          }]}
          onPress={() => navigateToTeamView(teamNumber)}
        >
          {/* Team Header */}
          <View style={styles.teamHeader}>
            <View style={styles.teamInfo}>
              <Text style={[styles.teamNumber, { color: settings.textColor }]}>{teamNumber}</Text>
              {teamName ? (
                <Text style={[styles.teamName, { color: settings.secondaryTextColor }]}>
                  {teamName}
                </Text>
              ) : null}
              {isFavorite && (
                <Ionicons name="star" size={16} color="#FFD700" style={styles.starIcon} />
              )}
            </View>
            <View style={[styles.rankBadge, { backgroundColor: settings.buttonColor, shadowColor: settings.buttonColor }]}>
              <Text style={styles.rankBadgeText}>#{item.rank}</Text>
            </View>
          </View>

          {/* Stats Section */}
          {showSimplifiedStats ? (
            // Simplified view for cooperative/individual formats
            <View style={[styles.statsContainer, { borderTopColor: settings.borderColor }]}>
              <View style={styles.statCard}>
                <Text style={[styles.statLabel, { color: settings.secondaryTextColor }]}>
                  {getRankingsScoreLabel()}
                </Text>
                <Text style={[styles.statValue, { color: settings.buttonColor }]}>
                  {showFinalistRankings ? (item.high_score || 0) : displayRounded(item.average_points)}
                </Text>
              </View>
            </View>
          ) : (
            // Full stats for competitive formats (2v2, 1v1)
            <View style={[styles.statsContainer, { borderTopColor: settings.borderColor }]}>
              <View style={styles.statCard}>
                <Text style={[styles.statLabel, { color: settings.secondaryTextColor }]}>Record</Text>
                <Text style={[styles.statValue, { color: settings.textColor }]}>
                  {item.wins || 0}-{item.losses || 0}-{item.ties || 0}
                </Text>
              </View>
              <View style={[styles.statCard, styles.statCardWithBorder, { borderLeftColor: settings.borderColor }]}>
                <Text style={[styles.statLabel, { color: settings.secondaryTextColor }]}>WP / AP / SP</Text>
                <Text style={[styles.statValue, { color: settings.buttonColor }]}>
                  {item.wp || 0} / {item.ap || 0} / {item.sp || 0}
                </Text>
              </View>
            <View style={[styles.statCard, styles.statCardWithBorder, { borderLeftColor: settings.borderColor }]}>
              <Text style={[styles.statLabel, { color: settings.secondaryTextColor }]}>Avg / Total</Text>
              <Text style={[styles.statValue, { color: settings.textColor }]}>
                {displayRounded(item.average_points)} / {item.total_points || 0}
              </Text>
            </View>
          </View>
        )}
        </TouchableOpacity>
      );
    } catch (error) {
      logger.error('Error rendering ranking item:', item, error);
      return null;
    }
  };

  const renderEmptyComponent = () => (
    <View style={styles.emptyContainer}>
      <View style={[styles.emptyIconContainer, { backgroundColor: settings.borderColor }]}>
        <Ionicons name="trophy-outline" size={50} color={settings.iconColor} />
      </View>
      <Text style={[styles.emptyText, { color: settings.textColor }]}>No Rankings</Text>
      <Text style={[styles.emptySubtext, { color: settings.secondaryTextColor }]}>
        {teamNumberQuery ? 'No teams match your search criteria.\nTry adjusting your search terms.' : 'Rankings will appear here once\nqualification matches have been played.'}
      </Text>
    </View>
  );

  if (showLoading && rankings.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: settings.backgroundColor }]}>
        <FlatList
          data={Array(10).fill(null)}
          renderItem={() => <RankingCardSkeleton compact={settings.compactViewRankings} />}
          keyExtractor={(_, index) => `skeleton-${index}`}
          contentContainerStyle={{ paddingVertical: 8 }}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: settings.backgroundColor }]}>
      <View style={[styles.searchContainer, { backgroundColor: settings.backgroundColor }]}>
        <View style={[styles.searchInputContainer, {
          backgroundColor: settings.cardBackgroundColor,
          borderColor: settings.borderColor,
          shadowColor: settings.colorScheme === 'dark' ? '#FFFFFF' : '#000000'
        }]}>
          <Ionicons name="search" size={20} color={settings.iconColor} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: settings.textColor }]}
            placeholder="Enter a team number..."
            value={teamNumberQuery}
            onChangeText={setTeamNumberQuery}
            placeholderTextColor={settings.secondaryTextColor}
          />
          {teamNumberQuery.length > 0 && (
            <TouchableOpacity onPress={() => setTeamNumberQuery('')} style={styles.clearButton}>
              <Ionicons name="close-circle" size={20} color={settings.iconColor} />
            </TouchableOpacity>
          )}
        </View>

        {/* Finalist Rankings Toggle - Only show if program supports it AND finalist rankings exist */}
        {programSupportsFinalistRankings && hasFinalistRankings && (
          <TouchableOpacity
            style={[styles.toggleButton, {
              backgroundColor: showFinalistRankings ? settings.buttonColor : settings.cardBackgroundColor,
              borderColor: settings.borderColor,
            }]}
            onPress={handleToggleRankingsType}
          >
            <Ionicons
              name={showFinalistRankings ? "trophy" : "trophy-outline"}
              size={18}
              color={showFinalistRankings ? '#FFFFFF' : settings.textColor}
            />
            <Text style={[styles.toggleButtonText, {
              color: showFinalistRankings ? '#FFFFFF' : settings.textColor
            }]}>
              {showFinalistRankings ? 'Finals' : 'Quals'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={{ flex: 1 }}>
        <FlatList
          ref={flatListRef}
          data={filteredRankings}
          renderItem={settings.compactViewRankings ? renderCompactRankingItem : renderTeamRankingRow}
          keyExtractor={(item) => item?.id?.toString() || `rank-${item.rank}`}
          ListEmptyComponent={renderEmptyComponent}
          contentContainerStyle={filteredRankings.length === 0 ? styles.emptyList : undefined}
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
        />
        <AnimatedScrollBar
          scrollY={scrollY}
          contentHeight={contentHeight}
          viewportHeight={viewportHeight}
          color={settings.buttonColor}
          enabled={settings.scrollBarEnabled && settings.scrollBarRankings}
          scrollViewRef={flatListRef}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  sortingContainer: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  picker: {
    height: 50,
  },
  searchContainer: {
    padding: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  toggleButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  clearButton: {
    marginLeft: 8,
  },
  rankingItem: {
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  teamHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  teamInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  teamNumber: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 0.3,
    minWidth: 80,
    flexShrink: 0,
  },
  teamName: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
    marginLeft: 12,
  },
  rankBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    minWidth: 50,
    alignItems: 'center',
    marginLeft: 8,
  },
  rankBadgeText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  starIcon: {
    marginLeft: 8,
  },
  // Stats container
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderTopWidth: 1,
    paddingTop: 14,
    marginTop: 2,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  statCardWithBorder: {
    borderLeftWidth: 1,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 4,
    textAlign: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyList: {
    flexGrow: 1,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  // Compact View Styles
  compactRankingItem: {
    borderRadius: 8,
    padding: 10,
    marginHorizontal: 16,
    marginVertical: 4,
    borderWidth: 1,
  },
  compactRankingRow: {
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
  compactStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  compactStat: {
    fontSize: 12,
    fontWeight: '500',
  },
  compactStatSeparator: {
    fontSize: 10,
    marginHorizontal: 4,
  },
});

export default EventDivisionRankingsScreen;