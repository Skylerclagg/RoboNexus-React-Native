/**
 * WORLD SKILLS SCREEN
 *
 * Global World Skills rankings screen showing top-performing teams worldwide.
 * Displays programming, driver, and combined skills scores with filtering options.
 *
 * NAVIGATION ACCESS:
 * - Dashboard tab → Rankings button
 * - Main tab navigator (Rankings tab)
 * - Team screens → Skills ranking links
 *
 * KEY FEATURES:
 * - Global World Skills rankings by season and division
 * - Search and filter by team, region, or country
 * - Programming vs Driver vs Combined score views
 * - Season and grade level filtering
 * - Direct navigation to team details
 * - Real-time data updates
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Linking,
  Alert,
  TextInput,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { robotEventsAPI } from '../services/apiRouter';
import { useSettings } from '../contexts/SettingsContext';
import { useDataCache } from '../contexts/DataCacheContext';
import { useFavorites } from '../contexts/FavoritesContext';
import { WorldSkillsResponse } from '../types';
import WorldSkillsFiltersModal from '../components/WorldSkillsFiltersModal';
import WorldSkillsRankingSkeleton from '../components/WorldSkillsRankingSkeleton';
import AnimatedScrollBar from '../components/AnimatedScrollBar';
import {
  getProgramId,
  programHasWorldSkills,
  getSkillsTypes,
  getCompetitionType,
  getAvailableGrades,
  GradeLevel
} from '../utils/programMappings';

type DivisionType = 'High School' | 'Middle School' | 'Elementary' | 'College';

// Extended WorldSkillsResponse with filtering properties
interface ExtendedWorldSkillsResponse extends WorldSkillsResponse {
  originalRank?: number;
  displayRank?: number;
  showOriginalRank?: boolean;
}

interface Props {
  navigation: any;
}

const WorldSkillsScreen: React.FC<Props> = ({ navigation }) => {
  const settings = useSettings();
  const { selectedProgram, globalSeasonEnabled, selectedSeason: globalSeason, updateGlobalSeason } = settings;
  const { addTeam, removeTeam, isTeamFavorited } = useFavorites();
  const { getWorldSkills, preloadWorldSkills, forceRefreshWorldSkills } = useDataCache();

  // Get available divisions based on the selected program using centralized config
  const getAvailableDivisions = (): DivisionType[] => {
    return getAvailableGrades(selectedProgram) as DivisionType[];
  };

  // Get skills information using format-aware system
  const skillsTypes = getSkillsTypes(selectedProgram);
  const competitionType = getCompetitionType(selectedProgram);
  const hasWorldSkills = programHasWorldSkills(selectedProgram);

  const availableDivisions = getAvailableDivisions();
  const [selectedDivision, setSelectedDivision] = useState<DivisionType>(availableDivisions[0]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rankings, setRankings] = useState<ExtendedWorldSkillsResponse[]>([]);
  const [currentSeason, setCurrentSeason] = useState<number>(181);
  const [searchText, setSearchText] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('');
  const [seasons, setSeasons] = useState<{label: string, value: string}[]>([]);
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [worldSkillsFilters, setWorldSkillsFilters] = useState({
    season: (globalSeasonEnabled && globalSeason) ? globalSeason : '',
    region: '',
  });
  const [availableRegions, setAvailableRegions] = useState<{label: string, value: string}[]>([]);
  const searchInputRef = useRef<TextInput>(null);

  // Scroll tracking for AnimatedScrollBar
  const [scrollY, setScrollY] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const flatListRef = useRef<any>(null);

  // Filter rankings based on search text and region filter
  const filteredRankings = useMemo(() => {
    let filtered = rankings.map(item => ({
      ...item,
      originalRank: item.rank // Store original rank
    }));

    // Apply region filter
    if (worldSkillsFilters.region) {
      filtered = filtered.filter(item => item.team.region === worldSkillsFilters.region);
    }

    // Apply search filter
    if (searchText.trim()) {
      const searchTerm = searchText.toLowerCase().trim();
      filtered = filtered.filter(item => {
        const teamNumber = item.team.team.toLowerCase();
        const teamName = (item.team.teamName || '').toLowerCase();
        const organization = (item.team.organization || '').toLowerCase();
        const location = `${item.team.city || ''} ${item.team.region || ''} ${item.team.country || ''}`.toLowerCase();

        return teamNumber.includes(searchTerm) ||
               teamName.includes(searchTerm) ||
               organization.includes(searchTerm) ||
               location.includes(searchTerm);
      });
    }

    // Check if any filters are applied
    const isFiltered = worldSkillsFilters.region || searchText.trim();

    // Re-rank filtered results if filters are applied
    if (isFiltered && filtered.length > 0) {
      return filtered.map((item, index) => ({
        ...item,
        rank: index + 1, // New display rank starting from 1
        displayRank: index + 1,
        showOriginalRank: true
      }));
    }

    // Return original rankings if no filters applied
    return filtered.map(item => ({
      ...item,
      displayRank: item.rank,
      showOriginalRank: false
    }));
  }, [rankings, searchText, worldSkillsFilters.region]);

  const loadSeasons = async () => {
    try {
      console.log('Loading seasons for program:', selectedProgram);
      // Get program ID for filtering
      const programId = getProgramId(selectedProgram);

      const seasonsResponse = await robotEventsAPI.getSeasons({ program: [programId] });
      console.log('Raw seasons response:', seasonsResponse);

      const formattedSeasons = seasonsResponse.data.map(season => ({
        label: season.name,
        value: season.id.toString()
      }));
      console.log('Formatted seasons:', formattedSeasons);
      setSeasons(formattedSeasons);

      // Set current season as default if not already set
      if (!selectedSeasonId && formattedSeasons.length > 0) {
        let defaultSeasonId: string;

        if (globalSeasonEnabled && globalSeason) {
          // Use global season if global mode is enabled
          defaultSeasonId = globalSeason;
          console.log('Using global season as default:', defaultSeasonId);
        } else {
          // Use current season from API
          const currentSeasonFromAPI = await robotEventsAPI.getCurrentSeasonId();
          defaultSeasonId = currentSeasonFromAPI.toString();
          console.log('Using current season from API as default:', defaultSeasonId);
          setCurrentSeason(currentSeasonFromAPI);
        }

        // Validate that the default season exists in the seasons list
        const seasonExists = formattedSeasons.some(season => season.value === defaultSeasonId);
        if (!seasonExists && formattedSeasons.length > 0) {
          console.log('Default season not found in list, using first available season');
          defaultSeasonId = formattedSeasons[0].value;
        }

        console.log('Setting selectedSeasonId to:', defaultSeasonId);
        setSelectedSeasonId(defaultSeasonId);
        updateGlobalSeason(defaultSeasonId);
      }
    } catch (error) {
      console.error('Failed to load seasons:', error);
    }
  };

  const generateRegionsFromRankings = (rankings: ExtendedWorldSkillsResponse[]) => {
    const regionSet = new Set<string>();

    rankings.forEach(item => {
      if (item.team.region && item.team.region.trim()) {
        regionSet.add(item.team.region.trim());
      }
    });

    const regions = Array.from(regionSet)
      .sort()
      .map(region => ({
        label: region,
        value: region
      }));

    console.log('Generated regions from rankings:', regions.length, 'regions');
    return regions;
  };

  const loadRankings = async () => {
    setIsLoading(true);
    try {
      // Use selected season or get current season
      let seasonId: number;

      if (selectedSeasonId) {
        seasonId = parseInt(selectedSeasonId);
      } else {
        // Get current season first
        seasonId = await robotEventsAPI.getCurrentSeasonId(selectedProgram);
        setCurrentSeason(seasonId);
        setSelectedSeasonId(seasonId.toString());
      }

      const programId = getProgramId(selectedProgram);

      console.log('Loading rankings for season ID:', seasonId, 'division:', selectedDivision, 'program:', selectedProgram);

      // Cache-first approach: try to get from cache first
      let skillsData = getWorldSkills(seasonId, programId, selectedDivision);

      // If cache is empty, pre-load it and use returned data
      if (!skillsData || skillsData.length === 0) {
        console.log('Cache empty, pre-loading World Skills data...');
        skillsData = await preloadWorldSkills(seasonId, programId, selectedDivision);
      }

      console.log('Loaded rankings count:', skillsData.length);
      setRankings(skillsData);

      // Generate regions from loaded rankings
      const regions = generateRegionsFromRankings(skillsData);
      setAvailableRegions(regions);
    } catch (error) {
      console.error('Failed to load rankings:', error);
      Alert.alert(
        'Error',
        `Failed to load rankings for ${selectedProgram}. Please check your internet connection and try again.`
      );
      setRankings([]);
      setAvailableRegions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (!selectedSeasonId) {
        console.error('No season ID available for refresh');
        Alert.alert('Error', 'No season selected. Please select a season first.');
        return;
      }

      const seasonId = parseInt(selectedSeasonId);
      const programId = getProgramId(selectedProgram);

      console.log('Refreshing rankings for season:', seasonId, 'division:', selectedDivision, 'program:', selectedProgram);

      // Force refresh cache
      await forceRefreshWorldSkills(seasonId, programId, selectedDivision);

      // Get refreshed data from cache
      const skillsData = getWorldSkills(seasonId, programId, selectedDivision);
      console.log('Refresh successful, loaded:', skillsData.length, 'teams');
      setRankings(skillsData);

      // Generate regions from refreshed rankings
      const regions = generateRegionsFromRankings(skillsData);
      setAvailableRegions(regions);
    } catch (error) {
      console.error('Failed to refresh rankings:', error);
      Alert.alert(
        'Refresh Failed',
        'Unable to refresh rankings. Please check your internet connection and try again.'
      );
    } finally {
      setRefreshing(false);
    }
  }, [selectedDivision, selectedSeasonId, selectedProgram, getWorldSkills, forceRefreshWorldSkills]);


  const toggleSearch = useCallback(() => {
    const newValue = !isSearchVisible;

    if (!newValue) {
      // Hiding search - clear text and blur
      setSearchText('');
      searchInputRef.current?.blur();
      setIsSearchVisible(false);
    } else {
      // Showing search - hide filters modal if open, then show search
      setShowFiltersModal(false);
      setIsSearchVisible(true);
    }
  }, [isSearchVisible]);

  const toggleFilters = useCallback(() => {
    // Hide search when opening filters modal
    if (!showFiltersModal) {
      setIsSearchVisible(false);
      setSearchText('');
      searchInputRef.current?.blur();
    }
    setShowFiltersModal(true);
  }, [showFiltersModal]);

  const handleSeasonChange = useCallback(async (seasonId: string) => {
    console.log('Season changed to:', seasonId);
    setSelectedSeasonId(seasonId);
    updateGlobalSeason(seasonId);

    // Reload rankings with new season
    const newSeasonId = parseInt(seasonId);
    if (isNaN(newSeasonId)) {
      console.error('Invalid season ID:', seasonId);
      Alert.alert('Error', 'Invalid season selected.');
      return;
    }

    const programId = getProgramId(selectedProgram);

    console.log('Loading rankings for season:', newSeasonId, 'division:', selectedDivision);
    setIsLoading(true);
    try {
      // Cache-first approach
      let skillsData = getWorldSkills(newSeasonId, programId, selectedDivision);

      // If cache is empty, pre-load it and use returned data
      if (!skillsData || skillsData.length === 0) {
        console.log('Cache empty for new season, pre-loading...');
        skillsData = await preloadWorldSkills(newSeasonId, programId, selectedDivision);
      }

      console.log('Loaded rankings:', skillsData.length, 'teams');
      setRankings(skillsData);

      // Generate regions from loaded rankings
      const regions = generateRegionsFromRankings(skillsData);
      setAvailableRegions(regions);
    } catch (error) {
      console.error('Failed to load rankings for new season:', error);
      Alert.alert('Error', 'Failed to load rankings for selected season.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedDivision, selectedProgram, updateGlobalSeason, getWorldSkills, preloadWorldSkills]);

  const handleFiltersChange = useCallback((filters: { season: string; region: string }) => {
    setWorldSkillsFilters(filters);
    if (filters.season !== selectedSeasonId) {
      handleSeasonChange(filters.season);
    }
    // Region filter is applied immediately through filteredRankings memo
  }, [selectedSeasonId, handleSeasonChange]);

  const openRobotEvents = () => {
    let url = '';

    // Determine the correct URL based on the selected program and division
    switch (selectedProgram) {
      case 'VEX AI Robotics Competition':
        if (selectedDivision === 'College') {
          url = 'https://www.robotevents.com/robot-competitions/vex-ai-competition/standings/skills?search=&event_region=&country=*&grade_level=college';
        } else if (selectedDivision === 'High School') {
          url = 'https://www.robotevents.com/robot-competitions/vex-ai-competition/standings/skills?search=&event_region=&country=*&grade_level=High+School';
        }
        break;

      case 'VEX U Robotics Competition':
        url = 'https://www.robotevents.com/robot-competitions/college-competition/standings/skills';
        break;

      case 'VEX V5 Robotics Competition':
        if (selectedDivision === 'Middle School') {
          url = 'https://www.robotevents.com/robot-competitions/vex-robotics-competition/standings/skills?search=&event_region=&country=*&grade_level=Middle+School';
        } else if (selectedDivision === 'High School') {
          url = 'https://www.robotevents.com/robot-competitions/vex-robotics-competition/standings/skills?search=&event_region=&country=*&grade_level=High+School';
        }
        break;

      case 'VEX IQ Robotics Competition':
        if (selectedDivision === 'Elementary') {
          url = 'https://www.robotevents.com/robot-competitions/vex-iq-competition/standings/skills?search=&event_region=&country=*&grade_level=Elementary';
        } else if (selectedDivision === 'Middle School') {
          url = 'https://www.robotevents.com/robot-competitions/vex-iq-competition/standings/skills?search=&event_region=&country=*&grade_level=Middle+School';
        }
        break;

      case 'Aerial Drone Competition':
      default:
        url = 'https://www.robotevents.com/robot-competitions/adc/standings/skills';
        break;
    }

    if (url) {
      Linking.openURL(url);
    }
  };

  const formatLocation = (team: any) => {
    const parts = [team.city, team.region, team.country];
    return parts.filter(Boolean).join(', ').replace('United States', 'USA');
  };

  useEffect(() => {
    console.log('Program changed to:', selectedProgram, '- clearing data and reloading seasons');
    setRankings([]);
    setSelectedSeasonId(''); // Clear selected season when program changes
    setAvailableRegions([]); // Clear regions when program changes
    setWorldSkillsFilters(prev => ({ ...prev, region: '' })); // Clear region filter
    loadSeasons();
  }, [selectedProgram]);

  // Sync with global season when global mode is enabled
  useEffect(() => {
    if (globalSeasonEnabled && globalSeason && globalSeason !== selectedSeasonId) {
      console.log('Syncing to global season:', {
        globalSeason,
        previousSeasonId: selectedSeasonId,
        globalSeasonEnabled
      });
      setSelectedSeasonId(globalSeason);
    }
  }, [globalSeasonEnabled, globalSeason, selectedSeasonId]);

  // Sync worldSkillsFilters with selectedSeasonId
  useEffect(() => {
    if (selectedSeasonId && selectedSeasonId !== worldSkillsFilters.season) {
      console.log('Syncing worldSkillsFilters season with selectedSeasonId:', selectedSeasonId);
      setWorldSkillsFilters(prev => ({ ...prev, season: selectedSeasonId }));
    }
  }, [selectedSeasonId]); // Only depend on selectedSeasonId to avoid loops

  useEffect(() => {
    if (selectedSeasonId && selectedDivision) {
      console.log('Auto-loading rankings due to dependency change:', {
        selectedDivision,
        selectedSeasonId,
        selectedProgram
      });
      loadRankings();
    }
  }, [selectedDivision, selectedSeasonId, selectedProgram]);

  // Update selected division when program changes
  useEffect(() => {
    const newAvailableDivisions = getAvailableDivisions();
    if (!newAvailableDivisions.includes(selectedDivision)) {
      setSelectedDivision(newAvailableDivisions[0]);
    }
  }, [selectedProgram]);

  // Handle search input focus when search becomes visible
  useEffect(() => {
    if (isSearchVisible) {
      // Small delay to ensure the TextInput is fully rendered
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isSearchVisible]);

  // Cache validation on screen focus
  useFocusEffect(
    useCallback(() => {
      if (!selectedSeasonId || !selectedDivision) return;

      const seasonId = parseInt(selectedSeasonId);
      const programId = getProgramId(selectedProgram);

      // Check if cache is empty and pre-load if needed
      const cacheData = getWorldSkills(seasonId, programId, selectedDivision);
      if (!cacheData || cacheData.length === 0) {
        console.log(`[WorldSkills] Cache empty for ${selectedDivision} on focus, pre-loading...`);
        preloadWorldSkills(seasonId, programId, selectedDivision);
      }
    }, [selectedSeasonId, selectedDivision, selectedProgram, getWorldSkills, preloadWorldSkills])
  );

  const renderRankingItem = useCallback(({ item }: { item: ExtendedWorldSkillsResponse }) => (
    <TouchableOpacity
      style={[styles.rankingItem, {
        backgroundColor: settings.cardBackgroundColor,
        borderColor: settings.borderColor,
        shadowColor: settings.colorScheme === 'dark' ? '#FFFFFF' : '#000000'
      }]}
      onPress={() => {
        navigation.navigate('TeamInfo', {
          teamNumber: item.team.team,
          teamName: item.team.teamName || item.team.team
        });
      }}
    >
      <View style={styles.rankingContent}>
        <View style={styles.rankContainer}>
          <Text style={[styles.rankText, { color: settings.textColor }]}>
            {item.showOriginalRank ?
              `#${item.displayRank} (#${item.originalRank})` :
              `#${item.rank}`
            }
          </Text>
          {/* Trophy/medal icons removed */}
        </View>

        <View style={styles.teamInfo}>
          <Text style={[styles.teamNumber, { color: settings.textColor }]}>{item.team.team}</Text>
          <Text style={[styles.teamName, { color: settings.secondaryTextColor }]}>{item.team.teamName}</Text>
          <Text style={[styles.organization, { color: settings.secondaryTextColor }]} numberOfLines={1}>{item.team.organization}</Text>
          <Text style={[styles.location, { color: settings.secondaryTextColor }]} numberOfLines={1}>📍 {formatLocation(item.team)}</Text>
        </View>

        <View style={styles.scoresContainer}>
          <View style={styles.scoreItem}>
            <Text style={[styles.scoreLabel, { color: settings.secondaryTextColor }]}>Total</Text>
            <Text style={[styles.totalScore, { color: settings.buttonColor }]}>{item.scores.score}</Text>
          </View>
          <View style={styles.scoreItem}>
            <Text style={[styles.scoreLabel, { color: settings.secondaryTextColor }]}>Auto.</Text>
            <Text style={[styles.scoreValue, { color: settings.textColor }]}>{item.scores.programming}</Text>
          </View>
          <View style={styles.scoreItem}>
            <Text style={[styles.scoreLabel, { color: settings.secondaryTextColor }]}>Driver</Text>
            <Text style={[styles.scoreValue, { color: settings.textColor }]}>{item.scores.driver}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.favoriteButton}
          onPress={async () => {
            try {
              if (isTeamFavorited(item.team.team)) {
                await removeTeam(item.team.team);
              } else {
                // Create a Team object from WorldSkillsResponse data
                const teamObj = {
                  id: 0, // WorldSkills doesn't provide team ID
                  number: item.team.team,
                  team_name: item.team.teamName,
                  organization: item.team.organization,
                  location: {
                    city: item.team.city,
                    region: item.team.region,
                    country: item.team.country,
                  },
                  robot_name: '',
                  grade: '',
                  registered: true,
                  program: {
                    id: 1,
                    name: selectedProgram,
                    code: selectedProgram === 'Aerial Drone Competition' ? 'ADC' : 'VEX',
                  },
                };
                await addTeam(teamObj);
              }
            } catch (error) {
              console.error('Failed to toggle team favorite:', error);
              Alert.alert('Error', 'Failed to update favorite status');
            }
          }}
        >
          <Ionicons
            name={isTeamFavorited(item.team.team) ? "heart" : "heart-outline"}
            size={20}
            color={isTeamFavorited(item.team.team) ? "#FF6B6B" : settings.iconColor}
          />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  ), [
    settings.cardBackgroundColor,
    settings.borderColor,
    settings.colorScheme,
    settings.textColor,
    settings.secondaryTextColor,
    settings.buttonColor,
    settings.iconColor,
    selectedProgram,
    navigation,
    isTeamFavorited,
    addTeam,
    removeTeam
  ]);

  const renderHeader = useCallback(() => (
    <View style={[styles.header, {
      backgroundColor: settings.cardBackgroundColor,
      borderBottomColor: settings.borderColor
    }]}>
      {/* Division Selector */}
      {availableDivisions.length > 1 && (
        <View style={[styles.tabContainer, { borderBottomColor: settings.borderColor }]}>
          {availableDivisions.map((division) => (
            <TouchableOpacity
              key={division}
              style={[
                styles.tab,
                selectedDivision === division && { borderBottomColor: settings.buttonColor }
              ]}
              onPress={() => setSelectedDivision(division)}
            >
              <Text style={[
                styles.tabText,
                selectedDivision === division ?
                  { color: settings.buttonColor, fontWeight: '600' } :
                  { color: settings.textColor }
              ]}>
                {division}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Info Section */}
      <View style={[styles.infoSection, { borderBottomColor: settings.borderColor }]}>
        <View style={styles.titleRow}>
          <View style={styles.titleContainer}>
            <Text style={[styles.infoTitle, { color: settings.textColor }]}>World Skills Rankings</Text>
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.actionButton, isSearchVisible && styles.activeButton]}
                onPress={toggleSearch}
              >
                <Ionicons
                  name="search"
                  size={20}
                  color={isSearchVisible ? '#FFFFFF' : settings.buttonColor}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, showFiltersModal && styles.activeButton]}
                onPress={toggleFilters}
              >
                <Ionicons
                  name="filter"
                  size={20}
                  color={showFiltersModal ? '#FFFFFF' : settings.buttonColor}
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>
        <Text style={[styles.infoSubtitle, { color: settings.secondaryTextColor }]}>
          Global rankings for {selectedDivision} teams
        </Text>
        <TouchableOpacity style={styles.linkButton} onPress={openRobotEvents}>
          <Ionicons name="link" size={16} color={settings.buttonColor} />
          <Text style={[styles.linkText, { color: settings.buttonColor }]}>View on RobotEvents</Text>
        </TouchableOpacity>
      </View>

    </View>
  ), [
    settings.cardBackgroundColor,
    settings.borderColor,
    settings.textColor,
    settings.secondaryTextColor,
    settings.buttonColor,
    settings.backgroundColor,
    availableDivisions,
    selectedDivision,
    isSearchVisible,
    showFiltersModal,
    setSelectedDivision,
    toggleSearch,
    toggleFilters
  ]);

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: settings.backgroundColor }]}>
        {renderHeader()}
        <ScrollView style={styles.skeletonContainer}>
          {[...Array(10)].map((_, index) => (
            <WorldSkillsRankingSkeleton key={index} />
          ))}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: settings.backgroundColor }]}>
      {/* Fixed Header */}
      {renderHeader()}

      {/* Search Section - outside FlatList */}
      {isSearchVisible && (
        <View style={[styles.searchSection, { borderBottomColor: settings.borderColor }]}>
          <View style={[styles.searchContainer, {
            backgroundColor: settings.backgroundColor,
            borderColor: settings.borderColor
          }]}>
            <Ionicons name="search" size={20} color={settings.secondaryTextColor} style={styles.searchIcon} />
            <TextInput
              ref={searchInputRef}
              style={[styles.searchInput, {
                color: settings.textColor,
                flex: 1
              }]}
              placeholder="Search teams, organizations, or locations..."
              placeholderTextColor={settings.secondaryTextColor}
              value={searchText}
              onChangeText={setSearchText}
            />
            {searchText.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchText('')}
                style={styles.clearButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close-circle" size={20} color={settings.secondaryTextColor} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}


      {/* Search Results Count */}
      {isSearchVisible && filteredRankings.length !== rankings.length && (
        <View style={[styles.searchResultsContainer, { backgroundColor: settings.cardBackgroundColor, borderBottomColor: settings.borderColor }]}>
          <Text style={[styles.searchResults, { color: settings.secondaryTextColor }]}>
            {`Showing ${filteredRankings.length} of ${rankings.length} teams`}
          </Text>
        </View>
      )}

      {/* FlatList without header */}
      <View style={{ flex: 1 }}>
        <FlatList
          ref={flatListRef}
          data={filteredRankings}
          renderItem={renderRankingItem}
          keyExtractor={(item) => `${item.team.team}-${currentSeason}-${selectedDivision}`}
          style={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            !isLoading ? (
              <View style={styles.emptyStateContainer}>
                <Ionicons
                  name={worldSkillsFilters.region ? "filter-outline" : "trophy-outline"}
                  size={64}
                  color={settings.secondaryTextColor}
                  style={styles.emptyStateIcon}
                />
                <Text style={[styles.emptyStateTitle, { color: settings.textColor }]}>
                  {worldSkillsFilters.region ? 'No Teams Found' : 'No Rankings Available'}
                </Text>
                <Text style={[styles.emptyStateMessage, { color: settings.secondaryTextColor }]}>
                  {worldSkillsFilters.region
                    ? `No teams found in ${worldSkillsFilters.region} for ${selectedDivision}.`
                    : `No World Skills rankings available for ${selectedDivision} this season.`
                  }
                </Text>
                {worldSkillsFilters.region && (
                  <TouchableOpacity
                    style={[styles.clearFiltersButton, { backgroundColor: settings.buttonColor }]}
                    onPress={() => {
                      setWorldSkillsFilters({ ...worldSkillsFilters, region: '' });
                    }}
                  >
                    <Ionicons name="close-circle-outline" size={20} color="#FFFFFF" />
                    <Text style={styles.clearFiltersButtonText}>Clear Filters</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : null
          }
          onScroll={(event) => {
            const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
            setScrollY(contentOffset.y);
            setContentHeight(contentSize.height);
            setViewportHeight(layoutMeasurement.height);
          }}
          scrollEventThrottle={16}
        />

        {/* Animated Scroll Bar */}
        <AnimatedScrollBar
          scrollY={scrollY}
          contentHeight={contentHeight}
          viewportHeight={viewportHeight}
          color={settings.buttonColor}
          enabled={settings.scrollBarEnabled && settings.scrollBarWorldSkills}
          scrollViewRef={flatListRef}
        />
      </View>

      {/* World Skills Filters Modal */}
      <WorldSkillsFiltersModal
        visible={showFiltersModal}
        onClose={() => setShowFiltersModal(false)}
        filters={worldSkillsFilters}
        onFiltersChange={handleFiltersChange}
        seasons={seasons}
        regions={availableRegions}
        selectedProgram={selectedProgram}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: 16,
  },
  infoSection: {
    padding: 16,
    borderBottomWidth: 1,
  },
  titleRow: {
    marginBottom: 4,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  activeButton: {
    backgroundColor: '#007AFF',
  },
  infoSubtitle: {
    fontSize: 14,
    marginBottom: 12,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  linkText: {
    fontSize: 14,
    marginLeft: 4,
  },
  searchSection: {
    padding: 16,
    borderBottomWidth: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    fontSize: 16,
    paddingVertical: 8,
  },
  clearButton: {
    marginLeft: 8,
    padding: 2,
  },
  searchResults: {
    fontSize: 12,
    textAlign: 'center',
  },
  searchResultsContainer: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  skeletonContainer: {
    flex: 1,
    paddingTop: 8,
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
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyStateIcon: {
    marginBottom: 16,
    opacity: 0.5,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateMessage: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  clearFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  clearFiltersButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  list: {
    flex: 1,
  },
  rankingItem: {
    marginVertical: 2,
    marginHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  rankingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  rankContainer: {
    width: 50,
    alignItems: 'center',
    marginRight: 12,
  },
  rankText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  teamInfo: {
    flex: 1,
    marginRight: 12,
  },
  teamNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  teamName: {
    fontSize: 14,
    marginBottom: 2,
  },
  organization: {
    fontSize: 11,
    marginBottom: 2,
  },
  location: {
    fontSize: 10,
    marginBottom: 2,
  },
  scoresContainer: {
    alignItems: 'flex-end',
    marginRight: 8,
  },
  scoreItem: {
    alignItems: 'center',
    marginBottom: 4,
  },
  scoreLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
  },
  totalScore: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  scoreValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  favoriteButton: {
    padding: 8,
  },
});

export default WorldSkillsScreen;
