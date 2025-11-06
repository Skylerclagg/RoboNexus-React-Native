/**
 * TEAM BROWSER CONTENT COMPONENT
 *
 * Content component for the Team Browser that can be used within the Lookup tab.
 * This contains all the team browser functionality without navigation setup.
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
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../contexts/SettingsContext';
import { useFavorites } from '../contexts/FavoritesContext';
import { useTeams } from '../contexts/TeamsContext';
import { Team } from '../types';
import DropdownPicker from './DropdownPicker';
import AnimatedScrollBar from './AnimatedScrollBar';
import { getProgramId, getAvailableGrades } from '../utils/programMappings';

interface Props {
  navigation?: any;
  viewMode?: 'list' | 'map';
}

interface TeamFilters {
  region: string;
  country: string;
  gradeLevel: string;
  registeredOnly: boolean;
}

const TeamBrowserContent: React.FC<Props> = ({ navigation, viewMode = 'list' }) => {
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
    getRegionsByCountry,
    filterTeams
  } = useTeams();

  // Local UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [currentSeason, setCurrentSeason] = useState('');

  // Filter states
  const [filters, setFilters] = useState<TeamFilters>({
    region: '',
    country: '',
    gradeLevel: '',
    registeredOnly: false, // Default to showing all teams
  });

  // Local filters for modal (like EventFiltersModal)
  const [localFilters, setLocalFilters] = useState<TeamFilters>(filters);

  // Scroll tracking for AnimatedScrollBar
  const [scrollY, setScrollY] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const flatListRef = useRef<any>(null);

  // Update local filters when main filters change
  React.useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  // Filter options
  const [seasons, setSeasons] = useState<{label: string, value: string}[]>([]);

  // Computed data from context
  const allTeams = currentSeason ? getTeamsForProgramSeason(settings.selectedProgram, currentSeason) : [];
  const rawAvailableRegions = currentSeason ? getAvailableRegions(settings.selectedProgram, currentSeason) : [];
  const rawAvailableCountries = currentSeason ? getAvailableCountries(settings.selectedProgram, currentSeason) : [];
  const regionsByCountryMap = currentSeason ? getRegionsByCountry(settings.selectedProgram, currentSeason) : {};

  // Get filtered regions based on selected country (like EventFiltersModal)
  const getFilteredRegions = () => {
    if (!localFilters.country || !regionsByCountryMap) {
      const uniqueRegions = [...new Set(rawAvailableRegions)].sort();
      return [
        { label: 'All Regions', value: '' },
        ...uniqueRegions.map(region => ({ label: region, value: region }))
      ];
    }

    // Get regions for the selected country
    const regionsForCountry = regionsByCountryMap[localFilters.country] || [];
    return [
      { label: 'All Regions', value: '' },
      ...regionsForCountry.map(region => ({ label: region, value: region }))
    ];
  };

  // Deduplicate and format for DropdownPicker
  const availableRegions = React.useMemo(() => {
    return getFilteredRegions();
  }, [rawAvailableRegions, localFilters.country, regionsByCountryMap]);

  const availableCountries = React.useMemo(() => {
    const uniqueCountries = [...new Set(rawAvailableCountries)].sort();
    return [
      { label: 'All Countries', value: '' },
      ...uniqueCountries.map(country => ({ label: country, value: country }))
    ];
  }, [rawAvailableCountries]);

  // Generate grade options based on selected program
  const gradeOptions = React.useMemo(() => {
    const availableGrades = getAvailableGrades(settings.selectedProgram);
    return [
      { label: 'All Grade Levels', value: '' },
      ...availableGrades.map(grade => ({ label: grade, value: grade }))
    ];
  }, [settings.selectedProgram]);

  // Apply client-side filtering (excluding search)
  const baseFilteredTeams = React.useMemo(() => {
    const clientFilters = {
      region: filters.region,
      country: filters.country,
      gradeLevel: filters.gradeLevel,
      registeredOnly: filters.registeredOnly
    };
    return filterTeams(allTeams, clientFilters);
  }, [allTeams, filters, filterTeams]);

  // Apply search on top of the filtered teams
  const filteredTeams = React.useMemo(() => {
    if (!searchQuery.trim()) {
      return baseFilteredTeams;
    }

    const searchLower = searchQuery.toLowerCase();
    return baseFilteredTeams.filter(team =>
      team.number?.toLowerCase().includes(searchLower) ||
      team.team_name?.toLowerCase().includes(searchLower) ||
      team.organization?.toLowerCase().includes(searchLower) ||
      team.location?.city?.toLowerCase().includes(searchLower) ||
      team.location?.region?.toLowerCase().includes(searchLower) ||
      team.location?.country?.toLowerCase().includes(searchLower)
    );
  }, [baseFilteredTeams, searchQuery]);

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
    }
  }, [seasons]);

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
      console.error('[TeamsMapContent] Error loading seasons:', error);
    }
  };

  // Manual refresh function
  const handleRefresh = async () => {
    if (currentSeason) {
      try {
        await refreshTeams(settings.selectedProgram, currentSeason);
      } catch (error) {
        console.error('[TeamsMapContent] Error refreshing teams:', error);
        Alert.alert('Error', 'Failed to refresh teams. Please try again.');
      }
    }
  };

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

  // Handle filter changes (for local state)
  const handleLocalFilterChange = (key: keyof TeamFilters, value: any) => {
    setLocalFilters(prev => {
      const newFilters = { ...prev, [key]: value };

      if (key === 'country') {
        newFilters.region = '';
      }

      return newFilters;
    });
  };

  // Apply filters (like EventFiltersModal)
  const applyFilters = () => {
    console.log('[TeamsMapContent] Applying filters:', localFilters);
    setFilters(localFilters);
    setShowFilters(false);
  };

  // Clear filters (like EventFiltersModal)
  const clearFilters = () => {
    const clearedFilters: TeamFilters = {
      region: '',
      country: '',
      gradeLevel: '',
      registeredOnly: false, // Default to showing all teams
    };
    setLocalFilters(clearedFilters);
    setFilters(clearedFilters);
  };

  const navigateToTeam = (teamNumber: string) => {
    navigation?.navigate('TeamInfo', {
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
            <Text style={[styles.teamName, { color: settings.textColor }]} numberOfLines={1}>
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
    <Modal
      visible={showFilters}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowFilters(false)}
    >
      <View style={[styles.container, { backgroundColor: settings.backgroundColor }]}>
        {/* Modern Header */}
        <View style={[styles.header, {
          backgroundColor: settings.cardBackgroundColor,
          borderBottomColor: settings.borderColor,
          shadowColor: settings.colorScheme === 'dark' ? '#FFFFFF' : '#000000'
        }]}>
          <TouchableOpacity onPress={() => setShowFilters(false)} style={styles.headerButton}>
            <Ionicons name="close" size={24} color={settings.iconColor} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: settings.textColor }]}>Team Filters</Text>
          <TouchableOpacity onPress={applyFilters} style={[styles.applyHeaderButton, { backgroundColor: settings.buttonColor }]}>
            <Text style={styles.applyHeaderButtonText}>Apply</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Region Filter Card */}
          <View style={[styles.modernFilterCard, {
            backgroundColor: settings.cardBackgroundColor,
            borderColor: settings.borderColor,
            shadowColor: settings.colorScheme === 'dark' ? '#FFFFFF' : '#000000'
          }]}>
            <View style={styles.filterHeader}>
              <Ionicons name="location-outline" size={20} color={settings.buttonColor} />
              <Text style={[styles.modernFilterTitle, { color: settings.textColor }]}>Region</Text>
            </View>
            <DropdownPicker
              options={availableRegions}
              selectedValue={localFilters.region}
              onValueChange={(value) => handleLocalFilterChange('region', value)}
              placeholder="All Regions"
            />
          </View>

          {/* Country Filter Card */}
          <View style={[styles.modernFilterCard, {
            backgroundColor: settings.cardBackgroundColor,
            borderColor: settings.borderColor,
            shadowColor: settings.colorScheme === 'dark' ? '#FFFFFF' : '#000000'
          }]}>
            <View style={styles.filterHeader}>
              <Ionicons name="globe-outline" size={20} color={settings.buttonColor} />
              <Text style={[styles.modernFilterTitle, { color: settings.textColor }]}>Country</Text>
            </View>
            <DropdownPicker
              options={availableCountries}
              selectedValue={localFilters.country}
              onValueChange={(value) => handleLocalFilterChange('country', value)}
              placeholder="All Countries"
            />
          </View>

          {/* Grade Level Filter Card */}
          <View style={[styles.modernFilterCard, {
            backgroundColor: settings.cardBackgroundColor,
            borderColor: settings.borderColor,
            shadowColor: settings.colorScheme === 'dark' ? '#FFFFFF' : '#000000'
          }]}>
            <View style={styles.filterHeader}>
              <Ionicons name="school-outline" size={20} color={settings.buttonColor} />
              <Text style={[styles.modernFilterTitle, { color: settings.textColor }]}>Grade Level</Text>
            </View>
            <DropdownPicker
              options={gradeOptions}
              selectedValue={localFilters.gradeLevel}
              onValueChange={(value) => handleLocalFilterChange('gradeLevel', value)}
              placeholder="All Grade Levels"
            />
          </View>

          {/* Registered Only Toggle Card */}
          <View style={[styles.modernFilterCard, {
            backgroundColor: settings.cardBackgroundColor,
            borderColor: settings.borderColor,
            shadowColor: settings.colorScheme === 'dark' ? '#FFFFFF' : '#000000'
          }]}>
            <View style={styles.modernSwitchRow}>
              <View style={styles.switchIconAndInfo}>
                <Ionicons name="checkmark-circle-outline" size={20} color={settings.buttonColor} />
                <View style={styles.switchTextInfo}>
                  <Text style={[styles.modernFilterTitle, { color: settings.textColor }]}>Registered Teams Only</Text>
                  <Text style={[styles.modernFilterDescription, { color: settings.secondaryTextColor }]}>Filter to show only registered teams</Text>
                </View>
              </View>
              <Switch
                value={localFilters.registeredOnly}
                onValueChange={(value) => handleLocalFilterChange('registeredOnly', value)}
                trackColor={{ false: '#767577', true: settings.buttonColor }}
                thumbColor={localFilters.registeredOnly ? '#FFFFFF' : '#f4f3f4'}
              />
            </View>
          </View>

          {/* Clear Filters Button */}
          <TouchableOpacity
            style={[styles.clearButton, { borderColor: settings.borderColor }]}
            onPress={clearFilters}
          >
            <Ionicons name="refresh-outline" size={20} color={settings.secondaryTextColor} />
            <Text style={[styles.clearButtonText, { color: settings.secondaryTextColor }]}>Clear All Filters</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );

  const renderContent = () => {
    if (loading && filteredTeams.length === 0) {
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
      {/* Search Section */}
      <View style={[styles.sectionCard, {
        backgroundColor: settings.cardBackgroundColor,
        borderColor: settings.borderColor,
        shadowColor: settings.colorScheme === 'dark' ? '#FFFFFF' : '#000000'
      }]}>
        <View style={styles.searchHeader}>
          <Text style={[styles.sectionTitle, { color: settings.textColor }]}>Team Search</Text>
          <View style={styles.headerActions}>
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

        {/* Simplified Results Summary */}
        {!loading && (
          <View style={styles.resultsRow}>
            <Text style={[styles.resultsText, { color: settings.secondaryTextColor }]}>
              {filteredTeams.length} teams
              {searchQuery && ` matching "${searchQuery}"`}
              {filters.region && ` in ${filters.region}`}
              {filters.country && ` in ${filters.country}`}
              {filters.gradeLevel && ` (${filters.gradeLevel})`}
              {filters.registeredOnly && ` (registered only)`}
            </Text>
            {teamsError && (
              <Text style={[styles.errorText, { color: '#FF3B30' }]}>
                Error: {teamsError}
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Teams Content */}
      <View style={styles.teamsContainer}>
        {renderContent()}
      </View>

      {/* Filters Modal */}
      {renderFiltersModal()}

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
  refreshButton: {
    padding: 4,
    marginRight: 8,
  },
  resultsRow: {
    marginTop: 8,
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
  resultsText: {
    fontSize: 14,
    fontWeight: '500',
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  headerButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  applyHeaderButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  applyHeaderButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  modernFilterCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  modernFilterTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  modernSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchIconAndInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  switchTextInfo: {
    marginLeft: 8,
    flex: 1,
  },
  modernFilterDescription: {
    fontSize: 14,
    marginTop: 2,
    lineHeight: 18,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  clearButtonText: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
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

export default TeamBrowserContent;