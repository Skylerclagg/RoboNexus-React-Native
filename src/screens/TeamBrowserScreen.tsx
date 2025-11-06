/**
 * TEAM BROWSER SCREEN
 *
 * Shows all registered teams for the current season with filtering and search.
 * This is a developer mode feature for exploring team distribution.
 *
 * NAVIGATION ACCESS:
 * - Developer mode only via Lookup
 *
 * KEY FEATURES:
 * - List view with search and filters similar to event lookup
 * - Search by team name or number
 * - Filter by region, state, country, grade level
 * - Link to individual team pages
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  FlatList,
  Alert,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../contexts/SettingsContext';
import { useFavorites } from '../contexts/FavoritesContext';
import { useTeams } from '../contexts/TeamsContext';
import { Team } from '../types';
import DropdownPicker from '../components/DropdownPicker';
import AnimatedScrollBar from '../components/AnimatedScrollBar';
import { getProgramId, getAvailableGrades } from '../utils/programMappings';

interface Props {
  navigation: any;
}

interface TeamFilters {
  season: string;
  region: string;
  country: string;
  gradeLevel: string;
  registeredOnly: boolean;
}

const TeamBrowserScreen: React.FC<Props> = ({ navigation }) => {
  const settings = useSettings();
  const { addTeam, removeTeam, isTeamFavorited } = useFavorites();
  const {
    getTeamsForProgramSeason,
    refreshTeams,
    isLoading: teamsLoading,
    isInitialLoad,
    lastUpdated,
    error: teamsError,
    loadingProgress,
    getAvailableRegions,
    getAvailableCountries,
    filterTeams
  } = useTeams();

  // Local UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [currentSeason, setCurrentSeason] = useState('');

  // Filter states
  const [filters, setFilters] = useState<TeamFilters>({
    season: '',
    region: '',
    country: '',
    gradeLevel: '',
    registeredOnly: true,
  });

  // Filter options
  const [seasons, setSeasons] = useState<{label: string, value: string}[]>([]);

  // Scroll tracking for AnimatedScrollBar
  const [scrollY, setScrollY] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const flatListRef = useRef<any>(null);

  // Computed data from context
  const allTeams = currentSeason ? getTeamsForProgramSeason(settings.selectedProgram, currentSeason) : [];
  const availableRegions = currentSeason ? getAvailableRegions(settings.selectedProgram, currentSeason) : [];
  const availableCountries = currentSeason ? getAvailableCountries(settings.selectedProgram, currentSeason) : [];

  // Apply client-side filtering
  const filteredTeams = React.useMemo(() => {
    const clientFilters = {
      search: searchQuery,
      region: filters.region,
      country: filters.country,
      gradeLevel: filters.gradeLevel,
      registeredOnly: filters.registeredOnly
    };
    return filterTeams(allTeams, clientFilters);
  }, [allTeams, searchQuery, filters, filterTeams]);

  // Search debouncing
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Loading state combines context loading and local search
  const loading = teamsLoading || isSearching;

  // Load seasons on mount
  useEffect(() => {
    loadSeasons();
  }, [settings.selectedProgram]);

  // Set default season when seasons load
  useEffect(() => {
    if (seasons.length > 0 && !currentSeason) {
      const defaultSeason = seasons[0]; // First season is usually current
      setCurrentSeason(defaultSeason.value);
      setFilters(prev => ({ ...prev, season: defaultSeason.value }));
    }
  }, [seasons]);

  // Update current season when filter changes
  useEffect(() => {
    if (filters.season && filters.season !== currentSeason) {
      setCurrentSeason(filters.season);
    }
  }, [filters.season]);

  // Header is now handled in App.tsx navigation configuration

  // Use centralized program mapping

  const loadSeasons = async () => {
    try {
      const programId = getProgramId(settings.selectedProgram);
      const { robotEventsAPI } = await import('../services/apiRouter');
      const seasonResponse = await robotEventsAPI.getSeasons({ program: [programId] });
      const seasonOptions = seasonResponse.data
        .sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime())
        .map(season => ({
          label: season.name,
          value: season.id.toString(),
        }));
      setSeasons(seasonOptions);
    } catch (error) {
      console.error('[TeamsMap] Error loading seasons:', error);
    }
  };

  // Manual refresh function
  const handleRefresh = async () => {
    if (currentSeason) {
      try {
        await refreshTeams(settings.selectedProgram, currentSeason);
      } catch (error) {
        console.error('[TeamsMap] Error refreshing teams:', error);
        Alert.alert('Error', 'Failed to refresh teams. Please try again.');
      }
    }
  };

  // No longer needed - filtering is handled by useMemo above

  // Debounced search
  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
    setIsSearching(true);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      setIsSearching(false);
    }, 300);
  }, []);

  // Handle filter changes
  const handleFilterChange = (key: keyof TeamFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const navigateToTeam = (teamNumber: string) => {
    navigation.navigate('TeamInfo', {
      teamNumber,
      teamData: null,
    });
  };

  const toggleFavorite = async (team: Team) => {
    try {
      if (isTeamFavorited(team.number || '')) {
        await removeTeam(team.number || '');
      } else {
        await addTeam(team);
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const renderTeamItem = ({ item: team }: { item: Team }) => {
    const isFavorited = isTeamFavorited(team.number || '');

    return (
      <TouchableOpacity
        style={[styles.teamCard, {
          backgroundColor: settings.cardBackgroundColor,
          borderColor: settings.borderColor,
        }]}
        onPress={() => navigateToTeam(team.number || '')}
      >
        <View style={styles.teamHeader}>
          <View style={styles.teamMainInfo}>
            <Text style={[styles.teamNumber, { color: settings.textColor }]}>
              {team.number}
            </Text>
            <Text style={[styles.teamName, { color: settings.textColor }]}>
              {team.team_name}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.favoriteButton}
            onPress={() => toggleFavorite(team)}
          >
            <Ionicons
              name={isFavorited ? 'heart' : 'heart-outline'}
              size={20}
              color={isFavorited ? '#FF3B30' : settings.secondaryTextColor}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.teamDetails}>
          {team.organization && (
            <Text style={[styles.teamOrg, { color: settings.secondaryTextColor }]} numberOfLines={1}>
              {team.organization}
            </Text>
          )}

          <View style={styles.teamLocationRow}>
            {team.location && (
              <>
                <Ionicons name="location-outline" size={14} color={settings.secondaryTextColor} />
                <Text style={[styles.teamLocation, { color: settings.secondaryTextColor }]} numberOfLines={1}>
                  {[
                    team.location.city,
                    team.location.region,
                    team.location.country
                  ].filter(Boolean).join(', ')}
                </Text>
              </>
            )}
          </View>

          {team.grade && (
            <View style={styles.teamGradeRow}>
              <Ionicons name="school-outline" size={14} color={settings.secondaryTextColor} />
              <Text style={[styles.teamGrade, { color: settings.secondaryTextColor }]}>
                {team.grade}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.teamFooter}>
          <Text style={[styles.registeredStatus, {
            color: team.registered ? '#34C759' : settings.secondaryTextColor
          }]}>
            {team.registered ? 'Registered' : 'Not Registered'}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={settings.secondaryTextColor} />
        </View>
      </TouchableOpacity>
    );
  };

  const renderMapView = () => (
    <View style={[styles.mapContainer, { backgroundColor: settings.backgroundColor }]}>
      <View style={styles.mapPlaceholder}>
        <Ionicons name="map" size={64} color={settings.secondaryTextColor} />
        <Text style={[styles.mapPlaceholderText, { color: settings.textColor }]}>
          Map View
        </Text>
        <Text style={[styles.mapPlaceholderSubtext, { color: settings.secondaryTextColor }]}>
          Coming soon - will show teams on an interactive map
        </Text>
      </View>
    </View>
  );

  const renderFiltersModal = () => (
    <View style={[styles.filtersModal, {
      backgroundColor: settings.backgroundColor,
      borderColor: settings.borderColor,
    }]}>
      <View style={styles.filtersHeader}>
        <Text style={[styles.filtersTitle, { color: settings.textColor }]}>Filters</Text>
        <TouchableOpacity onPress={() => setShowFilters(false)}>
          <Ionicons name="close" size={24} color={settings.textColor} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.filtersContent}>
        {/* Season Filter */}
        <View style={styles.filterSection}>
          <Text style={[styles.filterLabel, { color: settings.textColor }]}>Season</Text>
          <DropdownPicker
            options={seasons}
            selectedValue={filters.season}
            onValueChange={(value) => handleFilterChange('season', value)}
            placeholder="Select Season"
          />
        </View>

        {/* Region Filter */}
        <View style={styles.filterSection}>
          <Text style={[styles.filterLabel, { color: settings.textColor }]}>Region</Text>
          <DropdownPicker
            options={availableRegions.map(region => ({ label: region, value: region }))}
            selectedValue={filters.region}
            onValueChange={(value) => handleFilterChange('region', value)}
            placeholder="All Regions"
          />
        </View>

        {/* Country Filter */}
        <View style={styles.filterSection}>
          <Text style={[styles.filterLabel, { color: settings.textColor }]}>Country</Text>
          <DropdownPicker
            options={availableCountries.map(country => ({ label: country, value: country }))}
            selectedValue={filters.country}
            onValueChange={(value) => handleFilterChange('country', value)}
            placeholder="All Countries"
          />
        </View>

        {/* Grade Level Filter */}
        <View style={styles.filterSection}>
          <Text style={[styles.filterLabel, { color: settings.textColor }]}>Grade Level</Text>
          <DropdownPicker
            options={getAvailableGrades(settings.selectedProgram).map(grade => ({
              label: grade,
              value: grade
            }))}
            selectedValue={filters.gradeLevel}
            onValueChange={(value) => handleFilterChange('gradeLevel', value)}
            placeholder="All Grade Levels"
          />
        </View>

        {/* Registered Only Toggle */}
        <View style={styles.filterSection}>
          <View style={styles.switchRow}>
            <Text style={[styles.filterLabel, { color: settings.textColor }]}>Registered Teams Only</Text>
            <Switch
              value={filters.registeredOnly}
              onValueChange={(value) => handleFilterChange('registeredOnly', value)}
              trackColor={{ false: '#767577', true: settings.buttonColor }}
              thumbColor={filters.registeredOnly ? '#FFFFFF' : '#f4f3f4'}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );

  const renderContent = () => {
    if (loading) {
      return (
        <View style={[styles.container, styles.centered, { backgroundColor: settings.backgroundColor }]}>
          <ActivityIndicator size="large" color={settings.buttonColor} />
          <Text style={[styles.loadingText, { color: settings.secondaryTextColor }]}>
            Loading teams...
          </Text>
          <Text style={[styles.loadingSubtext, { color: settings.secondaryTextColor }]}>
            This may take a moment
          </Text>
        </View>
      );
    }

    if (viewMode === 'map') {
      return renderMapView();
    }

    return (
      <View style={{ flex: 1 }}>
        <FlatList
          ref={flatListRef}
          data={filteredTeams}
          keyExtractor={(item) => item.id?.toString() || item.number || ''}
          renderItem={renderTeamItem}
          style={styles.teamList}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.teamListContent}
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
          enabled={settings.scrollBarEnabled && settings.scrollBarTeamBrowser}
          scrollViewRef={flatListRef}
        />
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: settings.backgroundColor }]}>
      {/* Search Section - matching EventLookup pattern */}
      <View style={[styles.sectionCard, {
        backgroundColor: settings.cardBackgroundColor,
        borderColor: settings.borderColor,
        shadowColor: settings.colorScheme === 'dark' ? '#FFFFFF' : '#000000'
      }]}>
        <View style={styles.searchHeader}>
          <Text style={[styles.sectionTitle, { color: settings.textColor }]}>Team Search</Text>
          <View style={styles.headerActions}>
            {/* Last Updated Info */}
            {lastUpdated && !teamsLoading && (
              <Text style={[styles.lastUpdated, { color: settings.secondaryTextColor }]}>
                Updated {lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            )}

            {/* Refresh Button */}
            <TouchableOpacity
              style={[styles.refreshButton, { opacity: teamsLoading ? 0.5 : 1 }]}
              onPress={handleRefresh}
              disabled={teamsLoading}
            >
              <Ionicons
                name="refresh"
                size={18}
                color={settings.buttonColor}
                style={teamsLoading ? styles.spinning : undefined}
              />
            </TouchableOpacity>

            {/* View Mode Toggle */}
            {settings.isDeveloperMode && (
              <View style={styles.viewModeToggle}>
                <TouchableOpacity
                  style={[
                    styles.viewModeButton,
                    styles.viewModeLeft,
                    viewMode === 'list' && [styles.viewModeActive, { backgroundColor: settings.buttonColor }],
                    viewMode !== 'list' && [styles.viewModeInactive, { backgroundColor: 'rgba(128, 128, 128, 0.1)' }]
                  ]}
                  onPress={() => setViewMode('list')}
                >
                  <Ionicons
                    name="list"
                    size={16}
                    color={viewMode === 'list' ? '#FFFFFF' : settings.secondaryTextColor}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.viewModeButton,
                    styles.viewModeRight,
                    viewMode === 'map' && [styles.viewModeActive, { backgroundColor: settings.buttonColor }],
                    viewMode !== 'map' && [styles.viewModeInactive, { backgroundColor: 'rgba(128, 128, 128, 0.1)' }]
                  ]}
                  onPress={() => setViewMode('map')}
                >
                  <Ionicons
                    name="map"
                    size={16}
                    color={viewMode === 'map' ? '#FFFFFF' : settings.secondaryTextColor}
                  />
                </TouchableOpacity>
              </View>
            )}
            <TouchableOpacity
              style={styles.filterButton}
              onPress={() => setShowFilters(true)}
            >
              <Ionicons name="filter" size={20} color={settings.buttonColor} />
              <Text style={[styles.filterText, { color: settings.buttonColor }]}>Filters</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.searchInput, {
          backgroundColor: settings.backgroundColor,
          borderColor: settings.borderColor
        }]}>
          <Ionicons name="search" size={20} color={settings.iconColor} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchTextInput, { color: settings.textColor }]}
            value={searchQuery}
            onChangeText={handleSearchChange}
            placeholder="Search teams by name or number..."
            placeholderTextColor={settings.secondaryTextColor}
            returnKeyType="search"
            autoCorrect={false}
          />
          {isSearching && (
            <ActivityIndicator
              size="small"
              color={settings.buttonColor}
              style={styles.searchLoadingIndicator}
            />
          )}
        </View>

        {/* Results Summary */}
        {!loading && (
          <View style={styles.resultsRow}>
            <Text style={[styles.resultsText, { color: settings.secondaryTextColor }]}>
              {filteredTeams.length} of {allTeams.length} teams
              {searchQuery && ` matching "${searchQuery}"`}
            </Text>
            {teamsError && (
              <Text style={[styles.errorText, { color: '#FF3B30' }]}>
                Error: {teamsError}
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Teams Content - List or Map View */}
      <View style={styles.teamsContainer}>
        {renderContent()}
      </View>

      {/* Show loading progress during initial load */}
      {isInitialLoad && teamsLoading && (
        <View style={[styles.progressOverlay, { backgroundColor: 'rgba(0, 0, 0, 0.7)' }]}>
          <View style={[styles.progressCard, { backgroundColor: settings.cardBackgroundColor }]}>
            <ActivityIndicator size="large" color={settings.buttonColor} style={styles.progressIndicator} />
            <Text style={[styles.progressTitle, { color: settings.textColor }]}>Loading Teams</Text>
            <Text style={[styles.progressText, { color: settings.secondaryTextColor }]}>
              {loadingProgress.status}
            </Text>
            {loadingProgress.total > 0 && (
              <Text style={[styles.progressDetails, { color: settings.secondaryTextColor }]}>
                {loadingProgress.current} / {loadingProgress.total}
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Filters Modal */}
      {showFilters && (
        <View style={styles.modalOverlay}>
          {renderFiltersModal()}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerButtons: {
    flexDirection: 'row',
    marginRight: 8,
  },
  headerButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 4,
  },
  sectionCard: {
    borderRadius: 10,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  searchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  viewModeToggle: {
    flexDirection: 'row',
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(128, 128, 128, 0.3)',
  },
  viewModeButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewModeLeft: {
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  viewModeRight: {
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },
  viewModeActive: {
    // backgroundColor applied inline
  },
  viewModeInactive: {
    // backgroundColor applied inline
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  filterText: {
    marginLeft: 4,
    fontSize: 14,
    fontWeight: '500',
  },
  searchInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 2,
    borderWidth: 1,
    minHeight: 44,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchTextInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 8,
  },
  searchLoadingIndicator: {
    marginLeft: 8,
  },
  resultsRow: {
    marginTop: 8,
  },
  resultsText: {
    fontSize: 14,
  },
  teamList: {
    flex: 1,
  },
  teamListContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  teamsContainer: {
    flex: 1,
  },
  teamCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  teamHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  teamMainInfo: {
    flex: 1,
  },
  teamNumber: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  teamName: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 2,
  },
  favoriteButton: {
    padding: 4,
  },
  teamDetails: {
    marginBottom: 8,
  },
  teamOrg: {
    fontSize: 14,
    marginBottom: 4,
  },
  teamLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  teamLocation: {
    fontSize: 14,
    marginLeft: 4,
    flex: 1,
  },
  teamGradeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  teamGrade: {
    fontSize: 14,
    marginLeft: 4,
  },
  teamFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  registeredStatus: {
    fontSize: 14,
    fontWeight: '500',
  },
  mapContainer: {
    flex: 1,
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  mapPlaceholderText: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
  },
  mapPlaceholderSubtext: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 8,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filtersModal: {
    width: '90%',
    maxHeight: '80%',
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: 'white',
  },
  filtersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  filtersTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  filtersContent: {
    maxHeight: 400,
  },
  filterSection: {
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E5',
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  loadingSubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  lastUpdated: {
    fontSize: 12,
    marginRight: 8,
  },
  refreshButton: {
    padding: 4,
    marginRight: 8,
  },
  spinning: {
    // Add animation in React Native Reanimated if needed
  },
  errorText: {
    fontSize: 12,
    marginTop: 4,
  },
  progressOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  progressCard: {
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    minWidth: 200,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  progressIndicator: {
    marginBottom: 16,
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  progressText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 4,
  },
  progressDetails: {
    fontSize: 12,
    textAlign: 'center',
  },
});

export default TeamBrowserScreen;