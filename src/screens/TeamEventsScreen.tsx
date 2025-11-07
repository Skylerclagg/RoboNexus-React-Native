/**
 * TEAM EVENTS SCREEN
 *
 * Display a team's complete event participation history organized by seasons.
 * Shows event statistics, completion status, and upcoming events with collapsible seasons.
 *
 * NAVIGATION ACCESS:
 * - Team Info Screen → Events section → "View All Events"
 * - Team profile → Event statistics
 *
 * KEY FEATURES:
 * - Event history organized by collapsible seasons (newest first)
 * - Event statistics: total, completed, upcoming, and current season counts
 * - Event status indicators (completed, live, upcoming)
 * - Direct navigation to event details
 * - Auto-expansion of most recent season
 * - Real-time event status updates
 */

import React, { useState, useEffect, useMemo } from 'react';
import { createLogger } from '../utils/logger';

const logger = createLogger('TeamEventsScreen');
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { robotEventsAPI } from '../services/apiRouter';
import { useSettings } from '../contexts/SettingsContext';
import { Team, Event } from '../types';

const TeamEventsScreen: React.FC<any> = ({ route, navigation }) => {
  const settings = useSettings();
  const { teamNumber, teamData } = route.params;
  const [events, setEvents] = useState<Event[]>([]);
  const [team, setTeam] = useState<Team | null>(teamData || null);
  const [loading, setLoading] = useState(true);
  const [seasons, setSeasons] = useState<{label: string, value: string}[]>([]);
  const [expandedSeasons, setExpandedSeasons] = useState<Set<string>>(new Set());
  const [hasAutoExpanded, setHasAutoExpanded] = useState(false);
  const [currentSeasonId, setCurrentSeasonId] = useState<number | null>(null);

  const formatSeasonName = (seasonName: string) => {
    // Return the full season name without any shortening
    return seasonName;
  };

  // Group events by season for collapsible display (memoized)
  const eventsBySeason = useMemo(() => {
    const grouped: { [seasonName: string]: Event[] } = {};

    events.forEach(event => {
      const seasonName = formatSeasonName(event.season?.name || 'Unknown Season');
      if (!grouped[seasonName]) {
        grouped[seasonName] = [];
      }
      grouped[seasonName].push(event);
    });

    // Sort events within each season by date (earliest first)
    Object.keys(grouped).forEach(season => {
      grouped[season].sort((a, b) =>
        new Date(a.start).getTime() - new Date(b.start).getTime()
      );
    });

    return grouped;
  }, [events]);

  // Sort seasons by their chronological order (newest first) (memoized)
  const sortedSeasons = useMemo(() => {
    return Object.keys(eventsBySeason).sort((a, b) => {
      // Find the corresponding season objects
      const seasonA = seasons.find(s => s.label === a);
      const seasonB = seasons.find(s => s.label === b);

      if (seasonA && seasonB) {
        return seasonB.value.localeCompare(seasonA.value);
      }

      const yearA = parseInt(a.match(/(\d{4})/)?.[0] || '0');
      const yearB = parseInt(b.match(/(\d{4})/)?.[0] || '0');
      return yearB - yearA;
    });
  }, [eventsBySeason, seasons]);

  useEffect(() => {
    navigation.setOptions({
      title: `${teamNumber} Events`,
      headerStyle: {
        backgroundColor: settings.buttonColor,
      },
      headerTintColor: '#fff',
      headerTitleAlign: 'center',
    });

    fetchTeamEvents();
    getCurrentSeasonId();
  }, [teamNumber, navigation, settings.buttonColor]);

  const getCurrentSeasonId = async () => {
    try {
      const seasonId = await robotEventsAPI.getCurrentSeasonId(settings.selectedProgram);
      setCurrentSeasonId(seasonId);
      logger.debug(`Current active season ID: ${seasonId}`);
    } catch (error) {
      logger.error('Failed to get current season ID:', error);
    }
  };


  const fetchTeamEvents = async () => {
    setLoading(true);
    try {
      let teamToUse = team;
      if (!teamToUse) {
        const apiTeam = await robotEventsAPI.getTeamByNumber(teamNumber);
        logger.debug('Fetched team data:', apiTeam);

        // Transform API team to UI team type
        if (apiTeam) {
          teamToUse = {
            ...apiTeam,
            organization: apiTeam.organization || '',
            program: {
              id: apiTeam.program.id,
              name: apiTeam.program.name,
              code: apiTeam.program.code || 'UNKNOWN',
            },
          };
          setTeam(teamToUse);
        }
      }

      if (teamToUse) {
        logger.debug('Team to use:', teamToUse);
        logger.debug('Team ID:', teamToUse.id);
        logger.debug('Team ID type:', typeof teamToUse.id);
        logger.debug('About to call getTeamEvents with ID:', teamToUse.id);

        // Ensure we have a valid team ID
        if (!teamToUse.id) {
          logger.error('Team ID is undefined, cannot fetch events');
          Alert.alert('Error', 'Team ID not found, cannot load events');
          return;
        }

        // Fetch team events (no filters - get all events for team)
        const teamEventsResponse = await robotEventsAPI.getTeamEvents(teamToUse.id);

        // Transform API events to UI events and sort by date (earliest first)
        const transformedEvents = teamEventsResponse.data.map(event => ({
          ...event,
          program: {
            id: event.program.id,
            name: event.program.name,
            code: event.program.code || 'UNKNOWN',
          },
          season: {
            id: event.season.id,
            name: event.season.name,
            program: {
              id: event.program.id,
              name: event.program.name,
              code: event.program.code || 'UNKNOWN', // Add missing code property
            },
          }
        }));

        const sortedEvents = transformedEvents.sort((a, b) =>
          new Date(a.start).getTime() - new Date(b.start).getTime()
        );

        setEvents(sortedEvents);
        processSeasonsAndEvents(sortedEvents);
      } else {
        Alert.alert('Error', `Team ${teamNumber} not found`);
      }
    } catch (error) {
      logger.error('Failed to fetch team events:', error);
      Alert.alert('Error', 'Failed to load team events. Please check your internet connection.');
    } finally {
      setLoading(false);
    }
  };

  const processSeasonsAndEvents = (eventList: Event[]) => {
    // Group events by season
    const eventsBySeason: {[season: string]: Event[]} = {};
    const seasonNames: {[season: string]: string} = {};

    eventList.forEach(event => {
      const seasonId = event.season?.id?.toString() || 'unknown';
      const seasonName = event.season?.name || 'Unknown Season';

      if (!eventsBySeason[seasonId]) {
        eventsBySeason[seasonId] = [];
        seasonNames[seasonId] = seasonName;
      }
      eventsBySeason[seasonId].push(event);
    });

    // Create season options for the dropdown
    const seasonOptions = Object.keys(eventsBySeason)
      .sort((a, b) => {
        // Sort by earliest event start date for the season (most recent seasons first)
        const aEvents = eventsBySeason[a];
        const bEvents = eventsBySeason[b];
        const aDate = aEvents.reduce((earliest, event) =>
          new Date(event.start).getTime() < new Date(earliest).getTime() ? event.start : earliest,
          aEvents[0]?.start || '9999-12-31'
        );
        const bDate = bEvents.reduce((earliest, event) =>
          new Date(event.start).getTime() < new Date(earliest).getTime() ? event.start : earliest,
          bEvents[0]?.start || '9999-12-31'
        );
        return new Date(bDate).getTime() - new Date(aDate).getTime();
      })
      .map(seasonId => ({
        label: formatSeasonName(seasonNames[seasonId]),
        value: seasonId
      }));

    // Add "All Seasons" option
    seasonOptions.unshift({ label: 'All Seasons', value: 'all' });
    setSeasons(seasonOptions);

    // Auto-expand the most recent season when events are first loaded
    if (Object.keys(eventsBySeason).length > 0 && !hasAutoExpanded) {
      const seasonNames = Object.keys(eventsBySeason);
      if (seasonNames.length > 0) {
        const mostRecentSeason = seasonNames[0]; // Already sorted by most recent first
        setExpandedSeasons(new Set([mostRecentSeason]));
        setHasAutoExpanded(true);
      }
    }
  };



  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatLocation = (event: Event) => {
    const parts = [event.location?.city, event.location?.region, event.location?.country];
    return parts
      .filter(Boolean)
      .join(', ')
      .replace('United States', 'USA');
  };

  const isEventCanceled = (eventName: string) => {
    const nameLower = eventName.toLowerCase();
    return nameLower.includes('canceled') || nameLower.includes('cancelled');
  };

  const openEventDetails = (event: Event) => {
    navigation.navigate('EventMainView', {
      event: event,
      team: team
    });
  };

  const renderEventItem = ({ item }: { item: Event }) => (
    <TouchableOpacity
      style={[styles.eventItem, { backgroundColor: settings.cardBackgroundColor }]}
      onPress={() => openEventDetails(item)}
    >
      <View style={styles.eventContent}>
        <View style={styles.eventHeader}>
          <Text
            style={[
              styles.eventName,
              { color: settings.textColor },
              isEventCanceled(item.name) && styles.canceledEvent
            ]}
            numberOfLines={2}
          >
            {item.name}
          </Text>
          {isEventCanceled(item.name) && (
            <View style={styles.canceledBadge}>
              <Text style={styles.canceledBadgeText}>CANCELED</Text>
            </View>
          )}
        </View>

        <View style={styles.eventDetails}>
          <View style={styles.eventDetailRow}>
            <Ionicons name="location" size={14} color={settings.textColor} />
            <Text style={[styles.eventLocation, { color: settings.textColor }]}>{formatLocation(item)}</Text>
          </View>

          <View style={styles.eventDetailRow}>
            <Ionicons name="calendar" size={14} color={settings.textColor} />
            <Text style={[styles.eventDate, { color: settings.textColor }]}>
              {formatDate(item.start)} - {formatDate(item.end)}
            </Text>
          </View>

          <View style={styles.eventDetailRow}>
            <Ionicons name="trophy" size={14} color={settings.textColor} />
            <Text style={[styles.eventLevel, { color: settings.textColor }]}>{item.level}</Text>
          </View>
        </View>
      </View>

      <Ionicons name="chevron-forward" size={16} color={settings.textColor} />
    </TouchableOpacity>
  );

  const renderHeader = () => (
    <View style={[styles.header, { backgroundColor: settings.cardBackgroundColor }]}>
      {team && (
        <View style={styles.teamInfo}>
          <Text style={[styles.teamNumber, { color: settings.textColor }]}>{team.number}</Text>
          <Text style={[styles.teamName, { color: settings.textColor }]}>{team.team_name}</Text>
          {team.organization && (
            <Text style={[styles.teamOrganization, { color: settings.textColor }]}>{team.organization}</Text>
          )}
        </View>
      )}

      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: settings.buttonColor }]}>{events.length}</Text>
          <Text style={[styles.statLabel, { color: settings.textColor }]}>Events</Text>
          <Text style={[styles.statSubLabel, { color: settings.textColor }]}>(Lifetime)</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: settings.buttonColor }]}>
            {(() => {
              if (!currentSeasonId) return 0;

              // Count events in the actual current/active season only
              return events.filter(e => e.season?.id === currentSeasonId).length;
            })()}
          </Text>
          <Text style={[styles.statLabel, { color: settings.textColor }]}>This Season</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: settings.buttonColor }]}>
            {events.filter(e => new Date(e.end) < new Date()).length}
          </Text>
          <Text style={[styles.statLabel, { color: settings.textColor }]}>Completed</Text>
          <Text style={[styles.statSubLabel, { color: settings.textColor }]}>(Lifetime)</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: settings.buttonColor }]}>
            {(() => {
              if (events.length === 0) return 0;

              // Find the most recent season ID from actual events
              const eventsWithSeasons = events.filter(e => e.season?.id);
              if (eventsWithSeasons.length === 0) return 0;

              // Get unique seasons and sort by ID (assuming higher ID = more recent)
              const seasonIds = [...new Set(eventsWithSeasons.map(e => e.season!.id))];
              const mostRecentSeasonId = Math.max(...seasonIds);

              // Count completed events in the most recent season
              return events.filter(e =>
                e.season?.id === mostRecentSeasonId &&
                new Date(e.end) < new Date()
              ).length;
            })()}
          </Text>
          <Text style={[styles.statLabel, { color: settings.textColor }]}>Completed</Text>
          <Text style={[styles.statSubLabel, { color: settings.textColor }]}>(This Season)</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: settings.buttonColor }]}>
            {events.filter(e => new Date(e.start) > new Date()).length}
          </Text>
          <Text style={[styles.statLabel, { color: settings.textColor }]}>Upcoming</Text>
        </View>
      </View>

    </View>
  );

  const toggleSeasonExpansion = (season: string) => {
    setExpandedSeasons(prev => {
      const newSet = new Set(prev);
      if (newSet.has(season)) {
        newSet.delete(season);
      } else {
        newSet.add(season);
      }
      return newSet;
    });
  };

  const renderSeasonSection = (season: string, events: Event[]) => {
    const isExpanded = expandedSeasons.has(season);

    return (
      <View key={season} style={[styles.seasonSection, {
        backgroundColor: settings.cardBackgroundColor,
        borderColor: settings.borderColor
      }]}>
        <TouchableOpacity
          style={[styles.seasonHeader, { borderBottomColor: settings.borderColor }]}
          onPress={() => toggleSeasonExpansion(season)}
        >
          <View style={styles.seasonHeaderContent}>
            <Text style={[styles.seasonTitle, { color: settings.textColor }]}>
              {season}
            </Text>
            <Text style={[styles.seasonCount, { color: settings.textColor }]}>
              {events.length} event{events.length !== 1 ? 's' : ''}
            </Text>
          </View>
          <Ionicons
            name={isExpanded ? "chevron-up" : "chevron-down"}
            size={20}
            color={settings.textColor}
          />
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.seasonEvents}>
            {events.map((event, index) => (
              <View key={event.id} style={index < events.length - 1 ? [styles.eventWrapper, { borderBottomColor: settings.borderColor }] : styles.eventWrapper}>
                {renderEventItem({ item: event })}
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };


  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="calendar-outline" size={64} color={settings.textColor} />
      <Text style={[styles.emptyStateTitle, { color: settings.textColor }]}>No Events Found</Text>
      <Text style={[styles.emptyStateMessage, { color: settings.textColor }]}>
        This team hasn't participated in any events this season.
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: settings.backgroundColor }]}>
        <ActivityIndicator size="large" color={settings.buttonColor} />
        <Text style={[styles.loadingText, { color: settings.textColor }]}>Loading team events...</Text>
      </View>
    );
  }


  return (
    <View style={[styles.container, { backgroundColor: settings.backgroundColor }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={Object.keys(eventsBySeason).length === 0 ? styles.emptyContainer : styles.seasonsContainer}
      >
        {renderHeader()}
        {Object.keys(eventsBySeason).length === 0 ? (
          renderEmptyState()
        ) : (
          sortedSeasons.map(season =>
            renderSeasonSection(season, eventsBySeason[season])
          )
        )}
      </ScrollView>
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
  header: {
    padding: 16,
    marginBottom: 8,
  },
  teamInfo: {
    alignItems: 'center',
    marginBottom: 16,
  },
  teamNumber: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  teamName: {
    fontSize: 16,
    marginTop: 4,
    textAlign: 'center',
  },
  teamOrganization: {
    fontSize: 14,
    marginTop: 2,
    textAlign: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  statSubLabel: {
    fontSize: 10,
    marginTop: 2,
    opacity: 0.7,
  },
  eventItem: {
    marginHorizontal: 8,
    marginVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  eventContent: {
    flex: 1,
    padding: 16,
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  eventName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  canceledEvent: {
    color: '#ff4444',
  },
  canceledBadge: {
    backgroundColor: '#ff4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  canceledBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  eventDetails: {
    gap: 4,
  },
  eventDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eventLocation: {
    fontSize: 14,
    marginLeft: 6,
  },
  eventDate: {
    fontSize: 14,
    marginLeft: 6,
  },
  eventLevel: {
    fontSize: 14,
    marginLeft: 6,
    textTransform: 'capitalize',
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateMessage: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  sectionHeaderText: {
    fontSize: 18,
    fontWeight: '600',
  },
  // Season section styles (similar to TeamInfoScreen)
  seasonsContainer: {
    paddingBottom: 16,
  },
  seasonSection: {
    marginHorizontal: 8,
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  seasonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 80,
  },
  seasonHeaderContent: {
    flex: 1,
  },
  seasonTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  seasonCount: {
    fontSize: 15,
    marginTop: 6,
    fontWeight: '500',
  },
  seasonEvents: {
    padding: 16,
    paddingTop: 8,
  },
  eventWrapper: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 12,
    marginBottom: 12,
  },
});

export default TeamEventsScreen;