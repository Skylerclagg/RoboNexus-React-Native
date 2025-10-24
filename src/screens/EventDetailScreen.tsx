/**
 * EVENT DETAIL SCREEN
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
import { robotEventsAPI } from '../services/apiRouter';
import { useSettings } from '../contexts/SettingsContext';
import { useFavorites } from '../contexts/FavoritesContext';
import { Team, Event } from '../types';

interface EventDetailScreenProps {
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
  }[];
}

const EventDetailScreen = ({ route, navigation }: EventDetailScreenProps) => {
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

  // Fetch event data when eventId is provided
  useEffect(() => {
    const loadEvent = async () => {
      if (eventId && !event) {
        setEventLoading(true);
        try {
          console.log('[EventDetail] Fetching event data for eventId:', eventId);
          const eventData = await robotEventsAPI.getEventById(eventId);

          if (eventData) {
            console.log('[EventDetail] Successfully fetched event:', eventData.name, 'with', eventData.divisions?.length || 0, 'divisions');
            setEvent(eventData as any);
          } else {
            console.error('[EventDetail] Event not found for ID:', eventId);
            Alert.alert('Error', 'Event not found');
            navigation.goBack();
          }
        } catch (error) {
          console.error('[EventDetail] Failed to load event:', error);
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

  // Check if event is ongoing
  const isEventOngoing = () => {
    if (!event?.start || !event?.end) return false;
    const now = new Date();
    const start = new Date(event.start);
    const end = new Date(event.end);
    return now >= start && now <= end;
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
      },
      headerTransparent: false,
      headerBlurEffect: undefined,
      headerLargeTitle: false,
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
            style={styles.headerButton}
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
      console.log('[EventDetail] fetchEventData called but event is null');
      return;
    }

    console.log('[EventDetail] Fetching event teams for event:', event.name, 'ID:', event.id);
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      // Fetch real event teams data
      const eventTeamsResponse = await robotEventsAPI.getEventTeams(event.id);
      console.log('[EventDetail] Successfully fetched', eventTeamsResponse.data?.length || 0, 'teams');

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
        acc[team.id.toString()] = team.number;
        return acc;
      }, {} as { [key: string]: string });

      setEventTeamsList(teamsList);
      setTeamsMap(teamsMapData);

    } catch (error) {
      console.error('Failed to fetch event data:', error);
      Alert.alert('Error', 'Failed to load event data. Please check your internet connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    fetchEventData(true);
  }, [event]);


  const toggleFavorite = async () => {
    if (!event) return;

    try {
      if (isEventFavorited(event.sku)) {
        await removeEvent(event.sku);
      } else {
        await addEvent(event);
      }
    } catch (error) {
      console.error('Failed to toggle event favorite:', error);
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
    navigation.navigate('EventTeams', {
      event,
      division: undefined, // No specific division
    });
  };

  const navigateToTeamMatches = (selectedTeam: Team) => {
    console.log('Navigating to team matches for team:', selectedTeam.number, 'ID:', selectedTeam.id);
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

  // Get favorite teams that are in this event
  const favoriteEventTeams = eventTeams.filter(team => {
    return favoriteTeams.includes(team.number);
  });

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
      console.log('[EventDetail] Adding', event.divisions.length, 'divisions to sections');
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
      console.log('[EventDetail] No divisions found for event:', event?.name);
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
      }

      // Add individual team match lists
      favoriteTeamsData.push(...favoriteEventTeams.map(favTeam => ({
        id: `favorite-${favTeam.id}`,
        title: `${favTeam.number} Match List`,
        icon: 'star-outline' as const,
        onPress: () => navigateToTeamMatches(favTeam),
      })));

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

  const renderItem = ({ item }: { item: Section['data'][0] }) => (
    <TouchableOpacity style={[styles.listItem, {
      backgroundColor: settings.cardBackgroundColor,
      borderColor: settings.borderColor,
      shadowColor: settings.colorScheme === 'dark' ? '#FFFFFF' : '#000000'
    }]} onPress={item.onPress}>
      <View style={styles.listItemContent}>
        {item.icon && (
          <Ionicons
            name={item.icon as any}
            size={20}
            color={settings.buttonColor}
            style={styles.listItemIcon}
          />
        )}
        <View style={styles.listItemText}>
          <Text style={[styles.listItemTitle, { color: settings.textColor }]}>{item.title}</Text>
          {item.subtitle && (
            <Text style={[styles.listItemSubtitle, { color: settings.secondaryTextColor }]}>{item.subtitle}</Text>
          )}
        </View>
        <Ionicons name="chevron-forward" size={16} color={settings.iconColor} />
      </View>
    </TouchableOpacity>
  );

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
    padding: 8,
    marginLeft: 8,
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
    paddingHorizontal: 16,
    paddingVertical: 12,
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
    marginHorizontal: 8,
    marginVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  listItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  listItemIcon: {
    marginRight: 12,
  },
  listItemText: {
    flex: 1,
  },
  listItemTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  listItemSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
});

export default EventDetailScreen;