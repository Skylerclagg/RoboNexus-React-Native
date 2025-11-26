/**
 * World Skills Rankings Component
 *
 * Displays World Skills rankings for VEX robotics programs.
 * Shows programming, driver, and combined skills scores with filtering options.
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../contexts/SettingsContext';
import { useFavorites } from '../contexts/FavoritesContext';
import { useDataCache } from '../contexts/DataCacheContext';
import { WorldSkillsResponse } from '../types';
import { createLogger } from '../utils/logger';
import { getProgramId } from '../utils/programMappings';
import AnimatedScrollBar from './AnimatedScrollBar';
import WorldSkillsRankingSkeleton from './WorldSkillsRankingSkeleton';

const logger = createLogger('WorldSkillsRankings');

type DivisionType = 'High School' | 'Middle School' | 'Elementary' | 'College';

// Extended WorldSkillsResponse with filtering properties
interface ExtendedWorldSkillsResponse extends WorldSkillsResponse {
  originalRank?: number;
  displayRank?: number;
  showOriginalRank?: boolean;
}

interface WorldSkillsRankingsProps {
  navigation: any;
  selectedDivision: DivisionType;
  selectedSeasonId: string;
  selectedProgram: string;
  isSearchVisible: boolean;
  searchText: string;
  onSearchTextChange: (text: string) => void;
  regionFilter: string;
}

const WorldSkillsRankings: React.FC<WorldSkillsRankingsProps> = ({
  navigation,
  selectedDivision,
  selectedSeasonId,
  selectedProgram,
  isSearchVisible,
  searchText,
  onSearchTextChange,
  regionFilter,
}) => {
  const settings = useSettings();
  const { addTeam, removeTeam, isTeamFavorited } = useFavorites();
  const { getWorldSkills, preloadWorldSkills } = useDataCache();

  const [rankings, setRankings] = useState<ExtendedWorldSkillsResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Scroll tracking
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
    if (regionFilter) {
      filtered = filtered.filter(item => item.team.region === regionFilter);
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
    const isFiltered = regionFilter || searchText.trim();

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
  }, [rankings, searchText, regionFilter]);

  const loadRankings = useCallback(async () => {
    setIsLoading(true);
    try {
      if (!selectedSeasonId) {
        logger.warn('No season ID provided');
        setRankings([]);
        return;
      }

      const seasonId = parseInt(selectedSeasonId);
      const programId = getProgramId(selectedProgram);

      logger.debug('Loading rankings for season ID:', seasonId, 'division:', selectedDivision, 'program:', selectedProgram);

      // Cache-first approach: try to get from cache first
      let skillsData = getWorldSkills(seasonId, programId, selectedDivision);

      // If cache is empty, pre-load it and use returned data
      if (!skillsData || skillsData.length === 0) {
        logger.debug('Cache empty, pre-loading World Skills data...');
        skillsData = await preloadWorldSkills(seasonId, programId, selectedDivision);
      }

      logger.debug('Loaded rankings count:', skillsData.length);
      setRankings(skillsData);
    } catch (error) {
      logger.error('Failed to load rankings:', error);
      Alert.alert(
        'Error',
        `Failed to load rankings for ${selectedProgram}. Please check your internet connection and try again.`
      );
      setRankings([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDivision, selectedSeasonId, selectedProgram, getWorldSkills, preloadWorldSkills]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadRankings();
    } catch (error) {
      logger.error('Failed to refresh rankings:', error);
      Alert.alert(
        'Refresh Failed',
        'Unable to refresh rankings. Please check your internet connection and try again.'
      );
    } finally {
      setRefreshing(false);
    }
  }, [loadRankings]);

  const formatLocation = (team: any) => {
    const parts = [team.city, team.region, team.country];
    return parts.filter(Boolean).join(', ').replace('United States', 'USA');
  };

  useEffect(() => {
    if (selectedSeasonId && selectedDivision) {
      loadRankings();
    }
  }, [selectedDivision, selectedSeasonId, selectedProgram]);

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
              logger.error('Failed to toggle team favorite:', error);
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

  if (isLoading) {
    return (
      <View style={styles.container}>
        {/* Show 10 skeleton cards while loading */}
        {Array.from({ length: 10 }).map((_, index) => (
          <WorldSkillsRankingSkeleton key={`skeleton-${index}`} />
        ))}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search Results Count */}
      {isSearchVisible && filteredRankings.length !== rankings.length && (
        <View style={[styles.searchResultsContainer, {
          backgroundColor: settings.cardBackgroundColor,
          borderBottomColor: settings.borderColor
        }]}>
          <Text style={[styles.searchResults, { color: settings.secondaryTextColor }]}>
            {`Showing ${filteredRankings.length} of ${rankings.length} teams`}
          </Text>
        </View>
      )}

      <FlatList
        ref={flatListRef}
        data={filteredRankings}
        renderItem={renderRankingItem}
        keyExtractor={(item) => `${item.team.team}-${selectedSeasonId}-${selectedDivision}`}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={onRefresh}
        ListEmptyComponent={
          <View style={styles.emptyStateContainer}>
            <Ionicons
              name={regionFilter ? "filter-outline" : "trophy-outline"}
              size={64}
              color={settings.secondaryTextColor}
              style={styles.emptyStateIcon}
            />
            <Text style={[styles.emptyStateTitle, { color: settings.textColor }]}>
              {regionFilter ? 'No Teams Found' : 'No Rankings Available'}
            </Text>
            <Text style={[styles.emptyStateMessage, { color: settings.secondaryTextColor }]}>
              {regionFilter
                ? `No teams found in ${regionFilter} for ${selectedDivision}.`
                : `No World Skills rankings available for ${selectedDivision} this season.`}
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

export default WorldSkillsRankings;
