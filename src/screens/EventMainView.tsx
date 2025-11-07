/**
 * EVENT MAIN VIEW
 *
 * Comprehensive event information screen showing divisions, teams, matches, and rankings.
 * Serves as the main hub for all event-related data and competition results.
 *
 * NAVIGATION ACCESS:
 * - Dashboard → Tap on favorite event cards
 * - Team Events Screen → Tap on any event
 * - Event search results → Tap on event
 * - Live event links from team cards
 *
 * KEY FEATURES:
 * - Event information (dates, location, status)
 * - Division-based organization of data
 * - Team lists, match schedules, and rankings
 * - Skills rankings and awards
 * - Add/remove from favorites
 * - Real-time competition updates
 * - Direct navigation to division-specific screens
 */

import React, { useState, useEffect, useCallback } from 'react';
import { createLogger } from '../utils/logger';

const logger = createLogger('EventMainView');
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { robotEventsAPI } from '../services/apiRouter';
import { useSettings } from '../contexts/SettingsContext';
import { useFavorites } from '../contexts/FavoritesContext';
import { Team, Event } from '../types';
import { getEventStatus } from '../utils/eventUtils';

interface EventMainViewProps {
  route: {
    params: {
      event?: Event;
      eventId?: number;
      team?: Team;
    };
  };
  navigation: any;
}

interface Section {
  title: string;
  data: {
    id: string;
    title: string;
    icon?: string;
    onPress: () => void;
    subtitle?: string;
    allianceColor?: 'red' | 'blue';
  }[];
}

interface TeamMatchInfo {
  team: Team;
  nextMatchNumber?: string;
  nextMatchName?: string;
  nextMatchAlliance?: 'red' | 'blue';
  isComplete: boolean;
}

const EventMainView = ({ route, navigation }: EventMainViewProps) => {
  const settings = useSettings();
  const { addEvent, removeEvent, isEventFavorited, favoriteTeams } = useFavorites();
  const { event: initialEvent, eventId, team } = route.params;
  const [event, setEvent] = useState<Event | null>(initialEvent || null);
  const [eventTeams, setEventTeams] = useState<Team[]>([]);
  const [teamsMap, setTeamsMap] = useState<{ [key: string]: string }>({});
  const [eventTeamsList, setEventTeamsList] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventLoading, setEventLoading] = useState(!initialEvent && !!eventId);
  const [refreshing, setRefreshing] = useState(false);
  const [teamMatchData, setTeamMatchData] = useState<{ [teamNumber: string]: TeamMatchInfo }>({});
  const [sortByNextMatch, setSortByNextMatch] = useState(true);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  // Fetch event data when eventId is provided
  useEffect(() => {
    const loadEvent = async () => {
      if (eventId && !event) {
        setEventLoading(true);
        try {
         logger.debug(' Fetching event data for eventId:', eventId);
          const eventData = await robotEventsAPI.getEventById(eventId);

          if (eventData) {
           logger.debug(' Successfully fetched event:', eventData.name, 'with', eventData.divisions?.length || 0, 'divisions');
            setEvent(eventData as any);
          } else {
           logger.error(' Event not found for ID:', eventId);
            Alert.alert('Error', 'Event not found');
            navigation.goBack();
          }
        } catch (error) {
         logger.error(' Failed to load event:', error);
          Alert.alert('Error', 'Failed to load event data. Please check your internet connection.');
          navigation.goBack();
        } finally {
          setEventLoading(false);
        }
      }
    };

    loadEvent();
  }, [eventId]);

  // Helper function to format date range
  const formatEventDates = () => {
    if (!event?.start) return '';
    const startDate = new Date(event.start);
    const endDate = event.end ? new Date(event.end) : null;

    if (endDate && startDate.toDateString() !== endDate.toDateString()) {
      return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    }
    return startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Check if event is ongoing (using centralized event status logic)
  const isEventOngoing = () => {
    if (!event) return false;
    const status = getEventStatus(event as any);
    return status.status === 'live';
  };

  useEffect(() => {
    navigation.setOptions({
      title: event?.name || 'Loading...',
      headerStyle: {
        backgroundColor: settings.topBarColor,
      },
      headerTintColor: settings.topBarContentColor,
      headerTitleAlign: 'center',
      headerTitleStyle: {
        fontWeight: '500',
        fontSize: 19,
        // Allow wrapping for long event names
        textAlign: 'center',
      },
      headerTransparent: false,
      headerBlurEffect: undefined,
      headerLargeTitle: false,
      // Custom header title component that supports multiline
      headerTitle: () => (
        <Text
          style={{
            fontWeight: '500',
            fontSize: 19,
            color: settings.topBarContentColor,
            textAlign: 'center',
            maxWidth: 250,
          }}
          numberOfLines={2}
          ellipsizeMode="tail"
        >
          {event?.name || 'Loading...'}
        </Text>
      ),
      headerRight: event ? () => (
        <View style={styles.headerButtons}>
          {isEventOngoing() && (
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          )}
          <TouchableOpacity
            onPress={toggleFavorite}
            style={[styles.headerButton, isEventOngoing() && { marginLeft: 8 }, { marginRight: 16 }]}
          >
            <Ionicons
              name={isEventFavorited(event.sku) ? "heart" : "heart-outline"}
              size={24}
              color={settings.topBarContentColor}
            />
          </TouchableOpacity>
        </View>
      ) : undefined,
    });

    if (event) {
      fetchEventData();
    }
  }, [event?.id, navigation, settings.topBarColor, settings.topBarContentColor, event ? isEventFavorited(event.sku) : false]);

  const fetchEventData = async (isRefresh = false) => {
    if (!event) {
     logger.debug(' fetchEventData called but event is null');
      return;
    }

   logger.debug(' Fetching event teams for event:', event.name, 'ID:', event.id);
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      // Fetch real event teams data
      const eventTeamsResponse = await robotEventsAPI.getEventTeams(event.id);
     logger.debug(' Successfully fetched', eventTeamsResponse.data?.length || 0, 'teams');

      // Transform API teams to UI teams (ensure organization is not undefined and program has code)
      const uiTeams = eventTeamsResponse.data.map(team => ({
        ...team,
        organization: team.organization || '',
        program: {
          id: team.program.id,
          name: team.program.name,
          code: team.program.code || 'UNKNOWN',
        },
      }));
      setEventTeams(uiTeams);

      const teamsList = uiTeams.map(t => t.number);
      const teamsMapData = uiTeams.reduce((acc, team) => {
        // Map team ID to team number (for backwards compatibility)
        acc[team.id.toString()] = team.number;
        // Map team number to team name (for displaying team names in MatchNotes)
        acc[team.number] = team.team_name || team.number;
        return acc;
      }, {} as { [key: string]: string });

      setEventTeamsList(teamsList);
      setTeamsMap(teamsMapData);

      // Fetch match data for favorite teams
      await fetchFavoriteTeamsMatchData(uiTeams);

    } catch (error) {
     logger.error('Failed to fetch event data:', error);
      Alert.alert('Error', 'Failed to load event data. Please check your internet connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchFavoriteTeamsMatchData = async (teams: Team[]) => {
    if (!event) return;

    const favoriteEventTeams = teams.filter(t => favoriteTeams.includes(t.number));
    if (favoriteEventTeams.length === 0) return;

   logger.debug(' Fetching match data for', favoriteEventTeams.length, 'favorite teams');

    // Helper function to extract match number for comparison
    const extractMatchNumber = (matchName: string) => {
      const numbers = matchName.match(/\d+/g);
      return numbers ? parseInt(numbers[0]) : 0;
    };

    // First pass: collect all matches from all favorite teams
    const allMatchesSet = new Map<string, any>(); // Use map to deduplicate by match ID

    for (const favTeam of favoriteEventTeams) {
      try {
        const matchesResponse = await robotEventsAPI.getTeamMatches(favTeam.id, {
          event: [event.id],
        });
        const matches = matchesResponse.data || [];
        matches.forEach(match => {
          allMatchesSet.set(match.id.toString(), match);
        });
      } catch (error) {
       logger.error(' Failed to fetch matches for team', favTeam.number, ':', error);
      }
    }

    const allEventMatches = Array.from(allMatchesSet.values());
   logger.debug(' Collected', allEventMatches.length, 'unique matches from favorite teams');

    const matchDataPromises = favoriteEventTeams.map(async (favTeam) => {
      try {
        const matchesResponse = await robotEventsAPI.getTeamMatches(favTeam.id, {
          event: [event.id],
        });

        const matches = matchesResponse.data || [];
       logger.debug(' Found', matches.length, 'matches for team', favTeam.number);

        // Log match statuses for debugging
        if (matches.length > 0) {
         logger.debug(' Match statuses for team', favTeam.number, ':');
          matches.forEach((match, index) => {
            logger.debug(` Match ${index + 1}: ${match.name} - scored: ${match.scored}, started: ${match.started}, scores: ${match.alliances?.map(a => a.score)}`);
          });
        }

        let matchInfo: TeamMatchInfo = {
          team: favTeam,
          isComplete: false,
        };

        if (matches.length > 0) {
          // Helper function to check if a match should be considered played
          const isMatchPlayed = (match: any) => {
            const hasStarted = match.started && match.started !== null;
            const hasRealScores = match.alliances &&
              match.alliances.some((alliance: any) => alliance.score > 0);
            const hasNonZeroScores = match.alliances &&
              !match.alliances.every((alliance: any) => (alliance.score === 0 || alliance.score === null || alliance.score === undefined));

            // Check basic scoring
            if (hasStarted && (hasRealScores || hasNonZeroScores)) {
              return true;
            }

            // Check if any LATER match in the same division has been scored
            const currentMatchNum = extractMatchNumber(match.name);
            const laterMatchScored = allEventMatches.some(otherMatch => {
              // Same division check
              if (otherMatch.division?.id !== match.division?.id) return false;

              // Is it a later match?
              const otherMatchNum = extractMatchNumber(otherMatch.name);
              if (otherMatchNum <= currentMatchNum) return false;

              // Has it been scored?
              const otherHasRealScores = otherMatch.alliances &&
                otherMatch.alliances.some((alliance: any) => alliance.score > 0);
              const otherHasNonZeroScores = otherMatch.alliances &&
                !otherMatch.alliances.every((alliance: any) => (alliance.score === 0 || alliance.score === null || alliance.score === undefined));

              return otherHasRealScores || otherHasNonZeroScores;
            });

            if (laterMatchScored) {
             logger.debug(' Match', match.name, 'has 0-0 but later match scored, considering it played');
              return true;
            }

            return false;
          };

          // Find next unplayed match - using Dashboard's sophisticated logic
          // Filter for unplayed matches using multiple criteria for reliability
          let upcomingMatches = matches
            .filter(match => {
              const isPlayed = isMatchPlayed(match);
              const isUnplayed = !isPlayed;

             logger.debug(' Match', match.name, '- scored:', match.scored, ', started:', match.started, ', scores:',
                match.alliances?.map(a => a.score), ', isPlayed:', isPlayed, ', isUnplayed:', isUnplayed);

              return isUnplayed;
            })
            .sort((a, b) => {
              // Sort by scheduled time if available, otherwise by match name/number
              if (a.scheduled && b.scheduled) {
                return new Date(a.scheduled).getTime() - new Date(b.scheduled).getTime();
              } else if (a.scheduled) {
                return -1; // a has schedule, prioritize it
              } else if (b.scheduled) {
                return 1; // b has schedule, prioritize it
              } else {
                // Both have no schedule, sort by match name/number
                const aNum = parseInt((a.name || '').replace(/\D/g, '')) || 0;
                const bNum = parseInt((b.name || '').replace(/\D/g, '')) || 0;
                return aNum - bNum;
              }
            });

         logger.debug(' Team', favTeam.number, 'has', upcomingMatches.length, 'unplayed matches');

          if (upcomingMatches.length > 0) {
            const nextMatch = upcomingMatches[0];
            matchInfo.nextMatchNumber = nextMatch.name;
            matchInfo.nextMatchName = nextMatch.name.split(' ')[0]; // e.g., "Q", "R16", "QF", "SF", "F"

            // Determine alliance color
            if (nextMatch.alliances && nextMatch.alliances.length > 0) {
              const redAlliance = nextMatch.alliances.find(a => a.color === 'red');
              const blueAlliance = nextMatch.alliances.find(a => a.color === 'blue');

              const isOnRed = redAlliance?.teams?.some(t => t.team?.id === favTeam.id);
              const isOnBlue = blueAlliance?.teams?.some(t => t.team?.id === favTeam.id);

              if (isOnRed) {
                matchInfo.nextMatchAlliance = 'red';
              } else if (isOnBlue) {
                matchInfo.nextMatchAlliance = 'blue';
              }

             logger.debug(' Team', favTeam.number, 'alliance:', matchInfo.nextMatchAlliance);
            }

            const scheduleInfo = nextMatch.scheduled ? `at ${nextMatch.scheduled}` : 'TBD';
           logger.debug(' Next match for team', favTeam.number, ':', matchInfo.nextMatchNumber, scheduleInfo);
          } else {
           logger.debug(' No upcoming matches for team', favTeam.number, '. All', matches.length, 'matches are complete');
            matchInfo.isComplete = true;
          }
        } else {
          // No matches scheduled yet
          matchInfo.isComplete = false;
        }

        return { teamNumber: favTeam.number, matchInfo };
      } catch (error) {
       logger.error(' Failed to fetch matches for team', favTeam.number, ':', error);
        return {
          teamNumber: favTeam.number,
          matchInfo: { team: favTeam, isComplete: false },
        };
      }
    });

    const results = await Promise.all(matchDataPromises);
    const matchDataMap = results.reduce((acc, result) => {
      acc[result.teamNumber] = result.matchInfo;
      return acc;
    }, {} as { [teamNumber: string]: TeamMatchInfo });

    setTeamMatchData(matchDataMap);
   logger.debug(' Match data fetched for favorite teams:', matchDataMap);
  };

  const onRefresh = useCallback(() => {
    fetchEventData(true);
  }, [event]);

  // Refresh match data when screen comes into focus and set up auto-refresh
  useFocusEffect(
    useCallback(() => {
      if (event && eventTeams.length > 0) {
       logger.debug(' Screen focused, refreshing favorite teams match data');
        fetchFavoriteTeamsMatchData(eventTeams);

        // Set up auto-refresh every 2 minutes (120000ms)
        const interval = setInterval(() => {
         logger.debug(' Auto-refreshing favorite teams match data');
          fetchFavoriteTeamsMatchData(eventTeams);
        }, 120000);

        setAutoRefreshInterval(interval);

        // Cleanup: clear interval when screen loses focus
        return () => {
         logger.debug(' Screen unfocused, clearing auto-refresh interval');
          clearInterval(interval);
          setAutoRefreshInterval(null);
        };
      }
    }, [event, eventTeams, favoriteTeams])
  );

  const toggleFavorite = async () => {
    if (!event) return;

    try {
      if (isEventFavorited(event.sku)) {
        await removeEvent(event.sku);
      } else {
        await addEvent(event);
      }
    } catch (error) {
     logger.error('Failed to toggle event favorite:', error);
      Alert.alert('Error', 'Failed to update favorite status');
    }
  };

  const navigateToEventInformation = () => {
    navigation.navigate('EventInformation', { event });
  };

  const navigateToAgenda = () => {
    navigation.navigate('EventAgenda', { event });
  };

  const navigateToEventTeams = () => {
    navigation.navigate('EventTeamList', {
      event,
      division: undefined, // No specific division
    });
  };

  const navigateToTeamMatches = (selectedTeam: Team) => {
   logger.debug('Navigating to team matches for team:', selectedTeam.number, 'ID:', selectedTeam.id);
    navigation.navigate('EventTeamMatches', {
      event,
      teamNumber: selectedTeam.number,
      teamId: selectedTeam.id,
      teamsMap,
    });
  };

  const navigateToSkillsRankings = () => {
    navigation.navigate('EventSkillsRankings', {
      event,
      teamsMap,
    });
  };

  const navigateToDivision = (division: any) => {
    navigation.navigate('EventDivision', {
      event,
      division,
      eventTeams,
      teamsMap,
      divisionTeamsList: eventTeamsList, // This would be filtered by division in real implementation
    });
  };

  const navigateToFavoriteTeamsMatches = () => {
    navigation.navigate('FavoriteTeamsMatches', {
      event,
      teamsMap,
      eventTeams,
    });
  };

  // Get favorite teams that are in this event with sorting
  const getFavoriteEventTeams = () => {
    const favTeams = eventTeams.filter(team => favoriteTeams.includes(team.number));

    if (!sortByNextMatch) {
      // Sort by team number
      return favTeams.sort((a, b) => a.number.localeCompare(b.number));
    }

    // Sort by next match number
    return favTeams.sort((a, b) => {
      const matchInfoA = teamMatchData[a.number];
      const matchInfoB = teamMatchData[b.number];

      // Teams with no match data go to the end
      if (!matchInfoA && !matchInfoB) return a.number.localeCompare(b.number);
      if (!matchInfoA) return 1;
      if (!matchInfoB) return -1;

      // Completed teams (no next match) go to the end
      if (matchInfoA.isComplete && matchInfoB.isComplete) return a.number.localeCompare(b.number);
      if (matchInfoA.isComplete) return 1;
      if (matchInfoB.isComplete) return -1;

      // Both have next matches - compare match numbers
      if (matchInfoA.nextMatchNumber && matchInfoB.nextMatchNumber) {
        // Extract match type and numbers (e.g., "Q 12", "Qualifier #59", "R16 3-4")
        const parseMatch = (matchName: string) => {
          // First, extract all numbers from the string using regex
          const numbers = matchName.match(/\d+/g);

          if (!numbers || numbers.length === 0) {
            return { type: matchName, primary: 999999, secondary: 0 };
          }

          // Get the first number as primary
          const primary = parseInt(numbers[0]);

          // If there's a second number (like "3-4"), use it as secondary
          const secondary = numbers.length > 1 ? parseInt(numbers[1]) : 0;

          return { type: matchName.split(/\d/)[0].trim(), primary, secondary };
        };

        const matchA = parseMatch(matchInfoA.nextMatchNumber);
        const matchB = parseMatch(matchInfoB.nextMatchNumber);

       logger.debug(' Comparing matches:', matchInfoA.nextMatchNumber, '→', matchA, 'vs', matchInfoB.nextMatchNumber, '→', matchB);

        // Compare primary numbers first
        if (matchA.primary !== matchB.primary) {
          return matchA.primary - matchB.primary;
        }

        // If primary is the same, compare secondary (for matches like "3-4" vs "3-5")
        if (matchA.secondary !== matchB.secondary) {
          return matchA.secondary - matchB.secondary;
        }
      }

      return a.number.localeCompare(b.number);
    });
  };

  const favoriteEventTeams = getFavoriteEventTeams();

  const generateSections = (): Section[] => {
    const sections: Section[] = [
      {
        title: 'Event',
        data: [
          {
            id: 'information',
            title: 'Information',
            icon: 'information-circle',
            onPress: navigateToEventInformation,
          },
          {
            id: 'agenda',
            title: 'Agenda',
            icon: 'calendar',
            onPress: navigateToAgenda,
          },
          {
            id: 'teams',
            title: 'Teams',
            icon: 'people',
            onPress: navigateToEventTeams,
            subtitle: `${eventTeams.length} teams`,
          },
        ],
      },
      {
        title: 'Skills',
        data: [
          {
            id: 'skills',
            title: 'Skills Rankings',
            icon: 'trophy',
            onPress: navigateToSkillsRankings,
          },
        ],
      },
    ];

    // Add team-specific match list if viewing from a team context
    if (team) {
      sections[0].data.push({
        id: 'team-matches',
        title: `${team.number} Match List`,
        icon: 'list',
        onPress: () => navigateToTeamMatches(team),
      });
    }

    // Add divisions section
    if (event && event.divisions && event.divisions.length > 0) {
     logger.debug(' Adding', event.divisions.length, 'divisions to sections');
      sections.push({
        title: 'Divisions',
        data: event.divisions.map(division => ({
          id: `division-${division.id}`,
          title: division.name,
          icon: 'apps',
          onPress: () => navigateToDivision(division),
        })),
      });
    } else {
     logger.debug(' No divisions found for event:', event?.name);
    }

    // Add favorite teams section if there are favorites
    if (favoriteEventTeams.length > 0) {
      const favoriteTeamsData = [];

      if (favoriteEventTeams.length > 1) {
        favoriteTeamsData.push({
          id: 'all-favorites',
          title: 'All Favorite Teams Matches',
          icon: 'star',
          onPress: navigateToFavoriteTeamsMatches,
          subtitle: `${favoriteEventTeams.length} teams`,
        });

        // Add sort toggle button
        favoriteTeamsData.push({
          id: 'sort-toggle',
          title: sortByNextMatch ? 'Sorted by Next Match' : 'Sorted by Team Number',
          icon: sortByNextMatch ? 'swap-vertical' : 'list',
          onPress: () => setSortByNextMatch(!sortByNextMatch),
          subtitle: 'Tap to change sort order',
        });
      }

      // Add individual team match lists with next match info
      favoriteTeamsData.push(...favoriteEventTeams.map(favTeam => {
        const matchInfo = teamMatchData[favTeam.number];
        let subtitle = '';
        let allianceColor: 'red' | 'blue' | undefined = undefined;

        if (matchInfo) {
          if (matchInfo.isComplete) {
            subtitle = 'All matches complete';
          } else if (matchInfo.nextMatchNumber) {
            subtitle = `Next: ${matchInfo.nextMatchNumber}`;
            allianceColor = matchInfo.nextMatchAlliance;
          }
        }

        return {
          id: `favorite-${favTeam.id}`,
          title: `${favTeam.number} Match List`,
          icon: 'star-outline' as const,
          onPress: () => navigateToTeamMatches(favTeam),
          subtitle,
          allianceColor,
        };
      }));

      sections.push({
        title: favoriteEventTeams.length === 1 ? 'Favorite Team Match List' : 'Favorite Teams Match Lists',
        data: favoriteTeamsData,
      });
    }

    return sections;
  };

  const renderSectionHeader = ({ section }: { section: Section }) => (
    <View style={[styles.sectionHeader, {
      backgroundColor: settings.backgroundColor,
      borderTopColor: settings.borderColor
    }]}>
      <Text style={[styles.sectionHeaderText, { color: settings.textColor }]}>{section.title}</Text>
    </View>
  );

  const renderItem = ({ item }: { item: Section['data'][0] }) => {
    // Special styling for sort toggle button
    const isSortToggle = item.id === 'sort-toggle';
    // Special styling for match list items with next match info
    const isMatchListWithInfo = item.id.startsWith('favorite-') && item.subtitle && item.subtitle !== '';

    // Get alliance color for subtitle
    const getAllianceColor = () => {
      if (item.allianceColor === 'red') {
        return '#FF3B30'; // Red alliance color
      } else if (item.allianceColor === 'blue') {
        return '#007AFF'; // Blue alliance color
      }
      return settings.secondaryTextColor; // Default color
    };

    return (
      <TouchableOpacity
        style={[
          styles.listItem,
          {
            backgroundColor: settings.cardBackgroundColor,
            borderColor: settings.borderColor,
            shadowColor: settings.colorScheme === 'dark' ? '#FFFFFF' : '#000000'
          },
          isSortToggle && styles.sortToggleItem,
          isMatchListWithInfo && styles.matchListItemWithInfo,
        ]}
        onPress={item.onPress}
      >
        <View style={styles.listItemContent}>
          {item.icon && (
            <View style={[
              styles.iconContainer,
              isSortToggle && { backgroundColor: settings.buttonColor + '20' },
              !isSortToggle && { backgroundColor: 'transparent' }
            ]}>
              <Ionicons
                name={item.icon as any}
                size={18}
                color={settings.buttonColor}
              />
            </View>
          )}
          <View style={styles.listItemText}>
            <Text style={[styles.listItemTitle, { color: settings.textColor }]}>{item.title}</Text>
            {item.subtitle && (
              <Text style={[
                styles.listItemSubtitle,
                { color: getAllianceColor() },
                isMatchListWithInfo && item.subtitle.startsWith('Next:') && styles.nextMatchText
              ]}>
                {item.subtitle}
              </Text>
            )}
          </View>
          <Ionicons name="chevron-forward" size={16} color={settings.iconColor} />
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: settings.backgroundColor }]}>
        <ActivityIndicator size="large" color={settings.buttonColor} />
        <Text style={[styles.loadingText, { color: settings.textColor }]}>Loading event data...</Text>
      </View>
    );
  }

  // Show loading screen when fetching event data
  if (eventLoading || !event) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: settings.backgroundColor }]}>
        <ActivityIndicator size="large" color={settings.buttonColor} />
        <Text style={[styles.loadingText, { color: settings.textColor }]}>
          Loading event details...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: settings.backgroundColor }]}>
      <SectionList
        sections={generateSections()}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        bounces={true}
        scrollEventThrottle={16}
        stickySectionHeadersEnabled={true}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={settings.buttonColor}
            colors={[settings.buttonColor]}
          />
        }
      />
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
    marginTop: 12,
    fontSize: 16,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    padding: 4,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ff4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
    marginRight: 4,
  },
  liveText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingVertical: 8,
    paddingBottom: 20,
  },
  sectionHeader: {
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 8,
    marginTop: 0,
    borderTopWidth: 0,
  },
  sectionHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  listItem: {
    marginHorizontal: 12,
    marginVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  listItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  listItemText: {
    flex: 1,
  },
  listItemTitle: {
    fontSize: 15,
    fontWeight: '500',
  },
  listItemSubtitle: {
    fontSize: 13,
    marginTop: 1,
  },
  sortToggleItem: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  matchListItemWithInfo: {
    // Additional styling for match list items with info
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  nextMatchText: {
    fontWeight: '600',
    fontSize: 13,
  },
});

export default EventMainView;