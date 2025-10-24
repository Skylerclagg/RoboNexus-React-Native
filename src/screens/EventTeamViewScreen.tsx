/**
 * Event Team View Screen
 *
 * Description:
 * Comprehensive team detail screen showing all information for a specific team
 * at a VEX robotics event. Features tabbed interface with team information,
 * matches, rankings, and notes with favorites management capabilities.
 *
 * Navigation:
 * Accessed from team listings, search results, or match screens when users
 * want detailed information about a specific team at an event.
 *
 * Key Features:
 * - Tabbed interface for team information, matches, and performance data
 * - Team favorites management with add/remove functionality
 * - Match history and upcoming matches display
 * - Team ranking and statistical performance tracking
 * - Notes integration for team scouting and analysis
 * - Comprehensive team profile with organization and location details
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  FlatList,
  TextInput,
  RefreshControl,
  Image,
} from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../contexts/SettingsContext';
import { useFavorites } from '../contexts/FavoritesContext';
import { useNotes } from '../contexts/NotesContext';
import { useDataCache } from '../contexts/DataCacheContext';
import { robotEventsAPI } from '../services/apiRouter';
import { Event, Division, Team } from '../types';
import { ExtendedEvent, expandLeagueEvent } from '../utils/eventUtils';
import EventTeamMatchesScreen from './EventTeamMatchesScreen';
import EventCard from '../components/EventCard';
import TeamInfoCard from '../components/TeamInfoCard';
import DropdownPicker from '../components/DropdownPicker';
import { getProgramId } from '../utils/programMappings';

type EventTeamViewScreenRouteProp = RouteProp<
  {
    EventTeamView: {
      event: Event;
      teamNumber: string;
      teamData?: Team;
      division?: Division;
    };
  },
  'EventTeamView'
>;

type EventTeamViewScreenNavigationProp = StackNavigationProp<any>;

interface Props {
  route: EventTeamViewScreenRouteProp;
  navigation: EventTeamViewScreenNavigationProp;
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

interface EventMatchRecord {
  eventWins: number;
  eventLosses: number;
  eventTies: number;
  eventTotalMatches: number;
}

// Custom tab definitions
const tabs = [
  {
    key: 'statistics',
    name: 'Statistics',
    icon: 'stats-chart' as const,
  },
  {
    key: 'matches',
    name: 'Matches',
    icon: 'time' as const,
  },
  {
    key: 'events',
    name: 'Events',
    icon: 'calendar' as const,
  },
  {
    key: 'notes',
    name: 'Notes',
    icon: 'document-text' as const,
  },
];

const EventTeamViewScreen = ({ route, navigation }: Props) => {
  const { event, teamNumber, teamData, division } = route.params;
  const settings = useSettings();
  const {
    selectedProgram,
    backgroundColor,
    textColor,
    cardBackgroundColor,
    secondaryTextColor,
    iconColor,
    borderColor,
    buttonColor,
    colorScheme,
  } = settings;
  const { addTeam, removeTeam, isTeamFavorited } = useFavorites();
  const { getNotesByTeam, createOrUpdateNote, deleteNote } = useNotes();
  const {
    forceRefreshSeasons,
    forceRefreshTeamEvents,
    forceRefreshTeamAwards,
    forceRefreshWorldSkills
  } = useDataCache();

  // State management
  const [selectedSeason, setSelectedSeason] = useState<string>('');
  const [seasons, setSeasons] = useState<{label: string, value: string}[]>([]);
  const [team, setTeam] = useState<Team | null>(teamData || null);
  const [teamFetched, setTeamFetched] = useState(false);
  const [teamLoading, setTeamLoading] = useState(false);
  const [worldSkillsData, setWorldSkillsData] = useState<WorldSkillsData | null>(null);
  const [worldSkillsLoading, setWorldSkillsLoading] = useState(false);
  const [awardCounts, setAwardCounts] = useState<AwardCounts>({});
  const [awardCountsLoading, setAwardCountsLoading] = useState(false);
  const [averageRanking, setAverageRanking] = useState<number>(0);
  const [eventsState, setEventsState] = useState<EventsState>({ events: [], loading: false });
  const [expandedSeasons, setExpandedSeasons] = useState<Set<string>>(new Set());
  const [isWorldSkillsExpanded, setIsWorldSkillsExpanded] = useState<boolean>(false);
  const [isAwardsExpanded, setIsAwardsExpanded] = useState<boolean>(false);
  const [matchRecord, setMatchRecord] = useState<MatchRecord | null>(null);
  const [matchRecordLoading, setMatchRecordLoading] = useState(false);
  const [eventMatchRecord, setEventMatchRecord] = useState<EventMatchRecord | null>(null);
  const [eventMatchRecordLoading, setEventMatchRecordLoading] = useState(false);
  const [eventSkillsRanking, setEventSkillsRanking] = useState<any | null>(null);
  const [eventSkillsLoading, setEventSkillsLoading] = useState(false);

  // Custom tab state management
  const [activeTab, setActiveTab] = useState('statistics');
  const [currentTabTitle, setCurrentTabTitle] = useState('Statistics');

  // Pull-to-refresh state
  const [isRefreshing, setIsRefreshing] = useState(false);

  // TODO: Implement user settings for default page

  // Initialize data
  useEffect(() => {
    loadSeasons();
    fetchTeamInfo();
  }, [teamNumber]);

  useEffect(() => {
    const currentTeam = team || teamData;
    if (currentTeam?.id) {
      fetchTeamEvents();
      fetchEventSkillsRanking(currentTeam.id);
    }
  }, [team?.id, teamData?.id]);

  // Auto-expand the most recent season when events are first loaded
  const [hasAutoExpanded, setHasAutoExpanded] = useState(false);

  useEffect(() => {
    if (eventsState.events.length > 0 && !hasAutoExpanded && seasons.length > 0) {
      const eventsBySeason = groupEventsBySeason();
      const seasonNames = Object.keys(eventsBySeason);

      if (seasonNames.length > 0) {
        const sortedSeasons = seasonNames.sort((a, b) => {
          const seasonA = seasons.find(s => s.label === a);
          const seasonB = seasons.find(s => s.label === b);

          if (seasonA && seasonB) {
            return seasonB.value.localeCompare(seasonA.value);
          }

          const yearA = parseInt(a.match(/(\d{4})/)?.[0] || '0');
          const yearB = parseInt(b.match(/(\d{4})/)?.[0] || '0');
          return yearB - yearA;
        });
        setExpandedSeasons(new Set([sortedSeasons[0]]));
        setHasAutoExpanded(true);
      }
    }
  }, [eventsState.events.length, seasons.length, hasAutoExpanded]);

  // Refresh awards and world skills when selected season changes
  useEffect(() => {
    const currentTeam = team || teamData;
    if (currentTeam?.id && selectedSeason && selectedSeason !== '') {
      console.log('Selected season changed, refreshing data for season:', selectedSeason);
      const seasonId = parseInt(selectedSeason);
      fetchAwardCounts(currentTeam.id, seasonId);
      fetchWorldSkillsData(currentTeam.id, seasonId);
    }
  }, [selectedSeason, team?.id, teamData?.id]);

  const loadSeasons = async () => {
    try {
      // Get program ID for filtering
      const programId = getProgramId(selectedProgram);

      const seasonData = await robotEventsAPI.getSeasons({ program: [programId] });
      const formattedSeasons = seasonData.data
        .sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime())
        .map(season => ({
          label: formatSeasonOption(season.name),
          value: season.id.toString()
        }));
      setSeasons(formattedSeasons);
      if (formattedSeasons.length > 0) {
        setSelectedSeason(formattedSeasons[0].value);
      }
    } catch (error) {
      console.error('Failed to load seasons:', error);
    }
  };

  const formatSeasonOption = (raw: string) => {
    if (!raw) return 'Unknown Season';

    // Return the full season name as-is
    return raw;
  };

  const fetchTeamInfo = async () => {
    setTeamLoading(true);
    try {
      // Use provided team data or fetch it
      if (!team && teamData) {
        setTeam(teamData);
      } else if (!team) {
        const fetchedTeam = await robotEventsAPI.getTeamByNumber(teamNumber);
        if (fetchedTeam) {
          // Transform API team to UI team
          const uiTeam = {
            ...fetchedTeam,
            organization: fetchedTeam.organization || '',
            program: {
              id: fetchedTeam.program.id,
              name: fetchedTeam.program.name,
              code: fetchedTeam.program.code || 'UNKNOWN',
            },
          };
          setTeam(uiTeam);
        } else {
          Alert.alert('Error', `Team ${teamNumber} not found`);
        }
      }

      setTeamFetched(true);

      // Fetch additional data if we have a team
      const currentTeam = team || teamData;
      if (currentTeam) {
        await fetchWorldSkillsData(currentTeam.id);
        await fetchAwardCounts(currentTeam.id);
        await fetchMatchRecord(currentTeam.id);
        await fetchEventMatchRecord(currentTeam.id, event.id);
      }
    } catch (error) {
      console.error('Failed to fetch team info:', error);
      Alert.alert('Error', 'Failed to load team information');
    } finally {
      setTeamLoading(false);
    }
  };

  const fetchWorldSkillsData = async (teamId: number, seasonId?: number) => {
    try {
      console.log('Fetching world skills data for team:', teamId, 'season:', seasonId);

      if (!team || !team.grade) {
        console.log('No team data or grade available for world skills lookup');
        return;
      }

      // Use provided season or get current season
      let targetSeasonId = seasonId;
      if (!targetSeasonId) {
        if (selectedSeason && selectedSeason !== '') {
          targetSeasonId = parseInt(selectedSeason);
        } else {
          targetSeasonId = await robotEventsAPI.getCurrentSeasonId(selectedProgram);
        }
      }
      console.log('Target season ID:', targetSeasonId);

      // Get grade level for the skills API
      const gradeLevel = team.grade;
      console.log('Team grade level:', gradeLevel);

      // Fetch all world skills rankings for this grade level and season
      const allSkillsRankings = await robotEventsAPI.getWorldSkillsRankings(targetSeasonId, gradeLevel);
      console.log('Total skills rankings returned:', allSkillsRankings.length);

      // Find this team in the rankings
      const teamSkillsData = allSkillsRankings.find((ranking: any) =>
        ranking.team && ranking.team.id === teamId
      );

      if (teamSkillsData) {
        console.log('Found team in world skills rankings:', teamSkillsData);
        setWorldSkillsData({
          ranking: teamSkillsData.rank || 0,
          combined: teamSkillsData.scores?.score || 0,
          driver: teamSkillsData.scores?.driver || 0,
          programming: teamSkillsData.scores?.programming || 0,
          highestDriver: teamSkillsData.scores?.maxDriver || 0,
          highestProgramming: teamSkillsData.scores?.maxProgramming || 0,
          totalTeams: allSkillsRankings.length,
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
          totalTeams: allSkillsRankings.length,
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
    }
  };

  const fetchEventSkillsRanking = async (teamId: number) => {
    try {
      setEventSkillsLoading(true);
      console.log('Fetching event skills ranking for team:', teamId, 'at event:', event.id);

      // Fetch skills rankings for this event
      const skillsResponse = await robotEventsAPI.getEventSkills(event.id, {});
      console.log('Event skills rankings returned:', skillsResponse.data.length);

      // Group skills by team and calculate combined scores (same logic as EventSkillsRankingsScreen)
      const teamSkillsMap = new Map<number, {
        team: { id: number; name: string };
        programming_score: number;
        programming_attempts: number;
        driver_score: number;
        driver_attempts: number;
        combined_score: number;
      }>();

      skillsResponse.data.forEach((skill: any) => {
        if (!skill.team || !skill.team.id) return;

        const skillTeamId = skill.team.id;
        const existing = teamSkillsMap.get(skillTeamId) || {
          team: {
            id: skillTeamId,
            name: skill.team.name || ''
          },
          programming_score: 0,
          programming_attempts: 0,
          driver_score: 0,
          driver_attempts: 0,
          combined_score: 0,
        };

        // Update scores based on skill type
        if (skill.type === 'programming') {
          existing.programming_score = Math.max(existing.programming_score, skill.score || 0);
          existing.programming_attempts = skill.attempts || 0;
        } else if (skill.type === 'driver') {
          existing.driver_score = Math.max(existing.driver_score, skill.score || 0);
          existing.driver_attempts = skill.attempts || 0;
        }

        // Calculate combined score
        existing.combined_score = existing.programming_score + existing.driver_score;

        teamSkillsMap.set(skillTeamId, existing);
      });

      // Convert to array and sort by combined score
      const rankingsArray = Array.from(teamSkillsMap.entries()).map(([id, data]) => ({
        id,
        rank: 0,
        team: data.team,
        combined_score: data.combined_score,
        programming_score: data.programming_score,
        programming_attempts: data.programming_attempts,
        driver_score: data.driver_score,
        driver_attempts: data.driver_attempts,
        score: data.combined_score, // Add for compatibility with TeamInfoCard
        attempts: Math.max(data.programming_attempts, data.driver_attempts), // Use max attempts
      }));

      // Sort by combined score and assign ranks
      rankingsArray.sort((a, b) => b.combined_score - a.combined_score);
      rankingsArray.forEach((ranking, index) => {
        ranking.rank = index + 1;
      });

      // Find this team's ranking
      const teamRanking = rankingsArray.find(r => r.id === teamId);

      if (teamRanking) {
        console.log('Found team skills ranking at event:', teamRanking);
        setEventSkillsRanking(teamRanking);
      } else {
        console.log('Team has no skills ranking at this event');
        setEventSkillsRanking(null);
      }
    } catch (error) {
      console.error('Failed to fetch event skills ranking:', error);
      setEventSkillsRanking(null);
    } finally {
      setEventSkillsLoading(false);
    }
  };

  const fetchAwardCounts = async (teamId: number, seasonId?: number) => {
    try {
      console.log('Fetching awards for team:', teamId, 'season:', seasonId);

      // Get season ID to fetch awards for - use provided seasonId, selectedSeason, or current season
      let targetSeasonId = seasonId;
      if (!targetSeasonId) {
        if (selectedSeason && selectedSeason !== '') {
          targetSeasonId = parseInt(selectedSeason);
        } else {
          targetSeasonId = await robotEventsAPI.getCurrentSeasonId(selectedProgram);
        }
      }

      console.log('Fetching awards for season:', targetSeasonId);

      // Fetch team awards for the selected season
      const teamAwards = await robotEventsAPI.getTeamAwards(teamId, { season: [targetSeasonId] });
      console.log('Awards returned:', teamAwards.data.length);

      // Count awards by title (similar to Swift implementation)
      const awardCounts: AwardCounts = {};
      teamAwards.data.forEach((award: any) => {
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
    }
  };

  const handleToggleFavorite = async () => {
    const currentTeam = team || teamData;
    if (!currentTeam) return;

    try {
      if (isTeamFavorited(teamNumber)) {
        await removeTeam(teamNumber);
      } else {
        await addTeam(currentTeam, event.id);
      }
    } catch (error) {
      console.error('Failed to toggle team favorite:', error);
    }
  };

  const fetchMatchRecord = async (teamId: number) => {
    setMatchRecordLoading(true);
    try {
      console.log('Fetching overall match record for team:', teamId);

      // Get season ID to fetch matches for
      let seasonId: number;
      if (selectedSeason && selectedSeason !== '') {
        seasonId = parseInt(selectedSeason);
      } else {
        seasonId = await robotEventsAPI.getCurrentSeasonId(selectedProgram);
      }

      console.log('Fetching matches for season:', seasonId);

      // Fetch team matches for the selected season
      const matchesResponse = await robotEventsAPI.getTeamMatches(teamId, { season: [seasonId] });
      console.log('Matches returned:', matchesResponse.data.length);

      // Calculate win/loss/tie record
      let wins = 0;
      let losses = 0;
      let ties = 0;

      matchesResponse.data.forEach((match: any, index: number) => {
        // Debug: Log the full match structure for first match
        if (index === 0) {
          console.log('Full match object structure:', JSON.stringify(match, null, 2));
        }

        const blueAlliance = match.alliances?.find((a: any) => a.color === 'blue');
        const redAlliance = match.alliances?.find((a: any) => a.color === 'red');

        console.log(`Processing match ${index + 1}:`, {
          matchName: match.name,
          scored: match.scored,
          blueTeams: blueAlliance?.teams?.map((t: any) => t.team?.id),
          redTeams: redAlliance?.teams?.map((t: any) => t.team?.id),
          blueScore: blueAlliance?.score,
          redScore: redAlliance?.score
        });

        // The API returns alliances as an array, not an object
        if (!match.alliances || !Array.isArray(match.alliances) || match.alliances.length !== 2) {
          console.log('Invalid alliance data structure');
          return;
        }

        const isBlueAlliance = blueAlliance?.teams?.some((allianceTeam: any) =>
          allianceTeam.team?.id === teamId
        );
        const isRedAlliance = redAlliance?.teams?.some((allianceTeam: any) =>
          allianceTeam.team?.id === teamId
        );

        console.log(`Team ${teamId} is on:`, { isRedAlliance, isBlueAlliance });

        // Check if we have valid scores (matches can have scores even if not officially "scored")
        if (blueAlliance?.score !== undefined && redAlliance?.score !== undefined && (isBlueAlliance || isRedAlliance)) {
          const blueScore = blueAlliance.score;
          const redScore = redAlliance.score;

          console.log(`Match scores: Red ${redScore} - Blue ${blueScore}`);

          // Skip 0-0 matches as they are considered unplayed
          if (redScore === 0 && blueScore === 0) {
            console.log('Result: UNPLAYED (0-0 match, not counted in statistics)');
          } else if (redScore === blueScore) {
            ties++;
            console.log('Result: TIE');
          } else if (isRedAlliance && redScore > blueScore) {
            wins++;
            console.log('Result: WIN (Red Alliance)');
          } else if (isBlueAlliance && blueScore > redScore) {
            wins++;
            console.log('Result: WIN (Blue Alliance)');
          } else if (isRedAlliance || isBlueAlliance) {
            losses++;
            console.log('Result: LOSS');
          } else {
            console.log('Result: Team not found in match');
          }
        } else {
          console.log('Match missing score data or team not in match');
        }
      });

      const record: MatchRecord = {
        wins,
        losses,
        ties,
        totalMatches: wins + losses + ties
      };

      console.log('Processed overall match record:', record);
      setMatchRecord(record);
    } catch (error) {
      console.error('Failed to fetch overall match record:', error);
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

  const fetchEventMatchRecord = async (teamId: number, eventId: number) => {
    setEventMatchRecordLoading(true);
    try {
      console.log('Fetching event match record for team:', teamId, 'at event:', eventId, 'division:', division?.id);

      let divisionId = division?.id;
      let rankingsResponse;

      if (!divisionId) {
        try {
          console.log('Division not provided, fetching event details to get division information');
          const eventDetails = await robotEventsAPI.getEventById(eventId);

          if (eventDetails && eventDetails.divisions && eventDetails.divisions.length > 0) {
            // Use the first division (typically "Default Division" for single-division events)
            divisionId = eventDetails.divisions[0].id;
            console.log('Found division from event details:', divisionId, 'name:', eventDetails.divisions[0].name);
          }
        } catch (eventError) {
          console.error('Failed to fetch event details:', eventError);
        }
      }

      // Try to use division-specific rankings if division is available
      if (divisionId) {
        console.log('Using division-specific rankings API with division:', divisionId);
        rankingsResponse = await robotEventsAPI.getEventDivisionRankings(eventId, divisionId, { team: [teamId] });
      } else {
        // Final fallback: Use team rankings filtered by event
        console.log('No division available, using team rankings API filtered by event');
        rankingsResponse = await robotEventsAPI.getTeamRankings(teamId, { event: [eventId] });
      }

      console.log('Event rankings returned:', rankingsResponse.data.length, 'records');

      if (rankingsResponse.data.length > 0) {
        // Find the ranking record for this team/event
        const teamRanking = divisionId
          ? rankingsResponse.data.find(ranking => ranking.team.id === teamId)
          : rankingsResponse.data.find(ranking => ranking.event.id === eventId);

        if (teamRanking) {
          const eventRecord: EventMatchRecord = {
            eventWins: teamRanking.wins,
            eventLosses: teamRanking.losses,
            eventTies: teamRanking.ties,
            eventTotalMatches: teamRanking.wins + teamRanking.losses + teamRanking.ties
          };

          console.log('Retrieved event match record from rankings API:', eventRecord);
          setEventMatchRecord(eventRecord);
        } else {
          console.log('No ranking found for this team at this event');
          setEventMatchRecord({
            eventWins: 0,
            eventLosses: 0,
            eventTies: 0,
            eventTotalMatches: 0
          });
        }
      } else {
        console.log('No rankings data available for this team at this event');
        setEventMatchRecord({
          eventWins: 0,
          eventLosses: 0,
          eventTies: 0,
          eventTotalMatches: 0
        });
      }
    } catch (error) {
      console.error('Failed to fetch event match record:', error);
      setEventMatchRecord({
        eventWins: 0,
        eventLosses: 0,
        eventTies: 0,
        eventTotalMatches: 0
      });
    } finally {
      setEventMatchRecordLoading(false);
    }
  };

  const fetchTeamEvents = async () => {
    const currentTeam = team || teamData;
    if (!currentTeam?.id) return;

    setEventsState(prev => ({ ...prev, loading: true }));
    try {
      const teamEvents = await robotEventsAPI.getTeamEvents(currentTeam.id);
      // Transform API events to UI events
      const transformedEvents = teamEvents.data.map(event => ({
        ...event,
        program: {
          id: event.program.id,
          name: event.program.name,
          code: event.program.code || 'UNKNOWN',
        },
        season: {
          id: event.season.id,
          name: event.season.name,
          program: {
            id: event.program.id,
            name: event.program.name,
            code: event.program.code || 'UNKNOWN',
          },
        }
      }));

      const sortedEvents = transformedEvents.sort((a, b) =>
        new Date(a.start).getTime() - new Date(b.start).getTime()
      );
      setEventsState({ events: sortedEvents, loading: false });
    } catch (error) {
      console.error('Failed to fetch team events:', error);
      setEventsState({ events: [], loading: false });
    }
  };

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) {
      console.log('[EventTeamViewScreen] Already refreshing, skipping duplicate call to prevent API exhaustion');
      return;
    }

    const currentTeam = team || teamData;
    if (!currentTeam?.id) return;

    setIsRefreshing(true);

    try {
      console.log('[EventTeamViewScreen] Starting pull-to-refresh...');

      // Get program and season info for refresh
      const programId = getProgramId(selectedProgram);

      const seasonId = selectedSeason ? parseInt(selectedSeason) :
                      await robotEventsAPI.getCurrentSeasonId(selectedProgram);

      // Refresh all data in parallel for better performance
      const refreshPromises = [
        forceRefreshSeasons(programId),
        forceRefreshTeamEvents(currentTeam.id),
        forceRefreshTeamAwards(currentTeam.id),
      ];

      // Add world skills refresh if we have the team grade
      if (currentTeam.grade) {
        refreshPromises.push(forceRefreshWorldSkills(seasonId, programId, currentTeam.grade));
      }

      await Promise.all(refreshPromises);

      // Reload local data from the refreshed cache
      await Promise.all([
        loadSeasons(),
        fetchTeamEvents(),
      ]);

      // Refresh world skills and awards if we have team data
      if (currentTeam.grade && seasonId) {
        await fetchWorldSkillsData(currentTeam.id, seasonId);
      }

      await fetchAwardCounts(currentTeam.id, seasonId);

      // Refresh match records
      await fetchMatchRecord(currentTeam.id);
      await fetchEventMatchRecord(currentTeam.id, event.id);

      console.log('[EventTeamViewScreen] Pull-to-refresh completed successfully');
    } catch (error) {
      console.error('[EventTeamViewScreen] Pull-to-refresh failed:', error);
      Alert.alert('Refresh Failed', 'Unable to refresh data. Please try again.');
    } finally {
      setIsRefreshing(false);
    }
  }, [
    team,
    teamData,
    selectedProgram,
    selectedSeason,
    forceRefreshSeasons,
    forceRefreshTeamEvents,
    forceRefreshTeamAwards,
    forceRefreshWorldSkills,
    loadSeasons,
    fetchTeamEvents,
    fetchWorldSkillsData,
    fetchAwardCounts,
    fetchMatchRecord,
    fetchEventMatchRecord
  ]);

  // Auto-refresh data when screen comes into focus
  // TODO: Add smarter conditions to prevent unnecessary API calls
  // Currently commented out to prevent infinite loops and API exhaustion
  /*
  useFocusEffect(
    useCallback(() => {
      const currentTeam = team || teamData;
      if (currentTeam?.id) {
        console.log('[EventTeamViewScreen] Screen focused, triggering auto-refresh...');
        handleRefresh();
      }
    }, [handleRefresh, team, teamData])
  );
  */

  const getDynamicLabel = (defaultLabel: string) => {
    if (selectedProgram === 'Aerial Drone Competition') {
      return defaultLabel.replace('Robot', 'Drone');
    }
    return defaultLabel;
  };


  const groupEventsBySeason = () => {
    const eventsBySeason: { [seasonName: string]: Event[] } = {};

    eventsState.events.forEach(event => {
      let seasonName: string;

      if (event.season && event.season.name) {
        seasonName = event.season.name;
      } else {
        const eventDate = new Date(event.start);
        const matchingSeason = seasons.find(season => {
          const eventYear = eventDate.getFullYear();
          const eventMonth = eventDate.getMonth();

          const seasonYearMatch = season.label.match(/(\d{4})/);
          if (seasonYearMatch) {
            const seasonYear = parseInt(seasonYearMatch[0]);

            if (eventMonth >= 3) {
              return seasonYear === eventYear;
            } else {
              return seasonYear === eventYear - 1;
            }
          }
          return false;
        });

        if (matchingSeason) {
          seasonName = matchingSeason.label;
        } else {
          const year = eventDate.getFullYear();
          let seasonStart: number;
          if (eventDate.getMonth() >= 3) {
            seasonStart = year;
          } else {
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

    Object.keys(eventsBySeason).forEach(season => {
      eventsBySeason[season].sort((a, b) =>
        new Date(a.start).getTime() - new Date(b.start).getTime()
      );
    });

    return eventsBySeason;
  };

  const toggleSeasonExpansion = (season: string) => {
    setExpandedSeasons(prev => {
      const newSet = new Set(prev);
      if (newSet.has(season)) {
        newSet.delete(season);
      } else {
        newSet.add(season);
      }
      return newSet;
    });
  };



  const openEventDetails = (eventItem: ExtendedEvent) => {
    navigation.navigate('EventDetail', {
      event: eventItem,
      team: team || teamData
    });
  };

  // Create dynamic styles (memoized to prevent re-renders)
  const dynamicStyles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: backgroundColor,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: backgroundColor,
    },
    loadingText: {
      marginTop: 16,
      fontSize: 16,
      color: textColor,
    },
    scrollView: {
      flex: 1,
      backgroundColor: backgroundColor,
    },
    sectionContainer: {
      backgroundColor: cardBackgroundColor,
      margin: 16,
      marginBottom: 8,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: borderColor,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: textColor,
      marginBottom: 12,
    },
    teamInfoContainer: {
      backgroundColor: cardBackgroundColor,
      margin: 16,
      marginTop: 8,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: borderColor,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    menuRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: borderColor,
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: borderColor,
    },
    infoLabel: {
      fontSize: 16,
      color: textColor,
      flex: 1,
    },
    infoValue: {
      fontSize: 16,
      color: secondaryTextColor,
      textAlign: 'right',
      flex: 1,
    },
    eventItem: {
      backgroundColor: cardBackgroundColor,
      borderRadius: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: borderColor,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    eventContent: {
      padding: 16,
    },
    eventName: {
      fontSize: 16,
      fontWeight: '600',
      color: textColor,
      marginBottom: 8,
    },
    eventDetailsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
    },
    eventDetailText: {
      fontSize: 14,
      color: iconColor,
      marginLeft: 6,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 40,
      paddingVertical: 60,
    },
    emptyText: {
      fontSize: 18,
      fontWeight: '600',
      color: textColor,
      textAlign: 'center',
      marginTop: 16,
      marginBottom: 8,
    },
    emptySubtext: {
      fontSize: 14,
      color: secondaryTextColor,
      textAlign: 'center',
      lineHeight: 20,
    },
    tabBar: {
      flexDirection: 'row',
      backgroundColor: cardBackgroundColor,
      paddingHorizontal: 8,
      paddingTop: 8,
      paddingBottom: 4,
      borderBottomWidth: 1,
      borderBottomColor: borderColor,
    },
    tabButton: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: 8,
      marginHorizontal: 4,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      borderRadius: 10,
    },
    activeTabButton: {
      backgroundColor: buttonColor + '15', // 15% opacity
    },
    disabledTab: {
      opacity: 0.5,
    },
    tabIcon: {
      marginBottom: 4,
    },
    tabText: {
      fontSize: 11,
      fontWeight: '600',
      textAlign: 'center',
    },
    activeTabText: {
      color: buttonColor,
    },
    inactiveTabText: {
      color: secondaryTextColor,
    },
    tabContent: {
      flex: 1,
      backgroundColor: backgroundColor,
    },
    headerButton: {
      marginRight: 16,
      padding: 4,
    },
    // Notes tab styles
    notesContainer: {
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 16,
    },
    addNoteSection: {
      backgroundColor: cardBackgroundColor,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: borderColor,
    },
    addNoteButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: buttonColor,
      borderStyle: 'dashed',
    },
    addNoteText: {
      color: buttonColor,
      fontSize: 16,
      marginLeft: 8,
    },
    noteInputContainer: {
      marginTop: 12,
    },
    noteInput: {
      backgroundColor: backgroundColor,
      borderWidth: 1,
      borderColor: borderColor,
      borderRadius: 8,
      padding: 12,
      color: textColor,
      fontSize: 16,
      minHeight: 100,
      textAlignVertical: 'top',
    },
    noteActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginTop: 12,
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
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: secondaryTextColor,
    },
    saveButton: {
      backgroundColor: buttonColor,
    },
    // Modern Statistics Tab Styles (from TeamInfoScreen)
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
      gap: 8,
    },
    modernInfoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: borderColor,
    },
    modernInfoLabel: {
      fontSize: 16,
      fontWeight: '500',
      flex: 1,
    },
    modernInfoValue: {
      fontSize: 16,
      fontWeight: '600',
      textAlign: 'right',
    },
    skillsSection: {
      marginTop: 8,
    },
    scoreWithChevron: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    chevronIcon: {
      marginLeft: 4,
    },
    modernSkillsBreakdown: {
      marginTop: 8,
      paddingLeft: 16,
    },
    modernSkillsBreakdownRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
      borderBottomWidth: 1,
    },
    modernSkillsLabel: {
      fontSize: 14,
      flex: 1,
    },
    modernSkillsValue: {
      fontSize: 14,
      fontWeight: '600',
    },
    modernAwardsBreakdown: {
      marginTop: 8,
      paddingLeft: 16,
    },
    cancelButtonText: {
      color: secondaryTextColor,
      fontSize: 16,
    },
    saveButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    existingNotesSection: {
      backgroundColor: cardBackgroundColor,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: borderColor,
    },
    emptyNotesContainer: {
      alignItems: 'center',
      paddingVertical: 32,
    },
    emptyNotesText: {
      fontSize: 18,
      color: textColor,
      marginTop: 12,
      marginBottom: 8,
    },
    emptyNotesSubtext: {
      fontSize: 14,
      color: secondaryTextColor,
      textAlign: 'center',
      lineHeight: 20,
    },
    noteItem: {
      backgroundColor: backgroundColor,
      borderRadius: 8,
      padding: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: borderColor,
    },
    noteHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    noteDate: {
      fontSize: 12,
      color: secondaryTextColor,
    },
    deleteButton: {
      padding: 4,
    },
    noteText: {
      fontSize: 16,
      color: textColor,
      lineHeight: 22,
    },
    matchLabel: {
      fontSize: 12,
      fontWeight: '600',
    },
    noteImage: {
      width: '100%',
      height: 200,
      borderRadius: 8,
      marginTop: 8,
    },
    // Season-specific styles
    seasonsContainer: {
      paddingTop: 16,
      paddingBottom: 16,
    },
    seasonSection: {
      backgroundColor: cardBackgroundColor,
      marginHorizontal: 16,
      marginBottom: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: borderColor,
      overflow: 'hidden',
      shadowColor: '#000',
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
      borderBottomColor: borderColor,
      minHeight: 80,
    },
    seasonHeaderContent: {
      flex: 1,
    },
    seasonTitle: {
      fontSize: 20,
      fontWeight: '700',
      letterSpacing: 0.5,
      color: textColor,
    },
    seasonCount: {
      fontSize: 15,
      marginTop: 6,
      fontWeight: '500',
      color: secondaryTextColor,
    },
    seasonEvents: {
      padding: 16,
      paddingTop: 8,
    },
    eventWrapper: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: borderColor,
      paddingBottom: 12,
      marginBottom: 12,
    },
  }), [backgroundColor, textColor, cardBackgroundColor, secondaryTextColor, iconColor, borderColor, buttonColor]);

  // Static styles that don't need theming
  const staticStyles = StyleSheet.create({
    expandableSection: {
      // Additional styling for expandable sections if needed
    },
    teamInfoSection: {
      padding: 16,
      gap: 16,
    },
    placeholderContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    eventsListContainer: {
      padding: 8,
    },
    eventHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: 8,
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
    emptyEventsContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 60,
      paddingHorizontal: 40,
    },
    emptyEventsTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: textColor,
      marginTop: 16,
      textAlign: 'center',
    },
    emptyEventsMessage: {
      fontSize: 14,
      color: secondaryTextColor,
      marginTop: 8,
      textAlign: 'center',
      lineHeight: 20,
    },
    eventLocation: {
      fontSize: 14,
      color: secondaryTextColor,
      marginLeft: 6,
    },
    eventDate: {
      fontSize: 14,
      color: secondaryTextColor,
      marginLeft: 6,
    },
    eventLevel: {
      fontSize: 14,
      color: secondaryTextColor,
      marginLeft: 6,
      textTransform: 'capitalize',
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
    seasonCardsContainer: {
      marginTop: 8,
    },
    seasonCardsContent: {
      paddingHorizontal: 4,
    },
    seasonCard: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      marginHorizontal: 4,
      borderRadius: 12,
      borderWidth: 1,
      minWidth: 120,
      alignItems: 'center',
      justifyContent: 'center',
    },
    seasonCardText: {
      fontSize: 14,
      textAlign: 'center',
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
  });


  const handleTabPress = (tabKey: string, tabName: string) => {
    setActiveTab(tabKey);
    setCurrentTabTitle(tabName);
  };

  useEffect(() => {
    const currentTeam = team || teamData;
    const displayTitle = currentTeam?.team_name
      ? `${teamNumber} ${currentTeam.team_name} - ${currentTabTitle}`
      : `${teamNumber} ${currentTabTitle}`;

    navigation.setOptions({
      title: displayTitle,
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
          onPress={handleToggleFavorite}
          style={dynamicStyles.headerButton}
        >
          <Ionicons
            name={isTeamFavorited(teamNumber) ? "heart" : "heart-outline"}
            size={24}
            color={isTeamFavorited(teamNumber) ? "#FF6B6B" : settings.topBarContentColor}
          />
        </TouchableOpacity>
      ),
    });
  }, [settings.topBarColor, settings.topBarContentColor, teamNumber, currentTabTitle, isTeamFavorited(teamNumber), team?.team_name, teamData?.team_name]);

  // Tab Screens
  const InformationTabScreen = () => {
    const currentTeam = team || teamData;

    const renderModernTeamInfo = (label: string, value: string) => (
      <View style={dynamicStyles.modernInfoRow}>
        <Text style={[dynamicStyles.modernInfoLabel, { color: secondaryTextColor }]}>{label}</Text>
        <Text style={[dynamicStyles.modernInfoValue, { color: textColor }]}>{value}</Text>
      </View>
    );

    return (
      <ScrollView
        style={dynamicStyles.modernTabContent}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={dynamicStyles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[buttonColor]}
            tintColor={buttonColor}
          />
        }
      >
        {/* Season Selector Card */}
        <View style={[dynamicStyles.modernSectionCard, {
          backgroundColor: cardBackgroundColor,
          borderColor: borderColor,
          shadowColor: colorScheme === 'dark' ? '#FFFFFF' : '#000000'
        }]}>
          <Text style={[dynamicStyles.modernSectionTitle, { color: textColor }]}>Season</Text>
          <DropdownPicker
            options={seasons}
            selectedValue={selectedSeason}
            onValueChange={setSelectedSeason}
            placeholder="Select Season"
          />
        </View>

        {/* Team Information Card */}
        {teamFetched && currentTeam && (
          <TeamInfoCard
            team={currentTeam}
            onPress={undefined} // No navigation needed within this screen
            matchRecord={matchRecord}
            matchRecordLoading={matchRecordLoading}
            eventMatchRecord={eventMatchRecord}
            eventMatchRecordLoading={eventMatchRecordLoading}
            worldSkillsData={worldSkillsData}
            worldSkillsLoading={worldSkillsLoading}
            awardCounts={awardCounts}
            awardCountsLoading={awardCountsLoading}
            eventSkillsRanking={eventSkillsRanking}
            eventSkillsLoading={eventSkillsLoading}
            showFavoriteButton={false}
            showHeader={false}
            selectedProgram={selectedProgram}
          />
        )}
      </ScrollView>
    );
  };

  const MatchesTabScreen = () => (
    <EventTeamMatchesScreen
      route={{
        params: {
          event,
          teamNumber,
          teamId: (team || teamData)?.id || 0,
          division,
        },
      } as any}
      navigation={navigation}
    />
  );

  const renderSeasonSection = (season: string, events: Event[]) => {
    const isExpanded = expandedSeasons.has(season);

    return (
      <View key={season} style={dynamicStyles.seasonSection}>
        <TouchableOpacity
          style={dynamicStyles.seasonHeader}
          onPress={() => toggleSeasonExpansion(season)}
        >
          <View style={dynamicStyles.seasonHeaderContent}>
            <Text style={dynamicStyles.seasonTitle}>
              {season}
            </Text>
            <Text style={dynamicStyles.seasonCount}>
              {events.length} event{events.length !== 1 ? 's' : ''}
            </Text>
          </View>
          <Ionicons
            name={isExpanded ? "chevron-up" : "chevron-down"}
            size={20}
            color={iconColor}
          />
        </TouchableOpacity>

        {isExpanded && (
          <View style={dynamicStyles.seasonEvents}>
            {events.map((event, index) => (
              <View key={event.id} style={index < events.length - 1 ? dynamicStyles.eventWrapper : { marginBottom: 0 }}>
                {renderEventItem({ item: event })}
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderEventItem = ({ item }: { item: Event }) => {
    // Expand league events into individual sessions
    const expandedEvents = expandLeagueEvent(item);

    return (
      <>
        {expandedEvents.map((expandedEvent, index) => (
          <EventCard
            key={expandedEvent.uiId || `${expandedEvent.id}-${index}`}
            event={expandedEvent}
            onPress={openEventDetails}
            showFavoriteButton={false}
          />
        ))}
      </>
    );
  };

  const EventsTabScreen = () => {
    if (eventsState.loading) {
      return (
        <View style={dynamicStyles.loadingContainer}>
          <ActivityIndicator size="large" color={settings.buttonColor} />
          <Text style={dynamicStyles.loadingText}>Loading events...</Text>
        </View>
      );
    }

    if (eventsState.events.length === 0) {
      return (
        <ScrollView
          style={dynamicStyles.scrollView}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[buttonColor]}
              tintColor={buttonColor}
            />
          }
        >
          <View style={staticStyles.emptyEventsContainer}>
            <Ionicons name="calendar-outline" size={64} color={iconColor} />
            <Text style={staticStyles.emptyEventsTitle}>No Events Found</Text>
            <Text style={staticStyles.emptyEventsMessage}>
              This team hasn't participated in any events this season.
            </Text>
          </View>
        </ScrollView>
      );
    }

    const eventsBySeason = groupEventsBySeason();
    const sortedSeasons = Object.keys(eventsBySeason).sort((a, b) => {
      // First try to find exact matches in the seasons array
      const seasonA = seasons.find(s => s.label === a);
      const seasonB = seasons.find(s => s.label === b);

      if (seasonA && seasonB) {
        // Sort by season ID (higher ID = more recent)
        return parseInt(seasonB.value) - parseInt(seasonA.value);
      }

      const yearA = parseInt(a.match(/(\d{4})/)?.[0] || '0');
      const yearB = parseInt(b.match(/(\d{4})/)?.[0] || '0');

      if (yearA !== yearB) {
        return yearB - yearA;
      }

      return a.localeCompare(b);
    });

    return (
      <ScrollView
        style={[dynamicStyles.scrollView, { padding: 0 }]}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={dynamicStyles.seasonsContainer}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[buttonColor]}
            tintColor={buttonColor}
          />
        }
      >
        {sortedSeasons.map(season =>
          renderSeasonSection(season, eventsBySeason[season])
        )}
      </ScrollView>
    );
  };

  const NotesTabScreen = () => {
    const [newNote, setNewNote] = useState('');
    const [isEditing, setIsEditing] = useState(false);

    // Get existing notes for this team at this event
    const teamNotes = team ? getNotesByTeam(team.id, event.id) : [];

    const handleSaveNote = async () => {
      if (!team || !newNote.trim()) return;

      try {
        const noteData = {
          eventId: event.id,
          matchId: 0, // General team note, not match-specific
          matchName: `Team Note - ${event.name}`,
          note: newNote.trim(),
          played: false,
          teamAlliance: 0,
          teamId: team.id,
          teamName: team.team_name || teamNumber,
          teamNumber: teamNumber,
          time: new Date().toISOString(),
          winningAlliance: 0,
        };

        await createOrUpdateNote(noteData);
        setNewNote('');
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

    const renderNoteItem = ({ item }: { item: any }) => {
      const isMatchNote = item.matchId && item.matchId !== 0;

      return (
        <View style={dynamicStyles.noteItem}>
          <View style={dynamicStyles.noteHeader}>
            <View style={{ flex: 1 }}>
              <Text style={dynamicStyles.noteDate}>
                {new Date(item.createdAt || item.time).toLocaleDateString()}
              </Text>
              {isMatchNote && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                  <Ionicons name="trophy" size={12} color={buttonColor} style={{ marginRight: 4 }} />
                  <Text style={[dynamicStyles.matchLabel, { color: buttonColor }]}>
                    {item.matchName}
                  </Text>
                </View>
              )}
            </View>
            <TouchableOpacity
              onPress={() => handleDeleteNote(item.id)}
              style={dynamicStyles.deleteButton}
            >
              <Ionicons name="trash" size={16} color="#ef4444" />
            </TouchableOpacity>
          </View>
          <Text style={dynamicStyles.noteText}>{item.note}</Text>
          {item.imageUri && (
            <Image
              source={{ uri: item.imageUri }}
              style={dynamicStyles.noteImage}
              resizeMode="cover"
            />
          )}
        </View>
      );
    };

    return (
      <ScrollView
        style={dynamicStyles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[buttonColor]}
            tintColor={buttonColor}
          />
        }
      >
        <View style={dynamicStyles.notesContainer}>
          {/* Add new note section */}
          <View style={dynamicStyles.addNoteSection}>
            <Text style={dynamicStyles.sectionTitle}>Add Team Note</Text>
            {isEditing ? (
              <View style={dynamicStyles.noteInputContainer}>
                <TextInput
                  style={dynamicStyles.noteInput}
                  value={newNote}
                  onChangeText={setNewNote}
                  placeholder="Enter your note about this team..."
                  placeholderTextColor={secondaryTextColor}
                  multiline
                  textAlignVertical="top"
                  autoFocus
                />
                <View style={dynamicStyles.noteActions}>
                  <TouchableOpacity
                    style={[dynamicStyles.actionButton, dynamicStyles.cancelButton]}
                    onPress={() => {
                      setIsEditing(false);
                      setNewNote('');
                    }}
                  >
                    <Text style={dynamicStyles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[dynamicStyles.actionButton, dynamicStyles.saveButton]}
                    onPress={handleSaveNote}
                    disabled={!newNote.trim()}
                  >
                    <Text style={dynamicStyles.saveButtonText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={dynamicStyles.addNoteButton}
                onPress={() => setIsEditing(true)}
              >
                <Ionicons name="add" size={20} color={buttonColor} />
                <Text style={dynamicStyles.addNoteText}>Add Note</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Existing notes */}
          <View style={dynamicStyles.existingNotesSection}>
            <Text style={dynamicStyles.sectionTitle}>
              Team Notes ({teamNotes.length})
            </Text>
            {teamNotes.length === 0 ? (
              <View style={dynamicStyles.emptyNotesContainer}>
                <Ionicons name="document-text-outline" size={48} color={iconColor} />
                <Text style={dynamicStyles.emptyNotesText}>No notes yet</Text>
                <Text style={dynamicStyles.emptyNotesSubtext}>
                  Add notes about this team's performance, strategy, or observations
                </Text>
              </View>
            ) : (
              <FlatList
                data={teamNotes}
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

  const renderTabContent = () => {
    switch (activeTab) {
      case 'statistics':
        return <InformationTabScreen />;
      case 'matches':
        return <MatchesTabScreen />;
      case 'events':
        return <EventsTabScreen />;
      case 'notes':
        return <NotesTabScreen />;
      default:
        return <InformationTabScreen />;
    }
  };


  return (
    <View style={dynamicStyles.container}>
      {/* Custom Tab Bar */}
      <View style={dynamicStyles.tabBar}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[
                dynamicStyles.tabButton,
                isActive && dynamicStyles.activeTabButton,
                teamLoading && !team && !teamData && dynamicStyles.disabledTab,
              ]}
              onPress={() => !(teamLoading && !team && !teamData) && handleTabPress(tab.key, tab.name)}
              activeOpacity={teamLoading && !team && !teamData ? 1 : 0.7}
            >
              <Ionicons
                name={tab.icon}
                size={24}
                color={isActive && !(teamLoading && !team && !teamData) ? buttonColor : secondaryTextColor}
                style={dynamicStyles.tabIcon}
              />
              <Text
                style={[
                  dynamicStyles.tabText,
                  isActive && !(teamLoading && !team && !teamData) ? dynamicStyles.activeTabText : dynamicStyles.inactiveTabText,
                ]}
              >
                {tab.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Tab Content */}
      <View style={dynamicStyles.tabContent}>
        {teamLoading && !team && !teamData ? (
          <View style={dynamicStyles.loadingContainer}>
            <ActivityIndicator size="large" color={settings.buttonColor} />
            <Text style={dynamicStyles.loadingText}>Loading team information...</Text>
          </View>
        ) : (
          renderTabContent()
        )}
      </View>
    </View>
  );
};


export default EventTeamViewScreen;