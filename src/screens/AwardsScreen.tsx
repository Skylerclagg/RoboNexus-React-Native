/**
 * Awards Screen
 *
 * Description:
 * Displays awards and achievements for the user's favorite teams across different
 * VEX robotics competitions and seasons. Features expandable team cards with
 * detailed award information and qualification status indicators.
 *
 * Navigation:
 * Accessed from the main navigation tab or through team detail screens
 * when users want to view awards for their favorite teams.
 *
 * Key Features:
 * - Favorite teams award tracking across multiple seasons
 * - Expandable team cards with comprehensive award listings
 * - Season filtering and award type categorization
 * - Qualification tooltip and status indicators
 * - Event navigation and award detail display
 * - Loading states and empty state handling
 */
import React, { useState, useEffect } from 'react';
import { createLogger } from '../utils/logger';

const logger = createLogger('AwardsScreen');
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFavorites } from '../contexts/FavoritesContext';
import { useSettings } from '../contexts/SettingsContext';
import { robotEventsAPI } from '../services/apiRouter';
import { getProgramId } from '../utils/programMappings';

interface TeamAward {
  id: number;
  title: string;
  qualifications: string[];
  event: {
    id: number;
    name: string;
    start: string;
    end: string;
  };
}

interface TeamAwardData {
  teamNumber: string;
  teamName: string;
  awards: TeamAward[];
}

interface Props {
  navigation: any;
}


const AwardsScreen: React.FC<Props> = ({ navigation }) => {
  const { favorites } = useFavorites();
  const { globalSeasonEnabled, selectedSeason: globalSeason, ...settings } = useSettings();
  const [awardsData, setAwardsData] = useState<TeamAwardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showQualificationTooltip, setShowQualificationTooltip] = useState<string | null>(null);
  const [selectedQualifications, setSelectedQualifications] = useState<string[]>([]);
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
  const [selectedSeason, setSelectedSeason] = useState<string>('');
  const [seasons, setSeasons] = useState<{label: string, value: string}[]>([]);

  const favoriteTeams = favorites.filter(item => item.type === 'team');

  // Sync with global season when global mode is enabled
  useEffect(() => {
    if (globalSeasonEnabled && globalSeason && globalSeason !== selectedSeason) {
      setSelectedSeason(globalSeason);
    }
  }, [globalSeasonEnabled, globalSeason, selectedSeason]);

  const loadSeasons = async () => {
    try {
      // Get program ID for filtering
      const programId = settings.selectedProgram === 'VEX V5 Robotics Competition' ? 1 :
                       settings.selectedProgram === 'VEX IQ Robotics Competition' ? 41 :
                       settings.selectedProgram === 'VEX U Robotics Competition' ? 4 :
                       settings.selectedProgram === 'VEX AI Robotics Competition' ? 57 :
                       settings.selectedProgram === 'Aerial Drone Competition' ? 44 : 1;

      const seasonsResponse = await robotEventsAPI.getSeasons({ program: [programId] });

      const formattedSeasons = seasonsResponse.data.map((season: any) => ({
        label: season.name || `Season ${season.id}`,
        value: season.id.toString()
      }));

      setSeasons(formattedSeasons);
    } catch (error) {
      logger.error('Failed to load seasons:', error);
    }
  };

  const loadAwardsData = async () => {
    try {
      setLoading(true);
      // Use selected season if available, otherwise get current season
      let targetSeasonId;
      if (selectedSeason && selectedSeason !== '') {
        targetSeasonId = parseInt(selectedSeason);
      } else {
        targetSeasonId = await robotEventsAPI.getCurrentSeasonId(settings.selectedProgram);
      }

      const teamAwardsPromises = favoriteTeams.map(async (team) => {
        if (!team.number) return null;

        try {
          // Get basic team info (use program from favorite item to ensure correct API)
          const teamInfo = await robotEventsAPI.getTeamByNumber(team.number, team.program);

          // Get team awards for current season
          const awardsResponse = await robotEventsAPI.getTeamAwards(teamInfo!.id, { season: [targetSeasonId] });

          // Process awards to include proper event and qualification data
          const processedAwards = [];

          for (const award of (awardsResponse.data || [])) {
            logger.debug('Raw award data:', JSON.stringify(award, null, 2));

            // Try to extract event information from various possible locations
            let eventInfo = {
              id: 0,
              name: 'Unknown Event',
              start: '',
              end: ''
            };

            // Check for event data
            if (award.event) {
              eventInfo.id = award.event.id || 0;
              eventInfo.name = award.event.name || 'Unknown Event';
              // Note: award.event is IdInfo and doesn't have start/end properties
              // These will be fetched separately if needed
              eventInfo.start = '';
              eventInfo.end = '';
            }

            if (eventInfo.id > 0 && !eventInfo.start) {
              try {
                logger.debug('Fetching event details for missing date, event ID:', eventInfo.id || 'Unknown');
                const eventDetails = await robotEventsAPI.getEventDetails(eventInfo.id);
                if (eventDetails) {
                  eventInfo.name = eventDetails.name || eventInfo.name;
                  eventInfo.start = eventDetails.start || '';
                  eventInfo.end = eventDetails.end || '';
                  logger.debug('Updated event info from API:', eventInfo);
                }
              } catch (error) {
                logger.error('Failed to fetch event details for ID', eventInfo.id || 'Unknown', ':', error);
              }
            }

            // Handle qualifications - fetch from event awards if not in team awards
            let qualifications = [];
            if (Array.isArray(award.qualifications)) {
              qualifications = award.qualifications;
            } else if (award.qualifications && typeof award.qualifications === 'object' && 'qualification' in award.qualifications && Array.isArray((award.qualifications as any).qualification)) {
              qualifications = (award.qualifications as any).qualification;
            } else if (eventInfo.id > 0) {
              // Fetch event awards to get qualification data
              try {
                logger.debug('Fetching event awards for qualification data, event ID:', eventInfo.id || 'Unknown');
                const eventAwardsResponse = await robotEventsAPI.getEventAwards(eventInfo.id);

                // Find matching award by title or ID
                const matchingEventAward = eventAwardsResponse.data.find(eventAward =>
                  eventAward.title === award.title ||
                  eventAward.id === award.id ||
                  (eventAward.title && award.title &&
                   eventAward.title.toLowerCase().includes(award.title.toLowerCase().split(' ')[0]))
                );

                if (matchingEventAward && Array.isArray(matchingEventAward.qualifications)) {
                  qualifications = matchingEventAward.qualifications;
                  logger.debug('Found qualification data from event awards:', qualifications);
                } else {
                  logger.debug('No matching event award found for', award.title || 'Unknown');
                }
              } catch (error) {
                logger.error('Failed to fetch event awards for qualification data:', error);
              }
            }

            logger.debug('Final processed event info:', eventInfo);
            logger.debug('Processed qualifications:', qualifications);

            processedAwards.push({
              id: award.id,
              title: award.title || 'Unknown Award',
              qualifications: qualifications,
              event: eventInfo
            });
          }

          return {
            teamNumber: team.number,
            teamName: teamInfo?.team_name || 'Unknown Team',
            awards: processedAwards,
          };
        } catch (error) {
          logger.error('Failed to load awards for team', team.number || 'Unknown', ':', error);
          return {
            teamNumber: team.number || 'Unknown',
            teamName: 'Unknown Team',
            awards: [],
          };
        }
      });

      const results = await Promise.all(teamAwardsPromises);
      const validAwards = results.filter((data): data is TeamAwardData => data !== null);
      setAwardsData(validAwards);
    } catch (error) {
      logger.error('Failed to load awards data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadSeasons();
  }, [settings.selectedProgram]);

  useEffect(() => {
    loadAwardsData();
  }, [favorites, settings.selectedProgram, selectedSeason]);

  const onRefresh = () => {
    setRefreshing(true);
    loadAwardsData();
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Unknown Date';
    try {
      const date = new Date(dateString);
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return 'Invalid Date';
      }
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch (error) {
      logger.debug('Date formatting error for "' + (dateString || 'Unknown') + '":', error);
      return 'Invalid Date';
    }
  };

  const handleQualificationPress = (awardId: string, qualifications: string[]) => {
    setSelectedQualifications(qualifications);
    if (showQualificationTooltip === awardId) {
      setShowQualificationTooltip(null);
    } else {
      setShowQualificationTooltip(awardId);
    }
  };

  const navigateToEvent = async (eventId: number, eventName?: string) => {
    try {
      logger.debug('Attempting to navigate to event ID:', eventId || 'Unknown', ', name:', eventName || 'Unknown');

      if (!eventId || eventId === 0) {
        logger.error('Invalid event ID:', eventId || 'Unknown');
        return;
      }

      logger.debug('Using helper function to fetch event for navigation');
      const eventForNavigation = await robotEventsAPI.getEventById(eventId);

      if (eventForNavigation) {
        logger.debug('Successfully found event:', eventForNavigation.name || 'Unknown');
        logger.debug('Event data for navigation:', {
          id: eventForNavigation.id,
          name: eventForNavigation.name,
          sku: eventForNavigation.sku,
          hasLocation: !!eventForNavigation.location,
          hasDivisions: eventForNavigation.divisions?.length > 0
        });
        navigation.navigate('EventMainView', { event: eventForNavigation });
      } else {
        logger.error('No event found for ID:', eventId || 'Unknown', 'using navigation helper');
        logger.debug('The event with ID', eventId || 'Unknown', 'may no longer exist or may be from a different season');

        // Could try searching by name as fallback if eventName is available
      }
    } catch (error) {
      logger.error('Failed to fetch event for navigation (ID', eventId || 'Unknown', '):', error);

      // The event might exist but there could be an API error
      // Log additional context to help debug
      logger.debug('Error context - Event ID:', eventId || 'Unknown', ', Event Name:', eventName || 'Unknown');
    }
  };

  const toggleTeamExpansion = (teamNumber: string) => {
    const newExpandedTeams = new Set(expandedTeams);
    if (newExpandedTeams.has(teamNumber)) {
      newExpandedTeams.delete(teamNumber);
    } else {
      newExpandedTeams.add(teamNumber);
    }
    setExpandedTeams(newExpandedTeams);
  };

  const renderAwardItem = (award: TeamAward) => {
    // Add safety checks for award data
    if (!award || !award.event) {
      logger.error('Invalid award data:', award);
      return null;
    }

    const hasQualifications = award.qualifications && Array.isArray(award.qualifications) && award.qualifications.length > 0;
    const eventId = award.event.id || 0;
    const awardId = award.id || 0;
    const tooltipKey = `${eventId}-${awardId}`;

    return (
      <View
        key={tooltipKey}
        style={[styles.awardCard, {
          backgroundColor: settings.cardBackgroundColor,
          borderColor: settings.borderColor,
        }]}
      >
        <View style={styles.awardHeader}>
          <View style={styles.awardInfo}>
            <Text style={[styles.awardTitle, { color: settings.textColor }]}>
              {award.title || 'Unknown Award'}
            </Text>
            <Text style={[styles.eventName, { color: settings.secondaryTextColor }]}>
              {award.event.name || 'Unknown Event'}
            </Text>
            <Text style={[styles.eventDate, { color: settings.secondaryTextColor }]}>
              {formatDate(award.event.start)}
            </Text>
          </View>
          <View style={styles.awardActions}>
            {hasQualifications && (
              <TouchableOpacity
                style={styles.qualificationButton}
                onPress={() => handleQualificationPress(tooltipKey, award.qualifications)}
              >
                <Ionicons name="globe" size={20} color="#4A90E2" />
              </TouchableOpacity>
            )}
            {eventId > 0 && (
              <TouchableOpacity
                style={styles.eventButton}
                onPress={() => navigateToEvent(eventId, award.event.name)}
              >
                <Ionicons name="calendar" size={20} color={settings.buttonColor} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Qualification Tooltip */}
        {showQualificationTooltip === tooltipKey && hasQualifications && (
          <View style={styles.tooltipContainer}>
            <View style={[styles.tooltip, { backgroundColor: settings.cardBackgroundColor, borderColor: settings.borderColor }]}>
              <View style={styles.tooltipArrow} />
              <View style={styles.tooltipHeader}>
                <Ionicons name="globe" size={16} color="#4A90E2" />
                <Text style={[styles.tooltipTitle, { color: settings.textColor }]}>Qualifies For:</Text>
              </View>
              {selectedQualifications.map((qualification, index) => (
                <Text key={index} style={[styles.tooltipText, { color: settings.textColor }]}>• {qualification}</Text>
              ))}
            </View>
          </View>
        )}
      </View>
    );
  };

  const renderTeamHeader = (teamData: TeamAwardData) => {
    const isExpanded = expandedTeams.has(teamData.teamNumber);

    return (
      <TouchableOpacity
        style={[styles.teamHeader, {
          backgroundColor: settings.cardBackgroundColor,
          borderColor: settings.borderColor,
        }]}
        onPress={() => toggleTeamExpansion(teamData.teamNumber)}
        activeOpacity={0.7}
      >
        <View style={styles.teamHeaderContent}>
          <View style={styles.teamInfo}>
            <Text style={[styles.teamNumber, { color: settings.textColor }]}>
              {teamData.teamNumber}
            </Text>
            <Text style={[styles.teamName, { color: settings.textColor }]}>
              {teamData.teamName}
            </Text>
          </View>
          <View style={styles.teamHeaderRight}>
            <Text style={[styles.awardCountText, { color: settings.secondaryTextColor }]}>
              {teamData.awards.length} award{teamData.awards.length !== 1 ? 's' : ''}
            </Text>
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={settings.iconColor}
              style={styles.chevronIcon}
            />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderTeamCard = (teamData: TeamAwardData) => {
    const isExpanded = expandedTeams.has(teamData.teamNumber);
    // Sort awards by event date (most recent first) and filter out any null/invalid awards
    const sortedAwards = [...teamData.awards]
      .filter(award => award && award.event) // Filter out invalid awards
      .sort((a, b) => {
        // Improved date sorting with better error handling
        try {
          const dateA = a.event.start ? new Date(a.event.start).getTime() : 0;
          const dateB = b.event.start ? new Date(b.event.start).getTime() : 0;

          if (isNaN(dateA) && isNaN(dateB)) return 0;
          // Put invalid dates at the end
          if (isNaN(dateA)) return 1;
          if (isNaN(dateB)) return -1;

          return dateB - dateA; // Most recent first
        } catch (error) {
          logger.error('Error sorting by date:', error);
          return 0; // Maintain original order if sorting fails
        }
      });

    return (
      <View key={teamData.teamNumber} style={styles.teamCardContainer}>
        {renderTeamHeader(teamData)}

        {isExpanded && (
          <View style={[styles.teamContent, {
            backgroundColor: settings.backgroundColor,
            borderColor: settings.borderColor,
          }]}>
            {sortedAwards.length === 0 ? (
              <View style={styles.noAwardsSection}>
                <Text style={[styles.noAwardsText, { color: settings.secondaryTextColor }]}>
                  No awards{selectedSeason && seasons.find(s => s.value === selectedSeason) ?
                    ` in ${seasons.find(s => s.value === selectedSeason)?.label}` : ' this season'}
                </Text>
              </View>
            ) : (
              <View style={styles.awardsSection}>
                {sortedAwards.map(renderAwardItem).filter(Boolean)}
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="trophy-outline" size={64} color={settings.secondaryTextColor} />
      <Text style={[styles.emptyTitle, { color: settings.textColor }]}>
        No Favorite Teams
      </Text>
      <Text style={[styles.emptySubtitle, { color: settings.secondaryTextColor }]}>
        Add some favorite teams to see their awards here
      </Text>
      <TouchableOpacity
        style={[styles.emptyButton, { backgroundColor: settings.buttonColor }]}
        onPress={() => {
          logger.debug('Find Teams button pressed');
          logger.debug('Navigation object:', navigation ? 'exists' : 'null');
          logger.debug('Navigation keys:', navigation ? Object.keys(navigation) : 'none');

          // Navigate to the Lookup tab with Teams tab selected
          try {
            logger.debug('Attempting nested navigation to Main -> Lookup');

            // Method 1: Navigate to the Main screen (TabNavigator) and specify the Lookup tab
            navigation.navigate('Main', {
              screen: 'Lookup',
              params: { initialTab: 'team' }
            });

            logger.debug('Navigation attempt completed');
          } catch (error) {
            logger.error('Navigation error:', error);

            try {
              logger.debug('Trying fallback navigation');
              if (navigation.getParent) {
                const parentNav = navigation.getParent();
                if (parentNav) {
                  parentNav.navigate('Lookup', { initialTab: 'team' });
                }
              }
            } catch (fallbackError) {
              logger.error('Fallback navigation also failed:', fallbackError);
            }
          }
        }}
      >
        <Text style={styles.emptyButtonText}>Find Teams</Text>
      </TouchableOpacity>
    </View>
  );

  const renderLoadingState = () => (
    <View style={styles.loadingState}>
      <ActivityIndicator size="large" color={settings.buttonColor} />
      <Text style={[styles.loadingText, { color: settings.secondaryTextColor }]}>
        Loading awards...
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: settings.backgroundColor }]}>
        {renderLoadingState()}
      </View>
    );
  }

  if (favoriteTeams.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: settings.backgroundColor }]}>
        {renderEmptyState()}
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: settings.backgroundColor }]}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={settings.buttonColor}
          />
        }
      >
        <View style={styles.content}>
          <Text style={[styles.pageTitle, { color: settings.textColor }]}>
            🏆 Favorited Teams Awards ({settings.selectedProgram.replace('Robotics Competition', '').trim()})
          </Text>
          <Text style={[styles.pageSubtitle, { color: settings.secondaryTextColor }]}>
            Awards from {selectedSeason && seasons.find(s => s.value === selectedSeason) ?
              seasons.find(s => s.value === selectedSeason)?.label : 'the current season'} for your favorite teams
          </Text>

          {awardsData.map(renderTeamCard)}
        </View>
      </ScrollView>

      {/* Tooltip overlay for click-outside dismissal */}
      {showQualificationTooltip && (
        <TouchableOpacity
          style={styles.tooltipOverlay}
          activeOpacity={1}
          onPress={() => setShowQualificationTooltip(null)}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  tooltipOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
  },
  content: {
    padding: 16,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  pageSubtitle: {
    fontSize: 16,
    marginBottom: 24,
    lineHeight: 22,
  },
  teamCardContainer: {
    marginBottom: 16,
  },
  teamHeader: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  teamHeaderContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  teamHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chevronIcon: {
    marginLeft: 8,
  },
  teamContent: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderTopWidth: 0,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    paddingTop: 0,
  },
  teamInfo: {
    flex: 1,
  },
  teamNumber: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  teamName: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 2,
  },
  awardCountText: {
    fontSize: 14,
    fontWeight: '500',
  },
  awardsSection: {
    gap: 12,
    padding: 16,
  },
  noAwardsSection: {
    alignItems: 'center',
    padding: 20,
  },
  noAwardsText: {
    fontSize: 16,
    fontStyle: 'italic',
  },
  awardCard: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    position: 'relative',
  },
  awardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  awardInfo: {
    flex: 1,
    marginRight: 12,
  },
  awardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  eventName: {
    fontSize: 14,
    marginBottom: 2,
  },
  eventDate: {
    fontSize: 12,
  },
  awardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qualificationButton: {
    padding: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(74, 144, 226, 0.1)',
  },
  eventButton: {
    padding: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
  },
  tooltipContainer: {
    position: 'absolute',
    top: 0,
    right: 0,
    zIndex: 1000,
    alignItems: 'flex-end',
  },
  tooltip: {
    borderRadius: 8,
    padding: 12,
    minWidth: 200,
    maxWidth: 280,
    borderWidth: 1,
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
    backgroundColor: 'inherit',
    borderLeftWidth: 1,
    borderTopWidth: 1,
    borderColor: 'inherit',
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
    marginLeft: 6,
  },
  tooltipText: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 2,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  emptyButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 24,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
});

export default AwardsScreen;