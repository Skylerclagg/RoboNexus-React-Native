/**
 * Event Teams Screen
 *
 * Description:
 * Displays all teams participating in a specific VEX robotics event, with support
 * for division filtering, team search, and favorites management. Provides team
 * details and quick access to individual team information and statistics.
 *
 * Navigation:
 * Accessed from event detail screens or division screens when users want to
 * view all participating teams in a competition.
 *
 * Key Features:
 * - Complete team listings for events with search functionality
 * - Division-based filtering for multi-division events
 * - Favorites management (add/remove teams from favorites)
 * - Team information display with location details
 * - Export functionality for team data
 * - Navigation to individual team detail screens
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  ActionSheetIOS,
  Platform,
} from 'react-native';
import { RouteProp, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../contexts/SettingsContext';
import { useFavorites } from '../contexts/FavoritesContext';
import { robotEventsAPI } from '../services/apiRouter';
import { Event, Team, Division } from '../types';
import { DataExporter } from '../utils/dataExporter';
import DataExportModal from '../components/DataExportModal';
import { getProgramId } from '../utils/programMappings';

type EventTeamsScreenRouteProp = RouteProp<
  {
    EventTeams: {
      event: Event;
      division?: Division;
    };
  },
  'EventTeams'
>;

type EventTeamsScreenNavigationProp = StackNavigationProp<any>;

interface Props {
  route: EventTeamsScreenRouteProp;
  navigation: EventTeamsScreenNavigationProp;
}

interface TeamListItem {
  id: number;
  number: string;
  name: string;
  location: string;
}

const EventTeamsScreen = ({ route, navigation }: Props) => {
  const { event, division } = route.params;
  const settings = useSettings();
  const { addTeam, removeTeam, isTeamFavorited } = useFavorites();

  const [teams, setTeams] = useState<TeamListItem[]>([]);
  const [filteredTeams, setFilteredTeams] = useState<TeamListItem[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ current: number; total: number } | undefined>(undefined);
  const [fullTeamsData, setFullTeamsData] = useState<Team[]>([]);
  const [teamNumberQuery, setTeamNumberQuery] = useState('');
  const [showLoading, setShowLoading] = useState(true);
  const [showExportModal, setShowExportModal] = useState(false);

  const handleExportModalOpen = () => {
    if (fullTeamsData.length === 0) {
      Alert.alert('No Data', 'No teams available to export');
      return;
    }
    setShowExportModal(true);
  };

  const handleExport = async (selectedFields: { [key: string]: boolean }, exportScope: 'event' | 'season') => {
    setIsExporting(true);
    setExportProgress({ current: 0, total: 0 });

    try {
      const teamsToExport = fullTeamsData;
      const exportEventName = event.name;
      const exportDivisionName = division?.name || 'All Divisions';

      console.log(`[EventTeams] Exporting ${teamsToExport.length} teams from ${exportEventName}`);
      console.log(`[EventTeams] Export scope: ${exportScope}`);

      // Initialize progress with total
      setExportProgress({ current: 0, total: teamsToExport.length });

      const exportData = {
        teams: teamsToExport,
        eventName: exportEventName,
        eventDate: event.start,
        divisionName: exportDivisionName,
        eventId: exportScope === 'event' ? event.id : undefined,
        divisionId: division?.id,
        seasonId: event.season.id
      };

      await DataExporter.exportTeamsWithStatsToCSV(
        exportData,
        { selectedFields },
        (current, total) => {
          console.log(`[EventTeams] Exporting team ${current} of ${total}`);
          setExportProgress({ current, total });
        }
      );

      setShowExportModal(false);
      Alert.alert('Success', `Exported data for ${teamsToExport.length} teams successfully!`);
    } catch (error) {
      console.error('Export error:', error);
      setShowExportModal(false);
      Alert.alert(
        'Export Failed',
        error instanceof Error ? error.message : 'An unknown error occurred'
      );
    } finally {
      setIsExporting(false);
      setExportProgress(undefined);
    }
  };

  useEffect(() => {
    navigation.setOptions({
      title: division ? `${division.name} Teams` : 'Event Teams',
      headerStyle: {
        backgroundColor: settings.topBarColor,
      },
      headerTintColor: settings.topBarContentColor,
      headerTitleStyle: {
        fontWeight: '500',
        fontSize: 19,
      },
      headerRight: () => (
        <TouchableOpacity
          style={styles.headerButton}
          onPress={handleExportModalOpen}
          disabled={isExporting}
        >
          <Ionicons
            name={isExporting ? "hourglass-outline" : "download"}
            size={24}
            color={isExporting ? "#999" : settings.topBarContentColor}
          />
        </TouchableOpacity>
      ),
    });
  }, [division, settings.topBarColor, settings.topBarContentColor, handleExportModalOpen, isExporting]);

  const generateLocation = (team: Team): string => {
    const locationArray = [team.location?.city, team.location?.region, team.location?.country]
      .filter(item => item && item.trim() !== '');
    return locationArray.join(', ');
  };

  const fetchEventTeams = async () => {
    try {
      setShowLoading(true);

      // Fetch real event teams data from API
      const eventTeamsResponse = await robotEventsAPI.getEventTeams(event.id);

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

      let teamsToDisplay = uiTeams;

      // Using the same logic as Swift: try rankings first, then matches, then all teams
      if (division) {
        try {
          console.log(`Fetching division rankings to filter teams for division: ${division.name}`);

          // Fetch division rankings to get list of teams in this division
          const rankingsResponse = await robotEventsAPI.getEventDivisionRankings(event.id, division.id);
          const rankings = rankingsResponse.data;

          if (rankings && rankings.length > 0) {
            // Get set of team IDs that are in this division's rankings
            const divisionTeamIds = new Set(rankings.map((ranking: any) => ranking.team.id));

            console.log(`Division ${division.name} has ${divisionTeamIds.size} teams in rankings`);

            // Filter teams to only those in the division rankings
            teamsToDisplay = uiTeams.filter(team => divisionTeamIds.has(team.id));

            console.log(`Filtered from ${uiTeams.length} total teams to ${teamsToDisplay.length} division teams`);
          } else {
            console.log(`No rankings found for division ${division.name}, falling back to matches`);

            // Fall back to using matches if rankings are empty
            try {
              const matchesResponse = await robotEventsAPI.getEventDivisionMatches(event.id, division.id);
              const matches = matchesResponse.data;

              // Extract unique team IDs from all matches
              const divisionTeamIds = new Set<number>();
              matches.forEach((match: any) => {
                // Add teams from both alliances
                match.alliances?.forEach((alliance: any) => {
                  alliance.teams?.forEach((team: any) => {
                    if (team.team?.id) {
                      divisionTeamIds.add(team.team.id);
                    }
                  });
                });
              });

              console.log(`Division ${division.name} has ${divisionTeamIds.size} teams from matches`);
              teamsToDisplay = uiTeams.filter(team => divisionTeamIds.has(team.id));
            } catch (matchError) {
              console.error('Failed to fetch division matches, showing all teams:', matchError);
            }
          }
        } catch (error) {
          console.error('Failed to fetch division data for filtering, showing all teams:', error);
        }
      }

      setFullTeamsData(teamsToDisplay);

      const teamListItems: TeamListItem[] = teamsToDisplay.map(team => ({
        id: team.id,
        number: team.number,
        name: team.team_name || '',
        location: generateLocation(team),
      }));

      // Sort teams by number (numeric sort)
      teamListItems.sort((a, b) => {
        const numA = parseInt(a.number.replace(/\D/g, '')) || 0;
        const numB = parseInt(b.number.replace(/\D/g, '')) || 0;
        return numA - numB;
      });

      setTeams(teamListItems);
      setFilteredTeams(teamListItems);
    } catch (error) {
      console.error('Failed to fetch event teams:', error);
      Alert.alert('Error', 'Failed to load event teams. Please try again.');
    } finally {
      setShowLoading(false);
    }
  };

  useEffect(() => {
    fetchEventTeams();
  }, [event.id, division]);

  // Refresh data when tab becomes focused
  useFocusEffect(
    React.useCallback(() => {
      fetchEventTeams();
    }, [event.id, division])
  );

  useEffect(() => {
    if (teamNumberQuery.trim() === '') {
      setFilteredTeams(teams);
    } else {
      const filtered = teams.filter(team =>
        team.number.toLowerCase().includes(teamNumberQuery.toLowerCase()) ||
        team.name.toLowerCase().includes(teamNumberQuery.toLowerCase())
      );
      setFilteredTeams(filtered);
    }
  }, [teamNumberQuery, teams]);

  const navigateToTeamView = (teamNumber: string) => {
    // Find the full team data to pass along
    const fullTeam = fullTeamsData.find(team => team.number === teamNumber);

    if (fullTeam) {
      navigation.navigate('EventTeamView', {
        event,
        teamNumber,
        teamData: fullTeam,
        division,
      });
    } else {
      Alert.alert('Error', 'Team data not found');
    }
  };

  const handleTeamFavorite = async (teamNumber: string) => {
    try {
      if (isTeamFavorited(teamNumber)) {
        await removeTeam(teamNumber);
      } else {
        // Find the full team data from the stored teams
        const fullTeam = fullTeamsData.find(team => team.number === teamNumber);
        if (fullTeam) {
          await addTeam(fullTeam, event.id);
        }
      }
    } catch (error) {
      console.error('Failed to toggle team favorite:', error);
      Alert.alert('Error', 'Failed to update favorite status');
    }
  };

  const renderCompactTeamItem = ({ item }: { item: TeamListItem }) => {
    const isFavorite = isTeamFavorited(item.number);

    return (
      <TouchableOpacity
        style={[styles.compactTeamItem, {
          backgroundColor: settings.cardBackgroundColor,
          borderColor: settings.borderColor,
        }]}
        onPress={() => navigateToTeamView(item.number)}
      >
        <View style={styles.compactTeamRow}>
          <Text style={[styles.compactTeamNumber, { color: settings.buttonColor }]}>{item.number}</Text>
          <Text style={[styles.compactDash, { color: settings.secondaryTextColor }]}>-</Text>
          <Text style={[styles.compactTeamName, { color: settings.textColor }]} numberOfLines={1}>
            {item.name || 'Unknown Team'}
          </Text>
          {isFavorite && (
            <Ionicons name="heart" size={16} color="#FF6B6B" />
          )}
        </View>
        {item.location && (
          <View style={styles.compactTeamInfoRow}>
            <Ionicons name="location-outline" size={12} color={settings.secondaryTextColor} />
            <Text style={[styles.compactLocation, { color: settings.secondaryTextColor }]} numberOfLines={1}>
              {item.location}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderTeamItem = ({ item }: { item: TeamListItem }) => (
    <TouchableOpacity
      style={[styles.teamItem, {
        backgroundColor: settings.cardBackgroundColor,
        borderColor: settings.borderColor,
        shadowColor: settings.colorScheme === 'dark' ? '#FFFFFF' : '#000000'
      }]}
      onPress={() => navigateToTeamView(item.number)}
      activeOpacity={0.7}
    >
      {/* Top Row: Team Number, Name, and Actions */}
      <View style={styles.teamHeader}>
        <View style={styles.teamHeaderLeft}>
          <View style={[styles.teamNumberBadge, {
            backgroundColor: settings.buttonColor + '15',
            borderColor: settings.buttonColor + '30'
          }]}>
            <Text style={[styles.teamNumber, { color: settings.buttonColor }]}>{item.number}</Text>
          </View>
          {item.name ? (
            <Text style={[styles.teamName, { color: settings.textColor }]} numberOfLines={1}>
              {item.name}
            </Text>
          ) : null}
        </View>
        <View style={styles.teamActions}>
          <TouchableOpacity
            style={styles.favoriteButton}
            onPress={(e) => {
              e.stopPropagation();
              handleTeamFavorite(item.number);
            }}
          >
            <Ionicons
              name={isTeamFavorited(item.number) ? "heart" : "heart-outline"}
              size={22}
              color={isTeamFavorited(item.number) ? "#FF6B6B" : settings.iconColor}
            />
          </TouchableOpacity>
          <Ionicons name="chevron-forward" size={20} color={settings.iconColor} />
        </View>
      </View>

      {/* Bottom Row: Location */}
      {item.location ? (
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={14} color={settings.secondaryTextColor} style={styles.locationIcon} />
          <Text style={[styles.teamLocation, { color: settings.secondaryTextColor }]} numberOfLines={1}>
            {item.location}
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );

  const renderEmptyComponent = () => (
    <View style={styles.emptyContainer}>
      <View style={[styles.emptyIconContainer, { backgroundColor: settings.borderColor }]}>
        <Ionicons name="people-outline" size={50} color={settings.iconColor} />
      </View>
      <Text style={[styles.emptyText, { color: settings.textColor }]}>No Teams Found</Text>
      <Text style={[styles.emptySubtext, { color: settings.secondaryTextColor }]}>
        {teamNumberQuery ? 'No teams match your search criteria.\nTry adjusting your search terms.' : 'No teams are registered for this\nevent or division.'}
      </Text>
    </View>
  );

  if (showLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: settings.backgroundColor }]}>
        <ActivityIndicator size="large" color={settings.buttonColor} />
        <Text style={[styles.loadingText, { color: settings.textColor }]}>Loading teams...</Text>
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
            placeholder="Enter a team number or name..."
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
      </View>

      <FlatList
        data={filteredTeams}
        renderItem={settings.compactViewTeams ? renderCompactTeamItem : renderTeamItem}
        keyExtractor={(item) => item.id.toString()}
        ListEmptyComponent={renderEmptyComponent}
        contentContainerStyle={filteredTeams.length === 0 ? styles.emptyList : undefined}
        showsVerticalScrollIndicator={false}
      />

      <DataExportModal
        visible={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExport={handleExport}
        eventName={event.name}
        seasonName={event.season?.name}
        isExporting={isExporting}
        exportProgress={exportProgress}
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
    marginTop: 16,
    fontSize: 16,
  },
  headerButton: {
    marginRight: 16,
  },
  searchContainer: {
    padding: 16,
    paddingBottom: 12,
  },
  searchInputContainer: {
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
  teamItem: {
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 16,
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
    padding: 16,
    paddingBottom: 8,
  },
  teamHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  teamNumberBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 75,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamNumber: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  teamName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginLeft: 12,
  },
  teamActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  favoriteButton: {
    padding: 8,
    marginRight: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 0,
  },
  locationIcon: {
    marginRight: 6,
  },
  teamLocation: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
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
  compactTeamItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 10,
    marginHorizontal: 16,
    marginVertical: 4,
    borderWidth: 1,
  },
  compactTeamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  compactTeamNumber: {
    fontSize: 14,
    fontWeight: '700',
  },
  compactDash: {
    fontSize: 14,
  },
  compactTeamName: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  compactTeamInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  compactLocation: {
    fontSize: 12,
    flex: 1,
  },
});

export default EventTeamsScreen;