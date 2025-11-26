/**
 * TrueSkill Rankings Component
 *
 * Displays TrueSkill rankings for VEX V5 teams from the VRC Data Analysis API.
 * Shows global TrueSkill rankings with filtering by region and favorites.
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../contexts/SettingsContext';
import { useFavorites } from '../contexts/FavoritesContext';
import { vrcDataAnalysisAPI } from '../services/apiRouter';
import { VRCDataAnalysisTeam } from '../services/vrcDataAnalysisAPI';
import { createLogger } from '../utils/logger';
import AnimatedScrollBar from './AnimatedScrollBar';
import TrueSkillRankingSkeleton from './TrueSkillRankingSkeleton';

const logger = createLogger('TrueSkillRankings');

// Extended VRCDataAnalysisTeam with filtering properties
interface ExtendedVRCDataAnalysisTeam extends VRCDataAnalysisTeam {
  originalRank?: number;
  displayRank?: number;
  showOriginalRank?: boolean;
}

interface TrueSkillRankingsProps {
  navigation: any;
  isSearchVisible: boolean;
  searchText: string;
  onSearchTextChange: (text: string) => void;
  filters: {
    country: string;
    region: string;
    favoritesOnly: boolean;
  };
  onLocationDataLoaded?: (data: { countries: string[]; regionsByCountry: {[country: string]: string[]} }) => void;
}

const TrueSkillRankings: React.FC<TrueSkillRankingsProps> = ({
  navigation,
  isSearchVisible,
  searchText,
  onSearchTextChange,
  filters,
  onLocationDataLoaded,
}) => {
  const settings = useSettings();
  const { addTeam, removeTeam, isTeamFavorited, favoriteTeams } = useFavorites();

  const [trueSkillRankings, setTrueSkillRankings] = useState<VRCDataAnalysisTeam[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());

  const [scrollY, setScrollY] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const flatListRef = useRef<any>(null);

  // Filtered TrueSkill rankings
  const filteredTrueSkillRankings = useMemo(() => {
    if (trueSkillRankings.length === 0) return [];

    let filtered = trueSkillRankings.map(item => ({
      ...item,
      originalRank: item.ts_ranking // Store original rank
    }));

    // Apply country filter
    if (filters.country) {
      logger.debug('Applying country filter:', filters.country);
      filtered = filtered.filter(item => item.loc_country === filters.country);
      logger.debug('Teams after country filter:', filtered.length);
    }

    // Apply region filter
    if (filters.region) {
      logger.debug('Applying region filter:', filters.region);
      filtered = filtered.filter(item => item.loc_region === filters.region);
      logger.debug('Teams after region filter:', filtered.length);
    }

    // Apply favorites filter
    if (filters.favoritesOnly) {
      logger.debug('Applying favorites filter. Favorite teams:', favoriteTeams.length);
      logger.debug('Favorite teams data:', favoriteTeams);
      // favoriteTeams is already an array of team number strings
      const favoriteNumbers = favoriteTeams;
      logger.debug('Favorite team numbers:', favoriteNumbers);
      logger.debug('Sample TrueSkill team numbers (first 5):', filtered.slice(0, 5).map(t => t.team_number));
      const favoriteFiltered = vrcDataAnalysisAPI.getTeamsByNumbers(favoriteNumbers, filtered);
      // Preserve originalRank when filtering
      filtered = favoriteFiltered.map(item => ({
        ...item,
        originalRank: item.ts_ranking
      }));
      logger.debug('Teams after favorites filter:', filtered.length);
    }

    // Apply search filter
    if (searchText.trim()) {
      const searchTerm = searchText.toLowerCase().trim();
      filtered = filtered.filter(item => {
        const teamNumber = item.team_number.toLowerCase();
        const teamName = (item.team_name || '').toLowerCase();
        const location = `${item.loc_region || ''} ${item.loc_country || ''}`.toLowerCase();

        return teamNumber.includes(searchTerm) ||
               teamName.includes(searchTerm) ||
               location.includes(searchTerm);
      });
    }

    // Check if any filters are applied
    const isFiltered = filters.country || filters.region || filters.favoritesOnly || searchText.trim();

    // Re-rank filtered results if filters are applied
    if (isFiltered && filtered.length > 0) {
      return filtered.map((item, index) => ({
        ...item,
        ts_ranking: index + 1, // New display rank starting from 1
        displayRank: index + 1,
        showOriginalRank: true
      }));
    }

    // Return original rankings if no filters applied
    return filtered.map(item => ({
      ...item,
      displayRank: item.ts_ranking,
      showOriginalRank: false
    }));
  }, [trueSkillRankings, searchText, filters, favoriteTeams]);

  const loadTrueSkillRankings = useCallback(async () => {
    setIsLoading(true);
    try {
      logger.info('Loading TrueSkill rankings...');
      const allTeams = await vrcDataAnalysisAPI.getAllTeams();

      logger.debug('Loaded', allTeams.length, 'teams from VRC Data Analysis');
      setTrueSkillRankings(allTeams);

      // Generate unique countries
      const countries = [...new Set(allTeams.map(team => team.loc_country))].filter(Boolean).sort();

      // Generate regionsByCountry mapping
      const regionsByCountry: {[country: string]: string[]} = {};
      allTeams.forEach(team => {
        if (team.loc_country && team.loc_region) {
          if (!regionsByCountry[team.loc_country]) {
            regionsByCountry[team.loc_country] = [];
          }
          if (!regionsByCountry[team.loc_country].includes(team.loc_region)) {
            regionsByCountry[team.loc_country].push(team.loc_region);
          }
        }
      });

      // Sort regions within each country
      Object.keys(regionsByCountry).forEach(country => {
        regionsByCountry[country].sort();
      });

      logger.debug('Generated countries:', countries.length);
      logger.debug('Generated regionsByCountry:', Object.keys(regionsByCountry).length, 'countries');

      // Pass location data to parent
      if (onLocationDataLoaded) {
        onLocationDataLoaded({ countries, regionsByCountry });
      }
    } catch (error) {
      logger.error('Failed to load TrueSkill rankings:', error);
      Alert.alert(
        'Error',
        'Failed to load TrueSkill rankings. Please check your internet connection and try again.'
      );
      setTrueSkillRankings([]);
      if (onLocationDataLoaded) {
        onLocationDataLoaded({ countries: [], regionsByCountry: {} });
      }
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - onLocationDataLoaded is stable enough for our use case

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadTrueSkillRankings();
    } catch (error) {
      logger.error('Failed to refresh rankings:', error);
      Alert.alert(
        'Refresh Failed',
        'Unable to refresh rankings. Please check your internet connection and try again.'
      );
    } finally {
      setRefreshing(false);
    }
  }, [loadTrueSkillRankings]);

  const toggleExpand = useCallback((teamNumber: string) => {
    setExpandedTeams(prev => {
      const newSet = new Set(prev);
      if (newSet.has(teamNumber)) {
        newSet.delete(teamNumber);
      } else {
        newSet.add(teamNumber);
      }
      return newSet;
    });
  }, []);

  useEffect(() => {
    loadTrueSkillRankings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only load once on mount

  const renderTrueSkillItem = useCallback(({ item }: { item: ExtendedVRCDataAnalysisTeam }) => {
    const isExpanded = expandedTeams.has(item.team_number);

    return (
      <TouchableOpacity
        style={[styles.rankingItem, {
          backgroundColor: settings.cardBackgroundColor,
          borderColor: settings.borderColor,
          shadowColor: settings.colorScheme === 'dark' ? '#FFFFFF' : '#000000'
        }]}
        onPress={() => {
          navigation.navigate('TeamInfo', {
            teamNumber: item.team_number,
            teamName: item.team_name || item.team_number
          });
        }}
      >
        <View style={styles.rankingContent}>
          <View style={styles.rankContainer}>
            <Text style={[styles.rankText, { color: settings.textColor }]}>
              {item.showOriginalRank ? `#${item.displayRank}` : `#${item.ts_ranking}`}
            </Text>
            {item.showOriginalRank && (
              <Text style={[styles.originalRankText, { color: settings.secondaryTextColor }]}>
                (#{item.originalRank})
              </Text>
            )}
            {item.ranking_change !== 0 && (
              <Text style={[styles.rankingChange, {
                color: item.ranking_change > 0 ? '#4CAF50' : '#FF6B6B'
              }]}>
                {item.ranking_change > 0 ? '↑' : '↓'}{Math.abs(item.ranking_change)}
              </Text>
            )}
          </View>

          <View style={styles.teamInfo}>
            <Text style={[styles.teamNumber, { color: settings.textColor }]}>{item.team_number}</Text>
            <Text style={[styles.teamName, { color: settings.secondaryTextColor }]}>{item.team_name}</Text>
            <Text style={[styles.location, { color: settings.secondaryTextColor }]} numberOfLines={1}>
              📍 {item.loc_region || item.loc_country}
            </Text>
          </View>

          <View style={styles.scoresContainer}>
            <View style={styles.scoreItem}>
              <Text style={[styles.scoreLabel, { color: settings.secondaryTextColor }]}>TrueSkill</Text>
              <Text style={[styles.totalScore, { color: settings.buttonColor }]}>
                {item.trueskill != null ? item.trueskill.toFixed(1) : 'N/A'}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.expandButton, {
                backgroundColor: settings.buttonColor,
              }]}
              onPress={(e) => {
                e.stopPropagation();
                toggleExpand(item.team_number);
              }}
            >
              <Ionicons
                name={isExpanded ? "chevron-up" : "chevron-down"}
                size={18}
                color="#FFFFFF"
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.favoriteButton}
            onPress={async (e) => {
              e.stopPropagation();
              try {
                if (isTeamFavorited(item.team_number)) {
                  await removeTeam(item.team_number);
                } else {
                  const teamObj = {
                    id: item.id,
                    number: item.team_number,
                    team_name: item.team_name,
                    organization: '',
                    location: {
                      city: '',
                      region: item.loc_region,
                      country: item.loc_country,
                    },
                    robot_name: '',
                    grade: item.grade,
                    registered: true,
                    program: {
                      id: 1,
                      name: 'VEX V5 Robotics Competition',
                      code: 'V5RC',
                    },
                  };
                  await addTeam(teamObj);
                }
              } catch (error) {
                logger.error('Failed to toggle team favorite:', error);
                Alert.alert('Error', 'Failed to update favorite status');
              }
            }}
          >
            <Ionicons
              name={isTeamFavorited(item.team_number) ? "heart" : "heart-outline"}
              size={20}
              color={isTeamFavorited(item.team_number) ? "#FF6B6B" : settings.iconColor}
            />
          </TouchableOpacity>
        </View>

        {/* Expandable details section */}
        {isExpanded && (
          <View style={[styles.expandedDetails, { borderTopColor: settings.borderColor }]}>
            <View style={styles.detailsRow}>
              <View style={styles.detailItem}>
                <Text style={[styles.detailLabel, { color: settings.secondaryTextColor }]}>CCWM</Text>
                <Text style={[styles.detailValue, { color: settings.textColor }]}>
                  {item.ccwm != null ? item.ccwm.toFixed(1) : 'N/A'}
                </Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={[styles.detailLabel, { color: settings.secondaryTextColor }]}>OPR</Text>
                <Text style={[styles.detailValue, { color: settings.textColor }]}>
                  {item.opr != null ? item.opr.toFixed(1) : 'N/A'}
                </Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={[styles.detailLabel, { color: settings.secondaryTextColor }]}>DPR</Text>
                <Text style={[styles.detailValue, { color: settings.textColor }]}>
                  {item.dpr != null ? item.dpr.toFixed(1) : 'N/A'}
                </Text>
              </View>
            </View>
            <View style={styles.detailsRow}>
              <View style={styles.detailItem}>
                <Text style={[styles.detailLabel, { color: settings.secondaryTextColor }]}>Record</Text>
                <Text style={[styles.detailValue, { color: settings.textColor }]}>
                  {item.total_wins}-{item.total_losses}-{item.total_ties}
                </Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={[styles.detailLabel, { color: settings.secondaryTextColor }]}>Win %</Text>
                <Text style={[styles.detailValue, { color: settings.textColor }]}>
                  {item.total_winning_percent != null ? item.total_winning_percent.toFixed(1) : 'N/A'}%
                </Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={[styles.detailLabel, { color: settings.secondaryTextColor }]}>Skills</Text>
                <Text style={[styles.detailValue, { color: settings.textColor }]}>
                  #{item.total_skills_ranking || 'N/A'}
                </Text>
              </View>
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  }, [
    settings.cardBackgroundColor,
    settings.borderColor,
    settings.colorScheme,
    settings.textColor,
    settings.secondaryTextColor,
    settings.buttonColor,
    settings.iconColor,
    navigation,
    isTeamFavorited,
    addTeam,
    removeTeam,
    expandedTeams,
    toggleExpand
  ]);

  if (isLoading) {
    return (
      <View style={styles.container}>
        {/* Show 10 skeleton cards while loading */}
        {Array.from({ length: 10 }).map((_, index) => (
          <TrueSkillRankingSkeleton key={`skeleton-${index}`} />
        ))}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search Results Count */}
      {isSearchVisible && filteredTrueSkillRankings.length !== trueSkillRankings.length && (
        <View style={[styles.searchResultsContainer, {
          backgroundColor: settings.cardBackgroundColor,
          borderBottomColor: settings.borderColor
        }]}>
          <Text style={[styles.searchResults, { color: settings.secondaryTextColor }]}>
            {`Showing ${filteredTrueSkillRankings.length} of ${trueSkillRankings.length} teams`}
          </Text>
        </View>
      )}

      <FlatList
        ref={flatListRef}
        data={filteredTrueSkillRankings}
        renderItem={renderTrueSkillItem}
        keyExtractor={(item) => `trueskill-${item.team_number}`}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={onRefresh}
        ListEmptyComponent={
          <View style={styles.emptyStateContainer}>
            <Ionicons
              name="analytics-outline"
              size={64}
              color={settings.secondaryTextColor}
              style={styles.emptyStateIcon}
            />
            <Text style={[styles.emptyStateTitle, { color: settings.textColor }]}>
              No TrueSkill Rankings
            </Text>
            <Text style={[styles.emptyStateMessage, { color: settings.secondaryTextColor }]}>
              No TrueSkill rankings available. Pull to refresh or check your connection.
            </Text>
          </View>
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
  searchResultsContainer: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  searchResults: {
    fontSize: 12,
    textAlign: 'center',
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
    padding: 12,
    alignItems: 'center',
  },
  rankContainer: {
    minWidth: 50,
    alignItems: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  rankText: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  originalRankText: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 1,
  },
  rankingChange: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
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
  expandButton: {
    padding: 6,
    marginTop: 4,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteButton: {
    padding: 8,
  },
  expandedDetails: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingBottom: 12,
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
});

export default TrueSkillRankings;
