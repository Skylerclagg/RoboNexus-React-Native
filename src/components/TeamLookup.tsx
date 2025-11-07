/**
 * TEAM LOOKUP COMPONENT
 *
 * Extracted team search and discovery functionality with modern UI/UX design.
 * Features improved search results, team information display, and modern styling.
 *
 * KEY FEATURES:
 * - Real-time debounced search (no enter key required)
 * - Modern card-based search results
 * - Enhanced team information display
 * - World Skills ranking and score breakdown
 * - Awards display with expandable sections
 * - Favorite team functionality
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createLogger } from '../utils/logger';

const logger = createLogger('TeamLookup');
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { robotEventsAPI } from '../services/apiRouter';
import { useSettings } from '../contexts/SettingsContext';
import { useDataCache } from '../contexts/DataCacheContext';
import { useFavorites } from '../contexts/FavoritesContext';
import { Team } from '../types';
import TeamInfoCard from './TeamInfoCard';
import DropdownPicker from './DropdownPicker';
import { getProgramId, getProgramConfig } from '../utils/programMappings';

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

interface MatchRecord {
  wins: number;
  losses: number;
  ties: number;
  totalMatches: number;
}

interface TeamLookupProps {
  navigation?: any;
}

const TeamLookup: React.FC<TeamLookupProps> = ({ navigation }) => {
  const settings = useSettings();
  const { selectedProgram, globalSeasonEnabled, selectedSeason: globalSeason, updateGlobalSeason } = settings;
  const { addTeam, removeTeam, isTeamFavorited } = useFavorites();
  const { getWorldSkills, preloadWorldSkills } = useDataCache();

  // Teams State
  const [selectedSeason, setSelectedSeason] = useState<string>('');
  const [seasons, setSeasons] = useState<{label: string, value: string}[]>([]);
  const [currentSeasonId, setCurrentSeasonId] = useState<string>(''); // Track the actual current/active season ID
  const [teamNumber, setTeamNumber] = useState('');
  const [teamData, setTeamData] = useState<Team | null>(null);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamFetched, setTeamFetched] = useState(false);
  const [searchResults, setSearchResults] = useState<Team[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [worldSkillsData, setWorldSkillsData] = useState<WorldSkillsData | null>(null);
  const [awardCounts, setAwardCounts] = useState<AwardCounts>({});
  const [isWorldSkillsExpanded, setIsWorldSkillsExpanded] = useState<boolean>(false);
  const [isAwardsExpanded, setIsAwardsExpanded] = useState<boolean>(false);
  const [isWorldSkillsLoading, setIsWorldSkillsLoading] = useState<boolean>(false);
  const [matchRecord, setMatchRecord] = useState<MatchRecord | null>(null);
  const [matchRecordLoading, setMatchRecordLoading] = useState<boolean>(false);

  // Track registration status for teams (for past seasons, we check event registrations)
  const [teamRegistrationStatus, setTeamRegistrationStatus] = useState<{[teamId: string]: boolean}>({});
  const [checkingRegistrations, setCheckingRegistrations] = useState(false);

  // Debounced search state
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load seasons when component mounts or program changes
  useEffect(() => {
    loadSeasons();
  }, [selectedProgram]);

  // Sync with global season when global mode is enabled
  useEffect(() => {
    if (globalSeasonEnabled && globalSeason && globalSeason !== selectedSeason) {
      setSelectedSeason(globalSeason);
    }
  }, [globalSeasonEnabled, globalSeason]);

  // Refetch team data when season changes
  useEffect(() => {
    if (teamData && selectedSeason) {
      logger.debug('Season changed, refetching team data for season:', selectedSeason);
      Promise.all([
        fetchWorldSkillsData(teamData),
        fetchTeamAwards(teamData),
        fetchMatchRecord(teamData),
      ]).catch(error => {
        logger.error('Failed to refetch team data for new season:', error);
      });
    }
  }, [selectedSeason, teamData?.id]);

  // Check registrations when search results change (only for past seasons)
  useEffect(() => {
    // Only check event registrations for past seasons, not current season
    const isPastSeason = selectedSeason && currentSeasonId && selectedSeason !== currentSeasonId;

    if (isPastSeason && searchResults.length > 0 && showSearchResults) {
      logger.debug('Past season detected, checking event registrations for', searchResults.length, 'teams');
      checkTeamRegistrations(searchResults, selectedSeason);
    } else if (!isPastSeason) {
      // For current season, clear the status map (use team.registered instead)
      setTeamRegistrationStatus({});
    }
  }, [searchResults, selectedSeason, currentSeasonId, showSearchResults]);

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

      // Set the current season ID (first season is the active one after sorting)
      if (formattedSeasons.length > 0) {
        setCurrentSeasonId(formattedSeasons[0].value);
      }

      if (formattedSeasons.length > 0 && !selectedSeason) {
        const defaultSeason = formattedSeasons[0].value;
        setSelectedSeason(defaultSeason);
        updateGlobalSeason(defaultSeason);
      }
    } catch (error) {
      logger.error('Failed to load seasons:', error);
    }
  };

  const formatSeasonOption = (raw: string) => {
    if (!raw) return 'Unknown Season';
    return raw;
  };

  const getDynamicLabel = (defaultLabel: string) => {
    if (selectedProgram === 'Aerial Drone Competition') {
      return defaultLabel.replace('Robot', 'Drone');
    }
    return defaultLabel;
  };

  // Check if teams have event registrations for past seasons (in parallel)
  const checkTeamRegistrations = async (teams: Team[], seasonId: string) => {
    if (!teams.length) return;

    setCheckingRegistrations(true);

    try {
      // Check all teams in parallel
      const registrationChecks = teams.map(async (team) => {
        if (!team.id) return { teamId: team.id?.toString() || '', hasEvents: false };

        try {
          // Check if team has any events in this season
          const eventsResponse = await robotEventsAPI.getTeamEvents(team.id, {
            season: [parseInt(seasonId)],
          });
          const hasEvents = eventsResponse.data && eventsResponse.data.length > 0;
          return { teamId: team.id.toString(), hasEvents };
        } catch (error) {
          logger.error(`Error checking events for team ${team.number}:`, error);
          return { teamId: team.id.toString(), hasEvents: false };
        }
      });

      const results = await Promise.all(registrationChecks);

      // Update registration status map
      const statusMap: {[key: string]: boolean} = {};
      results.forEach(result => {
        if (result.teamId) {
          statusMap[result.teamId] = result.hasEvents;
        }
      });

      setTeamRegistrationStatus(statusMap);
    } catch (error) {
      logger.error('Error checking team registrations:', error);
    } finally {
      setCheckingRegistrations(false);
    }
  };

  // Debounced search function
  const debouncedSearch = useCallback((searchText: string) => {
    // Clear any existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Set searching state immediately for visual feedback
    setIsSearching(true);

    if (!searchText.trim()) {
      setTeamData(null);
      setTeamFetched(false);
      setSearchResults([]);
      setShowSearchResults(false);
      setWorldSkillsData(null);
      setAwardCounts({});
      setIsSearching(false);
      return;
    }

    // Debounce the actual search by 1 second (1000ms)
    searchTimeoutRef.current = setTimeout(() => {
      fetchTeamInfo(searchText);
      setIsSearching(false);
    }, 1000);
  }, [selectedProgram]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const fetchTeamInfo = async (number: string) => {
    if (!number.trim()) return;

    const searchNumber = number.trim().toUpperCase();
    setTeamLoading(true);
    setTeamFetched(false);
    setTeamNumber(searchNumber);
    setSearchResults([]);
    setShowSearchResults(false);

    try {
      logger.debug('Looking up team', searchNumber, 'in program:', selectedProgram);

      // First try exact match with program filtering
      const exactTeam = await robotEventsAPI.getTeamByNumber(searchNumber, selectedProgram);

      if (exactTeam) {
        logger.debug('Exact match found:', exactTeam.number, '-', exactTeam.team_name);

        // Transform API team to UI team
        const uiTeam = {
          ...exactTeam,
          organization: exactTeam.organization || '',
          program: {
            id: exactTeam.program.id,
            name: exactTeam.program.name,
            code: exactTeam.program.code || 'UNKNOWN',
          },
        };

        setTeamData(uiTeam);
        setTeamFetched(true);
        setShowSearchResults(false);

        // Start fetching additional team data immediately (don't await)
        fetchWorldSkillsData(uiTeam);
        fetchTeamAwards(uiTeam);
        fetchMatchRecord(uiTeam);
      } else {
        const isNumericOnly = /^\d+$/.test(searchNumber);

        if (isNumericOnly) {
          logger.debug('No exact match, checking all letter combinations for', searchNumber);

          // Create an array of letters A-Z
          const letters = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));

          // Search for teams with each letter suffix
          const searchPromises = letters.map(letter =>
            robotEventsAPI.getTeamByNumber(`${searchNumber}${letter}`, selectedProgram).catch(() => null)
          );

          const results = await Promise.all(searchPromises);
          const foundTeams = results.filter(team => team !== null) as Team[];

          if (foundTeams.length > 0) {
            logger.debug('Found', foundTeams.length, 'teams with letter combinations');

            // Transform API teams to UI teams
            const uiTeams = foundTeams.map(team => ({
              ...team,
              organization: team.organization || '',
              program: {
                id: team.program.id,
                name: team.program.name,
                code: team.program.code || 'UNKNOWN',
              },
            }));

            setSearchResults(uiTeams);
            setShowSearchResults(true);
          } else {
            logger.debug('No teams found with any letter combinations');
            Alert.alert('No Teams Found', `No teams found matching "${searchNumber}" in ${selectedProgram}.`);
          }
        } else {
          logger.debug('No exact match found for', searchNumber);
          Alert.alert('Team Not Found', `Team "${searchNumber}" not found in ${selectedProgram}.`);
        }
      }
    } catch (error) {
      logger.error('Failed to fetch team:', error);
      Alert.alert('Error', 'Failed to fetch team information. Please try again.');
    } finally {
      setTeamLoading(false);
    }
  };

  const fetchWorldSkillsData = async (team: Team) => {
    try {
      setIsWorldSkillsLoading(true);
      logger.debug('Fetching world skills data for team:', team.number);

      if (!team || !team.grade) {
        logger.debug('No team data or grade available for world skills lookup');
        setWorldSkillsData(null);
        setIsWorldSkillsLoading(false);
        return;
      }

      // Use selected season or get current season
      let targetSeasonId;
      if (selectedSeason && selectedSeason !== '') {
        targetSeasonId = parseInt(selectedSeason);
      } else {
        targetSeasonId = await robotEventsAPI.getCurrentSeasonId(selectedProgram);
      }

      // Search for team by ID across ALL grade caches for this program/season
      const programId = getProgramId(selectedProgram);
      logger.debug(`Searching for team ID ${team.id} in World Skills caches`);

      let teamSkillsData = null;
      const programConfig = getProgramConfig(selectedProgram);
      const allGradeCaches: any[] = []; // Collect all grade data for total count

      // Try each available grade for this program
      for (const grade of programConfig.availableGrades) {
        let gradeCache = getWorldSkills(targetSeasonId, programId, grade);

        // If cache is empty, try to preload it and use returned data
        if (gradeCache.length === 0) {
          logger.debug(`Cache empty for ${grade}, preloading...`);
          gradeCache = await preloadWorldSkills(targetSeasonId, programId, grade);
        }

        // Collect this grade's data for total count
        allGradeCaches.push(...gradeCache);

        // Search for team by ID in this grade's cache
        if (gradeCache.length > 0) {
          teamSkillsData = gradeCache.find((ranking: any) =>
            ranking.team && ranking.team.id === team.id
          );

          if (teamSkillsData) {
            logger.debug(`✓ Found team in ${grade} World Skills rankings`);
            break;
          }
        }
      }

      // Calculate total teams from collected caches
      const totalTeams = allGradeCaches.length;
      logger.debug('Total teams across all grades:', totalTeams);

      if (teamSkillsData) {
        logger.debug('Found team in rankings');
        setWorldSkillsData({
          ranking: teamSkillsData.rank || 0,
          combined: teamSkillsData.scores?.score || 0,
          driver: teamSkillsData.scores?.driver || 0,
          programming: teamSkillsData.scores?.programming || 0,
          highestDriver: teamSkillsData.scores?.maxDriver || 0,
          highestProgramming: teamSkillsData.scores?.maxProgramming || 0,
          totalTeams,
        });
      } else {
        // Team not found in rankings
        setWorldSkillsData({
          ranking: 0,
          combined: 0,
          driver: 0,
          programming: 0,
          highestDriver: 0,
          highestProgramming: 0,
          totalTeams,
        });
      }
      setIsWorldSkillsLoading(false);
    } catch (error) {
      logger.error('Failed to fetch world skills data:', error);
      setWorldSkillsData({
        ranking: 0,
        combined: 0,
        driver: 0,
        programming: 0,
        highestDriver: 0,
        highestProgramming: 0,
        totalTeams: 0,
      });
      setIsWorldSkillsLoading(false);
    }
  };

  const fetchTeamAwards = async (team: Team) => {
    try {
      logger.debug('Fetching awards for team:', team.number);

      // Get season ID to fetch awards for
      let targetSeasonId;
      if (selectedSeason && selectedSeason !== '') {
        targetSeasonId = parseInt(selectedSeason);
      } else {
        targetSeasonId = await robotEventsAPI.getCurrentSeasonId(selectedProgram);
      }

      // Fetch team awards for the selected season
      const teamAwards = await robotEventsAPI.getTeamAwards(team.id, { season: [targetSeasonId] });

      // Count awards by title
      const awardCounts: AwardCounts = {};
      teamAwards.data.forEach((award: any) => {
        let title = award.title || 'Unknown Award';
        // Clean up award title (remove parenthetical content)
        title = title.replace(/\([^()]*\)/g, '').trim();
        awardCounts[title] = (awardCounts[title] || 0) + 1;
      });

      setAwardCounts(awardCounts);
    } catch (error) {
      logger.error('Failed to fetch award counts:', error);
      setAwardCounts({});
    }
  };

  const fetchMatchRecord = async (team: Team) => {
    try {
      setMatchRecordLoading(true);
      logger.debug('Fetching match record for team:', team.number);

      // Get season ID to fetch rankings for
      let targetSeasonId;
      if (selectedSeason && selectedSeason !== '') {
        targetSeasonId = parseInt(selectedSeason);
      } else {
        targetSeasonId = await robotEventsAPI.getCurrentSeasonId(selectedProgram);
      }

      // Fetch team rankings for the selected season
      // Rankings contain the official match record (wins/losses/ties) for each event
      const teamRankings = await robotEventsAPI.getTeamRankings(team.id, { season: [targetSeasonId] });

      let totalWins = 0;
      let totalLosses = 0;
      let totalTies = 0;

      // Sum up wins/losses/ties from all events in the season
      teamRankings.data.forEach((ranking: any) => {
        totalWins += ranking.wins || 0;
        totalLosses += ranking.losses || 0;
        totalTies += ranking.ties || 0;
      });

      const totalMatches = totalWins + totalLosses + totalTies;
      logger.debug('Match record from rankings:', { totalWins, totalLosses, totalTies, totalMatches });

      setMatchRecord({
        wins: totalWins,
        losses: totalLosses,
        ties: totalTies,
        totalMatches
      });
    } catch (error) {
      logger.error('Failed to fetch match record:', error);
      setMatchRecord(null);
    } finally {
      setMatchRecordLoading(false);
    }
  };


  const openTeamPage = () => {
    if (!teamData) return;
    const baseUrl = 'https://www.robotevents.com/teams/';
    const url = `${baseUrl}${selectedProgram === 'VEX V5 Robotics Competition' ? 'VRC' :
                                selectedProgram === 'VEX IQ Robotics Competition' ? 'VIQC' :
                                selectedProgram === 'VEX U Robotics Competition' ? 'VEXU' :
                                selectedProgram === 'VEX AI Robotics Competition' ? 'VAIC' : 'ADC'}/${teamData.number}`;
    Linking.openURL(url);
  };

  const selectTeamFromResults = async (team: Team) => {
    setTeamLoading(true);
    setShowSearchResults(false);
    setSearchResults([]);

    try {
      setTeamData(team);
      setTeamFetched(true);
      setTeamNumber(team.number);

      // Start fetching additional team data immediately (don't await)
      fetchWorldSkillsData(team);
      fetchTeamAwards(team);
      fetchMatchRecord(team);

      setTeamLoading(false);
    } catch (error) {
      logger.error('Failed to fetch team details:', error);
      Alert.alert('Error', 'Failed to load team details');
      setTeamLoading(false);
    }
  };

  // Modern Search Results Component
  const renderSearchResultCard = ({ item }: { item: Team }) => (
    <TouchableOpacity
      style={[styles.modernSearchCard, {
        backgroundColor: settings.cardBackgroundColor,
        borderColor: settings.borderColor,
        shadowColor: settings.colorScheme === 'dark' ? '#FFFFFF' : '#000000'
      }]}
      onPress={() => selectTeamFromResults(item)}
    >
      <View style={styles.searchCardContent}>
        <View style={styles.searchCardLeft}>
          <View style={[styles.teamNumberBadge, { backgroundColor: settings.buttonColor }]}>
            <Text style={styles.teamNumberBadgeText}>{item.number}</Text>
          </View>
          <View style={styles.teamInfoSection}>
            <Text style={[styles.modernTeamName, { color: settings.textColor }]} numberOfLines={1}>
              {item.team_name || 'No name'}
            </Text>
            <Text style={[styles.modernOrganization, { color: settings.secondaryTextColor }]} numberOfLines={1}>
              {item.organization || 'No organization'}
            </Text>
            {item.location && (
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={12} color={settings.iconColor} />
                <Text style={[styles.modernLocation, { color: settings.secondaryTextColor }]} numberOfLines={1}>
                  {item.location.city}, {item.location.region}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.searchCardRight}>
          <TouchableOpacity
            style={styles.modernFavoriteButton}
            onPress={async (e) => {
              e.stopPropagation();
              try {
                if (isTeamFavorited(item.number)) {
                  await removeTeam(item.number);
                } else {
                  await addTeam(item);
                }
              } catch (error) {
                logger.error('Failed to toggle team favorite:', error);
                Alert.alert('Error', 'Failed to update favorite status');
              }
            }}
          >
            <Ionicons
              name={isTeamFavorited(item.number) ? "heart" : "heart-outline"}
              size={20}
              color={isTeamFavorited(item.number) ? "#FF6B6B" : settings.iconColor}
            />
          </TouchableOpacity>
          <Ionicons name="chevron-forward" size={18} color={settings.iconColor} />
        </View>
      </View>
    </TouchableOpacity>
  );

  // Modern Team Information Component
  const renderModernTeamInfo = (property: string, value: string) => (
    <View style={styles.modernInfoRow} key={property}>
      <Text style={[styles.modernInfoLabel, { color: settings.secondaryTextColor }]}>{property}</Text>
      <Text style={[styles.modernInfoValue, { color: settings.textColor }]}>{value}</Text>
    </View>
  );

  return (
    <ScrollView
      style={styles.modernTabContent}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
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
            setSelectedSeason(season);
            updateGlobalSeason(season);
          }}
          placeholder="Select Season"
        />
      </View>

      {/* Search Section */}
      <View style={[styles.modernSearchSection, {
        backgroundColor: settings.cardBackgroundColor,
        borderColor: settings.borderColor,
        shadowColor: settings.colorScheme === 'dark' ? '#FFFFFF' : '#000000'
      }]}>
        <View style={styles.searchHeader}>
          <Text style={[styles.modernSectionTitle, { color: settings.textColor }]}>Team Search</Text>
          {teamFetched && teamData && (
            <TouchableOpacity style={styles.modernLinkButton} onPress={openTeamPage}>
              <Ionicons name="link" size={22} color={settings.buttonColor} />
              <Text style={[styles.linkText, { color: settings.buttonColor }]}>View Online</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={[styles.modernSearchInput, {
          backgroundColor: settings.backgroundColor,
          borderColor: settings.borderColor
        }]}>
          <Ionicons name="search" size={20} color={settings.iconColor} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchTextInput, { color: settings.textColor }]}
            value={teamNumber}
            onChangeText={(text) => {
              setTeamNumber(text);
              debouncedSearch(text);
            }}
            placeholder="Team Number (e.g., 12345A)"
            placeholderTextColor={settings.secondaryTextColor}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="characters"
          />
          {teamNumber.length > 0 && !isSearching && !teamLoading && (
            <TouchableOpacity
              onPress={() => {
                setTeamNumber('');
                debouncedSearch('');
              }}
              style={styles.clearButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close-circle" size={20} color={settings.secondaryTextColor} />
            </TouchableOpacity>
          )}
          {(isSearching || teamLoading || checkingRegistrations) && (
            <ActivityIndicator
              size="small"
              color={settings.buttonColor}
              style={styles.searchLoadingIndicator}
            />
          )}
          {/* Favorite button when individual team is displayed */}
          {teamFetched && teamData && !showSearchResults && (
            <TouchableOpacity
              style={styles.searchFavoriteButton}
              onPress={async (e) => {
                e.stopPropagation();
                try {
                  if (isTeamFavorited(teamData.number)) {
                    await removeTeam(teamData.number);
                  } else {
                    await addTeam(teamData);
                  }
                } catch (error) {
                  logger.error('Failed to toggle team favorite:', error);
                }
              }}
            >
              <Ionicons
                name={isTeamFavorited(teamData.number) ? "heart" : "heart-outline"}
                size={20}
                color={isTeamFavorited(teamData.number) ? "#FF6B6B" : settings.iconColor}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Search Results - Properly positioned below search card */}
      {showSearchResults && searchResults.length > 0 && (() => {
        const isPastSeason = selectedSeason && currentSeasonId && selectedSeason !== currentSeasonId;

        // Sort teams into registered and not registered based on season type
        const registeredTeams = searchResults.filter(team => {
          if (isPastSeason) {
            // For past seasons, check if team has events (from our parallel check)
            return teamRegistrationStatus[team.id?.toString() || ''] === true;
          } else {
            // For current season, use team.registered property
            return team.registered;
          }
        });

        const unregisteredTeams = searchResults.filter(team => {
          if (isPastSeason) {
            // For past seasons, check if team has NO events
            const hasStatus = team.id?.toString() in teamRegistrationStatus;
            return hasStatus && teamRegistrationStatus[team.id?.toString() || ''] === false;
          } else {
            // For current season, use team.registered property
            return !team.registered;
          }
        });

        return (
          <View style={styles.compactResultsSection}>
            <Text style={[styles.compactResultsHeader, { color: settings.textColor }]}>
              Found {searchResults.length} team{searchResults.length > 1 ? 's' : ''} matching "{teamNumber}"
            </Text>

            {/* Registered Teams Section */}
            {registeredTeams.length > 0 && (
              <View>
                <View style={[styles.sectionHeader, { backgroundColor: settings.backgroundColor }]}>
                  <Text style={[styles.sectionHeaderText, { color: settings.textColor }]}>
                    Registered Teams
                  </Text>
                </View>
                {registeredTeams.map((item) => (
                  <View key={item.id.toString()} style={styles.cardContainer}>
                    {renderSearchResultCard({ item })}
                  </View>
                ))}
              </View>
            )}

            {/* Not Registered Section */}
            {unregisteredTeams.length > 0 && (
              <View>
                <View style={[styles.sectionHeader, { backgroundColor: settings.backgroundColor }]}>
                  <Text style={[styles.sectionHeaderText, { color: settings.textColor }]}>
                    Not Registered
                  </Text>
                </View>
                {unregisteredTeams.map((item) => (
                  <View key={item.id.toString()} style={styles.cardContainer}>
                    {renderSearchResultCard({ item })}
                  </View>
                ))}
              </View>
            )}
          </View>
        );
      })()}

      {/* Team Information Card */}
      {teamFetched && teamData && (
        <TeamInfoCard
          team={teamData}
          onPress={(team) => {
            if (navigation) {
              navigation.navigate('TeamInfo', {
                teamNumber: team.number,
                teamData: team,
              });
            }
          }}
          matchRecord={matchRecord}
          matchRecordLoading={matchRecordLoading}
          worldSkillsData={worldSkillsData}
          worldSkillsLoading={isWorldSkillsLoading}
          awardCounts={awardCounts}
          awardCountsLoading={false}
          showFavoriteButton={false}
          showHeader={false}
          selectedProgram={selectedProgram}
        />
      )}

      {/* Empty State */}
      {!teamLoading && !isSearching && !teamFetched && !showSearchResults && teamNumber.trim() === '' && (
        <View style={styles.emptyState}>
          <Ionicons name="search-outline" size={64} color={settings.iconColor} />
          <Text style={[styles.emptyStateTitle, { color: settings.textColor }]}>Search for Teams</Text>
          <Text style={[styles.emptyStateSubtitle, { color: settings.secondaryTextColor }]}>
            Enter a team number to search for team information, rankings, and awards
          </Text>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  modernTabContent: {
    flex: 1,
    paddingHorizontal: 16,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  modernSectionCard: {
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  modernSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  modernSearchSection: {
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  searchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modernLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  linkText: {
    marginLeft: 4,
    fontSize: 14,
    fontWeight: '500',
  },
  modernSearchInput: {
    flex: 1,
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
  clearButton: {
    marginLeft: 8,
    padding: 2,
  },
  searchLoadingIndicator: {
    marginLeft: 8,
  },
  searchFavoriteButton: {
    marginLeft: 8,
    padding: 4,
  },
  modernSearchCard: {
    borderRadius: 10,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  searchCardContent: {
    flexDirection: 'row',
    padding: 12,
  },
  searchCardLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  teamNumberBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 10,
  },
  teamNumberBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  teamInfoSection: {
    flex: 1,
  },
  modernTeamName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 1,
  },
  modernOrganization: {
    fontSize: 12,
    marginBottom: 3,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modernLocation: {
    fontSize: 12,
    marginLeft: 4,
  },
  searchCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modernFavoriteButton: {
    padding: 8,
  },
  compactResultsSection: {
    marginBottom: 8,
  },
  cardContainer: {
    marginBottom: 8,
  },
  compactResultsHeader: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  sectionHeader: {
    paddingHorizontal: 4,
    paddingVertical: 12,
    marginTop: 8,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.2)',
  },
  sectionHeaderText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  modernTeamCard: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  teamCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  teamHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  teamHeaderInfo: {
    flex: 1,
  },
  teamCardName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  teamCardOrg: {
    fontSize: 13,
  },
  teamHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  teamInfoGrid: {
    padding: 16,
  },
  modernInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modernInfoLabel: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  modernInfoValue: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
    flex: 1,
  },
  skillsSection: {
    marginTop: 8,
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
  skillsBreakdown: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  skillsBreakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  skillsLabel: {
    fontSize: 13,
    flex: 1,
  },
  skillsValue: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
  },
  awardsBreakdown: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default TeamLookup;