/**
 * DASHBOARD SCREEN
 *
 * Main landing screen of the app showing user's favorite teams and events.
 * Displays live competition data, team statistics, and quick actions.
 *
 * NAVIGATION ACCESS:
 * - Default tab in main tab navigator (Dashboard tab)
 * - Launched on app startup
 *
 * KEY FEATURES:
 * - Live team competition status and rankings
 * - Favorite teams and events management
 * - Quick access to team lookup, world rankings, and settings
 * - Auto-refresh with pull-to-refresh functionality
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createLogger } from '../utils/logger';

const logger = createLogger('DashboardScreen');
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
  Alert,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useFavorites } from '../contexts/FavoritesContext';
import { useSettings } from '../contexts/SettingsContext';
import { useDataCache } from '../contexts/DataCacheContext';
import { robotEventsAPI } from '../services/apiRouter';
import WelcomeScreen from './WelcomeScreen';
import EventCard from '../components/EventCard';
import DashboardTeamCardSkeleton from '../components/DashboardTeamCardSkeleton';
import ContextMenu, { ContextMenuOption } from '../components/ContextMenu';
import { isProgramLimitedMode, getLimitedModeMessage, programHasScoreCalculators, getProgramId, getAvailableGrades } from '../utils/programMappings';
import { filterLiveEvents, selectCurrentLiveEvent } from '../utils/eventUtils';

interface TeamDashboardData {
  teamNumber: string;
  teamName: string;
  organization: string;
  location: string;
  grade: string;
  currentRank?: number;
  previousRank?: number;
  skillsRank?: number;
  previousSkillsRank?: number;
  highestSkillsScore?: number;
  nextEvent?: string;
  recentAwards: number;
  isActive: boolean;
  // Qualification status
  qualifiedForRegionals?: boolean;
  qualifiedForWorlds?: boolean;
  // Live event data
  isAtEvent: boolean;
  currentEvent?: {
    name: string;
    eventId: number;
    nextMatchNumber?: string | null;
    nextMatchAlliance?: 'red' | 'blue' | null;
    eventRank?: number | null;
    eventSkillsRank?: number | null;
    divisionName?: string | null;
    isMultiDivision?: boolean;
  };
}

interface Props {
  navigation: any;
}


const DashboardScreen: React.FC<Props> = ({ navigation }) => {
  const { favorites, favoritesLoading, removeTeam, removeEvent, reorderTeams, reorderEvents } = useFavorites();
  const { getWorldSkills, preloadWorldSkills } = useDataCache();
  const { globalSeasonEnabled, selectedSeason: globalSeason, ...settings } = useSettings();
  const [teamData, setTeamData] = useState<TeamDashboardData[]>([]);
  const [eventData, setEventData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showProgramSelector, setShowProgramSelector] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState<string>('');
  const [showQualificationTooltip, setShowQualificationTooltip] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'teams' | 'events'>('teams');
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [contextMenuOptions, setContextMenuOptions] = useState<ContextMenuOption[]>([]);
  const [contextMenuTitle, setContextMenuTitle] = useState<string>('');
  const [eventsManuallyOrdered, setEventsManuallyOrdered] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // Memoize filtered favorites to prevent unnecessary recalculations
  const favoriteTeams = useMemo(() => {
    const teams = favorites.filter(item => item.type === 'team');
    logger.debug('favoriteTeams recalculated:', teams.length, 'teams for program:', settings.selectedProgram);
    return teams;
  }, [favorites, settings.selectedProgram]);

  const favoriteEvents = useMemo(() => {
    const events = favorites.filter(item => item.type === 'event');
    logger.debug('favoriteEvents recalculated:', events.length, 'events for program:', settings.selectedProgram);
    return events;
  }, [favorites, settings.selectedProgram]);

  // Helper function to check if events are in date order
  const checkIfEventsInDateOrder = useCallback((events: any[]) => {
    if (events.length <= 1) return true;

    for (let i = 0; i < events.length - 1; i++) {
      const currentDate = new Date(events[i].start);
      const nextDate = new Date(events[i + 1].start);
      if (currentDate > nextDate) {
        return false;
      }
    }
    return true;
  }, []);

  // Memoize sorted event data - sort by date unless manually ordered
  const sortedEventData = useMemo(() => {
    if (eventsManuallyOrdered) {
      return eventData;
    }

    // Sort by date (earliest first)
    return [...eventData].sort((a, b) => {
      const dateA = new Date(a.start);
      const dateB = new Date(b.start);
      return dateA.getTime() - dateB.getTime();
    });
  }, [eventData, eventsManuallyOrdered]);

  // Check if events are back in date order whenever eventData changes
  useEffect(() => {
    if (eventsManuallyOrdered && eventData.length > 0) {
      const inDateOrder = checkIfEventsInDateOrder(eventData);
      if (inDateOrder) {
        setEventsManuallyOrdered(false);
      }
    }
  }, [eventData, eventsManuallyOrdered, checkIfEventsInDateOrder]);

  // Memoize sorted team data based on settings
  const sortedTeamData = useMemo(() => {
    logger.debug('sortDashboardByNextMatch setting:', settings.sortDashboardByNextMatch);
    logger.debug('Team data to sort:', teamData.length, 'teams');

    if (!settings.sortDashboardByNextMatch) {
      logger.debug('Sorting disabled, keeping original order');
      return teamData; // Keep original order (favorites order)
    }

    logger.debug('Sorting enabled, applying next match sort');

    // Log current state of teams
     teamData.forEach(team => {
       logger.debug('Team', team.teamNumber, '- at event:', team.isAtEvent, ', next match:', team.currentEvent?.nextMatchNumber);
     });

    // Sort teams: teams at events with next match first
    const sorted = [...teamData].sort((a, b) => {
      // Teams at events come before teams not at events
      if (a.isAtEvent && !b.isAtEvent) {
        logger.debug('[Dashboard]', a.teamNumber, 'at event,', b.teamNumber, 'not at event →', a.teamNumber, 'first');
        return -1;
      }
      if (!a.isAtEvent && b.isAtEvent) {
        logger.debug('[Dashboard]', b.teamNumber, 'at event,', a.teamNumber, 'not at event →', b.teamNumber, 'first');
        return 1;
      }

      // Both at events - sort by next match number
      if (a.isAtEvent && b.isAtEvent) {
        const aHasMatch = a.currentEvent?.nextMatchNumber;
        const bHasMatch = b.currentEvent?.nextMatchNumber;

        // Teams with next match come before teams without
        if (aHasMatch && !bHasMatch) return -1;
        if (!aHasMatch && bHasMatch) return 1;

        // Both have next match - compare match numbers
        if (aHasMatch && bHasMatch) {
          // Extract match type and numbers (e.g., "Q 12", "Qualifier #59", "R16 3-4")
          const parseMatch = (matchName: string) => {
            // First, extract all numbers from the string using regex
            const numbers = matchName.match(/\d+/g);

            if (!numbers || numbers.length === 0) {
              return { type: matchName, primary: 999999, secondary: 0 };
            }

            // Get the first number as primary
            const primary = parseInt(numbers[0]);

            // If there's a second number (like "3-4"), use it as secondary
            const secondary = numbers.length > 1 ? parseInt(numbers[1]) : 0;

            return { type: matchName.split(/\d/)[0].trim(), primary, secondary };
          };

          const matchA = parseMatch(aHasMatch);
          const matchB = parseMatch(bHasMatch);

          logger.debug('Comparing matches:', aHasMatch, '→', matchA, 'vs', bHasMatch, '→', matchB);

          // Compare primary numbers first
          if (matchA.primary !== matchB.primary) {
            return matchA.primary - matchB.primary;
          }

          // If primary is the same, compare secondary (for matches like "3-4" vs "3-5")
          if (matchA.secondary !== matchB.secondary) {
            return matchA.secondary - matchB.secondary;
          }
        }
      }

      // Keep original order for teams in same category
      return 0;
    });

    logger.debug('Sorted order:');
     sorted.forEach((team, index) => {
      logger.debug(`${index + 1}.`, team.teamNumber, '- at event:', team.isAtEvent, ', next match:', team.currentEvent?.nextMatchNumber);
     });

    return sorted;
  }, [teamData, settings.sortDashboardByNextMatch]);

  // Auto-switch to events tab if no teams but events exist
  useEffect(() => {
    if (favoriteTeams.length === 0 && favoriteEvents.length > 0 && activeTab === 'teams') {
      setActiveTab('events');
    } else if (favoriteEvents.length === 0 && favoriteTeams.length > 0 && activeTab === 'events') {
      setActiveTab('teams');
    }
  }, [favoriteTeams.length, favoriteEvents.length, activeTab]);


  // Sync with global season when global mode is enabled
  useEffect(() => {
    if (globalSeasonEnabled && globalSeason && globalSeason !== selectedSeason) {
      setSelectedSeason(globalSeason);
    }
  }, [globalSeasonEnabled, globalSeason]);


  const loadDashboardData = useCallback(async (forceRefresh = false) => {
    logger.debug('loadDashboardData called, current loading state:', loading, 'forceRefresh:', forceRefresh);
    if (teamData.length === 0 || forceRefresh) {
      setLoading(true);
    }
    try {
      logger.debug('Starting to load dashboard data for', favoriteTeams.length, 'teams');
      // Initialize API cache on first load
      await robotEventsAPI.initializeCache();

      // Get target season ID once upfront to avoid multiple calls
      let targetSeasonId;
      if (selectedSeason && selectedSeason !== '') {
        targetSeasonId = parseInt(selectedSeason);
      } else {
        targetSeasonId = await robotEventsAPI.getCurrentSeasonId(settings.selectedProgram);
      }
      logger.debug('Using season ID:', targetSeasonId, 'for all teams');

      const programId = getProgramId(settings.selectedProgram);
      const availableGrades = getAvailableGrades(settings.selectedProgram);

      if (targetSeasonId && availableGrades.length > 0) {
        try {
          await Promise.all(
            availableGrades.map(grade =>
              preloadWorldSkills(targetSeasonId, programId, grade)
            )
          );
          logger.debug('Pre-loaded World Skills data for all grades:', availableGrades);
        } catch (error) {
          logger.error('Failed to pre-load World Skills rankings:', error);
        }
      }

      const teamDataPromises = favoriteTeams.map(async (team) => {
        if (!team.number) return null;

        try {
          // Get basic team info (use program from favorite item to ensure correct API)
          logger.debug('Fetching team info for:', team.number || 'Unknown', 'program:', team.program);
          const teamInfo = await robotEventsAPI.getTeamByNumber(team.number, team.program);

          if (!teamInfo) {
            logger.error('No team info returned for team', team.number || 'Unknown', 'program:', team.program);

            // Return a fallback team data object with cached info if available
            return {
              teamNumber: team.number,
              teamName: team.name || `Team ${team.number}`,
              organization: 'Unknown Organization',
              location: 'Unknown Location',
              grade: 'Unknown',
              currentRank: undefined,
              previousRank: undefined,
              skillsRank: undefined,
              previousSkillsRank: undefined,
              highestSkillsScore: undefined,
              nextEvent: undefined,
              recentAwards: 0,
              isActive: false,
              qualifiedForRegionals: false,
              qualifiedForWorlds: false,
              isAtEvent: false,
              currentEvent: undefined,
            };
          }

           logger.debug('Team info for', team.number || 'Unknown', ':', {
             id: teamInfo.id,
             team_name: teamInfo.team_name,
             teamName: teamInfo.team_name,
             organization: teamInfo.organization,
             city: teamInfo.location?.city || '',
             region: teamInfo.location?.region || ''
           });

          // Parallel fetch: awards and events (skills data is from cache)
          const [awardsResult, eventsResult, teamSkillsResult] = await Promise.allSettled([
            targetSeasonId ? robotEventsAPI.getTeamAwards(teamInfo.id, { season: [targetSeasonId] }) : Promise.resolve({ data: [] }),
            robotEventsAPI.getTeamEvents(teamInfo.id),
            targetSeasonId ? robotEventsAPI.getTeamSkills(teamInfo.id, { season: [targetSeasonId] }) : Promise.resolve({ data: [] })
          ]);

          let skillsRank = undefined;
          let highestSkillsScore = undefined;

          if (targetSeasonId && teamInfo.id) {
            try {
              logger.debug('Searching for team', team.number, '(ID:', teamInfo.id, ') in World Skills caches');

              let teamSkillsData = null;
              for (const grade of availableGrades) {
                const worldSkillsDataForGrade = getWorldSkills(targetSeasonId, programId, grade);

                if (worldSkillsDataForGrade && worldSkillsDataForGrade.length > 0) {
                  teamSkillsData = worldSkillsDataForGrade.find(item =>
                    item.team && item.team.id === teamInfo.id
                  );

                  if (teamSkillsData) {
                    logger.debug('✓ Found team', team.number, 'in', grade, 'World Skills cache - Rank:', teamSkillsData.rank);
                    break;
                  }
                }
              }

              if (teamSkillsData) {
                skillsRank = teamSkillsData.rank;
                highestSkillsScore = teamSkillsData.scores?.score || 0;
                logger.debug('Team', team.number, 'skills rank:', skillsRank, ', highest score:', highestSkillsScore);
              } else {
                logger.debug('✗ Team', team.number, '(ID:', teamInfo.id, ') not found in any World Skills cache');
              }
            } catch (error) {
              logger.error('Error getting World Skills from cache for team', team.number, ':', error);
            }
          } else {
            if (!targetSeasonId) logger.debug('No target season ID for team', team.number);
            if (!teamInfo.id) logger.debug('No team ID for team', team.number);
          }

          if (!highestSkillsScore && teamSkillsResult.status === 'fulfilled' && teamSkillsResult.value.data.length > 0) {
            const scores = teamSkillsResult.value.data.map((run: any) => run.score || 0);
            highestSkillsScore = Math.max(...scores);
            logger.debug('Team', team.number, 'highest skills score from direct fetch:', highestSkillsScore);
          }

          // Process awards and qualifications
          let recentAwards = 0;
          let qualifiedForRegionals = false;
          let qualifiedForWorlds = false;

          if (awardsResult.status === 'fulfilled') {
            const awardsResponse = awardsResult.value;
            recentAwards = awardsResponse.data.length;
            logger.debug('Team', team.number || 'Unknown', 'has', recentAwards, 'awards for season', targetSeasonId || 'Unknown');

            // Check for qualifications using the qualification data from awards API
            for (const award of awardsResponse.data) {
              try {
                 logger.debug('Checking qualification for award:', {
                  title: award.title,
                   qualifications: award.qualifications
                 });

                // Check if the award has qualification data
                if (award.qualifications && award.qualifications.length > 0) {
                  for (const qualification of award.qualifications) {
                    const qualificationText = qualification.toLowerCase();

                    // Check for regional/state/provincial qualifications
                    if (qualificationText.includes('region') ||
                        qualificationText.includes('state') ||
                        qualificationText.includes('provincial')) {
                      qualifiedForRegionals = true;
                       logger.debug('Team', team.number || 'Unknown', 'qualified for regionals via', award.title || 'Unknown', '->', qualification || 'Unknown');
                    }

                    // Check for world championship qualifications
                    if (qualificationText.includes('world') ||
                        qualificationText.includes('signature')) {
                      qualifiedForWorlds = true;
                       logger.debug('Team', team.number || 'Unknown', 'qualified for worlds via', award.title || 'Unknown', '->', qualification || 'Unknown');
                    }
                  }
                }
              } catch (awardError) {
                logger.error('Error checking award qualifications for', award.title || 'Unknown', ':', awardError);
              }
            }
          }

          // Check for live event participation
          let isAtEvent = false;
          let currentEvent = undefined;

           logger.debug('Checking event participation for team', team.number || 'Unknown', '- eventsResult status:', eventsResult.status);

          if (eventsResult.status === 'fulfilled') {
            const teamEventsResponse = eventsResult.value;
             logger.debug('Team', team.number || 'Unknown', 'has', teamEventsResponse.data?.length || 0, 'events');
             logger.debug('Events response data exists:', !!teamEventsResponse.data);

            if (!teamEventsResponse.data || teamEventsResponse.data.length === 0) {
               logger.debug('No events found for team', team.number || 'Unknown');
            }

            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

            // Find events happening during their full duration using centralized utility
            const liveEvents = filterLiveEvents(teamEventsResponse.data, {
              devLiveEventSimulation: settings.devLiveEventSimulation,
              isDeveloperMode: settings.isDeveloperMode,
              devTestEventId: settings.devTestEventId
            });

             logger.debug('Found', liveEvents.length, 'potentially live events for team', team.number || 'Unknown');
            if (liveEvents.length > 0) {
              // Use centralized utility to select the most relevant live event
              const liveEvent = await selectCurrentLiveEvent(
                liveEvents,
                async (eventId) => {
                  const response = await robotEventsAPI.getTeamMatches(teamInfo.id, { event: [eventId] });
                  return response.data || [];
                },
                {
                  isDeveloperMode: settings.isDeveloperMode,
                  devTestEventId: settings.devTestEventId
                }
              );

              // If we found a live event, mark team as at event
              if (liveEvent) {
                isAtEvent = true;
                 logger.debug('Team', team.number || 'Unknown', 'is at live event:', liveEvent.name);
              } else {
                 logger.debug('Team', team.number || 'Unknown', 'has no current live event');
                isAtEvent = false;
              }

              if (isAtEvent && liveEvent) {
                // Get live event data (matches, rankings, skills) - collect whatever data we can
                logger.debug('Fetching live event data for team', team.number || 'Unknown', 'at event', liveEvent.id || 'Unknown');

                // Initialize variables for all data we want to collect
                let nextMatchNumber = undefined;
                let nextMatchAlliance: 'red' | 'blue' | undefined = undefined;
                let eventRank = undefined;
                let eventSkillsRank = undefined;
                let divisionId = undefined;
                let divisionName = undefined;
                let isMultiDivision = false;

                // Fetch event details, team matches, and skills in parallel
                const [eventDetailsResult, teamMatchesResult, skillsResult] = await Promise.allSettled([
                  robotEventsAPI.getEventById(liveEvent.id),
                  robotEventsAPI.getTeamMatches(teamInfo.id, { event: [liveEvent.id] }),
                  robotEventsAPI.getEventSkills(liveEvent.id)
                ]);

                // Process event details and divisions
                const fullEventDetails = eventDetailsResult.status === 'fulfilled' ? eventDetailsResult.value : null;

                if (fullEventDetails && fullEventDetails.divisions && fullEventDetails.divisions.length > 0) {
                  isMultiDivision = fullEventDetails.divisions.length > 1;
                   logger.debug('Event has', fullEventDetails.divisions.length, 'divisions:', fullEventDetails.divisions.map(d => d.name).join(', '), '- Multi-division:', isMultiDivision);

                  // Check all divisions simultaneously
                  const divisionChecks = fullEventDetails.divisions.map(async (division) => {
                    try {
                       logger.debug('Checking division', division.name, 'for team', team.number || 'Unknown');
                      const rankingsResponse = await robotEventsAPI.getEventDivisionRankings(liveEvent.id, division.id);
                      const teamRanking = rankingsResponse.data.find(ranking => ranking.team?.id === teamInfo.id);
                      if (teamRanking) {
                        logger.debug('Found team', team.number || 'Unknown', 'in division', division.name, 'with rank', teamRanking.rank);
                        return { division, rank: teamRanking.rank };
                      }
                      return null;
                    } catch (error) {
                      logger.warn('Error checking division', division.name, ':', error);
                      return null;
                    }
                  });

                  const results = await Promise.all(divisionChecks);
                  const teamDivisionInfo = results.find(r => r !== null);

                  if (teamDivisionInfo) {
                    divisionId = teamDivisionInfo.division.id;
                    divisionName = teamDivisionInfo.division.name;
                    eventRank = teamDivisionInfo.rank;
                    logger.debug('Team', team.number || 'Unknown', 'is in division', divisionName, 'with rank', eventRank);
                  } else {
                    logger.debug('Team', team.number || 'Unknown', 'not found in any division rankings');
                  }
                }

                // Process team matches from parallel fetch
                const teamMatchesResponse = teamMatchesResult.status === 'fulfilled' ? teamMatchesResult.value : { data: [] };
                logger.debug('Found', teamMatchesResponse.data.length, 'matches for team', team.number || 'Unknown', 'at event', liveEvent.id || 'Unknown');

                // Log match statuses for debugging
                 if (teamMatchesResponse.data.length > 0) {
                   logger.debug('Match statuses for team', team.number || 'Unknown', ':');
                   teamMatchesResponse.data.forEach((match, index) => {
                     logger.debug(`Match ${index + 1}: ${match.name} - scored: ${match.scored}, started: ${match.started}, scores: ${match.alliances?.map(a => a.score)}`);
                   });
                 }

                if (teamMatchesResponse.data.length > 0) {
                  // Use division from matches as fallback if we didn't find it from rankings
                  if (!divisionId) {
                    divisionId = teamMatchesResponse.data[0].division?.id;
                    divisionName = teamMatchesResponse.data[0].division?.name;
                  }

                  // Get all division matches to check if later matches have been scored
                  let allEventMatches: any[] = [];
                  if (divisionId) {
                    try {
                      const divisionMatchesResponse = await robotEventsAPI.getEventDivisionMatches(liveEvent.id, divisionId);
                      allEventMatches = divisionMatchesResponse.data || [];
                      logger.debug('Fetched', allEventMatches.length, 'total matches for division', divisionName);
                    } catch (error) {
                      logger.warn('Failed to fetch division matches:', error);
                      // Fallback: use only team matches for comparison
                      allEventMatches = teamMatchesResponse.data;
                    }
                  } else {
                    // No division info, use only team matches
                    allEventMatches = teamMatchesResponse.data;
                  }

                  // Helper function to extract match number for comparison
                  const extractMatchNumber = (matchName: string) => {
                    const numbers = matchName.match(/\d+/g);
                    return numbers ? parseInt(numbers[0]) : 0;
                  };

                  // Helper function to check if a match should be considered played
                  const isMatchPlayed = (match: any, allMatches: any[]) => {
                    const hasStarted = match.started && match.started !== null;
                    const hasRealScores = match.alliances &&
                      match.alliances.some((alliance: any) => alliance.score > 0);
                    const hasNonZeroScores = match.alliances &&
                      !match.alliances.every((alliance: any) => (alliance.score === 0 || alliance.score === null || alliance.score === undefined));

                    // Check basic scoring
                    if (hasStarted && (hasRealScores || hasNonZeroScores)) {
                      return true;
                    }

                    // Check if any LATER match in the same division has been scored
                    const currentMatchNum = extractMatchNumber(match.name);
                    const laterMatchScored = allMatches.some(otherMatch => {
                      // Same division check
                      if (otherMatch.division?.id !== match.division?.id) return false;

                      // Is it a later match?
                      const otherMatchNum = extractMatchNumber(otherMatch.name);
                      if (otherMatchNum <= currentMatchNum) return false;

                      // Has it been scored?
                      const otherHasRealScores = otherMatch.alliances &&
                        otherMatch.alliances.some((alliance: any) => alliance.score > 0);
                      const otherHasNonZeroScores = otherMatch.alliances &&
                        !otherMatch.alliances.every((alliance: any) => (alliance.score === 0 || alliance.score === null || alliance.score === undefined));

                      return otherHasRealScores || otherHasNonZeroScores;
                    });

                    if (laterMatchScored) {
                      logger.debug('Match', match.name, 'has 0-0 but later match scored, considering it played');
                      return true;
                    }

                    return false;
                  };

                  // Find next unplayed match - prioritize unscored/unstarted matches
                  // Filter for unplayed matches using multiple criteria for reliability
                  let upcomingMatches = teamMatchesResponse.data
                    .filter(match => {
                      const isPlayed = isMatchPlayed(match, allEventMatches);
                      const isUnplayed = !isPlayed;

                      logger.debug('Match', match.name, '- scored:', match.scored, ', started:', match.started, ', scores:',
                         match.alliances?.map(a => a.score), ', isPlayed:', isPlayed, ', isUnplayed:', isUnplayed);

                      return isUnplayed;
                    })
                    .sort((a, b) => {
                      // Sort by scheduled time if available, otherwise by match name/number
                      if (a.scheduled && b.scheduled) {
                        return new Date(a.scheduled).getTime() - new Date(b.scheduled).getTime();
                      } else if (a.scheduled) {
                        return -1; // a has schedule, prioritize it
                      } else if (b.scheduled) {
                        return 1; // b has schedule, prioritize it
                      } else {
                        // Both have no schedule, sort by match name/number
                        const aNum = parseInt((a.name || '').replace(/\D/g, '')) || 0;
                        const bNum = parseInt((b.name || '').replace(/\D/g, '')) || 0;
                        return aNum - bNum;
                      }
                    });

                  logger.debug('Team', team.number || 'Unknown', 'has', upcomingMatches.length, 'unplayed matches');
                  if (upcomingMatches.length > 0) {
                    const nextMatch = upcomingMatches[0];
                    nextMatchNumber = nextMatch.name;

                    // Determine alliance color
                    if (nextMatch.alliances && nextMatch.alliances.length > 0) {
                      const redAlliance = nextMatch.alliances.find(a => a.color === 'red');
                      const blueAlliance = nextMatch.alliances.find(a => a.color === 'blue');

                      const isOnRed = redAlliance?.teams?.some(t => t.team?.id === teamInfo.id);
                      const isOnBlue = blueAlliance?.teams?.some(t => t.team?.id === teamInfo.id);

                      if (isOnRed) {
                        nextMatchAlliance = 'red';
                      } else if (isOnBlue) {
                        nextMatchAlliance = 'blue';
                      }

                      logger.debug('Team', team.number || 'Unknown', 'alliance:', nextMatchAlliance);
                    }

                    const scheduleInfo = nextMatch.scheduled ? `at ${nextMatch.scheduled}` : 'TBD';
                    logger.debug('Next match for team', team.number || 'Unknown', ':', nextMatchNumber || 'Unknown', scheduleInfo);
                  } else {
                    logger.debug('No upcoming matches for team', team.number || 'Unknown', '. All', teamMatchesResponse.data.length, 'matches are complete');
                  }
                }

              // Process event skills from parallel fetch
              if (skillsResult.status === 'fulfilled') {
                const skillsResponse = skillsResult.value;
                logger.debug('Found', skillsResponse.data.length, 'skills entries for event', liveEvent.id || 'Unknown');

                const teamSkills = skillsResponse.data.find(skills => skills.team?.id === teamInfo.id);
                if (teamSkills) {
                  eventSkillsRank = teamSkills.rank;
                  logger.debug('Team', team.number || 'Unknown', 'event skills rank:', eventSkillsRank);
                } else {
                  logger.debug('Team', team.number || 'Unknown', '(ID:', teamInfo.id || 'Unknown', ') not found in skills rankings.');
                }
              } else {
                logger.warn('Could not fetch event skills rankings for team', team.number || 'Unknown');
              }

              // Use null instead of undefined to ensure properties are preserved
              currentEvent = {
                name: liveEvent.name,
                eventId: liveEvent.id,
                nextMatchNumber: nextMatchNumber || null,
                nextMatchAlliance: nextMatchAlliance || null,
                eventRank: eventRank || null,
                eventSkillsRank: eventSkillsRank || null,
                divisionName: divisionName,
                isMultiDivision: isMultiDivision,
              };

               logger.debug('Live event data for team', team.number || 'Unknown', ':', {
                 eventId: liveEvent.id,
                 event: liveEvent.name,
                 nextMatch: nextMatchNumber,
                 eventRank: eventRank,
                 eventSkillsRank: eventSkillsRank,
                 divisionName: divisionName,
                 isMultiDivision: isMultiDivision
               });
              }
            }
          }

          const dashboardData: TeamDashboardData = {
            teamNumber: team.number,
            teamName: teamInfo.team_name || 'Unknown Team',
            organization: teamInfo.organization || '',
            location: `${teamInfo.location?.city || ''}, ${teamInfo.location?.region || ''}`.trim().replace(/^,\s*/, ''),
            grade: teamInfo.grade || 'Unknown',
            currentRank: undefined, // Competition rankings would need more complex logic
            previousRank: undefined,
            skillsRank: skillsRank,
            previousSkillsRank: undefined, // Would need historical data storage
            highestSkillsScore: highestSkillsScore,
            nextEvent: undefined, // Would need to check upcoming events
            recentAwards: recentAwards,
            isActive: recentAwards > 0 || skillsRank !== undefined || isAtEvent,
            qualifiedForRegionals: qualifiedForRegionals,
            qualifiedForWorlds: qualifiedForWorlds,
            isAtEvent: isAtEvent,
            currentEvent: currentEvent,
          };

          return dashboardData;
        } catch (error) {
          logger.error('Failed to load data for team', team.number || 'Unknown', ':', error);
          return null;
        }
      });

      const results = await Promise.all(teamDataPromises);
      const validTeamData = results.filter((data): data is TeamDashboardData => data !== null);
      setTeamData(validTeamData);

      // Load event data for favorite events
      logger.debug('Starting to load dashboard data for', favoriteEvents.length, 'events');
      const eventDataPromises = favoriteEvents.map(async (eventFavorite) => {
        try {
          const eventId = eventFavorite.eventApiId;
          if (!eventId) {
            logger.warn('Event favorite missing eventApiId:', eventFavorite.name);
            return null;
          }

          logger.debug('Fetching event data for:', eventFavorite.name, 'ID:', eventId);
          const eventDetails = await robotEventsAPI.getEventById(eventId);

          if (!eventDetails) {
            logger.error('No event details returned for event', eventId);
            return null;
          }

           logger.debug('Event details for', eventFavorite.name, ':', {
             id: eventDetails.id,
             name: eventDetails.name,
             start: eventDetails.start,
             end: eventDetails.end,
           });

          return eventDetails;
        } catch (error) {
          logger.error('Failed to load data for event', eventFavorite.name, ':', error);
          return null;
        }
      });

      const eventResults = await Promise.all(eventDataPromises);
      const validEventData = eventResults.filter((data): data is any => data !== null);
      setEventData(validEventData);
    } catch (error) {
      logger.error('Failed to load dashboard data:', error);
      // Otherwise preserve existing data to prevent cards from disappearing
      if (forceRefresh || teamData.length === 0) {
        setTeamData([]);
      }
      if (forceRefresh || eventData.length === 0) {
        setEventData([]);
      }
    } finally {
       logger.debug('Setting loading to false');
      setLoading(false);
      setRefreshing(false);
    }
  }, [favoriteTeams, favoriteEvents, selectedSeason, teamData.length, eventData.length, settings.selectedProgram, settings.devLiveEventSimulation, settings.isDeveloperMode, settings.devTestEventId, robotEventsAPI, getWorldSkills, preloadWorldSkills]);

  useEffect(() => {
    logger.debug('Program changed to:', settings.selectedProgram);
    setTeamData([]);
    setEventData([]);
    setLoading(true);
  }, [settings.selectedProgram]);

  useEffect(() => {
    // On web, wait for favorites to finish loading before making decisions
    // This prevents a race condition where the effect runs before AsyncStorage loads
    if (Platform.OS === 'web' && favoritesLoading) {
      logger.debug('Web: Waiting for favorites to finish loading...');
      return;
    }

    logger.debug('useEffect triggered - favoriteTeams:', favoriteTeams.length, 'favoriteEvents:', favoriteEvents.length, 'program:', settings.selectedProgram);

    if (favoriteTeams.length > 0 || favoriteEvents.length > 0) {
      logger.debug('Calling loadDashboardData()...');
      loadDashboardData();
    } else {
      logger.debug('No favorites, clearing data and setting loading to false');
      setTeamData([]);
      setEventData([]);
      setLoading(false);
    }
  }, [favoriteTeams, favoriteEvents, selectedSeason, favoritesLoading, settings.selectedProgram, loadDashboardData]);

  // Set up 3-minute interval for refetching data for teams at events
  useEffect(() => {
    const startRefetchInterval = () => {
      // Clear existing interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      // Set up new interval
      intervalRef.current = setInterval(() => {
        if (!isMountedRef.current) return;

        const teamsAtEvents = teamData.filter(team => team.isAtEvent);
        if (teamsAtEvents.length > 0) {
          logger.debug('Auto-refreshing data for', teamsAtEvents.length, 'teams at events');
          loadDashboardData(); // Soft refresh for auto-updates
        }
      }, 3 * 60 * 1000); // 3 minutes
    };

    // Start interval when we have team data
    if (teamData.length > 0) {
      startRefetchInterval();
    }

    // Cleanup interval on unmount or when teamData changes
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [teamData]);

  // Handle screen focus to refetch data when returning to dashboard
  useFocusEffect(
    React.useCallback(() => {
      logger.debug('Screen focused - checking if refresh needed');

      // Check if initial load is needed for teams or events
      const hasLiveTeams = teamData.some(team => team.isAtEvent);
      const needsTeamLoad = favoriteTeams.length > 0 && teamData.length === 0;
      const needsEventLoad = favoriteEvents.length > 0 && eventData.length === 0;
      const needsInitialLoad = needsTeamLoad || needsEventLoad;

      if (needsInitialLoad) {
        logger.debug('Initial load needed - refetching data');
        loadDashboardData();
      } else if (hasLiveTeams) {
        logger.debug('Teams at live events - soft refresh');
        loadDashboardData(); // Soft refresh for live events
      } else {
        logger.debug('No refresh needed - preserving existing data');
      }

      return () => {
        // Screen is unfocused - don't need to do anything special
        logger.debug('Screen unfocused');
      };
    }, [favoriteTeams.length, favoriteEvents.length, teamData.length, eventData.length]) // Add dependencies to prevent stale closure
  );

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboardData(true); // Force refresh when user pulls to refresh
  };




  const navigateToTeamInfo = (teamNumber: string) => {
    navigation.navigate('TeamInfo', {
      teamNumber,
      teamData: null,
    });
  };

  const navigateToLookup = () => {
    navigation.navigate('Lookup');
  };

  const navigateToWorldSkills = () => {
    navigation.navigate('World Skills');
  };

  const navigateToSettings = () => {
    navigation.navigate('Settings');
  };


  const getRankTrend = (current?: number, previous?: number) => {
    if (!current || !previous) return null;
    const change = previous - current; // Positive means improvement (lower rank number)
    if (change > 0) return { icon: '↗️', text: `+${change}`, color: settings.successColor };
    if (change < 0) return { icon: '↘️', text: `${change}`, color: settings.errorColor };
    return { icon: '➡️', text: '0', color: settings.secondaryTextColor };
  };

  const handleDeleteTeam = (teamNumber: string, teamName: string) => {
    Alert.alert(
      'Delete Team',
      `Are you sure you want to remove ${teamName} (${teamNumber}) from your favorites?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeTeam(teamNumber);
              // Update local team data to remove the deleted team
              setTeamData(prevData => prevData.filter(team => team.teamNumber !== teamNumber));
            } catch (error) {
              logger.error('Failed to delete team:', error);
              Alert.alert('Error', 'Failed to delete team from favorites');
            }
          }
        }
      ]
    );
  };

  const handleDeleteEvent = useCallback((eventSku: string, eventName: string) => {
    Alert.alert(
      'Delete Event',
      `Are you sure you want to remove ${eventName} from your favorites?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeEvent(eventSku);
            } catch (error) {
              logger.error('Failed to delete event:', error);
              Alert.alert('Error', 'Failed to delete event from favorites');
            }
          }
        }
      ]
    );
  }, [removeEvent]);

  const showTeamContextMenu = useCallback((team: TeamDashboardData, index: number) => {
    const options: ContextMenuOption[] = [
      {
        id: 'delete',
        title: 'Remove Favorite',
        icon: 'trash',
        color: settings.errorColor,
        onPress: () => handleDeleteTeam(team.teamNumber, team.teamName),
      },
    ];

    // Add move up option if not the first item
    if (index > 0) {
      options.unshift({
        id: 'moveUp',
        title: 'Move Up',
        icon: 'chevron-up',
        onPress: async () => {
          const newData = [...teamData];
          [newData[index], newData[index - 1]] = [newData[index - 1], newData[index]];
          setTeamData(newData);

          // Persist the new order to favorites
          const newOrder = newData.map(t => t.teamNumber);
          await reorderTeams(newOrder);
        },
      });
    }

    // Add move down option if not the last item
    if (index < teamData.length - 1) {
      options.splice(-1, 0, {
        id: 'moveDown',
        title: 'Move Down',
        icon: 'chevron-down',
        onPress: async () => {
          const newData = [...teamData];
          [newData[index], newData[index + 1]] = [newData[index + 1], newData[index]];
          setTeamData(newData);

          // Persist the new order to favorites
          const newOrder = newData.map(t => t.teamNumber);
          await reorderTeams(newOrder);
        },
      });
    }

    setContextMenuTitle(`${team.teamName} (${team.teamNumber})`);
    setContextMenuOptions(options);
    setContextMenuVisible(true);
  }, [teamData, handleDeleteTeam, reorderTeams]);

  const showEventContextMenu = useCallback((event: any, index: number) => {
    const options: ContextMenuOption[] = [
      {
        id: 'delete',
        title: 'Remove from Favorites',
        icon: 'trash',
        color: settings.errorColor,
        onPress: () => handleDeleteEvent(event.sku || '', event.name),
      },
    ];

    // Add move up option if not the first item
    if (index > 0) {
      options.unshift({
        id: 'moveUp',
        title: 'Move Up',
        icon: 'chevron-up',
        onPress: async () => {
          const newData = [...sortedEventData];
          [newData[index], newData[index - 1]] = [newData[index - 1], newData[index]];
          setEventData(newData);
          setEventsManuallyOrdered(true);

          // Persist the new order to favorites
          const newOrder = newData.map(e => e.sku);
          await reorderEvents(newOrder);
        },
      });
    }

    // Add move down option if not the last item
    if (index < sortedEventData.length - 1) {
      options.splice(-1, 0, {
        id: 'moveDown',
        title: 'Move Down',
        icon: 'chevron-down',
        onPress: async () => {
          const newData = [...sortedEventData];
          [newData[index], newData[index + 1]] = [newData[index + 1], newData[index]];
          setEventData(newData);
          setEventsManuallyOrdered(true);

          // Persist the new order to favorites
          const newOrder = newData.map(e => e.sku);
          await reorderEvents(newOrder);
        },
      });
    }

    setContextMenuTitle(event.name);
    setContextMenuOptions(options);
    setContextMenuVisible(true);
  }, [sortedEventData, handleDeleteEvent, reorderEvents]);


  const renderEventCard = (event: any, index: number) => {
    // Event data is already in the correct format from API
    return (
      <EventCard
        key={event.id}
        event={event}
        onPress={(eventData) => navigation.navigate('EventMainView', { eventId: eventData.id })}
        onLongPress={() => showEventContextMenu(event, index)}
        showFavoriteButton={false}
      />
    );
  };


  // Animated LIVE badge component
  const AnimatedLiveBadge = () => {
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();

      return () => pulse.stop();
    }, []);

    return (
      <Animated.View
        style={[
          styles.activeIndicator,
          {
            backgroundColor: settings.errorColor,
            transform: [{ scale: pulseAnim }],
          },
        ]}
      >
        <Text style={styles.activeText}>LIVE</Text>
      </Animated.View>
    );
  };

  const renderTeamCard = (team: TeamDashboardData, index: number) => {
    const skillsTrend = getRankTrend(team.skillsRank, team.previousSkillsRank);

    return (
      <TouchableOpacity
        key={team.teamNumber}
        style={[styles.teamCard, {
          backgroundColor: settings.cardBackgroundColor,
          borderColor: settings.borderColor,
        }]}
        onPress={() => navigateToTeamInfo(team.teamNumber)}
        onLongPress={() => showTeamContextMenu(team, index)}
        delayLongPress={600}
      >
        <View style={styles.teamCardHeader}>
          <View style={styles.teamInfo}>
            <View style={styles.teamNameRow}>
              <Text style={[styles.teamNumber, { color: settings.textColor }]}>
                {team.teamNumber}
              </Text>
              <View style={styles.qualificationIcons}>
                {team.qualifiedForRegionals && (
                  <TouchableOpacity
                    style={styles.qualificationButton}
                    onPress={() => setShowQualificationTooltip(
                      showQualificationTooltip === `${team.teamNumber}-regionals` ? null : `${team.teamNumber}-regionals`
                    )}
                  >
                    <Ionicons name="trophy" size={16} color={settings.warningColor} style={styles.qualificationIcon} />
                  </TouchableOpacity>
                )}
                {team.qualifiedForWorlds && (
                  <TouchableOpacity
                    style={styles.qualificationButton}
                    onPress={() => setShowQualificationTooltip(
                      showQualificationTooltip === `${team.teamNumber}-worlds` ? null : `${team.teamNumber}-worlds`
                    )}
                  >
                    <Ionicons name="globe" size={16} color={settings.infoColor} style={styles.qualificationIcon} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
            <Text style={[styles.teamName, { color: settings.textColor }]}>
              {team.teamName}
            </Text>
            <Text style={[styles.teamGrade, { color: settings.secondaryTextColor }]}>
              {team.grade}
            </Text>
            <Text style={[styles.teamLocation, { color: settings.secondaryTextColor }]} numberOfLines={1}>
              {team.location}
            </Text>
          </View>
          <View style={styles.statusIndicator}>
            {team.isAtEvent && <AnimatedLiveBadge />}
          </View>
        </View>

        <View style={styles.teamCardStats}>
          {team.isAtEvent ? (
            <>
              <View style={styles.statItem}>
                <Text style={[styles.statLabel, { color: settings.secondaryTextColor }]}>Qualification</Text>
                <Text style={[styles.statValue, { color: settings.textColor }]}>
                  {team.currentEvent?.eventRank ? `#${team.currentEvent.eventRank}` : '--'}
                </Text>
              </View>

              <View style={styles.statItem}>
                <Text style={[styles.statLabel, { color: settings.secondaryTextColor }]}>Skills</Text>
                <Text style={[styles.statValue, { color: settings.textColor }]}>
                  {team.currentEvent?.eventSkillsRank ? `#${team.currentEvent.eventSkillsRank}` : '--'}
                </Text>
              </View>

              <View style={styles.statItem}>
                <Text style={[styles.statLabel, { color: settings.secondaryTextColor }]}>Next Match</Text>
                <Text style={[
                  styles.statValue,
                  {
                    color: (() => {
                      if (team.currentEvent?.nextMatchAlliance === 'red') {
                        return settings.redAllianceColor;
                      } else if (team.currentEvent?.nextMatchAlliance === 'blue') {
                        return settings.blueAllianceColor;
                      }
                      return settings.textColor;
                    })()
                  }
                ]} numberOfLines={1} adjustsFontSizeToFit>
                  {team.currentEvent?.nextMatchNumber || '--'}
                </Text>
              </View>
            </>
          ) : (
            // Show regular stats
            <>
              <View style={styles.statItem}>
                <Text style={[styles.statLabel, { color: settings.secondaryTextColor }]}>World Skills</Text>
                <View style={styles.statValueContainer}>
                  <Text style={[styles.statValue, { color: settings.textColor }]}>
                    {team.skillsRank ? `#${team.skillsRank}` : '--'}
                  </Text>
                  {skillsTrend && (
                    <Text style={[styles.trendText, { color: skillsTrend.color }]}>
                      {skillsTrend.icon} {skillsTrend.text}
                    </Text>
                  )}
                </View>
              </View>

              <View style={styles.statItem}>
                <Text style={[styles.statLabel, { color: settings.secondaryTextColor }]}>Highest Skills</Text>
                <Text style={[styles.statValue, { color: settings.textColor }]}>
                  {team.highestSkillsScore ? team.highestSkillsScore : '--'}
                </Text>
              </View>

              <View style={styles.statItem}>
                <Text style={[styles.statLabel, { color: settings.secondaryTextColor }]}>Awards</Text>
                <Text style={[styles.statValue, { color: settings.textColor }]}>
                  {team.recentAwards}
                </Text>
              </View>
            </>
          )}

          {!team.isAtEvent && team.nextEvent && (
            <View style={styles.nextEvent}>
              <Text style={[styles.nextEventText, { color: settings.secondaryTextColor }]}>
                Next: {team.nextEvent}
              </Text>
            </View>
          )}
        </View>

        {/* Live Event Section - shows event name and link */}
        {team.isAtEvent && team.currentEvent && (
          <View style={styles.liveEventSection}>
            <Text style={[styles.liveEventLabel, { color: settings.secondaryTextColor }]}>
              Currently Competing At:
            </Text>
            <TouchableOpacity
              style={styles.eventLink}
              onPress={async () => {
                if (team.currentEvent && team.currentEvent.eventId) {
                  try {
                    const eventForNavigation = await robotEventsAPI.getEventById(team.currentEvent.eventId);
                    if (eventForNavigation) {
                      navigation.navigate('EventMainView', { event: eventForNavigation });
                    } else {
                      logger.error('No event found for ID:', team.currentEvent.eventId);
                    }
                  } catch (error) {
                    logger.error('Failed to fetch event for navigation:', error);
                  }
                }
              }}
            >
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={[styles.eventLinkText, { color: settings.errorColor, flex: 1 }]}>
                    {team.currentEvent?.name || 'Unknown Event'}
                  </Text>
                  <Ionicons name="calendar" size={16} color={settings.errorColor} style={{ marginLeft: 4 }} />
                </View>
                {team.currentEvent?.isMultiDivision && team.currentEvent?.divisionName && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                    <Text style={[styles.divisionLabel, { color: settings.secondaryTextColor }]}>
                      Division:{' '}
                    </Text>
                    <Text style={[styles.divisionName, { color: settings.textColor }]}>
                      {team.currentEvent.divisionName}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Qualification Tooltips */}
        {showQualificationTooltip === `${team.teamNumber}-worlds` && (
          <View style={styles.tooltipContainer}>
            <View style={[styles.tooltip, { backgroundColor: settings.cardBackgroundColor, borderColor: settings.borderColor }]}>
              <View style={styles.tooltipArrow} />
              <View style={styles.tooltipHeader}>
                <Ionicons name="globe" size={16} color={settings.infoColor} />
                <Text style={[styles.tooltipTitle, { color: settings.textColor }]}>World Championship Qualified</Text>
              </View>
              <Text style={[styles.tooltipText, { color: settings.secondaryTextColor }]}>
                This team has qualified for the World Championship through their competition awards.
              </Text>
            </View>
          </View>
        )}

        {showQualificationTooltip === `${team.teamNumber}-regionals` && (
          <View style={styles.tooltipContainer}>
            <View style={[styles.tooltip, { backgroundColor: settings.cardBackgroundColor, borderColor: settings.borderColor }]}>
              <View style={styles.tooltipArrow} />
              <View style={styles.tooltipHeader}>
                <Ionicons name="trophy" size={16} color={settings.warningColor} />
                <Text style={[styles.tooltipTitle, { color: settings.textColor }]}>Regional Championship Qualified</Text>
              </View>
              <Text style={[styles.tooltipText, { color: settings.secondaryTextColor }]}>
                This team has qualified for their Regional/State Championship through their competition awards.
              </Text>
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const navigateToAwards = () => {
    navigation.navigate('Awards');
  };

  const openProgramSelector = () => {
    setShowProgramSelector(true);
  };

  const closeProgramSelector = () => {
    setShowProgramSelector(false);
    // Force refresh dashboard data when program changes
    loadDashboardData(true);
  };

  const renderTabSelector = () => {
    const tabs = [
      ...(favoriteTeams.length > 0 ? [{ key: 'teams', title: 'My Teams', icon: 'people', count: favoriteTeams.length }] : []),
      ...(favoriteEvents.length > 0 ? [{ key: 'events', title: 'My Events', icon: 'calendar', count: favoriteEvents.length }] : []),
    ];

    // Don't show tab selector if there's only one type of content
    if (tabs.length <= 1) {
      return null;
    }

    return (
      <View style={[styles.tabContainer, {
        backgroundColor: settings.cardBackgroundColor,
        borderColor: settings.borderColor,
        shadowColor: settings.colorScheme === 'dark' ? '#FFFFFF' : '#000000'
      }]}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.tab,
              activeTab === tab.key && [styles.activeTab, { backgroundColor: settings.buttonColor }]
            ]}
            onPress={() => setActiveTab(tab.key as 'teams' | 'events')}
          >
            <Ionicons
              name={tab.icon as any}
              size={20}
              color={activeTab === tab.key ? '#FFFFFF' : settings.iconColor}
              style={styles.tabIcon}
            />
            <Text style={[
              styles.tabText,
              {
                color: activeTab === tab.key
                  ? '#FFFFFF'
                  : settings.textColor,
              }
            ]}>
              {tab.title}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderQuickActions = () => {
    // Check if current program is in limited mode
    const isLimitedMode = isProgramLimitedMode(settings.selectedProgram);
    const hasCalculators = programHasScoreCalculators(settings.selectedProgram);

    // Define actions based on limited mode
    let actions;
    if (isLimitedMode) {
      // Limited mode: Only show Change Program, Score Calculators, Game Manual, and Settings
      actions = [
        { icon: 'swap-horizontal', title: 'Change Program', onPress: openProgramSelector },
        ...(hasCalculators ? [{ icon: 'calculator', title: 'Score Calculators', onPress: () => navigation.navigate('ScoreCalculatorsHome') }] : []),
        { icon: 'book', title: 'Game Manual', onPress: () => navigation.navigate('Game Manual') },
        { icon: 'settings', title: 'Settings', onPress: navigateToSettings },
      ];
    } else {
      // Full mode: Show all actions
      actions = [
        { icon: 'search', title: 'Team Search', onPress: () => navigation.navigate('Lookup', { initialTab: 'team' }) },
        { icon: 'globe', title: 'Rankings', onPress: navigateToWorldSkills },
        { icon: 'calendar', title: 'Events', onPress: () => navigation.navigate('Lookup', { initialTab: 'event' }) },
        { icon: 'trophy', title: 'Awards', onPress: navigateToAwards },
        { icon: 'swap-horizontal', title: 'Change Program', onPress: openProgramSelector },
        { icon: 'settings', title: 'Settings', onPress: navigateToSettings },
      ];
    }

    // Responsive button sizing - 3 columns on phones, all in one row on tablets
    const screenWidth = Dimensions.get('window').width;
    const isTablet = screenWidth >= 768;
    const gap = 12; // Gap between buttons
    const columnsPerRow = isTablet ? actions.length : 3;
    const containerPadding = 16; // Padding on each side

    // Calculate button width to fit columns per row with gaps
    const availableWidth = screenWidth - (containerPadding * 2);
    const totalGapWidth = (columnsPerRow - 1) * gap;
    const calculatedButtonWidth = (availableWidth - totalGapWidth) / columnsPerRow;

    // Apply max width constraint on tablets only
    const maxButtonWidth = isTablet ? 120 : Number.MAX_VALUE;
    const buttonWidth = Math.min(calculatedButtonWidth, maxButtonWidth);

    // Scale padding and font sizes based on button size
    const buttonPadding = buttonWidth < 90 ? 4 : 8;
    const iconSize = buttonWidth < 90 ? 22 : 26;
    const fontSize = buttonWidth < 80 ? 10 : buttonWidth < 90 ? 11 : 12;

    // Group actions into rows
    const rows: typeof actions[] = [];
    for (let i = 0; i < actions.length; i += columnsPerRow) {
      rows.push(actions.slice(i, i + columnsPerRow));
    }

    return (
      <View style={styles.quickActionsContainer}>
        {rows.map((row, rowIndex) => (
          <View key={rowIndex} style={[styles.quickActionsRow, { marginBottom: rowIndex < rows.length - 1 ? gap : 0 }]}>
            {row.map((action, colIndex) => (
              <TouchableOpacity
                key={colIndex}
                style={[
                  styles.quickActionButton,
                  {
                    backgroundColor: settings.cardBackgroundColor,
                    borderColor: settings.borderColor,
                    width: buttonWidth,
                    height: buttonWidth,
                    padding: buttonPadding,
                    shadowColor: settings.colorScheme === 'dark' ? '#FFFFFF' : '#000000',
                    marginRight: colIndex < row.length - 1 ? gap : 0,
                  }
                ]}
                onPress={action.onPress}
              >
                <Ionicons
                  name={action.icon as any}
                  size={iconSize}
                  color={settings.buttonColor}
                />
                <Text
                  style={[
                    styles.quickActionText,
                    {
                      color: settings.textColor,
                      fontSize: fontSize,
                    }
                  ]}
                  numberOfLines={2}
                  adjustsFontSizeToFit
                >
                  {action.title}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>
    );
  };

  const renderEmptyState = () => {
    // Check if current program is in limited mode
    const isLimitedMode = isProgramLimitedMode(settings.selectedProgram);
    const customMessage = getLimitedModeMessage(settings.selectedProgram);

    if (isLimitedMode) {
      // Limited mode: Show custom message without the find teams button
      // Parse message for styled text markup
      const renderStyledMessage = (message: string) => {
        // Support <alert>text</alert> for red alert text
        const parts = message.split(/(<alert>.*?<\/alert>)/g);

        return (
          <Text style={[styles.emptyTitle, { color: settings.textColor }]}>
            {parts.map((part, index) => {
              const alertMatch = part.match(/<alert>(.*?)<\/alert>/);
              if (alertMatch) {
                return (
                  <Text key={index} style={{ color: settings.errorColor }}>
                    {alertMatch[1]}
                  </Text>
                );
              }
              return part;
            })}
          </Text>
        );
      };

      return (
        <View style={styles.emptyState}>
          {renderStyledMessage(customMessage || 'Limited Mode')}
          <Text style={[styles.emptySubtitle, { color: settings.secondaryTextColor }]}>
            Use the quick actions above to access available features for this program.
          </Text>
        </View>
      );
    }

    // Full mode: Show normal empty state
    return (
      <View style={styles.emptyState}>
        <Ionicons name="star-outline" size={64} color={settings.secondaryTextColor} />
        <Text style={[styles.emptyTitle, { color: settings.textColor }]}>
          Welcome to Your Dashboard
        </Text>
        <Text style={[styles.emptySubtitle, { color: settings.secondaryTextColor }]}>
          Add some favorite teams and events to see personalized information here
        </Text>
        <TouchableOpacity
          style={[styles.emptyButton, { backgroundColor: settings.buttonColor }]}
          onPress={navigateToLookup}
        >
          <Text style={styles.emptyButtonText}>Find Teams & Events</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderLoadingState = () => (
    <View style={styles.section}>
      {[1, 2, 3].map((i) => (
        <DashboardTeamCardSkeleton key={i} />
      ))}
    </View>
  );

  // Check if current program is in limited mode
  const isLimitedMode = isProgramLimitedMode(settings.selectedProgram);

  // Determine if screen is large enough for side-by-side layout
  const screenWidth = Dimensions.get('window').width;
  const isLargeScreen = screenWidth >= 768; // iPad breakpoint
  const showSideBySide = isLargeScreen && favoriteTeams.length > 0 && favoriteEvents.length > 0;

  // Log render state for debugging skeleton loader issues
  logger.debug('RENDER - State:', {
    favoritesLoading,
    loading,
    isLimitedMode,
    favoriteTeamsCount: favoriteTeams.length,
    favoriteEventsCount: favoriteEvents.length,
    teamDataCount: teamData.length,
    eventDataCount: eventData.length,
    willShowLoadingState: !isLimitedMode && (favoritesLoading || (loading && (favoriteTeams.length > 0 || favoriteEvents.length > 0))),
    willShowEmptyState: isLimitedMode || (!loading && !favoritesLoading && favoriteTeams.length === 0 && favoriteEvents.length === 0),
    willShowTeamCards: !isLimitedMode && activeTab === 'teams' && !loading && favoriteTeams.length > 0,
    willShowEventCards: !isLimitedMode && activeTab === 'events' && !loading && favoriteEvents.length > 0,
  });

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: settings.backgroundColor }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={settings.buttonColor}
        />
      }
    >

      {/* Quick Actions */}
      <View style={styles.quickActionsSection}>
        <Text style={[styles.sectionTitle, { color: settings.textColor }]}>
          Quick Actions
        </Text>
        {renderQuickActions()}
      </View>

      {/* Tab Selector - Hide in limited mode and on large screens with both types */}
      {!isLimitedMode && (favoriteTeams.length > 0 && favoriteEvents.length > 0) && !showSideBySide && (
        <View style={styles.tabSection}>
          {renderTabSelector()}
        </View>
      )}

      {/* Side-by-side layout for large screens */}
      {!isLimitedMode && showSideBySide ? (
        <View style={styles.sideBySideContainer}>
          {/* My Teams Column */}
          {favoriteTeams.length > 0 && (
            <View style={styles.sideBySideColumn}>
              <Text style={[styles.sectionTitle, { color: settings.textColor, paddingHorizontal: 16 }]}>
                My Teams ({favoriteTeams.length})
              </Text>
              <View style={styles.section}>
                {sortedTeamData.map((team, index) => renderTeamCard(team, index))}
              </View>
            </View>
          )}

          {/* My Events Column */}
          {favoriteEvents.length > 0 && (
            <View style={styles.sideBySideColumn}>
              <Text style={[styles.sectionTitle, { color: settings.textColor, paddingHorizontal: 16 }]}>
                My Events ({favoriteEvents.length})
              </Text>
              <View style={styles.section}>
                {sortedEventData.map((event, index) => renderEventCard(event, index))}
              </View>
            </View>
          )}
        </View>
      ) : (
        <>
          {/* My Teams Section - Hide in limited mode */}
          {!isLimitedMode && activeTab === 'teams' && favoriteTeams.length > 0 && (
            <View style={styles.section}>
              {sortedTeamData.map((team, index) => renderTeamCard(team, index))}
            </View>
          )}

          {/* My Events Section - Hide in limited mode */}
          {!isLimitedMode && activeTab === 'events' && favoriteEvents.length > 0 && (
            <View style={styles.section}>
              {sortedEventData.map((event, index) => renderEventCard(event, index))}
            </View>
          )}
        </>
      )}

      {/* Loading State - Show when either favorites are loading OR dashboard data is loading */}
      {!isLimitedMode && (favoritesLoading || (loading && (favoriteTeams.length > 0 || favoriteEvents.length > 0))) && renderLoadingState()}

      {/* Empty State - Only show when favorites have loaded and there are none for this program */}
      {(isLimitedMode || (!loading && !favoritesLoading && favoriteTeams.length === 0 && favoriteEvents.length === 0)) && renderEmptyState()}

      {/* Program Selector Modal */}
      <WelcomeScreen
        isVisible={showProgramSelector}
        onClose={closeProgramSelector}
        showCloseButton={true}
        title="Change Program"
        subtitle="Select a different program for RoboNexus."
        successMessage="Program changed successfully!"
      />

      {/* Tooltip overlay for click-outside dismissal */}
      {showQualificationTooltip && (
        <TouchableOpacity
          style={styles.tooltipOverlay}
          activeOpacity={1}
          onPress={() => setShowQualificationTooltip(null)}
        />
      )}

      {/* Context Menu */}
      <ContextMenu
        visible={contextMenuVisible}
        onClose={() => setContextMenuVisible(false)}
        options={contextMenuOptions}
        title={contextMenuTitle}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    marginBottom: 10,
    paddingHorizontal: 16,
  },
  quickActionsSection: {
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  tabSection: {
    marginBottom: 10,
    paddingHorizontal: 16,
  },
  tabContainer: {
    flexDirection: 'row',
    margin: 16,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  activeTab: {
    // Background color applied inline
  },
  tabIcon: {
    marginRight: 8,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 10,
  },
  manageButton: {
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  manageButtonText: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  teamCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  teamCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  teamInfo: {
    flex: 1,
  },
  teamNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  teamNumber: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  qualificationIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  qualificationIcon: {
    marginLeft: 4,
  },
  teamName: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 2,
  },
  teamGrade: {
    fontSize: 13,
    marginTop: 2,
  },
  teamLocation: {
    fontSize: 14,
    marginTop: 2,
  },
  statusIndicator: {
    alignItems: 'flex-end',
  },
  activeIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  teamCardStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  statValueContainer: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '600',
  },
  trendText: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  nextEvent: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5E7',
    flexDirection: 'row',
    alignItems: 'center',
  },
  nextEventText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  liveEventSection: {
    marginTop: 12,
    paddingTop: 12,
    paddingHorizontal: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5E7',
  },
  liveEventLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 6,
  },
  eventLink: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 0,
    flexShrink: 1,
  },
  eventLinkText: {
    fontSize: 14,
    fontWeight: '600',
  },
  divisionLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  divisionName: {
    fontSize: 12,
    fontWeight: '600',
  },
  sideBySideContainer: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 16,
  },
  sideBySideColumn: {
    flex: 1,
  },
  quickActionsContainer: {
    // Container for all rows
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  quickActionButton: {
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  quickActionText: {
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 14,
  },
  emptyState: {
    alignItems: 'center',
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
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  qualificationButton: {
    padding: 2,
    borderRadius: 4,
  },
  tooltipOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
  },
  tooltipContainer: {
    position: 'absolute',
    top: -8,
    right: 8,
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
  },
});

export default DashboardScreen;