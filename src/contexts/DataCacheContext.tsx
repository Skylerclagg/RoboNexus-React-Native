import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { createLogger } from '../utils/logger';
import { robotEventsAPI } from '../services/apiRouter';
import { useSettings } from './SettingsContext';
import { Event, WorldSkillsResponse } from '../types';
import { Award, Season } from '../types/api';
import { getProgramId, PROGRAM_CONFIGS, getProgramConfig } from '../utils/programMappings';

const logger = createLogger('DataCacheContext');

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
  getWorldSkillsForProgram: (seasonId: number, programId: number) => WorldSkillsResponse[];
  getTeamEvents: (teamId: number) => Event[];
  getTeamAwards: (teamId: number) => Award[];

  // Loading state getters
  isSeasonsLoading: (programId: number) => boolean;
  isWorldSkillsLoading: (seasonId: number, programId: number, grade: string) => boolean;
  isTeamEventsLoading: (teamId: number) => boolean;
  isTeamAwardsLoading: (teamId: number) => boolean;

  // Pre-load functions
  preloadSeasons: (programId: number) => Promise<void>;
  preloadWorldSkills: (seasonId: number, programId: number, grade: string) => Promise<WorldSkillsResponse[]>;
  preloadWorldSkillsForProgram: (seasonId: number, programId: number) => Promise<WorldSkillsResponse[]>;
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
      logger.debug(`Pre-loading seasons for program ${programId}...`);
      const seasonResponse = await robotEventsAPI.getSeasons({ program: [programId] });

      setCachedData(prev => ({
        ...prev,
        seasons: { ...prev.seasons, [key]: seasonResponse.data },
        seasonsLoading: { ...prev.seasonsLoading, [key]: false }
      }));

      logger.debug(`Pre-loaded ${seasonResponse.data.length} seasons for program ${programId}`);
    } catch (error) {
      logger.error(`Failed to pre-load seasons for program ${programId}:`, error);
      setCachedData(prev => ({
        ...prev,
        seasonsLoading: { ...prev.seasonsLoading, [key]: false }
      }));
    }
  }, [cachedData.seasons, cachedData.seasonsLoading]);

  // World Skills cache functions
  // Returns ALL World Skills data for a program/season (across all grades)
  const getWorldSkillsForProgram = useCallback((seasonId: number, programId: number): WorldSkillsResponse[] => {
    // Find all cache keys for this program/season
    const prefix = `${seasonId}_${programId}_`;
    const allData: WorldSkillsResponse[] = [];

    Object.keys(cachedData.worldSkills).forEach(key => {
      if (key.startsWith(prefix)) {
        allData.push(...cachedData.worldSkills[key]);
      }
    });

    return allData;
  }, [cachedData.worldSkills]);

  // Legacy method - returns World Skills data for a specific grade
  const getWorldSkills = useCallback((seasonId: number, programId: number, grade: string): WorldSkillsResponse[] => {
    const key = `${seasonId}_${programId}_${grade}`;
    return cachedData.worldSkills[key] || [];
  }, [cachedData.worldSkills]);

  const preloadWorldSkills = useCallback(async (seasonId: number, programId: number, grade: string): Promise<WorldSkillsResponse[]> => {
    const key = `${seasonId}_${programId}_${grade}`;

    if (cachedData.worldSkills[key]) {
      return cachedData.worldSkills[key];
    }

    if (cachedData.worldSkillsLoading[key]) {
      while (cachedData.worldSkillsLoading[key]) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return cachedData.worldSkills[key] || [];
    }

    setCachedData(prev => ({
      ...prev,
      worldSkillsLoading: { ...prev.worldSkillsLoading, [key]: true }
    }));

    try {
      const worldSkillsData = await robotEventsAPI.getWorldSkillsRankings(seasonId, grade);

      setCachedData(prev => ({
        ...prev,
        worldSkills: { ...prev.worldSkills, [key]: worldSkillsData },
        worldSkillsLoading: { ...prev.worldSkillsLoading, [key]: false }
      }));

      return worldSkillsData;
    } catch (error) {
      logger.error(`Failed to pre-load world skills for season ${seasonId}, program ${programId}, grade ${grade}:`, error);
      setCachedData(prev => ({
        ...prev,
        worldSkillsLoading: { ...prev.worldSkillsLoading, [key]: false }
      }));
      return [];
    }
  }, [cachedData.worldSkills, cachedData.worldSkillsLoading]);

  const preloadWorldSkillsForProgram = useCallback(async (seasonId: number, programId: number): Promise<WorldSkillsResponse[]> => {
    const programName = Object.keys(PROGRAM_CONFIGS).find(p => {
      const config = PROGRAM_CONFIGS[p as keyof typeof PROGRAM_CONFIGS];
      return config.id === programId;
    });

    if (!programName) {
      logger.error(`No program found with ID ${programId}`);
      return [];
    }

    const programConfig = getProgramConfig(programName);
    if (!programConfig.hasWorldSkills || programConfig.apiType !== 'RobotEvents') {
      logger.debug(`Program ${programName} does not support World Skills`);
      return [];
    }

    const gradePromises = programConfig.availableGrades.map(grade =>
      preloadWorldSkills(seasonId, programId, grade)
    );

    const gradeResults = await Promise.all(gradePromises);
    const allData: WorldSkillsResponse[] = gradeResults.flat();

    return allData;
  }, [preloadWorldSkills]);

  const getTeamEvents = useCallback((teamId: number): Event[] => {
    return cachedData.teamEvents[teamId.toString()] || [];
  }, [cachedData.teamEvents]);

  const preloadTeamEvents = useCallback(async (teamId: number): Promise<void> => {
    const key = teamId.toString();

    if (cachedData.teamEvents[key] || cachedData.teamEventsLoading[key]) {
      return;
    }

    setCachedData(prev => ({
      ...prev,
      teamEventsLoading: { ...prev.teamEventsLoading, [key]: true }
    }));

    try {
      logger.debug(`Pre-loading events for team ${teamId}...`);
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

      logger.debug(`Pre-loaded ${sortedEvents.length} events for team ${teamId}`);
    } catch (error) {
      logger.error(`Failed to pre-load events for team ${teamId}:`, error);
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
      logger.debug(`Pre-loading awards for team ${teamId}...`);
      const awardsResponse = await robotEventsAPI.getTeamAwards(teamId);

      setCachedData(prev => ({
        ...prev,
        teamAwards: { ...prev.teamAwards, [key]: awardsResponse.data },
        teamAwardsLoading: { ...prev.teamAwardsLoading, [key]: false }
      }));

      logger.debug(`Pre-loaded ${awardsResponse.data.length} awards for team ${teamId}`);
    } catch (error) {
      logger.error(`Failed to pre-load awards for team ${teamId}:`, error);
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
    logger.debug('Clearing all cache data');
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
    logger.debug(`Clearing cache for program ${programId}`);
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
    logger.debug(`Clearing cache for season ${seasonId}`);

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
    logger.debug(`Program changed to ${selectedProgram} (ID: ${programId}), pre-loading seasons...`);
    preloadSeasons(programId);
  }, [selectedProgram, getProgramId, preloadSeasons]);

  // Smart pre-loading: Only load essential data (World Skills for selected program/season)
  useEffect(() => {
    if (!selectedSeason) return;

    const programId = getProgramIdHelper(selectedProgram);
    const programConfig = getProgramConfig(selectedProgram);

    // Only pre-load if program has World Skills and uses RobotEvents API
    if (!programConfig.hasWorldSkills || programConfig.apiType !== 'RobotEvents') {
      logger.debug(`Program ${selectedProgram} does not support World Skills, skipping pre-load`);
      return;
    }

    // Handle season name vs season ID conversion
    const loadEssentialData = async () => {
      let seasonId: number;

      if (selectedSeason.includes('-')) {
        // It's a season name like "2024-2025", need to get actual season ID
        logger.debug(`Selected season is a name (${selectedSeason}), getting actual season ID...`);
        try {
          seasonId = await robotEventsAPI.getCurrentSeasonId(selectedProgram);
          logger.debug(`Resolved season ID: ${seasonId} for program ${selectedProgram}`);
        } catch (error) {
          logger.error('Failed to get current season ID, skipping world skills preload:', error);
          return;
        }
      } else {
        // It's already a season ID
        seasonId = parseInt(selectedSeason);
      }

      logger.debug(`Season/Program changed to ${selectedProgram} season ${selectedSeason} (ID: ${seasonId}), pre-loading World Skills for all grades...`);

      // Dynamically get available grades from program config
      const availableGrades = programConfig.availableGrades;

      // Pre-load all grades in parallel
      const preloadPromises = availableGrades.map(grade =>
        preloadWorldSkills(seasonId, programId, grade).catch(error => {
          // Silently handle background preload errors
        })
      );

      // Execute all in parallel (non-blocking)
      Promise.all(preloadPromises);
    };

    loadEssentialData();
  }, [selectedSeason, selectedProgram, getProgramIdHelper, preloadWorldSkills]);

  // Force refresh methods (clear cache and reload)
  const forceRefreshSeasons = useCallback(async (programId: number): Promise<void> => {
    const key = programId.toString();
    logger.debug(`Force refreshing seasons for program ${programId}...`);

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
    logger.debug(`Force refreshing world skills for season ${seasonId}, program ${programId}, grade ${grade}...`);

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
    logger.debug(`Force refreshing events for team ${teamId}...`);

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
    logger.debug(`Force refreshing awards for team ${teamId}...`);

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
    getWorldSkillsForProgram,
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
    preloadWorldSkillsForProgram,
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