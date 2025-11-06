/**
 * TEAM INFO SCREEN
 *
 * Comprehensive team profile screen showing detailed team information, statistics,
 * World Skills rankings, awards, and event history organized by seasons.
 *
 * NAVIGATION ACCESS:
 * - Dashboard → Tap on any team card
 * - Lookup Screen → Tap on search results
 * - Event screens → Tap on team names
 * - Direct team number navigation
 *
 * KEY FEATURES:
 * - Complete team profile with location and program
 * - Live World Skills rankings with trend indicators
 * - Awards history by season (collapsible sections)
 * - Event participation history
 * - Season filtering and statistics
 * - Add/remove from favorites
 * - Social sharing capabilities
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  FlatList,
  RefreshControl,
  Image,
  ActionSheetIOS,
  Platform,
  Modal,
  Dimensions,
  PanResponder,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { robotEventsAPI } from '../services/apiRouter';
import { useSettings } from '../contexts/SettingsContext';
import { useFavorites } from '../contexts/FavoritesContext';
import { useNotes } from '../contexts/NotesContext';
import { useDataCache } from '../contexts/DataCacheContext';
import { Team, Event } from '../types';
import { Award } from '../types/api';
import EventCard from '../components/EventCard';
import TeamInfoCard from '../components/TeamInfoCard';
import DropdownPicker from '../components/DropdownPicker';
import EventTeamMatchesScreen from './EventTeamMatchesScreen';
import { expandLeagueEvent, ExtendedEvent, filterLiveEvents, selectCurrentLiveEvent } from '../utils/eventUtils';
import { getProgramId, getProgramConfig, is2v0Format, useThemedScoreColors } from '../utils/programMappings';

interface Props {
  route: {
    params: {
      teamNumber: string;
      teamData?: Team;
    };
  };
  navigation: any;
}

interface TeamInfo {
  property: string;
  value: string;
}

interface WorldSkillsData {
  ranking: number;
  combined: number;
  driver: number;
  programming: number;
  highestDriver: number;
  highestProgramming: number;
  totalTeams: number;
}

interface AwardCounts {
  [awardTitle: string]: number;
}

interface EventsState {
  events: Event[];
  loading: boolean;
}

interface MatchRecord {
  wins: number;
  losses: number;
  ties: number;
  totalMatches: number;
}

const TeamInfoScreen = ({ route, navigation }: Props) => {
  const { teamNumber, teamData } = route.params;
  const { selectedProgram, globalSeasonEnabled, selectedSeason: globalSeason, updateGlobalSeason, ...settings } = useSettings();
  const { addTeam, removeTeam, isTeamFavorited } = useFavorites();
  const { getNotesByTeam, createNote, deleteNote } = useNotes();
  const {
    getSeasons,
    getTeamEvents,
    getTeamAwards,
    getWorldSkills,
    preloadSeasons,
    preloadTeamEvents,
    preloadTeamAwards,
    preloadWorldSkills,
    isTeamEventsLoading,
    isTeamAwardsLoading,
    forceRefreshSeasons,
    forceRefreshTeamEvents,
    forceRefreshTeamAwards,
    forceRefreshWorldSkills
  } = useDataCache();

  const [selectedTab, setSelectedTab] = useState(0); // 0 = Events, 1 = Statistics, 2 = Awards, 3 = Notes, 4 = Matches (if at event), 5 = Developer (if enabled)
  const [selectedSeason, setSelectedSeason] = useState<string>('');
  const [seasons, setSeasons] = useState<{label: string, value: string}[]>([]);
  const [apiActiveSeason, setApiActiveSeason] = useState<{id: number, name: string} | null>(null);
  const [team, setTeam] = useState<Team | null>(teamData || null);
  const [teamFetched, setTeamFetched] = useState(false);
  const [teamLoading, setTeamLoading] = useState(false);
  const [worldSkillsData, setWorldSkillsData] = useState<WorldSkillsData | null>(null);
  const [awardCounts, setAwardCounts] = useState<AwardCounts>({});
  const [averageRanking, setAverageRanking] = useState<number>(0);
  const [eventsState, setEventsState] = useState<EventsState>({ events: [], loading: false });
  const [expandedSeasons, setExpandedSeasons] = useState<Set<string>>(new Set());
  const [isWorldSkillsExpanded, setIsWorldSkillsExpanded] = useState<boolean>(false);
  const [isAwardsExpanded, setIsAwardsExpanded] = useState<boolean>(false);
  const [teamAwards, setTeamAwards] = useState<Award[]>([]);
  const [awardsLoading, setAwardsLoading] = useState(false);
  const [groupedAwards, setGroupedAwards] = useState<{ [seasonName: string]: Award[] }>({});
  const [newNote, setNewNote] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [modalImageUri, setModalImageUri] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [tripleCrownModalVisible, setTripleCrownModalVisible] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [matchRecord, setMatchRecord] = useState<MatchRecord | null>(null);
  const [matchRecordLoading, setMatchRecordLoading] = useState(false);
  const [worldSkillsLoading, setWorldSkillsLoading] = useState(false);
  const [awardCountsLoading, setAwardCountsLoading] = useState(false);
  // Live event states
  const [isTeamAtEvent, setIsTeamAtEvent] = useState(false);
  const [currentLiveEvent, setCurrentLiveEvent] = useState<any | null>(null);

  // Pan responder for swipe-to-dismiss modal
  const modalPanY = useRef(new Animated.Value(0)).current;
  const panStartY = useRef(0);

  const modalPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return Math.abs(gestureState.dy) > Math.abs(gestureState.dx) && Math.abs(gestureState.dy) > 5;
      },
      onPanResponderGrant: (evt, gestureState) => {
        panStartY.current = evt.nativeEvent.pageY;
      },
      onPanResponderMove: (evt, gestureState) => {
        if (gestureState.dy > 0) {
          modalPanY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dy > 150 || gestureState.vy > 0.5) {
          Animated.timing(modalPanY, {
            toValue: 600,
            duration: 250,
            useNativeDriver: true,
          }).start(() => {
            setTripleCrownModalVisible(false);
            modalPanY.setValue(0);
          });
        } else {
          // Otherwise, snap back to original position
          Animated.spring(modalPanY, {
            toValue: 0,
            tension: 40,
            friction: 8,
            useNativeDriver: true,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        // Reset position if gesture is interrupted
        Animated.spring(modalPanY, {
          toValue: 0,
          tension: 40,
          friction: 8,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  // Check if this is a cooperative format (2v0)
  const isCooperative = is2v0Format(selectedProgram);

  // Determine if we should use themed colors or alliance colors for scores
  const shouldUseThemedColors = useThemedScoreColors(selectedProgram);
  const redScoreColor = shouldUseThemedColors ? settings.textColor : '#FF3B30';
  const blueScoreColor = shouldUseThemedColors ? settings.textColor : '#007AFF';

  // Helper function to get match border color for 2v0 format consistency
  const getMatchBorderColor = (match: any): string => {
    if (isCooperative) {
      const redScore = match.alliances?.[0]?.score ?? null;
      const blueScore = match.alliances?.[1]?.score ?? null;

      if (redScore !== null && blueScore !== null && redScore !== blueScore) {
        if (redScore > blueScore) return redScoreColor; // Red
        if (blueScore > redScore) return blueScoreColor; // Blue
        return '#FFA500'; // Orange for ties
      }

      // Default to gray for 2v0 format
      return '#999999';
    }

    return settings.borderColor;
  };

  useEffect(() => {
    navigation.setOptions({
      title: 'Team Info',
      headerStyle: {
        backgroundColor: settings.topBarColor,
      },
      headerTintColor: settings.topBarContentColor,
      headerTitleAlign: 'center',
      headerTitleStyle: {
        fontWeight: '500',
        fontSize: 19,
      },
    });
  }, [navigation, settings.topBarColor, settings.topBarContentColor]);

  // Auto-expand the most recent season when events are first loaded
  const [hasAutoExpanded, setHasAutoExpanded] = useState(false);

  // Combined effect for global season sync and season-specific data loading
  useEffect(() => {
    // First, sync with global season if global mode is enabled
    if (globalSeasonEnabled && globalSeason && globalSeason !== selectedSeason) {
      console.log('Syncing with global season:', globalSeason);
      setSelectedSeason(globalSeason);
      return; // Let the next effect run with the new selectedSeason
    }

    // Load season-specific data when we have team and selected season
    if (team?.id && selectedSeason && selectedSeason !== '') {
      console.log('Loading season-specific data for season:', selectedSeason, 'team:', team.id);
      const seasonId = parseInt(selectedSeason);

      const loadSeasonData = async () => {
        try {
          // Force refresh world skills cache first for the new season
          const programId = getProgramId(selectedProgram);

          // Load all season-specific data in parallel
          const promises = [
            fetchAwardCounts(team.id),
            fetchMatchRecord(team.id)
          ];

          if (team.grade) {
            console.log('Forcing world skills cache refresh for season:', seasonId, 'program:', programId, 'grade:', team.grade);
            promises.push(
              forceRefreshWorldSkills(seasonId, programId, team.grade).then(() => {
                console.log('World skills cache refreshed, now fetching data');
                return fetchWorldSkillsData(team.id, seasonId);
              })
            );
          }

          await Promise.all(promises);
          console.log('Season-specific data loaded successfully for season:', seasonId);
        } catch (error) {
          console.error('Failed to load season-specific data:', error);
        }
      };

      loadSeasonData();
    }
  }, [globalSeasonEnabled, globalSeason, selectedSeason, team?.id, selectedProgram, team?.grade]);

  const loadSeasons = useCallback(async () => {
    try {
      // Get program ID for filtering
      const programId = getProgramId(selectedProgram);

      // Pre-load seasons into cache (this will be a no-op if already cached)
      await preloadSeasons(programId);

      // Get seasons from cache
      const cachedSeasons = getSeasons(programId);
      console.log('Season data loaded from cache:', cachedSeasons.length, 'seasons');

      const formattedSeasons = cachedSeasons
        .sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime())
        .map(season => {
          const formattedLabel = formatSeasonOption(season.name);
          console.log('Season:', season.name || 'Unknown', '->', formattedLabel || 'Unknown');
          return {
            label: formattedLabel,
            value: season.id.toString()
          };
        });

      setSeasons(formattedSeasons);
      if (formattedSeasons.length > 0) {
        // Use global season if global mode is enabled, otherwise use first season
        const defaultSeason = globalSeasonEnabled && globalSeason
          ? globalSeason
          : formattedSeasons[0].value;
        setSelectedSeason(defaultSeason);
        console.log('Selected season:', defaultSeason);
      }
    } catch (error) {
      console.error('Failed to load seasons:', error);
    }
  }, [selectedProgram, preloadSeasons, getSeasons, globalSeasonEnabled, globalSeason]);

  // Fetch API active season for the selected program
  useEffect(() => {
    const fetchApiActiveSeason = async () => {
      try {
        const seasonId = await robotEventsAPI.getCurrentSeasonId(selectedProgram);
        const seasonData = seasons.find(s => s.value === seasonId.toString());
        setApiActiveSeason({
          id: seasonId,
          name: seasonData?.label || 'Unknown'
        });
      } catch (error) {
        console.error('Failed to fetch API active season:', error);
        setApiActiveSeason(null);
      }
    };

    if (selectedProgram && seasons.length > 0) {
      fetchApiActiveSeason();
    }
  }, [selectedProgram, seasons]);

  const formatSeasonOption = (raw: string) => {
    if (!raw) return 'Unknown Season';

    // Return the full season name as-is
    return raw;
  };

  // Check if team is currently at a live event (similar to Dashboard logic)
  const checkLiveEventStatus = useCallback(async (teamData: Team) => {
    if (!teamData?.id) return;

    try {
      console.log('[TeamInfo] Checking live event status for team', teamNumber);
      const teamEventsResponse = await robotEventsAPI.getTeamEvents(teamData.id);

      // Use centralized utility to find live events
      const liveEvents = filterLiveEvents(teamEventsResponse.data, {
        devLiveEventSimulation: settings.devLiveEventSimulation,
        isDeveloperMode: settings.isDeveloperMode,
        devTestEventId: settings.devTestEventId
      });

      if (liveEvents.length > 0) {
        // Use centralized utility to select the most relevant live event
        const liveEvent = await selectCurrentLiveEvent(
          liveEvents,
          async (eventId) => {
            const response = await robotEventsAPI.getTeamMatches(teamData.id, { event: [eventId] });
            return response.data || [];
          },
          {
            isDeveloperMode: settings.isDeveloperMode,
            devTestEventId: settings.devTestEventId
          }
        );

        if (liveEvent) {
          // selectCurrentLiveEvent already handles match checking, so if we got a result, the team is at the event
          console.log('[TeamInfo] Team', teamNumber, 'is at live event:', liveEvent.name);
          setIsTeamAtEvent(true);
          setCurrentLiveEvent(liveEvent);
          return liveEvent;
        } else {
          console.log('[TeamInfo] Team', teamNumber, 'has no active live event');
          setIsTeamAtEvent(false);
          setCurrentLiveEvent(null);
          return null;
        }
      } else {
        console.log('[TeamInfo] Team', teamNumber, 'is not at any live events');
        setIsTeamAtEvent(false);
        setCurrentLiveEvent(null);
        return null;
      }
    } catch (error) {
      console.error('[TeamInfo] Error checking live event status for team', teamNumber, ':', error);
      setIsTeamAtEvent(false);
      setCurrentLiveEvent(null);
      return null;
    }
  }, [teamNumber, settings.devLiveEventSimulation, settings.isDeveloperMode, settings.devTestEventId]);


  const fetchTeamInfo = useCallback(async () => {
    setTeamLoading(true);
    try {
      // Fetch team data if not provided
      if (!team) {
        const teamData = await robotEventsAPI.getTeamByNumber(teamNumber);
        if (teamData) {
          // Transform API team to UI team type
          const uiTeam = {
            ...teamData,
            organization: teamData.organization || '',
            program: {
              id: teamData.program.id,
              name: teamData.program.name,
              code: teamData.program.code || 'UNKNOWN',
            },
          };
          setTeam(uiTeam);
          // Check if team is at a live event
          await checkLiveEventStatus(uiTeam);
          setTeamFetched(true);

          // fetchTeamEvents and season-specific data will be loaded by separate useEffects
        } else {
          Alert.alert('Error', `Team ${teamNumber} not found`);
        }
      } else {
        setTeamFetched(true);
        // Check if team is at a live event
        if (team) {
          await checkLiveEventStatus(team);
        }
        // fetchTeamEvents and season-specific data will be loaded by separate useEffects
      }
    } catch (error) {
      console.error('Failed to fetch team info:', error);
      Alert.alert('Error', 'Failed to load team information');
    } finally {
      setTeamLoading(false);
    }
  }, [teamNumber, team]);

  const fetchWorldSkillsData = async (teamId: number, seasonId?: number) => {
    setWorldSkillsLoading(true);
    // Clear existing world skills data to show loading state
    setWorldSkillsData(null);

    try {
      console.log('Fetching world skills data for team:', teamId, 'season:', seasonId);

      if (!team || !team.grade) {
        console.log('No team data or grade available for world skills lookup');
        setWorldSkillsData({
          ranking: 0,
          combined: 0,
          driver: 0,
          programming: 0,
          highestDriver: 0,
          highestProgramming: 0,
          totalTeams: 0,
        });
        return;
      }

      // Use provided season or get current season
      let targetSeasonId = seasonId;
      console.log('fetchWorldSkillsData called with seasonId:', seasonId, 'selectedSeason:', selectedSeason);

      if (!targetSeasonId) {
        if (selectedSeason && selectedSeason !== '') {
          // Check if selectedSeason is a season name (contains hyphen) or actual ID
          if (selectedSeason.includes('-')) {
            // It's a season name like "2024-2025", need to get actual season ID
            console.log('Selected season is a name, should not happen in modern app:', selectedSeason);
            targetSeasonId = await robotEventsAPI.getCurrentSeasonId(selectedProgram);
          } else {
            // It's already a season ID
            targetSeasonId = parseInt(selectedSeason);
          }
        } else {
          console.log('No selected season, getting current season');
          targetSeasonId = await robotEventsAPI.getCurrentSeasonId(selectedProgram);
        }
      }
      console.log('Final target season ID for World Skills:', targetSeasonId);

      // Get grade level and program ID for the cache lookup
      const gradeLevel = team.grade;
      const programId = getProgramId(selectedProgram);

      console.log('Team grade level:', gradeLevel, 'Program ID:', programId);

      // Search for team by ID across ALL grade caches for this program/season
      // This ensures we find the team even if grade data is wrong or missing
      console.log('[TeamInfo] Searching for team ID', teamId, 'in World Skills caches for season', targetSeasonId);

      let teamSkillsData = null;
      const programConfig = getProgramConfig(selectedProgram);
      const allGradeCaches: any[] = []; // Collect all grade data for total count

      // Try each available grade for this program
      for (const grade of programConfig.availableGrades) {
        let gradeCache = getWorldSkills(targetSeasonId, programId, grade);

        // If cache is empty, try to preload it and use returned data
        if (gradeCache.length === 0) {
          console.log(`[TeamInfo] Cache empty for ${grade}, preloading...`);
          gradeCache = await preloadWorldSkills(targetSeasonId, programId, grade);
        }

        // Collect this grade's data for total count
        allGradeCaches.push(...gradeCache);

        // Search for team by ID in this grade's cache
        if (gradeCache.length > 0) {
          teamSkillsData = gradeCache.find((ranking: any) =>
            ranking.team && ranking.team.id === teamId
          );

          if (teamSkillsData) {
            console.log(`[TeamInfo] ✓ Found team in ${grade} World Skills rankings`);
            break;
          }
        }
      }

      const totalTeams = allGradeCaches.length;
      console.log('[TeamInfo] Total teams across all grades:', totalTeams);

      if (teamSkillsData) {
        console.log('Found team in world skills rankings:', teamSkillsData);
        setWorldSkillsData({
          ranking: teamSkillsData.rank || 0,
          combined: teamSkillsData.scores?.score || 0,
          driver: teamSkillsData.scores?.driver || 0,
          programming: teamSkillsData.scores?.programming || 0,
          highestDriver: teamSkillsData.scores?.driver || 0,
          highestProgramming: teamSkillsData.scores?.programming || 0,
          totalTeams: totalTeams,
        });
      } else {
        console.log('Team not found in world skills rankings');
        setWorldSkillsData({
          ranking: 0,
          combined: 0,
          driver: 0,
          programming: 0,
          highestDriver: 0,
          highestProgramming: 0,
          totalTeams: totalTeams,
        });
      }
    } catch (error) {
      console.error('Failed to fetch world skills data:', error);
      setWorldSkillsData({
        ranking: 0,
        combined: 0,
        driver: 0,
        programming: 0,
        highestDriver: 0,
        highestProgramming: 0,
        totalTeams: 0,
      });
    } finally {
      setWorldSkillsLoading(false);
    }
  };

  const fetchAwardCounts = async (teamId: number) => {
    setAwardCountsLoading(true);
    try {
      console.log('Fetching awards for team:', teamId);

      // Get season ID to fetch awards for - use selectedSeason if available, otherwise current season
      let seasonId: number;
      if (selectedSeason && selectedSeason !== '') {
        seasonId = parseInt(selectedSeason);
      } else {
        seasonId = await robotEventsAPI.getCurrentSeasonId(selectedProgram);
      }

      console.log('Fetching awards for season:', seasonId);

      // Fetch team awards for the selected season
      const teamAwardsResponse = await robotEventsAPI.getTeamAwards(teamId, { season: [seasonId] });
      console.log('Awards returned:', teamAwardsResponse.data.length);

      // Count awards by title (similar to Swift implementation)
      const awardCounts: AwardCounts = {};
      teamAwardsResponse.data.forEach((award: any) => {
        let title = award.title || 'Unknown Award';

        // Clean up award title (remove parenthetical content like in Swift)
        title = title.replace(/\([^()]*\)/g, '').trim();

        awardCounts[title] = (awardCounts[title] || 0) + 1;
      });

      console.log('Processed award counts:', awardCounts);
      setAwardCounts(awardCounts);
    } catch (error) {
      console.error('Failed to fetch award counts:', error);
      setAwardCounts({});
    } finally {
      setAwardCountsLoading(false);
    }
  };

  const fetchMatchRecord = async (teamId: number) => {
    setMatchRecordLoading(true);
    try {
      console.log('Fetching match record for team:', teamId);

      // Get season ID to fetch rankings for
      let seasonId: number;
      if (selectedSeason && selectedSeason !== '') {
        seasonId = parseInt(selectedSeason);
      } else {
        seasonId = await robotEventsAPI.getCurrentSeasonId(selectedProgram);
      }

      console.log('Fetching rankings for season:', seasonId);

      // Fetch team rankings for the selected season
      // Rankings contain the official match record (wins/losses/ties) for each event
      const teamRankings = await robotEventsAPI.getTeamRankings(teamId, { season: [seasonId] });
      console.log('Rankings returned:', teamRankings.data.length);

      let totalWins = 0;
      let totalLosses = 0;
      let totalTies = 0;

      // Sum up wins/losses/ties from all events in the season
      teamRankings.data.forEach((ranking: any) => {
        totalWins += ranking.wins || 0;
        totalLosses += ranking.losses || 0;
        totalTies += ranking.ties || 0;
      });

      const record: MatchRecord = {
        wins: totalWins,
        losses: totalLosses,
        ties: totalTies,
        totalMatches: totalWins + totalLosses + totalTies
      };

      console.log('Processed match record from rankings:', record);
      setMatchRecord(record);
    } catch (error) {
      console.error('Failed to fetch match record:', error);
      setMatchRecord({
        wins: 0,
        losses: 0,
        ties: 0,
        totalMatches: 0
      });
    } finally {
      setMatchRecordLoading(false);
    }
  };

  const handleTeamFavorite = async () => {
    try {
      if (!team) return;

      if (isTeamFavorited(teamNumber)) {
        await removeTeam(teamNumber);
      } else {
        await addTeam(team);
      }
    } catch (error) {
      console.error('Failed to toggle team favorite:', error);
      Alert.alert('Error', 'Failed to update favorite status');
    }
  };

  const fetchTeamEvents = useCallback(async () => {
    if (!team?.id) return;

    // Check if already cached
    const cachedEvents = getTeamEvents(team.id);
    if (cachedEvents.length > 0) {
      console.log('Using cached team events:', cachedEvents.length, 'events');
      setEventsState({ events: cachedEvents, loading: false });
      return;
    }

    // Set loading state based on cache loading state
    const loading = isTeamEventsLoading(team.id);
    setEventsState(prev => ({ ...prev, loading }));

    try {
      // Pre-load events into cache
      await preloadTeamEvents(team.id);

      // Get events from cache
      const events = getTeamEvents(team.id);
      setEventsState({ events, loading: false });
    } catch (error) {
      console.error('Failed to fetch team events:', error);
      setEventsState({ events: [], loading: false });
    }
  }, [team?.id, getTeamEvents, isTeamEventsLoading, preloadTeamEvents]);

  const loadTeamAwards = useCallback(async () => {
    if (!team?.id) return;

    // Check if already cached
    const cachedAwards = getTeamAwards(team.id);
    if (cachedAwards.length > 0) {
      console.log('Using cached team awards:', cachedAwards.length, 'awards');
      setTeamAwards(cachedAwards);
      setAwardsLoading(false);
      return;
    }

    // Set loading state based on cache loading state
    const loading = isTeamAwardsLoading(team.id);
    setAwardsLoading(loading);

    try {
      console.log('Loading awards for team:', team.id);

      // Pre-load awards into cache
      await preloadTeamAwards(team.id);

      // Get awards from cache
      const awards = getTeamAwards(team.id);
      console.log('Awards loaded from cache:', awards.length, 'awards found');

      setTeamAwards(awards);
    } catch (error) {
      console.error('Failed to load team awards:', error);
      setTeamAwards([]);
    } finally {
      setAwardsLoading(false);
    }
  }, [team?.id, getTeamAwards, isTeamAwardsLoading, preloadTeamAwards]);

  const navigateToEvents = () => {
    if (team) {
      navigation.navigate('TeamEvents', {
        teamNumber: teamNumber,
        teamData: team,
      });
    }
  };

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) {
      console.log('[TeamInfoScreen] Already refreshing, skipping duplicate call to prevent API exhaustion');
      return;
    }

    if (!team?.id) return;

    setIsRefreshing(true);

    try {
      console.log('[TeamInfoScreen] Starting pull-to-refresh...');

      // Get program and season info for refresh
      const programId = getProgramId(selectedProgram);

      const seasonId = selectedSeason ? parseInt(selectedSeason) :
                      await robotEventsAPI.getCurrentSeasonId(selectedProgram);

      // Refresh all data in parallel for better performance
      const refreshPromises = [
        forceRefreshSeasons(programId),
        forceRefreshTeamEvents(team.id),
        forceRefreshTeamAwards(team.id),
      ];

      // Add world skills refresh if we have the team grade
      if (team.grade) {
        refreshPromises.push(forceRefreshWorldSkills(seasonId, programId, team.grade));
      }

      await Promise.all(refreshPromises);

      // Reload local data from the refreshed cache
      await Promise.all([
        loadSeasons(),
        fetchTeamEvents(),
        loadTeamAwards(),
      ]);

      // Refresh season-specific data with the current selected season
      console.log('[TeamInfoScreen] Refreshing season-specific data for season:', seasonId);
      await Promise.all([
        // World Skills
        team.grade ? fetchWorldSkillsData(team.id, seasonId) : Promise.resolve(),
        // Awards for specific season
        fetchAwardCounts(team.id),
        // Matches for specific season
        fetchMatchRecord(team.id)
      ]);

      console.log('[TeamInfoScreen] Pull-to-refresh completed successfully');
    } catch (error) {
      console.error('[TeamInfoScreen] Pull-to-refresh failed:', error);
      Alert.alert('Refresh Failed', 'Unable to refresh data. Please try again.');
    } finally {
      setIsRefreshing(false);
    }
  }, [
    team?.id,
    selectedProgram,
    selectedSeason,
    forceRefreshSeasons,
    forceRefreshTeamEvents,
    forceRefreshTeamAwards,
    forceRefreshWorldSkills,
    loadSeasons,
    fetchTeamEvents,
    loadTeamAwards,
    fetchWorldSkillsData,
    fetchAwardCounts,
    fetchMatchRecord
  ]);

  const getDynamicLabel = (defaultLabel: string) => {
    if (selectedProgram === 'Aerial Drone Competition') {
      return defaultLabel.replace('Robot', 'Drone');
    }
    return defaultLabel;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatEventLocation = (event: Event) => {
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

  const groupEventsBySeason = useCallback(() => {
    const eventsBySeason: { [seasonName: string]: Event[] } = {};

    console.log('Grouping events by season. Total events:', eventsState.events.length);
    console.log('Available seasons:', seasons.map(s => s.label));

    eventsState.events.forEach(event => {
      console.log('Processing event:', event.name, 'Season data:', event.season);
      // Check if the event has a season property we can use
      let seasonName: string;

      if (event.season && event.season.name) {
        // Use the event's season information if available
        seasonName = event.season.name;
      } else {
        const eventDate = new Date(event.start);
        const matchingSeason = seasons.find(season => {
          // Try to find a season that this event date would fall into
          // This is a heuristic based on typical VEX season timing
          const eventYear = eventDate.getFullYear();
          const eventMonth = eventDate.getMonth(); // 0-11

          // Extract year from season label if possible
          const seasonYearMatch = season.label.match(/(\d{4})/);
          if (seasonYearMatch) {
            const seasonYear = parseInt(seasonYearMatch[0]);

            // VEX seasons typically run from April to next April
            if (eventMonth >= 3) { // April-December
              return seasonYear === eventYear;
            } else { // January-March
              return seasonYear === eventYear - 1;
            }
          }
          return false;
        });

        if (matchingSeason) {
          seasonName = matchingSeason.label;
        } else {
          // Final fallback: create year-based season name
          const year = eventDate.getFullYear();
          let seasonStart: number;
          if (eventDate.getMonth() >= 3) { // April or later
            seasonStart = year;
          } else { // January-March
            seasonStart = year - 1;
          }
          seasonName = `${seasonStart}-${seasonStart + 1} Season`;
        }
      }

      if (!eventsBySeason[seasonName]) {
        eventsBySeason[seasonName] = [];
      }
      eventsBySeason[seasonName].push(event);
    });

    // Sort events within each season by date (earliest to latest)
    Object.keys(eventsBySeason).forEach(season => {
      eventsBySeason[season].sort((a, b) =>
        new Date(a.start).getTime() - new Date(b.start).getTime()
      );
    });

    return eventsBySeason;
  }, [eventsState.events, seasons]);

  const groupAwardsBySeason = useCallback(async () => {
    if (teamAwards.length === 0) {
      setGroupedAwards({});
      return;
    }

    const awardsBySeason: { [seasonName: string]: Award[] } = {};
    const eventCache = new Map<number, Event>();

    console.log('Grouping awards by season. Total awards:', teamAwards.length);
    console.log('Available events loaded:', eventsState.events.length);

    // First, cache all loaded events by ID for quick lookup
    eventsState.events.forEach(event => {
      eventCache.set(event.id, event);
    });

    // Process each award and fetch missing event data if needed
    for (const award of teamAwards) {
      let matchedEvent = eventCache.get(award.event.id);

      // If event not in cache, fetch it from the API
      if (!matchedEvent) {
        try {
          console.log(`Fetching event ${award.event.id} for award "${award.title}"`);
          const eventResponse = await robotEventsAPI.getEventById(award.event.id);
          if (eventResponse) {
            // Transform API event to match our Event type (same transformation as in DataCacheContext)
            const transformedEvent: Event = {
              ...eventResponse,
              program: {
                id: eventResponse.program.id,
                name: eventResponse.program.name,
                code: eventResponse.program.code || 'UNKNOWN',
              },
              season: eventResponse.season ? {
                id: eventResponse.season.id,
                name: eventResponse.season.name,
                program: {
                  id: eventResponse.program.id,
                  name: eventResponse.program.name,
                  code: eventResponse.program.code || 'UNKNOWN',
                },
              } : { id: 0, name: 'Unknown', program: { id: 0, name: 'Unknown', code: 'UNKNOWN' } },
            };
            matchedEvent = transformedEvent;
            eventCache.set(award.event.id, transformedEvent);
          }
        } catch (error) {
          console.error(`Failed to fetch event ${award.event.id}:`, error);
        }
      }

      // Determine season name from the matched event
      let seasonName: string = 'Unknown Season';
      if (matchedEvent && matchedEvent.season && matchedEvent.season.name) {
        seasonName = matchedEvent.season.name;
      } else {
        console.warn(`Could not determine season for award "${award.title}" (Event ID: ${award.event.id})`);
      }

      if (!awardsBySeason[seasonName]) {
        awardsBySeason[seasonName] = [];
      }
      awardsBySeason[seasonName].push(award);
    }

    // Sort awards within each season by event order (or title)
    Object.keys(awardsBySeason).forEach(season => {
      awardsBySeason[season].sort((a, b) => a.order - b.order);
    });

    console.log('Grouped awards by season:', Object.keys(awardsBySeason).map(season =>
      `${season}: ${awardsBySeason[season].length} awards`));

    setGroupedAwards(awardsBySeason);
  }, [teamAwards, eventsState.events]);

  // Detect Triple Crowns for the current season
  const tripleCrownData = useMemo(() => {
    if (!selectedSeason || teamAwards.length === 0) {
      return { count: 0, events: [] };
    }

    // Find the current season's name
    const currentSeasonData = seasons.find(s => s.value === selectedSeason);
    if (!currentSeasonData) {
      return { count: 0, events: [] };
    }

    // Filter awards for the current season
    const currentSeasonAwards = teamAwards.filter(award => {
      const matchedEvent = eventsState.events.find(event => event.id === award.event.id);
      return matchedEvent?.season?.name === currentSeasonData.label;
    });

    // Group awards by event
    const awardsByEvent: { [eventId: number]: Award[] } = {};
    currentSeasonAwards.forEach(award => {
      const eventId = award.event.id || 0;
      if (!awardsByEvent[eventId]) {
        awardsByEvent[eventId] = [];
      }
      awardsByEvent[eventId].push(award);
    });

    // Check each event for Triple Crown
    const tripleCrownEvents: number[] = [];
    Object.entries(awardsByEvent).forEach(([eventId, awards]) => {
      let hasTournamentChampion = false;
      let hasExcellence = false;
      let hasSkillsChampion = false;

      awards.forEach(award => {
        const titleLower = award.title.toLowerCase();

        // Check for Tournament Champion or Teamwork Champion
        if (titleLower.includes('tournament champion') || titleLower.includes('teamwork champion')) {
          hasTournamentChampion = true;
        }

        // Check for Excellence Award or All Around Champion
        if (titleLower.includes('excellence') || titleLower.includes('all around champion')) {
          hasExcellence = true;
        }

        // Check for Robot Skills Champion
        if (titleLower.includes('robot skills champion')) {
          hasSkillsChampion = true;
        }
      });

      // Triple Crown achieved if all three are true
      if (hasTournamentChampion && hasExcellence && hasSkillsChampion) {
        tripleCrownEvents.push(parseInt(eventId));
      }
    });

    return { count: tripleCrownEvents.length, events: tripleCrownEvents };
  }, [selectedSeason, teamAwards, seasons, eventsState.events]);

  // Calculate qualification status for current season
  const currentSeasonQualification = useMemo(() => {
    if (!selectedSeason || teamAwards.length === 0) {
      return { hasWorldsQual: false, hasRegionalQual: false };
    }

    // Find the current season's name
    const currentSeasonData = seasons.find(s => s.value === selectedSeason);
    if (!currentSeasonData) {
      return { hasWorldsQual: false, hasRegionalQual: false };
    }

    // Filter awards for the current season
    const currentSeasonAwards = teamAwards.filter(award => {
      const matchedEvent = eventsState.events.find(event => event.id === award.event.id);
      return matchedEvent?.season?.name === currentSeasonData.label;
    });

    // Check for qualifications
    let hasWorldsQual = false;
    let hasRegionalQual = false;

    currentSeasonAwards.forEach(award => {
      if (award.qualifications && Array.isArray(award.qualifications)) {
        award.qualifications.forEach(qual => {
          const qualLower = qual.toLowerCase();
          if (qualLower.includes('world')) {
            hasWorldsQual = true;
          } else if (qualLower.includes('regional') || qualLower.includes('region') || qualLower.includes('state') || qualLower.includes('championship')) {
            hasRegionalQual = true;
          }
        });
      }
    });

    return { hasWorldsQual, hasRegionalQual };
  }, [selectedSeason, teamAwards, seasons, eventsState.events]);

  // Group awards by season when awards or events change
  useEffect(() => {
    groupAwardsBySeason();
  }, [groupAwardsBySeason]);

  // Use effects that depend on functions - placed after function declarations
  useEffect(() => {
    loadSeasons();
    fetchTeamInfo();
  }, [loadSeasons, fetchTeamInfo]);

  useEffect(() => {
    if (team?.id) {
      fetchTeamEvents();
    }
  }, [team?.id, fetchTeamEvents]);

  useEffect(() => {
    if (team?.id) {
      loadTeamAwards();
    }
  }, [team?.id, loadTeamAwards]);


  useEffect(() => {
    if (eventsState.events.length > 0 && !hasAutoExpanded && seasons.length > 0) {
      const eventsBySeason = groupEventsBySeason();
      const seasonNames = Object.keys(eventsBySeason);

      if (seasonNames.length > 0) {
        // Sort seasons and expand the most recent one
        const sortedSeasons = seasonNames.sort((a, b) => {
          // Find the corresponding season objects
          const seasonA = seasons.find(s => s.label === a);
          const seasonB = seasons.find(s => s.label === b);

          if (seasonA && seasonB) {
            // Sort by season value as numbers (newest first)
            const valueA = parseInt(seasonA.value);
            const valueB = parseInt(seasonB.value);
            return valueB - valueA;
          }

          const yearA = parseInt(a.match(/(\d{4})/)?.[0] || '0');
          const yearB = parseInt(b.match(/(\d{4})/)?.[0] || '0');
          return yearB - yearA;
        });
        console.log('Auto-expanding season:', sortedSeasons[0]);
        setExpandedSeasons(new Set([sortedSeasons[0]]));
        setHasAutoExpanded(true);
      }
    }
  }, [eventsState.events.length, seasons.length, hasAutoExpanded, groupEventsBySeason]);

  // Cache validation on screen focus
  useFocusEffect(
    useCallback(() => {
      if (!team?.id || !team?.grade || !selectedSeason) return;

      const programId = getProgramId(selectedProgram);
      let seasonId: number;

      // Parse season ID
      if (selectedSeason.includes('-')) {
        // Season name, would need to resolve - skip for now
        return;
      } else {
        seasonId = parseInt(selectedSeason);
      }

      // Check if World Skills cache is empty and pre-load if needed
      const cacheData = getWorldSkills(seasonId, programId, team.grade);
      if (!cacheData || cacheData.length === 0) {
        console.log(`[TeamInfoScreen] Cache empty for ${team.grade} on focus, pre-loading...`);
        preloadWorldSkills(seasonId, programId, team.grade);
      }
    }, [team?.id, team?.grade, selectedSeason, selectedProgram, getWorldSkills, preloadWorldSkills])
  );

  const toggleSeasonExpansion = (season: string) => {
    console.log('Toggling season:', season);
    console.log('Current expanded seasons:', Array.from(expandedSeasons));

    setExpandedSeasons(prev => {
      const newSet = new Set(prev);
      const wasExpanded = newSet.has(season);

      if (wasExpanded) {
        console.log('Collapsing season:', season);
        newSet.delete(season);
      } else {
        console.log('Expanding season:', season);
        newSet.add(season);
      }

      console.log('New expanded seasons:', Array.from(newSet));
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
            <Text style={[styles.seasonCount, { color: settings.secondaryTextColor }]}>
              {events.length} event{events.length !== 1 ? 's' : ''}
            </Text>
          </View>
          <Ionicons
            name={isExpanded ? "chevron-up" : "chevron-down"}
            size={20}
            color={settings.iconColor}
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

  const renderTeamInfo = (property: string, value: string) => (
    <View style={[styles.infoRow, { borderBottomColor: settings.borderColor }]} key={property}>
      <Text style={[styles.infoProperty, { color: settings.textColor }]}>{property}</Text>
      <Text style={[styles.infoValue, { color: settings.secondaryTextColor }]}>{value}</Text>
    </View>
  );

  const renderModernTeamInfo = (property: string, value: string) => (
    <View style={styles.modernInfoRow} key={property}>
      <Text style={[styles.modernInfoLabel, { color: settings.secondaryTextColor }]}>{property}</Text>
      <Text style={[styles.modernInfoValue, { color: settings.textColor }]}>{value}</Text>
    </View>
  );

  const renderEventItem = ({ item }: { item: Event }) => {
    // Expand league events into individual sessions
    const expandedEvents = expandLeagueEvent(item);

    return (
      <>
        {expandedEvents.map((expandedEvent, index) => {
          // Check if this event has a Triple Crown
          const hasTripleCrown = tripleCrownData.events.includes(expandedEvent.id);

          return (
            <EventCard
              key={expandedEvent.uiId || `${expandedEvent.id}-${index}`}
              event={expandedEvent}
              onPress={(event) => openEventDetails(event as Event)}
              showFavoriteButton={false}
              showTripleCrown={hasTripleCrown}
            />
          );
        })}
      </>
    );
  };

  const eventsBySeason = useMemo(() => groupEventsBySeason(), [groupEventsBySeason]);

  const renderEventsTab = () => {
    if (eventsState.loading) {
      return (
        <View style={[styles.loadingContainer, { backgroundColor: settings.backgroundColor }]}>
          <ActivityIndicator size="large" color={settings.buttonColor} />
          <Text style={[styles.loadingText, { color: settings.textColor }]}>Loading events...</Text>
        </View>
      );
    }

    if (eventsState.events.length === 0) {
      return (
        <ScrollView
          style={styles.tabContent}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[settings.buttonColor]}
              tintColor={settings.buttonColor}
            />
          }
        >
          <View style={styles.emptyEventsContainer}>
            <Ionicons name="calendar-outline" size={64} color={settings.iconColor} />
            <Text style={[styles.emptyEventsTitle, { color: settings.textColor }]}>No Events Found</Text>
            <Text style={[styles.emptyEventsMessage, { color: settings.secondaryTextColor }]}>
              This team hasn't participated in any events this season.
            </Text>
          </View>
        </ScrollView>
      );
    }

    // Sort seasons by their chronological order (newest first)
    const sortedSeasons = Object.keys(eventsBySeason).sort((a, b) => {
      // Find the corresponding season objects
      const seasonA = seasons.find(s => s.label === a);
      const seasonB = seasons.find(s => s.label === b);

      if (seasonA && seasonB) {
        // Sort by season value as numbers (newest first)
        const valueA = parseInt(seasonA.value);
        const valueB = parseInt(seasonB.value);
        return valueB - valueA;
      }

      const yearA = parseInt(a.match(/(\d{4})/)?.[0] || '0');
      const yearB = parseInt(b.match(/(\d{4})/)?.[0] || '0');
      return yearB - yearA;
    });

    return (
      <ScrollView
        style={[styles.tabContent, { padding: 0 }]}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.seasonsContainer}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[settings.buttonColor]}
            tintColor={settings.buttonColor}
          />
        }
      >
        {sortedSeasons.map(season =>
          renderSeasonSection(season, eventsBySeason[season])
        )}
      </ScrollView>
    );
  };

  const renderStatisticsTab = () => (
    <ScrollView
      style={styles.modernTabContent}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          colors={[settings.buttonColor]}
          tintColor={settings.buttonColor}
        />
      }
    >
      {/* Season Selector Card */}
      <View style={[styles.modernSectionCard, {
        backgroundColor: settings.cardBackgroundColor,
        borderColor: settings.borderColor,
        shadowColor: settings.colorScheme === 'dark' ? '#FFFFFF' : '#000000'
      }]}>
        <Text style={[styles.modernSectionTitle, { color: settings.textColor }]}>Season</Text>
        <DropdownPicker
          options={seasons}
          selectedValue={selectedSeason}
          onValueChange={(season) => {
            console.log('Season changed via dropdown to:', season);
            setSelectedSeason(season);
            if (globalSeasonEnabled) {
              console.log('Updating global season to:', season);
              updateGlobalSeason(season);
            } else {
              console.log('Global season mode disabled, not updating global season');
            }
          }}
          placeholder="Select Season"
        />
      </View>

      {/* Team Information Card */}
      {teamFetched && team && (
        <TeamInfoCard
          team={team}
          onPress={undefined} // No navigation needed within this screen
          matchRecord={matchRecord}
          matchRecordLoading={matchRecordLoading}
          worldSkillsData={worldSkillsData}
          worldSkillsLoading={worldSkillsLoading}
          awardCounts={awardCounts}
          awardCountsLoading={awardCountsLoading}
          showFavoriteButton={false}
          showHeader={false}
          selectedProgram={selectedProgram}
        />
      )}

      {/* Triple Crown Card */}
      {tripleCrownData.count > 0 && (
        <TouchableOpacity
          style={[styles.modernSectionCard, {
            backgroundColor: settings.cardBackgroundColor,
            borderColor: settings.borderColor,
            shadowColor: settings.colorScheme === 'dark' ? '#FFFFFF' : '#000000'
          }]}
          onPress={() => {
            console.log('Triple Crown Data:', tripleCrownData);
            console.log('Events State:', eventsState.events.length, 'events loaded');
            setTripleCrownModalVisible(true);
          }}
          activeOpacity={0.7}
        >
          <View style={styles.tripleCrownContainer}>
            <View style={styles.tripleCrownLeft}>
              <View style={styles.tripleCrownIconBadge}>
                <Ionicons name="medal" size={28} color="#FFD700" />
              </View>
              <View style={styles.tripleCrownInfo}>
                <Text style={[styles.modernSectionTitle, { color: settings.textColor, marginBottom: 2 }]}>
                  Triple Crown
                </Text>
                <Text style={[styles.tripleCrownDescription, { color: settings.secondaryTextColor }]}>
                  Tournament Champion, Excellence, and Skills Champion at a single event
                </Text>
              </View>
            </View>
            <View style={styles.tripleCrownRight}>
              <Text style={[styles.tripleCrownCount, { color: settings.buttonColor }]}>
                {tripleCrownData.count}
              </Text>
              <Text style={[styles.tripleCrownLabel, { color: settings.secondaryTextColor }]}>
                {tripleCrownData.count === 1 ? 'Event' : 'Events'}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      )}
    </ScrollView>
  );

  const renderAwardsTab = () => {
    if (awardsLoading) {
      return (
        <View style={[styles.loadingContainer, { backgroundColor: settings.backgroundColor }]}>
          <ActivityIndicator size="large" color={settings.buttonColor} />
          <Text style={[styles.loadingText, { color: settings.textColor }]}>Loading awards...</Text>
        </View>
      );
    }

    if (teamAwards.length === 0) {
      return (
        <ScrollView
          style={styles.tabContent}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[settings.buttonColor]}
              tintColor={settings.buttonColor}
            />
          }
        >
          <View style={styles.noDataContainer}>
            <Ionicons name="trophy-outline" size={48} color={settings.secondaryTextColor} />
            <Text style={[styles.noDataText, { color: settings.secondaryTextColor }]}>
              No awards found for this team
            </Text>
          </View>
        </ScrollView>
      );
    }

    const seasonNames = Object.keys(groupedAwards);

    console.log('Sorting award seasons:', seasonNames);
    console.log('Available season data for sorting:', seasons.map(s => ({ label: s.label, value: s.value })));

    // Sort seasons by the season identifier (latest first) - same logic as events tab
    const sortedSeasonNames = seasonNames.sort((a, b) => {
      // Find the corresponding season objects from the loaded seasons data
      const seasonA = seasons.find(s => s.label === a);
      const seasonB = seasons.find(s => s.label === b);

      if (seasonA && seasonB) {
        console.log(`Comparing seasons by value: ${seasonA.label} (${seasonA.value}) vs ${seasonB.label} (${seasonB.value})`);
        // Sort by season value as numbers (newest first)
        const valueA = parseInt(seasonA.value);
        const valueB = parseInt(seasonB.value);
        return valueB - valueA;
      }

      const yearA = parseInt(a.match(/(\d{4})/)?.[0] || '0');
      const yearB = parseInt(b.match(/(\d{4})/)?.[0] || '0');
      console.log(`Fallback year comparison: ${a} (${yearA}) vs ${b} (${yearB})`);
      return yearB - yearA; // Latest first
    });

    console.log('Final sorted award seasons:', sortedSeasonNames);

    return (
      <ScrollView
        style={styles.tabContent}
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[settings.buttonColor]}
            tintColor={settings.buttonColor}
          />
        }
      >
        {sortedSeasonNames.map(seasonName => {
          const awards = groupedAwards[seasonName];
          const isExpanded = expandedSeasons.has(seasonName);

          return (
            <View key={seasonName} style={[styles.seasonSection, {
              backgroundColor: settings.cardBackgroundColor,
              borderColor: settings.borderColor,
              shadowColor: settings.colorScheme === 'dark' ? '#FFFFFF' : '#000000'
            }]}>
              <TouchableOpacity
                style={[styles.seasonHeader, { borderBottomColor: settings.borderColor }]}
                onPress={() => {
                  const newExpanded = new Set(expandedSeasons);
                  if (isExpanded) {
                    newExpanded.delete(seasonName);
                  } else {
                    newExpanded.add(seasonName);
                  }
                  setExpandedSeasons(newExpanded);
                }}
              >
                <View style={styles.seasonHeaderContent}>
                  <Text style={[styles.seasonTitle, { color: settings.textColor }]}>
                    {seasonName}
                  </Text>
                  <Text style={[styles.awardCount, { color: settings.secondaryTextColor }]}>
                    {awards.length} award{awards.length !== 1 ? 's' : ''}
                  </Text>
                </View>
                <Ionicons
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={settings.iconColor}
                />
              </TouchableOpacity>

              {isExpanded && (
                <View style={styles.seasonAwards}>
                  {awards.map((award) => {
                    const hasQualifications = award.qualifications && Array.isArray(award.qualifications) && award.qualifications.length > 0;
                    const eventId = award.event.id || 0;

                    // Try to find the matching event in our loaded events to get the date
                    const matchedEvent = eventsState.events.find(event => event.id === eventId);

                    // Debug: Log if we found a matching event with date info
                    if (matchedEvent) {
                      console.log(`Found matching event for award "${award.title}": ${matchedEvent.name} (${matchedEvent.start})`);
                    } else {
                      console.log(`No matching event found for award "${award.title}" (Event ID: ${eventId})`);
                    }

                    return (
                      <View
                        key={award.id}
                        style={[styles.awardCard, {
                          backgroundColor: settings.cardBackgroundColor,
                          borderColor: settings.borderColor,
                          shadowColor: settings.colorScheme === 'dark' ? '#FFFFFF' : '#000000'
                        }]}
                      >
                        <View style={styles.awardHeader}>
                          <View style={styles.awardInfo}>
                            <Text style={[styles.awardTitle, { color: settings.textColor }]}>
                              {award.title || 'Unknown Award'}
                            </Text>
                            <Text style={[styles.awardEventName, { color: settings.secondaryTextColor }]}>
                              {award.event.name || 'Unknown Event'}
                            </Text>
                            {/* Show event date if we found the matching event */}
                            {matchedEvent && matchedEvent.start && (
                              <Text style={[styles.awardEventDate, { color: settings.secondaryTextColor }]}>
                                {formatDate(matchedEvent.start)}
                              </Text>
                            )}
                          </View>
                          <View style={styles.awardActions}>
                            {hasQualifications && (
                              <TouchableOpacity
                                style={styles.qualificationButton}
                                onPress={() => {
                                  // Show qualifications in an alert for now
                                  Alert.alert(
                                    'Qualifies For',
                                    award.qualifications.map(q => `• ${q}`).join('\n'),
                                    [{ text: 'OK' }]
                                  );
                                }}
                              >
                                {/* Check if qualifies for worlds or regionals */}
                                {award.qualifications.some(q => q.toLowerCase().includes('world')) ? (
                                  <Ionicons name="globe" size={18} color="#4A90E2" />
                                ) : (
                                  <Ionicons name="trophy" size={18} color="#FFD700" />
                                )}
                              </TouchableOpacity>
                            )}
                            {eventId > 0 && (
                              <TouchableOpacity
                                style={styles.eventButton}
                                onPress={() => {
                                  // Navigate to event detail - find matching event in our loaded events
                                  const matchedEvent = eventsState.events.find(event => event.id === eventId);
                                  if (matchedEvent) {
                                    navigation.navigate('EventMainView', {
                                      event: matchedEvent,
                                      team: team
                                    });
                                  }
                                }}
                              >
                                <Ionicons name="calendar" size={18} color={settings.iconColor} />
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    );
  };

  const renderNotesTab = () => {
    // Get all notes for this team across all events
    const teamNotes = team ? getNotesByTeam(team.id) : [];

    const handleSaveNote = async () => {
      if (!team || !newNote.trim()) return;

      try {
        const noteData = {
          eventId: 0, // 0 indicates a general team note, not event-specific
          matchId: 0, // General team note, not match-specific
          matchName: `General Team Note`,
          note: newNote.trim(),
          played: false,
          teamAlliance: 0,
          teamId: team.id,
          teamName: team.team_name || teamNumber,
          teamNumber: teamNumber,
          time: new Date().toISOString(),
          winningAlliance: 0,
          imageUri: selectedImage || undefined,
        };

        await createNote(noteData);
        setNewNote('');
        setSelectedImage(null);
        setIsEditing(false);
      } catch (error) {
        console.error('Failed to save note:', error);
        Alert.alert('Error', 'Failed to save note');
      }
    };

    const handleDeleteNote = async (noteId: string) => {
      try {
        await deleteNote(noteId);
      } catch (error) {
        console.error('Failed to delete note:', error);
        Alert.alert('Error', 'Failed to delete note');
      }
    };

    const handleImagePicker = async () => {
      try {
        if (Platform.OS === 'ios') {
          ActionSheetIOS.showActionSheetWithOptions(
            {
              options: ['Cancel', 'Take Photo', 'Choose from Library'],
              cancelButtonIndex: 0,
            },
            async (buttonIndex) => {
              if (buttonIndex === 1) {
                // Take Photo
                const { status } = await ImagePicker.requestCameraPermissionsAsync();
                if (status !== 'granted') {
                  Alert.alert('Permission needed', 'Camera permission is required to take photos');
                  return;
                }

                const result = await ImagePicker.launchCameraAsync({
                  mediaTypes: ImagePicker.MediaTypeOptions.Images,
                  allowsEditing: true,
                  aspect: [4, 3],
                  quality: 0.8,
                });

                if (!result.canceled && result.assets[0]) {
                  setSelectedImage(result.assets[0].uri);
                }
              } else if (buttonIndex === 2) {
                // Choose from Library
                const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (status !== 'granted') {
                  Alert.alert('Permission needed', 'Photo library permission is required to select images');
                  return;
                }

                const result = await ImagePicker.launchImageLibraryAsync({
                  mediaTypes: ImagePicker.MediaTypeOptions.Images,
                  allowsEditing: true,
                  aspect: [4, 3],
                  quality: 0.8,
                });

                if (!result.canceled && result.assets[0]) {
                  setSelectedImage(result.assets[0].uri);
                }
              }
            }
          );
        } else {
          // Android - show alert with options
          Alert.alert(
            'Add Image',
            'Choose an option',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Take Photo',
                onPress: async () => {
                  const { status } = await ImagePicker.requestCameraPermissionsAsync();
                  if (status !== 'granted') {
                    Alert.alert('Permission needed', 'Camera permission is required to take photos');
                    return;
                  }

                  const result = await ImagePicker.launchCameraAsync({
                    mediaTypes: ImagePicker.MediaTypeOptions.Images,
                    allowsEditing: true,
                    aspect: [4, 3],
                    quality: 0.8,
                  });

                  if (!result.canceled && result.assets[0]) {
                    setSelectedImage(result.assets[0].uri);
                  }
                }
              },
              {
                text: 'Choose from Library',
                onPress: async () => {
                  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                  if (status !== 'granted') {
                    Alert.alert('Permission needed', 'Photo library permission is required to select images');
                    return;
                  }

                  const result = await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ImagePicker.MediaTypeOptions.Images,
                    allowsEditing: true,
                    aspect: [4, 3],
                    quality: 0.8,
                  });

                  if (!result.canceled && result.assets[0]) {
                    setSelectedImage(result.assets[0].uri);
                  }
                }
              }
            ]
          );
        }
      } catch (error) {
        console.error('Failed to pick image:', error);
        Alert.alert('Error', 'Failed to pick image');
      }
    };

    const handleImageTap = (imageUri: string) => {
      setModalImageUri(imageUri);
      setImageModalVisible(true);
    };


    const renderNoteItem = ({ item }: { item: any }) => (
      <View style={[styles.noteItem, {
        backgroundColor: settings.cardBackgroundColor,
        borderColor: settings.borderColor,
      }]}>
        <View style={styles.noteHeader}>
          <View style={styles.noteInfo}>
            <Text style={[styles.noteDate, { color: settings.textColor }]}>
              {new Date(item.createdAt || item.time).toLocaleDateString()}
            </Text>
            {item.eventId > 0 && (
              <Text style={[styles.noteEvent, { color: settings.secondaryTextColor }]}>
                Event: {item.matchName}
              </Text>
            )}
          </View>
          <TouchableOpacity
            onPress={() => handleDeleteNote(item.id)}
            style={styles.deleteButton}
          >
            <Ionicons name="trash" size={16} color="#ef4444" />
          </TouchableOpacity>
        </View>
        <Text style={[styles.noteText, { color: settings.textColor }]}>{item.note}</Text>
        {item.imageUri && (
          <TouchableOpacity onPress={() => handleImageTap(item.imageUri)}>
            <Image
              source={{ uri: item.imageUri }}
              style={styles.noteImage}
              resizeMode="cover"
            />
          </TouchableOpacity>
        )}
      </View>
    );

    return (
      <ScrollView
        style={styles.tabContent}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[settings.buttonColor]}
            tintColor={settings.buttonColor}
          />
        }
      >
        <View>
          {/* Add new note section */}
          <View style={[styles.addNoteSection, {
            backgroundColor: settings.cardBackgroundColor,
            borderColor: settings.borderColor,
          }]}>
            <Text style={[styles.sectionTitle, { color: settings.textColor }]}>Add Team Note</Text>
            {isEditing ? (
              <View style={styles.noteInputContainer}>
                <TextInput
                  style={[styles.noteInput, {
                    backgroundColor: settings.backgroundColor,
                    borderColor: settings.borderColor,
                    color: settings.textColor,
                  }]}
                  value={newNote}
                  onChangeText={setNewNote}
                  placeholder="Enter your note about this team..."
                  placeholderTextColor={settings.secondaryTextColor}
                  multiline
                  textAlignVertical="top"
                  autoFocus
                />

                {/* Image attachment section */}
                <View style={styles.imageAttachmentSection}>
                  <TouchableOpacity
                    style={[styles.imagePickerButton, { borderColor: settings.buttonColor }]}
                    onPress={handleImagePicker}
                  >
                    <Ionicons name="camera" size={20} color={settings.buttonColor} />
                    <Text style={[styles.imagePickerText, { color: settings.buttonColor }]}>
                      {selectedImage ? 'Change Image' : 'Add Image'}
                    </Text>
                  </TouchableOpacity>

                  {selectedImage && (
                    <View style={styles.selectedImageContainer}>
                      <Image
                        source={{ uri: selectedImage }}
                        style={styles.selectedImage}
                        resizeMode="cover"
                      />
                      <TouchableOpacity
                        style={styles.removeImageButton}
                        onPress={() => setSelectedImage(null)}
                      >
                        <Ionicons name="close-circle" size={20} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                <View style={styles.noteActions}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.cancelButton]}
                    onPress={() => {
                      setIsEditing(false);
                      setNewNote('');
                      setSelectedImage(null);
                    }}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, {
                      backgroundColor: settings.buttonColor,
                    }]}
                    onPress={handleSaveNote}
                    disabled={!newNote.trim()}
                  >
                    <Text style={styles.saveButtonText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.addNoteButton, { borderColor: settings.buttonColor }]}
                onPress={() => setIsEditing(true)}
              >
                <Ionicons name="add" size={20} color={settings.buttonColor} />
                <Text style={[styles.addNoteText, { color: settings.buttonColor }]}>Add Note</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Existing notes */}
          <View style={[styles.existingNotesSection, {
            backgroundColor: settings.cardBackgroundColor,
            borderColor: settings.borderColor,
          }]}>
            <Text style={[styles.sectionTitle, { color: settings.textColor }]}>
              Team Notes ({teamNotes.length})
            </Text>
            {teamNotes.length === 0 ? (
              <View style={styles.emptyNotesContainer}>
                <Ionicons name="document-text-outline" size={48} color={settings.secondaryTextColor} />
                <Text style={[styles.emptyNotesText, { color: settings.textColor }]}>No notes yet</Text>
                <Text style={[styles.emptyNotesSubtext, { color: settings.secondaryTextColor }]}>
                  Add notes about this team's performance, strategy, or observations
                </Text>
              </View>
            ) : (
              <FlatList
                data={teamNotes.sort((a, b) => new Date(b.createdAt || b.time).getTime() - new Date(a.createdAt || a.time).getTime())}
                renderItem={renderNoteItem}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
              />
            )}
          </View>
        </View>
      </ScrollView>
    );
  };

  const renderMatchesTab = () => {
    if (!isTeamAtEvent || !currentLiveEvent) {
      return (
        <View style={styles.noDataContainer}>
          <Text style={[styles.noDataText, { color: settings.secondaryTextColor }]}>
            Team is not currently at an event
          </Text>
        </View>
      );
    }

    return (
      <EventTeamMatchesScreen
        route={{
          params: {
            event: currentLiveEvent,
            teamNumber,
            teamId: (team || teamData)?.id || 0,
            division: currentLiveEvent.divisions?.[0], // Use first division from the event
          },
        } as any}
        navigation={navigation}
      />
    );
  };

  const renderDeveloperTab = () => (
    <ScrollView
      style={styles.tabContent}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          colors={[settings.buttonColor]}
          tintColor={settings.buttonColor}
        />
      }
    >
      {/* Developer Information */}
      <View style={[styles.teamInfoContainer, {
        backgroundColor: settings.cardBackgroundColor,
        borderColor: settings.borderColor,
        shadowColor: settings.colorScheme === 'dark' ? '#FFFFFF' : '#000000'
      }]}>
        <Text style={[styles.sectionTitle, { color: settings.textColor, marginBottom: 16 }]}>
          Developer Information
        </Text>

        {/* Team Data */}
        {team && (
          <>
            {renderTeamInfo('Team ID', team.id?.toString() || 'N/A')}
            {renderTeamInfo('Team Number', teamNumber)}
            {renderTeamInfo('Team Name', team.team_name || 'N/A')}
            {renderTeamInfo('Robot Name', team.robot_name || 'N/A')}
            {renderTeamInfo('Organization', team.organization || 'N/A')}
            {renderTeamInfo('Grade Level', team.grade || 'N/A')}
            {renderTeamInfo('Country', team.location?.country || 'N/A')}
            {renderTeamInfo('State/Region', team.location?.region || 'N/A')}
            {renderTeamInfo('City', team.location?.city || 'N/A')}
            {renderTeamInfo('Postal Code', team.location?.postcode || 'N/A')}
            {renderTeamInfo('Program ID', team.program?.id?.toString() || 'N/A')}
            {renderTeamInfo('Program Code', team.program?.code || 'N/A')}
            {renderTeamInfo('Program Name', team.program?.name || 'N/A')}
            {renderTeamInfo('Registered', team.registered ? 'Yes' : 'No')}
          </>
        )}

        {/* Team Data Status */}
        <Text style={[styles.sectionTitle, { color: settings.textColor, marginTop: 24, marginBottom: 16 }]}>
          Team Data Status
        </Text>
        {renderTeamInfo('Team Fetched', teamFetched ? 'Yes' : 'No')}
        {renderTeamInfo('Team Loading', teamLoading ? 'Yes' : 'No')}
        {renderTeamInfo('Events Count', eventsState.events.length.toString())}
        {renderTeamInfo('Events Loading', eventsState.loading ? 'Yes' : 'No')}

        {/* Season Information */}
        <Text style={[styles.sectionTitle, { color: settings.textColor, marginTop: 24, marginBottom: 16 }]}>
          Season Information
        </Text>
        {!globalSeasonEnabled && selectedSeason && (() => {
          const seasonData = seasons.find(s => s.value === selectedSeason);
          return (
            <>
              {renderTeamInfo('Selected Season', seasonData?.label || 'N/A')}
              {renderTeamInfo('Selected Season ID', selectedSeason || 'N/A')}
            </>
          );
        })()}

        {/* World Skills Data */}
        {worldSkillsData && (
          <>
            <Text style={[styles.sectionTitle, { color: settings.textColor, marginTop: 24, marginBottom: 16 }]}>
              World Skills Data
            </Text>
            {renderTeamInfo('Ranking', worldSkillsData.ranking?.toString() || 'N/A')}
            {renderTeamInfo('Combined Score', worldSkillsData.combined?.toString() || 'N/A')}
            {renderTeamInfo('Driver Score', worldSkillsData.driver?.toString() || 'N/A')}
            {renderTeamInfo('Programming Score', worldSkillsData.programming?.toString() || 'N/A')}
            {renderTeamInfo('Highest Driver', worldSkillsData.highestDriver?.toString() || 'N/A')}
            {renderTeamInfo('Highest Programming', worldSkillsData.highestProgramming?.toString() || 'N/A')}
            {renderTeamInfo('Total Teams', worldSkillsData.totalTeams?.toString() || 'N/A')}
          </>
        )}

        {/* Match Record Data */}
        {matchRecord && (
          <>
            <Text style={[styles.sectionTitle, { color: settings.textColor, marginTop: 24, marginBottom: 16 }]}>
              Match Record Data
            </Text>
            {renderTeamInfo('Wins', matchRecord.wins.toString())}
            {renderTeamInfo('Losses', matchRecord.losses.toString())}
            {renderTeamInfo('Ties', matchRecord.ties.toString())}
            {renderTeamInfo('Total Matches', matchRecord.totalMatches.toString())}
          </>
        )}

        {/* Award Counts Data */}
        {awardCounts && Object.keys(awardCounts).length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: settings.textColor, marginTop: 24, marginBottom: 16 }]}>
              Award Counts Data
            </Text>
            {Object.entries(awardCounts)
              .sort(([, a], [, b]) => b - a)
              .map(([awardTitle, count]) => (
                renderTeamInfo(awardTitle, count.toString())
              ))}
          </>
        )}

        {/* Raw Team API Response */}
        {team && (
          <>
            <Text style={[styles.sectionTitle, { color: settings.textColor, marginTop: 24, marginBottom: 16 }]}>
              Raw Team API Data
            </Text>
            <View style={[styles.jsonContainer, { backgroundColor: settings.cardBackgroundColor, borderColor: settings.borderColor }]}>
              <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                <Text style={[styles.jsonText, { color: settings.textColor }]}>
                  {JSON.stringify(team, null, 2)}
                </Text>
              </ScrollView>
            </View>
          </>
        )}

        {/* Raw World Skills API Response */}
        {worldSkillsData && (
          <>
            <Text style={[styles.sectionTitle, { color: settings.textColor, marginTop: 24, marginBottom: 16 }]}>
              Raw World Skills API Data
            </Text>
            <View style={[styles.jsonContainer, { backgroundColor: settings.cardBackgroundColor, borderColor: settings.borderColor }]}>
              <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                <Text style={[styles.jsonText, { color: settings.textColor }]}>
                  {JSON.stringify(worldSkillsData, null, 2)}
                </Text>
              </ScrollView>
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );

  return (
    <View style={[styles.container, { backgroundColor: settings.backgroundColor }]}>
      {/* Team Header - Show even when loading basic team info */}
      {(team || teamLoading) && (
        <View style={[styles.headerContainer, {
          backgroundColor: settings.cardBackgroundColor,
          borderBottomColor: settings.borderColor
        }]}>
          <View style={styles.headerContent}>
            <Text style={[styles.teamNumber, { color: settings.textColor }]}>{teamNumber}</Text>
            {teamLoading && !team ? (
              <View style={styles.loadingTeamName}>
                <ActivityIndicator size="small" color={settings.buttonColor} />
                <Text style={[styles.loadingText, { color: settings.secondaryTextColor, marginLeft: 8 }]}>Loading team...</Text>
              </View>
            ) : (
              <View style={styles.teamNameContainer}>
                <Text style={[styles.teamName, { color: settings.secondaryTextColor }]}>{team?.team_name}</Text>
                {isRefreshing && (
                  <ActivityIndicator size="small" color={settings.buttonColor} style={{ marginLeft: 8 }} />
                )}
              </View>
            )}
          </View>
          {!(teamLoading && !team) && (
            <View style={styles.headerActions}>
              {/* Qualification Icons */}
              {currentSeasonQualification.hasRegionalQual && (
                <TouchableOpacity
                  style={[styles.qualificationIconBadge, styles.trophyBadge]}
                  onPress={() => {
                    const currentSeasonData = seasons.find(s => s.value === selectedSeason);
                    Alert.alert(
                      'Regional Championship Qualifier',
                      `This team has qualified for a Regional/State Championship in the ${currentSeasonData?.label || 'selected'} season.`,
                      [{ text: 'OK' }]
                    );
                  }}
                  activeOpacity={0.6}
                >
                  <Ionicons name="trophy" size={18} color="#FFD700" />
                </TouchableOpacity>
              )}
              {currentSeasonQualification.hasWorldsQual && (
                <TouchableOpacity
                  style={[styles.qualificationIconBadge, styles.globeBadge]}
                  onPress={() => {
                    const currentSeasonData = seasons.find(s => s.value === selectedSeason);
                    Alert.alert(
                      'World Championship Qualifier',
                      `This team has qualified for the World Championship in the ${currentSeasonData?.label || 'selected'} season.`,
                      [{ text: 'OK' }]
                    );
                  }}
                  activeOpacity={0.6}
                >
                  <Ionicons name="globe" size={18} color="#4A90E2" />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.favoriteButton}
                onPress={handleTeamFavorite}
              >
                <Ionicons
                  name={isTeamFavorited(teamNumber) ? "heart" : "heart-outline"}
                  size={24}
                  color={isTeamFavorited(teamNumber) ? "#FF6B6B" : settings.iconColor}
                />
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Tab Selector */}
      <View style={[styles.tabContainer, {
        backgroundColor: settings.cardBackgroundColor,
        borderBottomColor: settings.borderColor
      }]}>
        {/* Stats Tab */}
        <TouchableOpacity
          style={[styles.tab, selectedTab === 0 && { backgroundColor: settings.buttonColor + '15' }]}
          onPress={() => setSelectedTab(0)}
        >
          <Ionicons
            name="stats-chart"
            size={24}
            color={selectedTab === 0 ? settings.buttonColor : settings.secondaryTextColor}
            style={styles.tabIcon}
          />
          <Text style={[styles.tabText, { color: settings.secondaryTextColor }, selectedTab === 0 && { color: settings.buttonColor }]}>
            Stats
          </Text>
        </TouchableOpacity>

        {/* Matches Tab - only show if team is at event */}
        {isTeamAtEvent && (
          <TouchableOpacity
            style={[styles.tab, selectedTab === 1 && { backgroundColor: settings.buttonColor + '15' }]}
            onPress={() => setSelectedTab(1)}
          >
            <Ionicons
              name="time"
              size={24}
              color={selectedTab === 1 ? settings.buttonColor : settings.secondaryTextColor}
              style={styles.tabIcon}
            />
            <Text style={[styles.tabText, { color: settings.secondaryTextColor }, selectedTab === 1 && { color: settings.buttonColor }]}>
              Matches
            </Text>
          </TouchableOpacity>
        )}

        {/* Events Tab */}
        <TouchableOpacity
          style={[styles.tab, selectedTab === (isTeamAtEvent ? 2 : 1) && { backgroundColor: settings.buttonColor + '15' }]}
          onPress={() => setSelectedTab(isTeamAtEvent ? 2 : 1)}
        >
          <Ionicons
            name="calendar"
            size={24}
            color={selectedTab === (isTeamAtEvent ? 2 : 1) ? settings.buttonColor : settings.secondaryTextColor}
            style={styles.tabIcon}
          />
          <Text style={[styles.tabText, { color: settings.secondaryTextColor }, selectedTab === (isTeamAtEvent ? 2 : 1) && { color: settings.buttonColor }]}>
            Events
          </Text>
        </TouchableOpacity>

        {/* Awards Tab */}
        <TouchableOpacity
          style={[styles.tab, selectedTab === (isTeamAtEvent ? 3 : 2) && { backgroundColor: settings.buttonColor + '15' }]}
          onPress={() => setSelectedTab(isTeamAtEvent ? 3 : 2)}
        >
          <Ionicons
            name="trophy"
            size={24}
            color={selectedTab === (isTeamAtEvent ? 3 : 2) ? settings.buttonColor : settings.secondaryTextColor}
            style={styles.tabIcon}
          />
          <Text style={[styles.tabText, { color: settings.secondaryTextColor }, selectedTab === (isTeamAtEvent ? 3 : 2) && { color: settings.buttonColor }]}>
            Awards
          </Text>
        </TouchableOpacity>

        {/* Notes Tab */}
        <TouchableOpacity
          style={[styles.tab, selectedTab === (isTeamAtEvent ? 4 : 3) && { backgroundColor: settings.buttonColor + '15' }]}
          onPress={() => setSelectedTab(isTeamAtEvent ? 4 : 3)}
        >
          <Ionicons
            name="document-text"
            size={24}
            color={selectedTab === (isTeamAtEvent ? 4 : 3) ? settings.buttonColor : settings.secondaryTextColor}
            style={styles.tabIcon}
          />
          <Text style={[styles.tabText, { color: settings.secondaryTextColor }, selectedTab === (isTeamAtEvent ? 4 : 3) && { color: settings.buttonColor }]}>
            Notes
          </Text>
        </TouchableOpacity>

        {/* Developer Tab - only show if enabled */}
        {settings.developerTabEnabled && (
          <TouchableOpacity
            style={[styles.tab, selectedTab === (isTeamAtEvent ? 5 : 4) && { backgroundColor: settings.buttonColor + '15' }]}
            onPress={() => setSelectedTab(isTeamAtEvent ? 5 : 4)}
          >
            <Ionicons
              name="code-slash"
              size={24}
              color={selectedTab === (isTeamAtEvent ? 5 : 4) ? settings.buttonColor : settings.secondaryTextColor}
              style={styles.tabIcon}
            />
            <Text style={[styles.tabText, { color: settings.secondaryTextColor }, selectedTab === (isTeamAtEvent ? 5 : 4) && { color: settings.buttonColor }]}>
              Dev
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Tab Content */}
      {teamLoading && !team ? (
        <View style={[styles.loadingContainer, { backgroundColor: settings.backgroundColor }]}>
          <ActivityIndicator size="large" color={settings.buttonColor} />
          <Text style={[styles.loadingText, { color: settings.textColor }]}>Loading team information...</Text>
        </View>
      ) : (
        selectedTab === 0 ? renderStatisticsTab() :
        selectedTab === 1 && isTeamAtEvent ? renderMatchesTab() :
        selectedTab === (isTeamAtEvent ? 2 : 1) ? renderEventsTab() :
        selectedTab === (isTeamAtEvent ? 3 : 2) ? renderAwardsTab() :
        selectedTab === (isTeamAtEvent ? 4 : 3) ? renderNotesTab() :
        renderDeveloperTab()
      )}

      {/* Image Modal */}
      <Modal
        visible={imageModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setImageModalVisible(false)}
      >
        <View style={styles.imageModalContainer}>
          <TouchableOpacity
            style={styles.imageModalOverlay}
            onPress={() => setImageModalVisible(false)}
          >
            <View style={styles.imageModalContent}>
              <TouchableOpacity
                style={styles.imageModalCloseButton}
                onPress={() => setImageModalVisible(false)}
              >
                <Ionicons name="close" size={30} color="white" />
              </TouchableOpacity>
              {modalImageUri && (
                <Image
                  source={{ uri: modalImageUri }}
                  style={styles.expandedImage}
                  resizeMode="contain"
                />
              )}
            </View>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Triple Crown Events Modal */}
      <Modal
        visible={tripleCrownModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setTripleCrownModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalContainer}
          activeOpacity={1}
          onPress={() => setTripleCrownModalVisible(false)}
        >
          <Animated.View
            style={[styles.modalContent, {
              backgroundColor: settings.cardBackgroundColor,
              borderColor: settings.borderColor,
              transform: [{ translateY: modalPanY }],
            }]}
            onStartShouldSetResponder={() => true}
            onTouchEnd={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader} {...modalPanResponder.panHandlers}>
              <View style={styles.modalHandleContainer}>
                <View style={[styles.modalHandle, { backgroundColor: settings.borderColor }]} />
              </View>
              <View style={styles.modalTitleContainer}>
                <Ionicons name="medal" size={24} color="#FFD700" />
                <Text style={[styles.modalTitle, { color: settings.textColor }]}>
                  Triple Crown Events
                </Text>
              </View>
            </View>

            <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent}>
              {tripleCrownData.events.length === 0 ? (
                <Text style={[styles.noDataText, { color: settings.secondaryTextColor }]}>
                  No Triple Crown events found
                </Text>
              ) : (
                tripleCrownData.events.map((eventId) => {
                  const event = eventsState.events.find(e => e.id === eventId);

                  if (!event) {
                    return null;
                  }

                  return (
                    <EventCard
                      key={eventId}
                      event={event}
                      onPress={(event) => {
                        setTripleCrownModalVisible(false);
                        openEventDetails(event as Event);
                      }}
                      showFavoriteButton={false}
                      showTripleCrown={true}
                    />
                  );
                })
              )}
            </ScrollView>
          </Animated.View>
        </TouchableOpacity>
      </Modal>
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
  loadingTeamName: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  teamNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  headerContainer: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  headerContent: {
    flex: 1,
  },
  teamNumber: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  teamName: {
    fontSize: 16,
    marginTop: 4,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  qualificationIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  trophyBadge: {
    backgroundColor: 'rgba(255, 215, 0, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  globeBadge: {
    backgroundColor: 'rgba(74, 144, 226, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(74, 144, 226, 0.3)',
  },
  favoriteButton: {
    padding: 8,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    borderRadius: 10,
    borderBottomWidth: 0,
    borderBottomColor: 'transparent',
  },
  tabIcon: {
    marginBottom: 4,
  },
  tabText: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  tabContent: {
    flex: 1,
  },
  eventsButton: {
    padding: 16,
    borderRadius: 12,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  eventsButtonContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eventsButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  sectionContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  teamInfoContainer: {
    borderRadius: 12,
    padding: 16,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  infoProperty: {
    fontSize: 16,
    flex: 1,
  },
  infoValue: {
    fontSize: 16,
    textAlign: 'right',
    flex: 1,
  },
  menuRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  expandableSection: {
    marginVertical: 4,
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  placeholderText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  placeholderSubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  eventsListContainer: {
    padding: 8,
  },
  eventItem: {
    marginHorizontal: 8,
    marginVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 16,
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
  emptyEventsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyEventsTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyEventsMessage: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  // Season section styles
  seasonsContainer: {
    paddingTop: 16,
    paddingBottom: 16,
  },
  seasonSection: {
    marginHorizontal: 16,
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
  skillsBreakdown: {
    marginTop: 8,
    paddingHorizontal: 16,
  },
  awardsBreakdown: {
    marginTop: 8,
    paddingHorizontal: 16,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  breakdownLabel: {
    fontSize: 14,
    flex: 1,
  },
  breakdownValue: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'right',
    marginLeft: 8,
  },
  scoreWithChevron: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flex: 1,
  },
  chevronIcon: {
    marginLeft: 8,
  },
  seasonSelectorCard: {
    marginBottom: 16,
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  warningContainer: {
    marginTop: 20,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  warningText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  // Awards Tab Styles
  noDataContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  noDataText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 12,
  },
  awardCount: {
    fontSize: 14,
    fontWeight: '500',
  },
  seasonAwards: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 12,
  },
  awardCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    position: 'relative',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
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
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  awardEventName: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  awardEventDate: {
    fontSize: 13,
    fontWeight: '400',
  },
  awardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qualificationButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Triple Crown Styles
  tripleCrownContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tripleCrownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  tripleCrownIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 215, 0, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  tripleCrownInfo: {
    flex: 1,
  },
  tripleCrownRight: {
    alignItems: 'center',
    marginLeft: 12,
  },
  tripleCrownCount: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  tripleCrownLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tripleCrownDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
  // Notes Tab Styles
  notesContainer: {
  },
  addNoteSection: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  noteInputContainer: {
    marginTop: 12,
  },
  noteInput: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    minHeight: 80,
    marginBottom: 12,
    fontSize: 16,
  },
  noteActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  actionButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '500',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  addNoteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginTop: 12,
  },
  addNoteText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '500',
  },
  existingNotesSection: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  emptyNotesContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyNotesText: {
    fontSize: 18,
    marginTop: 12,
    marginBottom: 8,
  },
  emptyNotesSubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  noteItem: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  noteInfo: {
    flex: 1,
  },
  noteDate: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  noteEvent: {
    fontSize: 11,
  },
  deleteButton: {
    padding: 4,
  },
  noteText: {
    fontSize: 14,
    lineHeight: 20,
  },
  // Modern Statistics Tab Styles (from TeamLookup)
  modernTabContent: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
  },
  modernSectionCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    marginBottom: 16,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  modernSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  modernTeamCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    marginBottom: 16,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  teamInfoGrid: {
    gap: 4,
  },
  modernInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    minHeight: 32,
  },
  modernInfoLabel: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
    letterSpacing: 0.2,
  },
  modernInfoValue: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'right',
    flex: 1,
    letterSpacing: 0.2,
  },
  skillsSection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5E7',
  },
  modernSkillsBreakdown: {
    marginTop: 8,
    paddingLeft: 16,
    gap: 4,
  },
  modernSkillsBreakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modernSkillsLabel: {
    fontSize: 14,
    fontWeight: '400',
    flex: 1,
    letterSpacing: 0.1,
  },
  modernSkillsValue: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
    minWidth: 60,
    letterSpacing: 0.2,
  },
  modernAwardsBreakdown: {
    marginTop: 8,
    paddingLeft: 16,
    gap: 4,
  },
  // Image attachment styles
  imageAttachmentSection: {
    marginTop: 12,
    marginBottom: 16,
    gap: 8,
  },
  imagePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    paddingBottom: 16,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  imagePickerText: {
    fontSize: 14,
    fontWeight: '500',
  },
  selectedImageContainer: {
    position: 'relative',
    alignSelf: 'flex-start',
  },
  selectedImage: {
    width: 120,
    height: 90,
    borderRadius: 8,
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: 'white',
    borderRadius: 10,
  },
  noteImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginTop: 8,
  },
  // Image Modal styles
  imageModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalOverlay: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalContent: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  imageModalCloseButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    padding: 10,
  },
  expandedImage: {
    width: '90%',
    height: '80%',
  },
  // Matches Tab Styles
  matchCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  matchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 12,
  },
  matchInfo: {
    flex: 1,
  },
  matchName: {
    fontSize: 18,
    fontWeight: '600',
  },
  matchTime: {
    fontSize: 14,
    marginTop: 4,
  },
  matchResult: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  matchResultText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  matchAlliances: {
    flexDirection: 'row',
  },
  alliance: {
    flex: 1,
    padding: 12,
    paddingTop: 8,
  },
  allianceLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  allianceScore: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  allianceTeams: {
    gap: 4,
  },
  matchTeamNumber: {
    fontSize: 14,
  },
  matchesHeader: {
    padding: 16,
    paddingBottom: 12,
  },
  eventTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
  },
  matchCount: {
    fontSize: 14,
  },
  // Triple Crown Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    maxHeight: '80%',
    height: '80%',
  },
  modalHeader: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  modalHandleContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    opacity: 0.3,
  },
  modalTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  modalBody: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  modalBodyContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 20,
  },
  jsonContainer: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    maxHeight: 400,
  },
  jsonText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 12,
    lineHeight: 18,
  },
});

export default TeamInfoScreen;