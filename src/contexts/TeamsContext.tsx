/**
 * TEAMS CONTEXT
 *
 * Manages teams data with background loading and client-side filtering.
 * Teams are loaded once on app launch and cached for fast access.
 *
 * KEY FEATURES:
 * - Background loading on app startup
 * - Manual refresh capability
 * - Client-side filtering for fast performance
 * - Caching with smart invalidation
 * - Progress tracking for UI feedback
 */

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { robotEventsAPI } from '../services/apiRouter';
import { Team } from '../types';
import { useSettings } from './SettingsContext';
import { getProgramId } from '../utils/programMappings';

interface TeamsData {
  [programSeasonKey: string]: Team[];
}

interface TeamsContextType {
  // Data state
  allTeams: TeamsData;
  isLoading: boolean;
  isInitialLoad: boolean;
  lastUpdated: Date | null;
  error: string | null;

  // Loading progress
  loadingProgress: {
    current: number;
    total: number;
    status: string;
  };

  // Methods
  getTeamsForProgramSeason: (program: string, seasonId: string) => Team[];
  refreshTeams: (program?: string, seasonId?: string) => Promise<void>;
  clearCache: () => void;

  // Filtering helpers
  getAvailableRegions: (program: string, seasonId: string) => string[];
  getAvailableCountries: (program: string, seasonId: string) => string[];
  getRegionsByCountry: (program: string, seasonId: string) => {[country: string]: string[]};
  filterTeams: (teams: Team[], filters: TeamFilters) => Team[];
}

interface TeamFilters {
  search?: string;
  region?: string;
  country?: string;
  gradeLevel?: string;
  registeredOnly?: boolean;
}

interface TeamsProviderProps {
  children: ReactNode;
}

const TeamsContext = createContext<TeamsContextType | null>(null);

export const useTeams = (): TeamsContextType => {
  const context = useContext(TeamsContext);
  if (!context) {
    throw new Error('useTeams must be used within a TeamsProvider');
  }
  return context;
};

export const TeamsProvider: React.FC<TeamsProviderProps> = ({ children }) => {
  const settings = useSettings();
  const { selectedProgram, teamBrowserEnabled } = settings;

  // State
  const [allTeams, setAllTeams] = useState<TeamsData>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState({
    current: 0,
    total: 0,
    status: 'Initializing...'
  });

  // Track what we've loaded to avoid duplicates
  const loadedKeys = useRef(new Set<string>());

  // Use centralized program mapping

  // Generate cache key for program/season combination
  const getCacheKey = (program: string, seasonId: string): string => {
    return `${program}-${seasonId}`;
  };

  // Get teams for specific program/season
  const getTeamsForProgramSeason = (program: string, seasonId: string): Team[] => {
    const key = getCacheKey(program, seasonId);
    return allTeams[key] || [];
  };

  // Load teams for a specific program/season
  const loadTeamsForProgramSeason = async (program: string, seasonId: string): Promise<Team[]> => {
    const key = getCacheKey(program, seasonId);

    // Skip if already loaded
    if (loadedKeys.current.has(key)) {
      console.log(`[TeamsContext] Teams already loaded for ${key}`);
      return allTeams[key] || [];
    }

    try {
      console.log(`[TeamsContext] Loading teams for ${program}, season ${seasonId}`);
      setLoadingProgress(prev => ({
        ...prev,
        status: `Loading ${program} teams...`
      }));

      const programId = getProgramId(program);
      const queryParams: any = {
        program: [programId],
        season: [parseInt(seasonId)],
        per_page: 250, // RobotEvents API max is 250
        myTeams: false
      };

      const allAPITeams: Team[] = [];
      let currentPage = 1;
      let hasMore = true;
      const maxPages = 300; // (300 * 250 = 75,000 max teams)
      const batchSize = 20; // Number of concurrent requests

      while (hasMore && currentPage <= maxPages) {
        // Create batch of page numbers to fetch concurrently
        const batch = [];
        for (let i = 0; i < batchSize && (currentPage + i) <= maxPages; i++) {
          batch.push(currentPage + i);
        }

        console.log(`[TeamsContext] Fetching batch of pages ${batch[0]}-${batch[batch.length - 1]} for ${key}`);

        try {
          // Fetch all pages in the batch concurrently using team browser dedicated keys
          const batchPromises = batch.map(page =>
            robotEventsAPI.getTeamsForBrowser({ ...queryParams, page })
              .then(response => ({ page, response }))
              .catch(error => ({ page, error }))
          );

          const batchResults = await Promise.all(batchPromises);

          // Process results in order
          let foundEmptyPage = false;
          for (const result of batchResults) {
            if ('error' in result) {
              console.error(`[TeamsContext] Error fetching page ${result.page} for ${key}:`, result.error);
              continue;
            }

            const { page, response } = result;
            console.log(`[TeamsContext] Page ${page} response:`, {
              dataLength: response.data?.length || 0,
              total: response.meta?.total || 'unknown'
            });

            if (response.data && response.data.length > 0) {
              // Transform API data to match internal Team type
              const transformedTeams = response.data.map(team => ({
                ...team,
                organization: team.organization || '', // Ensure organization is always a string
                program: {
                  ...team.program,
                  code: team.program.code || '', // Ensure program.code is always a string
                },
              }));
              allAPITeams.push(...transformedTeams);

              // Check if this page had fewer results than expected (indicates end)
              if (response.data.length < 250) {
                console.log(`[TeamsContext] Page ${page} returned ${response.data.length} teams (less than 250), stopping pagination`);
                foundEmptyPage = true;
              }
            } else {
              console.log(`[TeamsContext] No teams found on page ${page}`);
              foundEmptyPage = true;
            }
          }

          // Update progress after processing batch
          setLoadingProgress(prev => ({
            ...prev,
            status: `Loading ${program} teams... (${allAPITeams.length} loaded)`
          }));

          // Move to next batch or stop if we found an incomplete page
          currentPage += batchSize;
          hasMore = !foundEmptyPage && currentPage <= maxPages;

          // Small delay between batches to be respectful to API
          if (hasMore) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }

        } catch (batchError) {
          console.error(`[TeamsContext] Error processing batch starting at page ${currentPage} for ${key}:`, batchError);
          hasMore = false;
        }
      }

      console.log(`[TeamsContext] Loaded ${allAPITeams.length} teams for ${key}`);

      // Cache the results
      setAllTeams(prev => ({
        ...prev,
        [key]: allAPITeams
      }));

      loadedKeys.current.add(key);
      return allAPITeams;

    } catch (error) {
      console.error(`[TeamsContext] Error loading teams for ${key}:`, error);
      throw error;
    }
  };

  // Load teams for current program/season and optionally other popular combinations
  const loadInitialTeams = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Get current season for the selected program
      const programId = getProgramId(selectedProgram);
      const seasonsResponse = await robotEventsAPI.getSeasons({ program: [programId] });

      if (seasonsResponse.data && seasonsResponse.data.length > 0) {
        const currentSeason = seasonsResponse.data
          .sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime())[0];

        setLoadingProgress({
          current: 0,
          total: 1,
          status: 'Loading current season teams...'
        });

        // Load teams for current program/season
        await loadTeamsForProgramSeason(selectedProgram, currentSeason.id.toString());

        setLoadingProgress({
          current: 1,
          total: 1,
          status: 'Teams loaded successfully'
        });

        setLastUpdated(new Date());
      }
    } catch (error) {
      console.error('[TeamsContext] Error loading initial teams:', error);
      setError(error instanceof Error ? error.message : 'Failed to load teams');
    } finally {
      setIsLoading(false);
      setIsInitialLoad(false);
    }
  };

  // Manual refresh for specific program/season or current selection
  const refreshTeams = async (program?: string, seasonId?: string) => {
    const targetProgram = program || selectedProgram;

    try {
      setIsLoading(true);
      setError(null);

      if (seasonId) {
        // Refresh specific program/season
        const key = getCacheKey(targetProgram, seasonId);
        loadedKeys.current.delete(key); // Remove from cache
        await loadTeamsForProgramSeason(targetProgram, seasonId);
      } else {
        // Refresh current season for program
        const programId = getProgramId(targetProgram);
        const seasonsResponse = await robotEventsAPI.getSeasons({ program: [programId] });

        if (seasonsResponse.data && seasonsResponse.data.length > 0) {
          const currentSeason = seasonsResponse.data
            .sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime())[0];

          const key = getCacheKey(targetProgram, currentSeason.id.toString());
          loadedKeys.current.delete(key); // Remove from cache
          await loadTeamsForProgramSeason(targetProgram, currentSeason.id.toString());
        }
      }

      setLastUpdated(new Date());
    } catch (error) {
      console.error('[TeamsContext] Error refreshing teams:', error);
      setError(error instanceof Error ? error.message : 'Failed to refresh teams');
    } finally {
      setIsLoading(false);
    }
  };

  // Clear all cached data
  const clearCache = () => {
    setAllTeams({});
    loadedKeys.current.clear();
    setLastUpdated(null);
    setError(null);
  };

  // Get available regions for filtering
  const getAvailableRegions = (program: string, seasonId: string): string[] => {
    const teams = getTeamsForProgramSeason(program, seasonId);
    const regions = new Set<string>();

    teams.forEach(team => {
      if (team.location?.region) {
        regions.add(team.location.region);
      }
    });

    return Array.from(regions).sort();
  };

  // Get regions by country mapping
  const getRegionsByCountry = (program: string, seasonId: string): {[country: string]: string[]} => {
    const teams = getTeamsForProgramSeason(program, seasonId);
    const regionsByCountry: {[country: string]: Set<string>} = {};

    teams.forEach(team => {
      if (team.location?.country && team.location?.region) {
        if (!regionsByCountry[team.location.country]) {
          regionsByCountry[team.location.country] = new Set<string>();
        }
        regionsByCountry[team.location.country].add(team.location.region);
      }
    });

    // Convert sets to sorted arrays
    const result: {[country: string]: string[]} = {};
    Object.keys(regionsByCountry).forEach(country => {
      result[country] = Array.from(regionsByCountry[country]).sort();
    });

    return result;
  };

  // Get available countries for filtering
  const getAvailableCountries = (program: string, seasonId: string): string[] => {
    const teams = getTeamsForProgramSeason(program, seasonId);
    const countries = new Set<string>();

    teams.forEach(team => {
      if (team.location?.country) {
        countries.add(team.location.country);
      }
    });

    return Array.from(countries).sort();
  };

  // Client-side filtering
  const filterTeams = (teams: Team[], filters: TeamFilters): Team[] => {
    return teams.filter(team => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesSearch =
          team.number?.toLowerCase().includes(searchLower) ||
          team.team_name?.toLowerCase().includes(searchLower) ||
          team.organization?.toLowerCase().includes(searchLower) ||
          team.location?.city?.toLowerCase().includes(searchLower) ||
          team.location?.region?.toLowerCase().includes(searchLower) ||
          team.location?.country?.toLowerCase().includes(searchLower);

        if (!matchesSearch) return false;
      }

      // Region filter
      if (filters.region && team.location?.region !== filters.region) {
        return false;
      }

      // Country filter
      if (filters.country && team.location?.country !== filters.country) {
        return false;
      }

      // Grade level filter
      if (filters.gradeLevel && team.grade !== filters.gradeLevel) {
        return false;
      }

      // Registration filter - only filter when explicitly set to true
      if (filters.registeredOnly === true && !team.registered) {
        return false;
      }

      return true;
    });
  };

  // Load initial teams on mount only if team browser is enabled
  useEffect(() => {
    if (selectedProgram && teamBrowserEnabled) {
      loadInitialTeams();
    }
  }, [selectedProgram, teamBrowserEnabled]);

  const contextValue: TeamsContextType = {
    allTeams,
    isLoading,
    isInitialLoad,
    lastUpdated,
    error,
    loadingProgress,
    getTeamsForProgramSeason,
    refreshTeams,
    clearCache,
    getAvailableRegions,
    getAvailableCountries,
    getRegionsByCountry,
    filterTeams
  };

  return (
    <TeamsContext.Provider value={contextValue}>
      {children}
    </TeamsContext.Provider>
  );
};

export default TeamsContext;