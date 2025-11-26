/**
 * WORLD RANKINGS SCREEN
 *
 * Global rankings screen with toggle between World Skills and TrueSkill rankings.
 * Container component that manages header, filters, and renders the appropriate ranking component.
 *
 * NAVIGATION ACCESS:
 * - Dashboard tab → Rankings button
 * - Main tab navigator (Rankings tab)
 * - Team screens → Skills ranking links
 *
 * KEY FEATURES:
 * - Toggle between World Skills and TrueSkill rankings (VEX V5 only)
 * - Season and grade level filtering (World Skills)
 * - Region filtering (both modes)
 * - Search functionality
 * - Direct navigation to team details
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createLogger } from '../utils/logger';

const logger = createLogger('WorldRankingsScreen');
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
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
import WorldSkillsFiltersModal from '../components/WorldSkillsFiltersModal';
import TrueSkillFiltersModal from '../components/TrueSkillFiltersModal';
import TrueSkillInfoModal from '../components/TrueSkillInfoModal';
import WorldSkillsRankingSkeleton from '../components/WorldSkillsRankingSkeleton';
import WorldSkillsRankings from '../components/WorldSkillsRankings';
import TrueSkillRankings from '../components/TrueSkillRankings';
import {
  getProgramId,
  getAvailableGrades,
  getProgramConfig,
} from '../utils/programMappings';

type DivisionType = 'High School' | 'Middle School' | 'Elementary' | 'College';
type RankingsMode = 'worldskills' | 'trueskill';

interface Props {
  navigation: any;
}

const WorldRankingsScreen: React.FC<Props> = ({ navigation }) => {
  const settings = useSettings();
  const { selectedProgram, globalSeasonEnabled, selectedSeason: globalSeason, updateGlobalSeason, trueSkillEnabled, filterResetTrigger } = settings;
  const { getWorldSkills, preloadWorldSkills } = useDataCache();

  // Get program config to check if TrueSkill is available for this program
  const programConfig = getProgramConfig(selectedProgram);

  // Get available divisions based on the selected program using centralized config
  const getAvailableDivisions = (): DivisionType[] => {
    return getAvailableGrades(selectedProgram) as DivisionType[];
  };

  const availableDivisions = getAvailableDivisions();
  const [selectedDivision, setSelectedDivision] = useState<DivisionType>(availableDivisions[0]);
  const [isLoading, setIsLoading] = useState(true);

  // Rankings mode state (only show when program supports it AND user has it enabled)
  const [rankingsMode, setRankingsMode] = useState<RankingsMode>('worldskills');
  const isTrueSkillAvailable = programConfig.hasTrueSkill && trueSkillEnabled;

  // Common state
  const [searchText, setSearchText] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('');
  const [seasons, setSeasons] = useState<{label: string, value: string}[]>([]);
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [worldSkillsFilters, setWorldSkillsFilters] = useState({
    season: (globalSeasonEnabled && globalSeason) ? globalSeason : '',
    region: '',
  });
  const [trueSkillFilters, setTrueSkillFilters] = useState<{
    country: string;
    region: string;
    favoritesOnly: boolean;
  }>({
    country: '',
    region: '',
    favoritesOnly: false,
  });
  const [availableRegions, setAvailableRegions] = useState<{label: string, value: string}[]>([]);
  const [trueSkillCountries, setTrueSkillCountries] = useState<string[]>([]);
  const [trueSkillRegionsByCountry, setTrueSkillRegionsByCountry] = useState<{[country: string]: string[]}>({});
  const [showTrueSkillInfoModal, setShowTrueSkillInfoModal] = useState(false);
  const searchInputRef = useRef<TextInput>(null);

  const loadSeasons = async () => {
    try {
      logger.debug('Loading seasons for program:', selectedProgram);
      // Get program ID for filtering
      const programId = getProgramId(selectedProgram);

      const seasonsResponse = await robotEventsAPI.getSeasons({ program: [programId] });
      logger.debug('Raw seasons response:', seasonsResponse);

      const formattedSeasons = seasonsResponse.data.map(season => ({
        label: season.name,
        value: season.id.toString()
      }));
      logger.debug('Formatted seasons:', formattedSeasons);
      setSeasons(formattedSeasons);

      // Set current season as default if not already set
      if (!selectedSeasonId && formattedSeasons.length > 0) {
        let defaultSeasonId: string;

        if (globalSeasonEnabled && globalSeason) {
          // Use global season if global mode is enabled
          defaultSeasonId = globalSeason;
          logger.debug('Using global season as default:', defaultSeasonId);
        } else {
          // Use current season from API
          const currentSeasonFromAPI = await robotEventsAPI.getCurrentSeasonId();
          defaultSeasonId = currentSeasonFromAPI.toString();
          logger.debug('Using current season from API as default:', defaultSeasonId);
        }

        // Validate that the default season exists in the seasons list
        const seasonExists = formattedSeasons.some(season => season.value === defaultSeasonId);
        if (!seasonExists && formattedSeasons.length > 0) {
          logger.debug('Default season not found in list, using first available season');
          defaultSeasonId = formattedSeasons[0].value;
        }

        logger.debug('Setting selectedSeasonId to:', defaultSeasonId);
        setSelectedSeasonId(defaultSeasonId);
        updateGlobalSeason(defaultSeasonId);
      }

      // Stop loading once seasons are loaded
      setIsLoading(false);
    } catch (error) {
      logger.error('Failed to load seasons:', error);
      setIsLoading(false);
    }
  };



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
    logger.debug('Toggle filters called. Current state:', showFiltersModal, 'Rankings mode:', rankingsMode);
    // Hide search when opening filters modal
    if (!showFiltersModal) {
      setIsSearchVisible(false);
      setSearchText('');
      searchInputRef.current?.blur();
    }
    setShowFiltersModal(!showFiltersModal);
  }, [showFiltersModal, rankingsMode]);

  const handleSeasonChange = useCallback((seasonId: string) => {
    logger.debug('Season changed to:', seasonId);
    setSelectedSeasonId(seasonId);
    updateGlobalSeason(seasonId);
  }, [updateGlobalSeason]);

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

  const openVRCDataAnalysis = () => {
    Linking.openURL('https://vrc-data-analysis.com');
  };

  useEffect(() => {
    logger.debug('Program changed to:', selectedProgram, '- clearing data and reloading seasons');
    setSelectedSeasonId(''); // Clear selected season when program changes
    setWorldSkillsFilters(prev => ({ ...prev, region: '' })); // Clear region filter
    setIsLoading(true);
    loadSeasons();
  }, [selectedProgram]);

  // Reset all filters when program changes
  useEffect(() => {
    if (filterResetTrigger > 0) {
      logger.debug('Filter reset triggered - clearing all filters');
      setWorldSkillsFilters({
        season: (globalSeasonEnabled && globalSeason) ? globalSeason : '',
        region: '',
      });
      setTrueSkillFilters({
        country: '',
        region: '',
        favoritesOnly: false,
      });
      setSearchText('');
    }
  }, [filterResetTrigger]);

  // Sync with global season when global mode is enabled
  useEffect(() => {
    if (globalSeasonEnabled && globalSeason && globalSeason !== selectedSeasonId) {
      logger.debug('Syncing to global season:', {
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
      logger.debug('Syncing worldSkillsFilters season with selectedSeasonId:', selectedSeasonId);
      setWorldSkillsFilters(prev => ({ ...prev, season: selectedSeasonId }));
    }
  }, [selectedSeasonId]); // Only depend on selectedSeasonId to avoid loops

  // Update selected division when program changes
  useEffect(() => {
    const newAvailableDivisions = getAvailableDivisions();
    if (!newAvailableDivisions.includes(selectedDivision)) {
      setSelectedDivision(newAvailableDivisions[0]);
    }
  }, [selectedProgram]);

  // Reset to World Skills mode if TrueSkill is not available for the current program
  useEffect(() => {
    if (!isTrueSkillAvailable && rankingsMode === 'trueskill') {
      logger.debug('TrueSkill not available for this program, switching to World Skills mode');
      setRankingsMode('worldskills');
    }
  }, [isTrueSkillAvailable, rankingsMode]);

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

  // Set up navigation header with toggle button for TrueSkill/World Skills
  useEffect(() => {
    navigation?.setOptions?.({
      title: 'Rankings',
      headerStyle: {
        backgroundColor: settings.topBarColor,
      },
      headerTintColor: settings.topBarContentColor,
      headerTitleAlign: 'center',
      headerLeft: isTrueSkillAvailable ? () => (
        <TouchableOpacity
          style={[styles.headerToggle, { backgroundColor: settings.buttonColor }]}
          onPress={() => {
            const newMode = rankingsMode === 'worldskills' ? 'trueskill' : 'worldskills';
            setRankingsMode(newMode);
          }}
        >
          <Ionicons
            name={rankingsMode === 'worldskills' ? 'trending-up-outline' : 'globe-outline'}
            size={20}
            color="#FFFFFF"
          />
        </TouchableOpacity>
      ) : undefined,
    });
  }, [navigation, settings, isTrueSkillAvailable, rankingsMode]);

  // Cache validation on screen focus
  useFocusEffect(
    useCallback(() => {
      if (!selectedSeasonId || !selectedDivision) return;

      const seasonId = parseInt(selectedSeasonId);
      const programId = getProgramId(selectedProgram);

      // Check if cache is empty and pre-load if needed
      const cacheData = getWorldSkills(seasonId, programId, selectedDivision);
      if (!cacheData || cacheData.length === 0) {
        logger.debug(`Cache empty for ${selectedDivision} on focus, pre-loading...`);
        preloadWorldSkills(seasonId, programId, selectedDivision);
      }
    }, [selectedSeasonId, selectedDivision, selectedProgram, getWorldSkills, preloadWorldSkills])
  );

  const renderHeader = useCallback(() => (
    <View style={[styles.header, {
      backgroundColor: settings.cardBackgroundColor,
      borderBottomColor: settings.borderColor
    }]}>
      {/* Division Selector - Only show for World Skills mode */}
      {rankingsMode === 'worldskills' && availableDivisions.length > 1 && (
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
          <Text style={[styles.infoTitle, { color: settings.textColor }]}>
            {rankingsMode === 'trueskill' ? 'TrueSkill Rankings' : 'World Skills Rankings'}
          </Text>
          <View style={styles.titleContainer}>
            <View style={styles.actionButtons}>
              {rankingsMode === 'trueskill' && (
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => setShowTrueSkillInfoModal(true)}
                >
                  <Ionicons
                    name="information-circle-outline"
                    size={20}
                    color={settings.buttonColor}
                  />
                </TouchableOpacity>
              )}
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
          {rankingsMode === 'trueskill'
            ? 'Global TrueSkill rankings for VEX V5 teams'
            : `Global rankings for ${selectedDivision} teams`
          }
        </Text>
        {rankingsMode === 'worldskills' ? (
          <TouchableOpacity style={styles.linkButton} onPress={openRobotEvents}>
            <Ionicons name="link" size={16} color={settings.buttonColor} />
            <Text style={[styles.linkText, { color: settings.buttonColor }]}>View on RobotEvents</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity style={styles.linkButton} onPress={openVRCDataAnalysis}>
              <Ionicons name="link" size={16} color={settings.buttonColor} />
              <Text style={[styles.linkText, { color: settings.buttonColor }]}>View on VRC Data Analysis</Text>
            </TouchableOpacity>
            <Text style={[styles.attributionText, { color: settings.secondaryTextColor }]}>
              Data provided by vrc-data-analysis.com
            </Text>
          </>
        )}
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
    rankingsMode,
    setSelectedDivision,
    toggleSearch,
    toggleFilters
  ]);

  // Only show loading skeleton for World Skills mode (needs seasons)
  // TrueSkill mode handles its own loading state
  if (isLoading && rankingsMode === 'worldskills') {
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


      {/* Conditional Component Rendering */}
      {rankingsMode === 'trueskill' ? (
        <TrueSkillRankings
          navigation={navigation}
          isSearchVisible={isSearchVisible}
          searchText={searchText}
          onSearchTextChange={setSearchText}
          filters={trueSkillFilters}
          onLocationDataLoaded={(data) => {
            setTrueSkillCountries(data.countries);
            setTrueSkillRegionsByCountry(data.regionsByCountry);
          }}
        />
      ) : (
        <WorldSkillsRankings
          navigation={navigation}
          selectedDivision={selectedDivision}
          selectedSeasonId={selectedSeasonId}
          selectedProgram={selectedProgram}
          isSearchVisible={isSearchVisible}
          searchText={searchText}
          onSearchTextChange={setSearchText}
          regionFilter={worldSkillsFilters.region}
        />
      )}

      {/* World Skills Filters Modal - Only show for World Skills mode */}
      {rankingsMode === 'worldskills' && (
        <WorldSkillsFiltersModal
          visible={showFiltersModal}
          onClose={() => setShowFiltersModal(false)}
          filters={worldSkillsFilters}
          onFiltersChange={handleFiltersChange}
          seasons={seasons}
          regions={availableRegions}
          selectedProgram={selectedProgram}
        />
      )}

      {/* TrueSkill Filters Modal - Only show for TrueSkill mode */}
      {rankingsMode === 'trueskill' && (
        <TrueSkillFiltersModal
          visible={showFiltersModal}
          onClose={() => setShowFiltersModal(false)}
          filters={trueSkillFilters}
          onFiltersChange={setTrueSkillFilters}
          countries={trueSkillCountries}
          regionsByCountry={trueSkillRegionsByCountry}
        />
      )}

      {/* TrueSkill Info Modal */}
      <TrueSkillInfoModal
        visible={showTrueSkillInfoModal}
        onClose={() => setShowTrueSkillInfoModal(false)}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerToggle: {
    borderRadius: 8,
    marginLeft: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    justifyContent: 'center',
    alignItems: 'center',
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
  attributionText: {
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
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
  // TrueSkill-specific styles
  rankingChange: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  expandButton: {
    padding: 4,
    marginTop: 4,
  },
  expandedDetails: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  detailItem: {
    alignItems: 'center',
    flex: 1,
  },
  detailLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '600',
  },
});

export default WorldRankingsScreen;
