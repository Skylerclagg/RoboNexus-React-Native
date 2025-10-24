import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { robotEventsAPI } from '../services/apiRouter';
import { useSettings } from './SettingsContext';
import { Event, WorldSkillsResponse } from '../types';
import { Award, Season } from '../types/api';
import { getProgramId } from '../utils/programMappings';

interface CachedData {
  // Seasons data (loaded once per program)
  seasons: { [programId: string]: Season[] };

  // World Skills data (loaded per season/program/grade)
  worldSkills: { [key: string]: WorldSkillsResponse[] }; // key format: `${seasonId}_${programId}_${grade}`

  // Teams events (loaded per team)
  teamEvents: { [teamId: string]: Event[] };

  // Team awards (loaded per team)
  teamAwards: { [teamId: string]: Award[] };

  // Loading states
  seasonsLoading: { [programId: string]: boolean };
  worldSkillsLoading: { [key: string]: boolean };
  teamEventsLoading: { [teamId: string]: boolean };
  teamAwardsLoading: { [teamId: string]: boolean };
}

interface DataCacheContextType {
  // Data getters
  getSeasons: (programId: number) => Season[];
  getWorldSkills: (seasonId: number, programId: number, grade: string) => WorldSkillsResponse[];
  getTeamEvents: (teamId: number) => Event[];
  getTeamAwards: (teamId: number) => Award[];

  // Loading state getters
  isSeasonsLoading: (programId: number) => boolean;
  isWorldSkillsLoading: (seasonId: number, programId: number, grade: string) => boolean;
  isTeamEventsLoading: (teamId: number) => boolean;
  isTeamAwardsLoading: (teamId: number) => boolean;

  // Pre-load functions
  preloadSeasons: (programId: number) => Promise<void>;
  preloadWorldSkills: (seasonId: number, programId: number, grade: string) => Promise<void>;
  preloadTeamEvents: (teamId: number) => Promise<void>;
  preloadTeamAwards: (teamId: number) => Promise<void>;

  // Cache management
  clearCache: () => void;
  clearCacheForProgram: (programId: number) => void;
  clearCacheForSeason: (seasonId: number) => void;

  // Force refresh methods (for pull-to-refresh)
  forceRefreshSeasons: (programId: number) => Promise<void>;
  forceRefreshWorldSkills: (seasonId: number, programId: number, grade: string) => Promise<void>;
  forceRefreshTeamEvents: (teamId: number) => Promise<void>;
  forceRefreshTeamAwards: (teamId: number) => Promise<void>;
}

const DataCacheContext = createContext<DataCacheContextType | undefined>(undefined);

export const useDataCache = (): DataCacheContextType => {
  const context = useContext(DataCacheContext);
  if (!context) {
    throw new Error('useDataCache must be used within a DataCacheProvider');
  }
  return context;
};

interface DataCacheProviderProps {
  children: ReactNode;
}

export const DataCacheProvider: React.FC<DataCacheProviderProps> = ({ children }) => {
  const { selectedProgram, selectedSeason } = useSettings();

  const [cachedData, setCachedData] = useState<CachedData>({
    seasons: {},
    worldSkills: {},
    teamEvents: {},
    teamAwards: {},
    seasonsLoading: {},
    worldSkillsLoading: {},
    teamEventsLoading: {},
    teamAwardsLoading: {},
  });

  // Helper function to get program ID from program name
  const getProgramIdHelper = useCallback((programName?: string): number => {
    const program = programName || selectedProgram;
    return getProgramId(program);
  }, [selectedProgram]);

  // Seasons cache functions
  const getSeasons = useCallback((programId: number): Season[] => {
    return cachedData.seasons[programId.toString()] || [];
  }, [cachedData.seasons]);

  const preloadSeasons = useCallback(async (programId: number): Promise<void> => {
    const key = programId.toString();

    // Don't reload if already cached or currently loading
    if (cachedData.seasons[key] || cachedData.seasonsLoading[key]) {
      return;
    }

    setCachedData(prev => ({
      ...prev,
      seasonsLoading: { ...prev.seasonsLoading, [key]: true }
    }));

    try {
      console.log(`[DataCache] Pre-loading seasons for program ${programId}...`);
      const seasonResponse = await robotEventsAPI.getSeasons({ program: [programId] });

      setCachedData(prev => ({
        ...prev,
        seasons: { ...prev.seasons, [key]: seasonResponse.data },
        seasonsLoading: { ...prev.seasonsLoading, [key]: false }
      }));

      console.log(`[DataCache] Pre-loaded ${seasonResponse.data.length} seasons for program ${programId}`);
    } catch (error) {
      console.error(`[DataCache] Failed to pre-load seasons for program ${programId}:`, error);
      setCachedData(prev => ({
        ...prev,
        seasonsLoading: { ...prev.seasonsLoading, [key]: false }
      }));
    }
  }, [cachedData.seasons, cachedData.seasonsLoading]);

  // World Skills cache functions
  const getWorldSkills = useCallback((seasonId: number, programId: number, grade: string): WorldSkillsResponse[] => {
    const key = `${seasonId}_${programId}_${grade}`;
    return cachedData.worldSkills[key] || [];
  }, [cachedData.worldSkills]);

  const preloadWorldSkills = useCallback(async (seasonId: number, programId: number, grade: string): Promise<void> => {
    const key = `${seasonId}_${programId}_${grade}`;

    // Don't reload if already cached or currently loading
    if (cachedData.worldSkills[key] || cachedData.worldSkillsLoading[key]) {
      return;
    }

    setCachedData(prev => ({
      ...prev,
      worldSkillsLoading: { ...prev.worldSkillsLoading, [key]: true }
    }));

    try {
      console.log(`[DataCache] Pre-loading world skills for season ${seasonId}, program ${programId}, grade ${grade}...`);
      const worldSkillsData = await robotEventsAPI.getWorldSkillsRankings(seasonId, grade);

      setCachedData(prev => ({
        ...prev,
        worldSkills: { ...prev.worldSkills, [key]: worldSkillsData },
        worldSkillsLoading: { ...prev.worldSkillsLoading, [key]: false }
      }));

      console.log(`[DataCache] Pre-loaded ${worldSkillsData.length} world skills rankings for season ${seasonId}, program ${programId}, grade ${grade}`);
    } catch (error) {
      console.error(`[DataCache] Failed to pre-load world skills for season ${seasonId}, program ${programId}, grade ${grade}:`, error);
      setCachedData(prev => ({
        ...prev,
        worldSkillsLoading: { ...prev.worldSkillsLoading, [key]: false }
      }));
    }
  }, [cachedData.worldSkills, cachedData.worldSkillsLoading]);

  // Team Events cache functions
  const getTeamEvents = useCallback((teamId: number): Event[] => {
    return cachedData.teamEvents[teamId.toString()] || [];
  }, [cachedData.teamEvents]);

  const preloadTeamEvents = useCallback(async (teamId: number): Promise<void> => {
    const key = teamId.toString();

    // Don't reload if already cached or currently loading
    if (cachedData.teamEvents[key] || cachedData.teamEventsLoading[key]) {
      return;
    }

    setCachedData(prev => ({
      ...prev,
      teamEventsLoading: { ...prev.teamEventsLoading, [key]: true }
    }));

    try {
      console.log(`[DataCache] Pre-loading events for team ${teamId}...`);
      const teamEventsResponse = await robotEventsAPI.getTeamEvents(teamId);

      // Transform API events to UI events (same as in TeamInfoScreen)
      const transformedEvents = teamEventsResponse.data.map(event => ({
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
        new Date(b.start).getTime() - new Date(a.start).getTime()
      );

      setCachedData(prev => ({
        ...prev,
        teamEvents: { ...prev.teamEvents, [key]: sortedEvents },
        teamEventsLoading: { ...prev.teamEventsLoading, [key]: false }
      }));

      console.log(`[DataCache] Pre-loaded ${sortedEvents.length} events for team ${teamId}`);
    } catch (error) {
      console.error(`[DataCache] Failed to pre-load events for team ${teamId}:`, error);
      setCachedData(prev => ({
        ...prev,
        teamEventsLoading: { ...prev.teamEventsLoading, [key]: false }
      }));
    }
  }, [cachedData.teamEvents, cachedData.teamEventsLoading]);

  // Team Awards cache functions
  const getTeamAwards = useCallback((teamId: number): Award[] => {
    return cachedData.teamAwards[teamId.toString()] || [];
  }, [cachedData.teamAwards]);

  const preloadTeamAwards = useCallback(async (teamId: number): Promise<void> => {
    const key = teamId.toString();

    // Don't reload if already cached or currently loading
    if (cachedData.teamAwards[key] || cachedData.teamAwardsLoading[key]) {
      return;
    }

    setCachedData(prev => ({
      ...prev,
      teamAwardsLoading: { ...prev.teamAwardsLoading, [key]: true }
    }));

    try {
      console.log(`[DataCache] Pre-loading awards for team ${teamId}...`);
      const awardsResponse = await robotEventsAPI.getTeamAwards(teamId);

      setCachedData(prev => ({
        ...prev,
        teamAwards: { ...prev.teamAwards, [key]: awardsResponse.data },
        teamAwardsLoading: { ...prev.teamAwardsLoading, [key]: false }
      }));

      console.log(`[DataCache] Pre-loaded ${awardsResponse.data.length} awards for team ${teamId}`);
    } catch (error) {
      console.error(`[DataCache] Failed to pre-load awards for team ${teamId}:`, error);
      setCachedData(prev => ({
        ...prev,
        teamAwardsLoading: { ...prev.teamAwardsLoading, [key]: false }
      }));
    }
  }, [cachedData.teamAwards, cachedData.teamAwardsLoading]);

  // Loading state getters
  const isSeasonsLoading = useCallback((programId: number): boolean => {
    return cachedData.seasonsLoading[programId.toString()] || false;
  }, [cachedData.seasonsLoading]);

  const isWorldSkillsLoading = useCallback((seasonId: number, programId: number, grade: string): boolean => {
    const key = `${seasonId}_${programId}_${grade}`;
    return cachedData.worldSkillsLoading[key] || false;
  }, [cachedData.worldSkillsLoading]);

  const isTeamEventsLoading = useCallback((teamId: number): boolean => {
    return cachedData.teamEventsLoading[teamId.toString()] || false;
  }, [cachedData.teamEventsLoading]);

  const isTeamAwardsLoading = useCallback((teamId: number): boolean => {
    return cachedData.teamAwardsLoading[teamId.toString()] || false;
  }, [cachedData.teamAwardsLoading]);

  // Cache management functions
  const clearCache = useCallback(() => {
    console.log('[DataCache] Clearing all cache data');
    setCachedData({
      seasons: {},
      worldSkills: {},
      teamEvents: {},
      teamAwards: {},
      seasonsLoading: {},
      worldSkillsLoading: {},
      teamEventsLoading: {},
      teamAwardsLoading: {},
    });
  }, []);

  const clearCacheForProgram = useCallback((programId: number) => {
    console.log(`[DataCache] Clearing cache for program ${programId}`);
    const programKey = programId.toString();

    setCachedData(prev => {
      const newWorldSkills = { ...prev.worldSkills };
      const newWorldSkillsLoading = { ...prev.worldSkillsLoading };

      // Remove world skills data for this program
      Object.keys(newWorldSkills).forEach(key => {
        if (key.includes(`_${programId}_`)) {
          delete newWorldSkills[key];
          delete newWorldSkillsLoading[key];
        }
      });

      return {
        ...prev,
        seasons: { ...prev.seasons, [programKey]: undefined } as any,
        worldSkills: newWorldSkills,
        seasonsLoading: { ...prev.seasonsLoading, [programKey]: false },
        worldSkillsLoading: newWorldSkillsLoading,
      };
    });
  }, []);

  const clearCacheForSeason = useCallback((seasonId: number) => {
    console.log(`[DataCache] Clearing cache for season ${seasonId}`);

    setCachedData(prev => {
      const newWorldSkills = { ...prev.worldSkills };
      const newWorldSkillsLoading = { ...prev.worldSkillsLoading };

      // Remove world skills data for this season
      Object.keys(newWorldSkills).forEach(key => {
        if (key.startsWith(`${seasonId}_`)) {
          delete newWorldSkills[key];
          delete newWorldSkillsLoading[key];
        }
      });

      return {
        ...prev,
        worldSkills: newWorldSkills,
        worldSkillsLoading: newWorldSkillsLoading,
      };
    });
  }, []);

  // Auto-preload seasons when program changes
  useEffect(() => {
    const programId = getProgramIdHelper(selectedProgram);
    console.log(`[DataCache] Program changed to ${selectedProgram} (ID: ${programId}), pre-loading seasons...`);
    preloadSeasons(programId);
  }, [selectedProgram, getProgramId, preloadSeasons]);

  // Smart pre-loading: Only load essential data (World Skills for selected program/season)
  useEffect(() => {
    if (!selectedSeason) return;

    const programId = getProgramIdHelper(selectedProgram);

    // Handle season name vs season ID conversion
    const loadEssentialData = async () => {
      let seasonId: number;

      if (selectedSeason.includes('-')) {
        // It's a season name like "2024-2025", need to get actual season ID
        console.log(`[DataCache] Selected season is a name (${selectedSeason}), getting actual season ID...`);
        try {
          seasonId = await robotEventsAPI.getCurrentSeasonId(selectedProgram);
          console.log(`[DataCache] Resolved season ID: ${seasonId} for program ${selectedProgram}`);
        } catch (error) {
          console.error('[DataCache] Failed to get current season ID, skipping world skills preload:', error);
          return;
        }
      } else {
        // It's already a season ID
        seasonId = parseInt(selectedSeason);
      }

      console.log(`[DataCache] Season/Program changed to ${selectedProgram} season ${selectedSeason} (ID: ${seasonId}), pre-loading essential data...`);

      // This reduces API calls from 4 per season change to 2 per season change
      const essentialGrades = ['High School', 'Middle School'];

      essentialGrades.forEach(grade => {
        // Pre-load in background (don't await to avoid blocking)
        preloadWorldSkills(seasonId, programId, grade).catch(error => {
          console.log(`[DataCache] Background pre-load failed for ${grade} world skills:`, error.message);
        });
      });

      // TODO: Add events pre-loading for the current program/season when needed
      // This can be added later: preloadEventsForSeason(seasonId, programId)
    };

    loadEssentialData();
  }, [selectedSeason, selectedProgram, getProgramId, preloadWorldSkills]);

  // Force refresh methods (clear cache and reload)
  const forceRefreshSeasons = useCallback(async (programId: number): Promise<void> => {
    const key = programId.toString();
    console.log(`[DataCache] Force refreshing seasons for program ${programId}...`);

    // Clear cache for this program by removing the key entirely
    setCachedData(prev => {
      const newSeasons = { ...prev.seasons };
      delete newSeasons[key];
      return {
        ...prev,
        seasons: newSeasons,
        seasonsLoading: { ...prev.seasonsLoading, [key]: false }
      };
    });

    // Force reload
    await preloadSeasons(programId);
  }, [preloadSeasons]);

  const forceRefreshWorldSkills = useCallback(async (seasonId: number, programId: number, grade: string): Promise<void> => {
    const key = `${seasonId}_${programId}_${grade}`;
    console.log(`[DataCache] Force refreshing world skills for season ${seasonId}, program ${programId}, grade ${grade}...`);

    // Clear cache for this world skills data by removing the key entirely
    setCachedData(prev => {
      const newWorldSkills = { ...prev.worldSkills };
      const newWorldSkillsLoading = { ...prev.worldSkillsLoading };
      delete newWorldSkills[key];
      delete newWorldSkillsLoading[key];
      return {
        ...prev,
        worldSkills: newWorldSkills,
        worldSkillsLoading: newWorldSkillsLoading
      };
    });

    // Force reload
    await preloadWorldSkills(seasonId, programId, grade);
  }, [preloadWorldSkills]);

  const forceRefreshTeamEvents = useCallback(async (teamId: number): Promise<void> => {
    const key = teamId.toString();
    console.log(`[DataCache] Force refreshing events for team ${teamId}...`);

    // Clear cache for this team by removing the key entirely
    setCachedData(prev => {
      const newTeamEvents = { ...prev.teamEvents };
      const newTeamEventsLoading = { ...prev.teamEventsLoading };
      delete newTeamEvents[key];
      delete newTeamEventsLoading[key];
      return {
        ...prev,
        teamEvents: newTeamEvents,
        teamEventsLoading: newTeamEventsLoading
      };
    });

    // Force reload
    await preloadTeamEvents(teamId);
  }, [preloadTeamEvents]);

  const forceRefreshTeamAwards = useCallback(async (teamId: number): Promise<void> => {
    const key = teamId.toString();
    console.log(`[DataCache] Force refreshing awards for team ${teamId}...`);

    // Clear cache for this team by removing the key entirely
    setCachedData(prev => {
      const newTeamAwards = { ...prev.teamAwards };
      const newTeamAwardsLoading = { ...prev.teamAwardsLoading };
      delete newTeamAwards[key];
      delete newTeamAwardsLoading[key];
      return {
        ...prev,
        teamAwards: newTeamAwards,
        teamAwardsLoading: newTeamAwardsLoading
      };
    });

    // Force reload
    await preloadTeamAwards(teamId);
  }, [preloadTeamAwards]);

  const contextValue: DataCacheContextType = {
    // Data getters
    getSeasons,
    getWorldSkills,
    getTeamEvents,
    getTeamAwards,

    // Loading state getters
    isSeasonsLoading,
    isWorldSkillsLoading,
    isTeamEventsLoading,
    isTeamAwardsLoading,

    // Pre-load functions
    preloadSeasons,
    preloadWorldSkills,
    preloadTeamEvents,
    preloadTeamAwards,

    // Cache management
    clearCache,
    clearCacheForProgram,
    clearCacheForSeason,

    // Force refresh methods
    forceRefreshSeasons,
    forceRefreshWorldSkills,
    forceRefreshTeamEvents,
    forceRefreshTeamAwards,
  };

  return (
    <DataCacheContext.Provider value={contextValue}>
      {children}
    </DataCacheContext.Provider>
  );
};