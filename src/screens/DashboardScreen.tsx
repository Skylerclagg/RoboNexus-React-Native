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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useFavorites } from '../contexts/FavoritesContext';
import { useSettings } from '../contexts/SettingsContext';
import { robotEventsAPI } from '../services/apiRouter';
import WelcomeScreen from './WelcomeScreen';
import EventCard from '../components/EventCard';
import TeamCardSkeleton from '../components/TeamCardSkeleton';
import ContextMenu, { ContextMenuOption } from '../components/ContextMenu';
import { isProgramLimitedMode, getLimitedModeMessage, programHasScoreCalculators } from '../utils/programMappings';

interface TeamDashboardData {
  teamNumber: string;
  teamName: string;
  organization: string;
  location: string;
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
  const { favorites, removeTeam, removeEvent, reorderTeams } = useFavorites();
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
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // Memoize filtered favorites to prevent unnecessary recalculations
  const favoriteTeams = useMemo(() => favorites.filter(item => item.type === 'team'), [favorites]);
  const favoriteEvents = useMemo(() => favorites.filter(item => item.type === 'event'), [favorites]);

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


  const loadDashboardData = async (forceRefresh = false) => {
    console.log('[Dashboard] loadDashboardData called, current loading state:', loading, 'forceRefresh:', forceRefresh);
    if (teamData.length === 0 || forceRefresh) {
      setLoading(true);
    }
    try {
      console.log('[Dashboard] Starting to load dashboard data for', favoriteTeams.length, 'teams');
      // Initialize API cache on first load
      await robotEventsAPI.initializeCache();

      // Get target season ID once upfront to avoid multiple calls
      let targetSeasonId;
      if (selectedSeason && selectedSeason !== '') {
        targetSeasonId = parseInt(selectedSeason);
      } else {
        targetSeasonId = await robotEventsAPI.getCurrentSeasonId(settings.selectedProgram);
      }
      console.log('[Dashboard] Using season ID:', targetSeasonId, 'for all teams');

      // Fetch World Skills rankings once for all teams (shared data)
      let worldSkillsDataCache = null;
      if (targetSeasonId) {
        try {
          worldSkillsDataCache = await robotEventsAPI.getWorldSkillsRankings(targetSeasonId, 'High School');
          console.log('[Dashboard] Cached World Skills data for', worldSkillsDataCache.length, 'teams');
        } catch (error) {
          console.error('[Dashboard] Failed to fetch World Skills rankings:', error);
        }
      }

      const teamDataPromises = favoriteTeams.map(async (team) => {
        if (!team.number) return null;

        try {
          // Get basic team info
          console.log('[Dashboard] Fetching team info for:', team.number || 'Unknown');
          const teamInfo = await robotEventsAPI.getTeamByNumber(team.number);

          if (!teamInfo) {
            console.error('[Dashboard] No team info returned for team', team.number || 'Unknown');

            // Return a fallback team data object with cached info if available
            return {
              teamNumber: team.number,
              teamName: team.name || `Team ${team.number}`,
              organization: 'Unknown Organization',
              location: 'Unknown Location',
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

          console.log('[Dashboard] Team info for', team.number || 'Unknown', ':', {
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

          // Process World Skills ranking from cached data
          let skillsRank = undefined;
          let highestSkillsScore = undefined;

          if (worldSkillsDataCache && worldSkillsDataCache.length > 0) {
            const teamSkillsData = worldSkillsDataCache.find(item => {
              const teamNumber = item.team?.team || item.team?.teamName;
              const normalizedItemTeam = teamNumber ? teamNumber.toString().trim() : '';
              const normalizedSearchTeam = team.number ? team.number.toString().trim() : '';
              return normalizedItemTeam === normalizedSearchTeam;
            });

            if (teamSkillsData) {
              skillsRank = teamSkillsData.rank;
              highestSkillsScore = teamSkillsData.scores?.score || 0;
              console.log('[Dashboard] Team', team.number, 'skills rank:', skillsRank, ', highest score:', highestSkillsScore);
            }
          }

          if (!highestSkillsScore && teamSkillsResult.status === 'fulfilled' && teamSkillsResult.value.data.length > 0) {
            const scores = teamSkillsResult.value.data.map((run: any) => run.score || 0);
            highestSkillsScore = Math.max(...scores);
            console.log('[Dashboard] Team', team.number, 'highest skills score from direct fetch:', highestSkillsScore);
          }

          // Process awards and qualifications
          let recentAwards = 0;
          let qualifiedForRegionals = false;
          let qualifiedForWorlds = false;

          if (awardsResult.status === 'fulfilled') {
            const awardsResponse = awardsResult.value;
            recentAwards = awardsResponse.data.length;
            console.log('[Dashboard] Team', team.number || 'Unknown', 'has', recentAwards, 'awards for season', targetSeasonId || 'Unknown');

            // Check for qualifications using the qualification data from awards API
            for (const award of awardsResponse.data) {
              try {
                console.log('[Dashboard] Checking qualification for award:', {
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
                      console.log('[Dashboard] Team', team.number || 'Unknown', 'qualified for regionals via', award.title || 'Unknown', '->', qualification || 'Unknown');
                    }

                    // Check for world championship qualifications
                    if (qualificationText.includes('world') ||
                        qualificationText.includes('signature')) {
                      qualifiedForWorlds = true;
                      console.log('[Dashboard] Team', team.number || 'Unknown', 'qualified for worlds via', award.title || 'Unknown', '->', qualification || 'Unknown');
                    }
                  }
                }
              } catch (awardError) {
                console.error('[Dashboard] Error checking award qualifications for', award.title || 'Unknown', ':', awardError);
              }
            }
          }

          // Check for live event participation
          let isAtEvent = false;
          let currentEvent = undefined;

          if (eventsResult.status === 'fulfilled') {
            const teamEventsResponse = eventsResult.value;
            console.log('[Dashboard] Team', team.number || 'Unknown', 'has', teamEventsResponse.data.length, 'events');
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

            // Find events happening during their full duration
            const liveEvents = teamEventsResponse.data.filter(event => {
              const start = new Date(event.start);
              const end = new Date(event.end);

              console.log('[Dashboard] Checking event', event.name, '- Start:', start.toISOString(), 'End:', end.toISOString(), 'Now:', now.toISOString());

              // Developer mode: if test event ID is set, only match that event
              if (settings.isDeveloperMode && settings.devTestEventId && settings.devTestEventId.trim() !== '') {
                const testEventIdNum = parseInt(settings.devTestEventId.trim());
                const isTestEvent = event.id === testEventIdNum;
                if (isTestEvent) {
                  console.log('[Dashboard] Developer test mode - Event', event.name, 'matches test event ID:', testEventIdNum);
                }
                return isTestEvent;
              }

              // Developer mode simulation: if enabled, simulate live events by treating recent events as live
              if (settings.devLiveEventSimulation && settings.isDeveloperMode) {
                const oneWeekAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
                const oneWeekFromNow = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000));
                const isSimulatedLive = start >= oneWeekAgo && start <= oneWeekFromNow;
                console.log('[Dashboard] Developer simulation mode - Event', event.name, 'is simulated live:', isSimulatedLive);
                return isSimulatedLive;
              }

              // Check if event has specific dates (league events) or just date range (tournaments)
              if (event.locations) {
                // League event with specific competition dates
                const todayString = today.toISOString().split('T')[0]; // Format: YYYY-MM-DD
                const eventDates = Object.keys(event.locations);
                const isLeagueCompetitionDay = eventDates.includes(todayString);
                console.log('[Dashboard] League event', event.name, '- Competition dates:', eventDates, '- Today:', todayString, '- Is competition day:', isLeagueCompetitionDay);
                return isLeagueCompetitionDay;
              } else {
                // Regular event with continuous date range
                const withinDateRange = start <= now && end >= now;
                console.log('[Dashboard] Regular event', event.name, 'is within date range:', withinDateRange);
                return withinDateRange;
              }
            });

            console.log('[Dashboard] Found', liveEvents.length, 'potentially live events for team', team.number || 'Unknown');
            if (liveEvents.length > 0) {
              // Sort live events by start date (most recent first) to prioritize active competitions
              liveEvents.sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime());
              const liveEvent = liveEvents[0]; // Take the most recent live event

              // Check if team has any incomplete matches at this event
              console.log('[Dashboard] Checking for incomplete matches at event', liveEvent.name, 'for team', team.number || 'Unknown');
              try {
                const teamMatchesResponse = await robotEventsAPI.getTeamMatches(teamInfo.id, { event: [liveEvent.id] });
                const teamMatches = teamMatchesResponse.data || [];
                console.log('[Dashboard] Found', teamMatches.length, 'matches for team', team.number || 'Unknown', 'at event', liveEvent.name);

                // Count matches that are happening today or very recently
                const now = new Date();
                const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const tomorrowStart = new Date(todayStart.getTime() + (24 * 60 * 60 * 1000));

                const activeMatches = teamMatches.filter(match => {
                  const matchStarted = match.started;
                  const matchScored = match.scored;
                  const matchScheduled = match.scheduled ? new Date(match.scheduled) : null;

                  // Match is incomplete if it hasn't started yet, or started but not scored
                  const isIncomplete = !matchStarted || (matchStarted && !matchScored);

                  let isToday = false;
                  if (matchScheduled) {
                    isToday = matchScheduled >= todayStart && matchScheduled < tomorrowStart;
                  }

                  // Consider match "active" if it's incomplete AND (scheduled for today OR no schedule info)
                  const isActive = isIncomplete && (isToday || !matchScheduled);

                  console.log('[Dashboard] Match', match.name, '- Started:', matchStarted, 'Scored:', matchScored, 'Scheduled:', matchScheduled?.toISOString(), 'Today:', isToday, 'Active:', isActive);
                  return isActive;
                });

                console.log('[Dashboard] Team', team.number || 'Unknown', 'has', activeMatches.length, 'active matches today at event', liveEvent.name);

                if (activeMatches.length > 0) {
                  isAtEvent = true;
                  console.log('[Dashboard] Team', team.number || 'Unknown', 'is actively competing today - has active matches');
                } else {
                  console.log('[Dashboard] Team', team.number || 'Unknown', 'has no active matches today - not showing as live');
                  isAtEvent = false;
                }
              } catch (matchError) {
                console.error('[Dashboard] Failed to fetch matches for team', team.number || 'Unknown', 'at event', liveEvent.name, ':', matchError);
                isAtEvent = true;
                console.log('[Dashboard] Fallback: showing team as live due to match fetch error');
              }

              if (isAtEvent) {
                // Get live event data (matches, rankings, skills) - collect whatever data we can
                console.log('[Dashboard] Fetching live event data for team', team.number || 'Unknown', 'at event', liveEvent.id || 'Unknown');

                // Initialize variables for all data we want to collect
                let nextMatchNumber = undefined;
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
                  console.log('[Dashboard] Event has', fullEventDetails.divisions.length, 'divisions:', fullEventDetails.divisions.map(d => d.name).join(', '), '- Multi-division:', isMultiDivision);

                  // Check all divisions simultaneously
                  const divisionChecks = fullEventDetails.divisions.map(async (division) => {
                    try {
                      console.log('[Dashboard] Checking division', division.name, 'for team', team.number || 'Unknown');
                      const rankingsResponse = await robotEventsAPI.getEventDivisionRankings(liveEvent.id, division.id);
                      const teamRanking = rankingsResponse.data.find(ranking => ranking.team?.id === teamInfo.id);
                      if (teamRanking) {
                        console.log('[Dashboard] Found team', team.number || 'Unknown', 'in division', division.name, 'with rank', teamRanking.rank);
                        return { division, rank: teamRanking.rank };
                      }
                      return null;
                    } catch (error) {
                      console.warn('[Dashboard] Error checking division', division.name, ':', error);
                      return null;
                    }
                  });

                  const results = await Promise.all(divisionChecks);
                  const teamDivisionInfo = results.find(r => r !== null);

                  if (teamDivisionInfo) {
                    divisionId = teamDivisionInfo.division.id;
                    divisionName = teamDivisionInfo.division.name;
                    eventRank = teamDivisionInfo.rank;
                    console.log('[Dashboard] Team', team.number || 'Unknown', 'is in division', divisionName, 'with rank', eventRank);
                  } else {
                    console.log('[Dashboard] Team', team.number || 'Unknown', 'not found in any division rankings');
                  }
                }

                // Process team matches from parallel fetch
                const teamMatchesResponse = teamMatchesResult.status === 'fulfilled' ? teamMatchesResult.value : { data: [] };
                console.log('[Dashboard] Found', teamMatchesResponse.data.length, 'matches for team', team.number || 'Unknown', 'at event', liveEvent.id || 'Unknown');

                // Log match statuses for debugging
                if (teamMatchesResponse.data.length > 0) {
                  console.log('[Dashboard] Match statuses for team', team.number || 'Unknown', ':');
                  teamMatchesResponse.data.forEach((match, index) => {
                    console.log(`[Dashboard] Match ${index + 1}: ${match.name} - scored: ${match.scored}, started: ${match.started}, scores: ${match.alliances?.map(a => a.score)}`);
                  });
                }

                if (teamMatchesResponse.data.length > 0) {
                  // Use division from matches as fallback if we didn't find it from rankings
                  if (!divisionId) {
                    divisionId = teamMatchesResponse.data[0].division?.id;
                    divisionName = teamMatchesResponse.data[0].division?.name;
                  }

                  // Find next unplayed match - prioritize unscored/unstarted matches

                  // Filter for unplayed matches using multiple criteria for reliability
                  let upcomingMatches = teamMatchesResponse.data
                    .filter(match => {
                      // Check if match has been played by looking at actual game results
                      const hasStarted = match.started && match.started !== null;
                      const hasRealScores = match.alliances &&
                        match.alliances.some(alliance => alliance.score > 0);
                      const hasNonZeroScores = match.alliances &&
                        !match.alliances.every(alliance => (alliance.score === 0 || alliance.score === null || alliance.score === undefined));

                      // A match is PLAYED if it has started AND has real scores (not all zeros)
                      const isPlayed = hasStarted && (hasRealScores || hasNonZeroScores);

                      // A match is UNPLAYED if it hasn't been played
                      const isUnplayed = !isPlayed;

                      console.log('[Dashboard] Match', match.name, '- scored:', match.scored, ', started:', match.started, ', scores:',
                        match.alliances?.map(a => a.score), ', hasStarted:', hasStarted, ', hasRealScores:', hasRealScores, ', isPlayed:', isPlayed, ', isUnplayed:', isUnplayed);

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

                  console.log('[Dashboard] Team', team.number || 'Unknown', 'has', upcomingMatches.length, 'unplayed matches');
                  if (upcomingMatches.length > 0) {
                    nextMatchNumber = upcomingMatches[0].name;
                    const nextMatch = upcomingMatches[0];
                    const scheduleInfo = nextMatch.scheduled ? `at ${nextMatch.scheduled}` : 'TBD';
                    console.log('[Dashboard] Next match for team', team.number || 'Unknown', ':', nextMatchNumber || 'Unknown', scheduleInfo);
                  } else {
                    console.log('[Dashboard] No upcoming matches for team', team.number || 'Unknown', '. All', teamMatchesResponse.data.length, 'matches are complete');
                  }
                }

              // Process event skills from parallel fetch
              if (skillsResult.status === 'fulfilled') {
                const skillsResponse = skillsResult.value;
                console.log('[Dashboard] Found', skillsResponse.data.length, 'skills entries for event', liveEvent.id || 'Unknown');

                const teamSkills = skillsResponse.data.find(skills => skills.team?.id === teamInfo.id);
                if (teamSkills) {
                  eventSkillsRank = teamSkills.rank;
                  console.log('[Dashboard] Team', team.number || 'Unknown', 'event skills rank:', eventSkillsRank);
                } else {
                  console.log('[Dashboard] Team', team.number || 'Unknown', '(ID:', teamInfo.id || 'Unknown', ') not found in skills rankings.');
                }
              } else {
                console.warn('[Dashboard] Could not fetch event skills rankings for team', team.number || 'Unknown');
              }

              // Use null instead of undefined to ensure properties are preserved
              currentEvent = {
                name: liveEvent.name,
                eventId: liveEvent.id,
                nextMatchNumber: nextMatchNumber || null,
                eventRank: eventRank || null,
                eventSkillsRank: eventSkillsRank || null,
                divisionName: divisionName,
                isMultiDivision: isMultiDivision,
              };

              console.log('[Dashboard] Live event data for team', team.number || 'Unknown', ':', {
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
          console.error('Failed to load data for team', team.number || 'Unknown', ':', error);
          return null;
        }
      });

      const results = await Promise.all(teamDataPromises);
      const validTeamData = results.filter((data): data is TeamDashboardData => data !== null);
      setTeamData(validTeamData);

      // Load event data for favorite events
      console.log('[Dashboard] Starting to load dashboard data for', favoriteEvents.length, 'events');
      const eventDataPromises = favoriteEvents.map(async (eventFavorite) => {
        try {
          const eventId = eventFavorite.eventApiId;
          if (!eventId) {
            console.warn('[Dashboard] Event favorite missing eventApiId:', eventFavorite.name);
            return null;
          }

          console.log('[Dashboard] Fetching event data for:', eventFavorite.name, 'ID:', eventId);
          const eventDetails = await robotEventsAPI.getEventById(eventId);

          if (!eventDetails) {
            console.error('[Dashboard] No event details returned for event', eventId);
            return null;
          }

          console.log('[Dashboard] Event details for', eventFavorite.name, ':', {
            id: eventDetails.id,
            name: eventDetails.name,
            start: eventDetails.start,
            end: eventDetails.end,
          });

          return eventDetails;
        } catch (error) {
          console.error('Failed to load data for event', eventFavorite.name, ':', error);
          return null;
        }
      });

      const eventResults = await Promise.all(eventDataPromises);
      const validEventData = eventResults.filter((data): data is any => data !== null);
      setEventData(validEventData);
    } catch (error) {
      console.error('[Dashboard] Failed to load dashboard data:', error);
      // Otherwise preserve existing data to prevent cards from disappearing
      if (forceRefresh || teamData.length === 0) {
        setTeamData([]);
      }
      if (forceRefresh || eventData.length === 0) {
        setEventData([]);
      }
    } finally {
      console.log('[Dashboard] Setting loading to false');
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Load dashboard data when dependencies change
  useEffect(() => {
    // Reload if there are favorite teams or events to load
    if (favoriteTeams.length > 0 || favoriteEvents.length > 0) {
      loadDashboardData();
    } else {
      setTeamData([]);
      setEventData([]);
      setLoading(false);
    }
  }, [favoriteTeams.length, favoriteEvents.length, selectedSeason]);

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
          console.log('[Dashboard] Auto-refreshing data for', teamsAtEvents.length, 'teams at events');
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
      console.log('[Dashboard] Screen focused - checking if refresh needed');

      // Check if initial load is needed for teams or events
      const hasLiveTeams = teamData.some(team => team.isAtEvent);
      const needsTeamLoad = favoriteTeams.length > 0 && teamData.length === 0;
      const needsEventLoad = favoriteEvents.length > 0 && eventData.length === 0;
      const needsInitialLoad = needsTeamLoad || needsEventLoad;

      if (needsInitialLoad) {
        console.log('[Dashboard] Initial load needed - refetching data');
        loadDashboardData();
      } else if (hasLiveTeams) {
        console.log('[Dashboard] Teams at live events - soft refresh');
        loadDashboardData(); // Soft refresh for live events
      } else {
        console.log('[Dashboard] No refresh needed - preserving existing data');
      }

      return () => {
        // Screen is unfocused - don't need to do anything special
        console.log('[Dashboard] Screen unfocused');
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
    if (change > 0) return { icon: '↗️', text: `+${change}`, color: '#34C759' };
    if (change < 0) return { icon: '↘️', text: `${change}`, color: '#FF3B30' };
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
              console.error('Failed to delete team:', error);
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
              console.error('Failed to delete event:', error);
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
        color: '#FF3B30',
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

  const showEventContextMenu = useCallback((event: any) => {
    const options: ContextMenuOption[] = [
      {
        id: 'delete',
        title: 'Remove from Favorites',
        icon: 'trash',
        color: '#FF3B30',
        onPress: () => handleDeleteEvent(event.sku || '', event.name),
      },
    ];

    setContextMenuTitle(event.name);
    setContextMenuOptions(options);
    setContextMenuVisible(true);
  }, [handleDeleteEvent]);


  const renderEventCard = (event: any) => {
    // Event data is already in the correct format from API
    return (
      <EventCard
        key={event.id}
        event={event}
        onPress={(eventData) => navigation.navigate('EventDetail', { eventId: eventData.id })}
        onLongPress={() => showEventContextMenu(event)}
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
            backgroundColor: '#FF3B30',
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
                    <Ionicons name="trophy" size={16} color="#FFD700" style={styles.qualificationIcon} />
                  </TouchableOpacity>
                )}
                {team.qualifiedForWorlds && (
                  <TouchableOpacity
                    style={styles.qualificationButton}
                    onPress={() => setShowQualificationTooltip(
                      showQualificationTooltip === `${team.teamNumber}-worlds` ? null : `${team.teamNumber}-worlds`
                    )}
                  >
                    <Ionicons name="globe" size={16} color="#4A90E2" style={styles.qualificationIcon} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
            <Text style={[styles.teamName, { color: settings.textColor }]} numberOfLines={1}>
              {team.teamName}
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
                <Text style={[styles.statValue, { color: settings.textColor }]} numberOfLines={1} adjustsFontSizeToFit>
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
                <Text style={[styles.statLabel, { color: settings.secondaryTextColor }]}>Skills Highest</Text>
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
                      navigation.navigate('EventDetail', { event: eventForNavigation });
                    } else {
                      console.error('[Dashboard] No event found for ID:', team.currentEvent.eventId);
                    }
                  } catch (error) {
                    console.error('[Dashboard] Failed to fetch event for navigation:', error);
                  }
                }
              }}
            >
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={[styles.eventLinkText, { color: '#FF3B30', flex: 1 }]}>
                    {team.currentEvent?.name || 'Unknown Event'}
                  </Text>
                  <Ionicons name="calendar" size={16} color="#FF3B30" style={{ marginLeft: 4 }} />
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
                <Ionicons name="globe" size={16} color="#4A90E2" />
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
                <Ionicons name="trophy" size={16} color="#FFD700" />
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
    const columns = isTablet ? actions.length : 3; // All buttons in one row on tablets, 3 columns on phones
    const horizontalPadding = 32; // 16px padding on each side

    // Calculate button width to fit 3 per row with gaps, with max size constraint
    const availableWidth = screenWidth - horizontalPadding;
    const totalGapWidth = (columns - 1) * gap;
    const calculatedButtonWidth = (availableWidth - totalGapWidth) / columns;
    const maxButtonWidth = 120; // Maximum size for buttons
    const buttonWidth = Math.min(calculatedButtonWidth, maxButtonWidth);

    // Fixed icon and font sizes
    const iconSize = 26;
    const fontSize = 12;

    return (
      <View style={styles.quickActionsGrid}>
        {actions.map((action, index) => {
          const totalRows = Math.ceil(actions.length / columns);
          const currentRow = Math.floor(index / columns);
          const isInLastRow = currentRow === totalRows - 1;
          const positionInRow = index % columns;
          const isLastInRow = positionInRow === columns - 1;

          return (
            <TouchableOpacity
              key={index}
              style={[
                styles.quickActionButton,
                {
                  backgroundColor: settings.cardBackgroundColor,
                  borderColor: settings.borderColor,
                  width: buttonWidth,
                  height: buttonWidth,
                  shadowColor: settings.colorScheme === 'dark' ? '#FFFFFF' : '#000000',
                  marginRight: isLastInRow ? 0 : gap,
                  marginBottom: isInLastRow ? 0 : gap,
                }
              ]}
              onPress={action.onPress}
            >
              <Ionicons
                name={action.icon as any}
                size={iconSize}
                color={settings.buttonColor}
              />
              <Text style={[
                styles.quickActionText,
                {
                  color: settings.textColor,
                  fontSize: fontSize,
                }
              ]}>
                {action.title}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const renderEmptyState = () => {
    // Check if current program is in limited mode
    const isLimitedMode = isProgramLimitedMode(settings.selectedProgram);
    const customMessage = getLimitedModeMessage(settings.selectedProgram);

    if (isLimitedMode) {
      // Limited mode: Show custom message without the find teams button
      return (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyTitle, { color: settings.textColor }]}>
            {customMessage || 'Limited Mode'}
          </Text>
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
        <TeamCardSkeleton key={i} />
      ))}
    </View>
  );

  // Check if current program is in limited mode
  const isLimitedMode = isProgramLimitedMode(settings.selectedProgram);

  // Determine if screen is large enough for side-by-side layout
  const screenWidth = Dimensions.get('window').width;
  const isLargeScreen = screenWidth >= 768; // iPad breakpoint
  const showSideBySide = isLargeScreen && favoriteTeams.length > 0 && favoriteEvents.length > 0;

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
                {teamData.map((team, index) => renderTeamCard(team, index))}
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
                {eventData.map((event) => renderEventCard(event))}
              </View>
            </View>
          )}
        </View>
      ) : (
        <>
          {/* My Teams Section - Hide in limited mode */}
          {!isLimitedMode && activeTab === 'teams' && favoriteTeams.length > 0 && (
            <View style={styles.section}>
              {teamData.map((team, index) => renderTeamCard(team, index))}
            </View>
          )}

          {/* My Events Section - Hide in limited mode */}
          {!isLimitedMode && activeTab === 'events' && favoriteEvents.length > 0 && (
            <View style={styles.section}>
              {eventData.map((event) => renderEventCard(event))}
            </View>
          )}
        </>
      )}

      {/* Loading State - Hide in limited mode */}
      {!isLimitedMode && loading && favoriteTeams.length > 0 && renderLoadingState()}

      {/* Empty State - Always show (but with different content in limited mode) */}
      {(isLimitedMode || (!loading && favoriteTeams.length === 0 && favoriteEvents.length === 0)) && renderEmptyState()}

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
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  quickActionButton: {
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
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