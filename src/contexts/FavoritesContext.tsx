import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Event, Team } from '../types';
import { storage } from '../utils/webCompatibility';
import { useSettings, ProgramType } from './SettingsContext';

interface FavoriteItem {
  id: string;
  type: 'team' | 'event';
  program: ProgramType; // Store which program this favorite belongs to
  number?: string;
  name: string;
  organization?: string;
  location?: string;
  eventId?: number; // For teams, store which event context they were favorited from
  sku?: string; // For events - the event SKU
  eventApiId?: number; // Store the actual event.id for direct navigation
  eventUiId?: string; // Store the uiId for league sessions (e.g., "12345_session_2")
  start?: string; // For events - the start date
  end?: string; // For events - the end date
}

interface FavoritesContextType {
  favoriteTeams: string[]; // Array of team numbers
  favoriteEvents: string[]; // Array of event SKUs
  favorites: FavoriteItem[]; // All favorite items for the favorites screen
  favoritesLoading: boolean; // Whether favorites are currently loading from storage
  addTeam: (team: Team, eventId?: number) => Promise<void>;
  removeTeam: (teamNumber: string) => Promise<void>;
  addEvent: (event: Event) => Promise<void>;
  removeEvent: (eventSku: string) => Promise<void>;
  isTeamFavorited: (teamNumber: string) => boolean;
  isEventFavorited: (eventSku: string) => boolean;
  clearFavoriteTeams: () => Promise<void>;
  clearFavoriteEvents: () => Promise<void>;
  loadFavorites: () => Promise<void>;
  reorderTeams: (teamNumbers: string[]) => Promise<void>;
  reorderEvents: (eventSkus: string[]) => Promise<void>;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

export const useFavorites = () => {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error('useFavorites must be used within a FavoritesProvider');
  }
  return context;
};

interface FavoritesProviderProps {
  children: ReactNode;
}

export type { FavoriteItem };

export const FavoritesProvider: React.FC<FavoritesProviderProps> = ({ children }) => {
  const settings = useSettings();
  const [allFavorites, setAllFavorites] = useState<FavoriteItem[]>([]);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [favoriteTeams, setFavoriteTeams] = useState<string[]>([]);
  const [favoriteEvents, setFavoriteEvents] = useState<string[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(true);

  useEffect(() => {
    loadFavorites();
  }, []);

  // Filter favorites when the selected program changes
  useEffect(() => {
    filterFavoritesByProgram();

    // After filtering completes, if we were loading, mark as done
    if (favoritesLoading) {
      console.log('[FavoritesContext] Filtering complete, setting favoritesLoading to false');
      setFavoritesLoading(false);
    }
  }, [settings.selectedProgram, allFavorites]);

  const filterFavoritesByProgram = () => {
    console.log('[FavoritesContext] Filtering favorites for program:', settings.selectedProgram);
    console.log('[FavoritesContext] Total favorites:', allFavorites.length);

    const programFavorites = allFavorites.filter(
      item => item.program === settings.selectedProgram
    );

    console.log('[FavoritesContext] Program favorites:', programFavorites.length);
    setFavorites(programFavorites);

    // Extract team numbers and event SKUs for quick lookup (program-specific)
    const teams = programFavorites
      .filter(item => item.type === 'team')
      .map(item => item.number!)
      .filter(Boolean);

    const events = programFavorites
      .filter(item => item.type === 'event')
      .map(item => item.sku!)
      .filter(Boolean);

    console.log('[FavoritesContext] Filtered teams:', teams.length, ', events:', events.length);
    setFavoriteTeams(teams);
    setFavoriteEvents(events);
  };

  const loadFavorites = async () => {
    try {
      console.log('[FavoritesContext] Loading favorites from storage...');
      setFavoritesLoading(true);
      const savedFavorites = await storage.getItem('favorites');
      if (savedFavorites) {
        const parsedFavorites: FavoriteItem[] = JSON.parse(savedFavorites);
        console.log('[FavoritesContext] Loaded', parsedFavorites.length, 'favorites from storage');

        // Migrate old favorites without program field to current program
        const migratedFavorites = parsedFavorites.map(item => {
          const updatedItem = { ...item };

          if (!item.program) {
            updatedItem.program = settings.selectedProgram;
          }


          return updatedItem;
        });

        setAllFavorites(migratedFavorites);
        console.log('[FavoritesContext] Set allFavorites with', migratedFavorites.length, 'items');

        // Save migrated favorites back to storage if there were any changes
        const needsSave = migratedFavorites.some((item, index) => {
          const original = parsedFavorites[index];
          return item.program !== original?.program;
        });

        if (needsSave) {
          await storage.setItem('favorites', JSON.stringify(migratedFavorites));
        }
      } else {
        console.log('[FavoritesContext] No saved favorites found in storage');
        // No favorites to filter, safe to set loading to false immediately
        setFavoritesLoading(false);
      }
    } catch (error) {
      console.error('[FavoritesContext] Failed to load favorites:', error);
      setFavoritesLoading(false);
    }
    // Don't set favoritesLoading to false here - let the filter useEffect do it after filtering completes
  };

  const saveFavorites = async (newAllFavorites: FavoriteItem[]) => {
    try {
      await storage.setItem('favorites', JSON.stringify(newAllFavorites));
      setAllFavorites(newAllFavorites);
    } catch (error) {
      console.error('Failed to save favorites:', error);
      throw error;
    }
  };

  const addTeam = async (team: Team, eventId?: number) => {
    try {
      // Check if already favorited in current program
      if (favoriteTeams.includes(team.number)) {
        return;
      }

      const favoriteItem: FavoriteItem = {
        id: 'team-' + (settings.selectedProgram || 'unknown') + '-' + (team.number || 'unknown'),
        type: 'team',
        program: settings.selectedProgram,
        number: team.number,
        name: team.team_name || team.number,
        organization: team.organization,
        location: team.location ? ((team.location.city || '') + ', ' + (team.location.region || '')) : undefined,
        eventId,
      };

      const newAllFavorites = [...allFavorites, favoriteItem];
      await saveFavorites(newAllFavorites);
    } catch (error) {
      console.error('Failed to add team to favorites:', error);
      throw error;
    }
  };

  const removeTeam = async (teamNumber: string) => {
    try {
      const newAllFavorites = allFavorites.filter(item =>
        !(item.type === 'team' && item.number === teamNumber && item.program === settings.selectedProgram)
      );
      await saveFavorites(newAllFavorites);
    } catch (error) {
      console.error('Failed to remove team from favorites:', error);
      throw error;
    }
  };

  const addEvent = async (event: any) => {
    try {
      // Get unique identifier - use uiId for league sessions, otherwise use event ID
      const uniqueId = event.uiId || event.id.toString();

      // Check if already favorited in current program by unique identifier
      const alreadyFavorited = allFavorites.some(item =>
        item.type === 'event' &&
        ((item.eventUiId && item.eventUiId === uniqueId) ||
         (!item.eventUiId && item.eventApiId === event.id)) &&
        item.program === settings.selectedProgram
      );

      if (alreadyFavorited) {
        return;
      }

      const favoriteItem: FavoriteItem = {
        id: 'event-' + (settings.selectedProgram || 'unknown') + '-' + uniqueId,
        type: 'event',
        program: settings.selectedProgram,
        name: event.name,
        location: event.location ? ((event.location.city || '') + ', ' + (event.location.region || '')) : undefined,
        sku: event.sku, // Store SKU
        eventApiId: event.id, // Store the actual API event ID
        eventUiId: event.uiId, // Store uiId for league sessions (undefined for regular events)
        start: event.start, // Store start date
        end: event.end, // Store end date
      };

      const newAllFavorites = [...allFavorites, favoriteItem];
      await saveFavorites(newAllFavorites);
    } catch (error) {
      console.error('Failed to add event to favorites:', error);
      throw error;
    }
  };

  const removeEvent = async (identifier: string) => {
    try {
      // Support event ID, uiId, or SKU for removal
      const eventId = parseInt(identifier);
      const newAllFavorites = allFavorites.filter(item => {
        if (item.type !== 'event' || item.program !== settings.selectedProgram) {
          return true;
        }

        // Check uiId first (for league sessions)
        if (item.eventUiId === identifier) {
          return false;
        }

        // Check by event ID if it's a number
        if (!isNaN(eventId) && item.eventApiId === eventId) {
          return false;
        }

        // Check by SKU (backwards compatibility)
        if (item.sku === identifier) {
          return false;
        }

        return true;
      });
      await saveFavorites(newAllFavorites);
    } catch (error) {
      console.error('Failed to remove event from favorites:', error);
      throw error;
    }
  };

  const isTeamFavorited = (teamNumber: string): boolean => {
    return favoriteTeams.includes(teamNumber);
  };

  const isEventFavorited = (identifier: string): boolean => {
    // Support event ID, uiId, or SKU for checking
    const eventId = parseInt(identifier);

    return allFavorites.some(item => {
      if (item.type !== 'event' || item.program !== settings.selectedProgram) {
        return false;
      }

      // Check uiId first (for league sessions)
      if (item.eventUiId === identifier) {
        return true;
      }

      // Check by event ID if it's a number
      if (!isNaN(eventId) && item.eventApiId === eventId) {
        return true;
      }

      // Check by SKU (backwards compatibility)
      if (item.sku === identifier) {
        return true;
      }

      return false;
    });
  };

  const clearFavoriteTeams = async () => {
    try {
      const newAllFavorites = allFavorites.filter(item =>
        !(item.type === 'team' && item.program === settings.selectedProgram)
      );
      await saveFavorites(newAllFavorites);
    } catch (error) {
      console.error('Failed to clear favorite teams:', error);
      throw error;
    }
  };

  const clearFavoriteEvents = async () => {
    try {
      const newAllFavorites = allFavorites.filter(item =>
        !(item.type === 'event' && item.program === settings.selectedProgram)
      );
      await saveFavorites(newAllFavorites);
    } catch (error) {
      console.error('Failed to clear favorite events:', error);
      throw error;
    }
  };

  const reorderTeams = async (teamNumbers: string[]) => {
    try {
      // Get current program's team favorites
      const currentProgramTeams = allFavorites.filter(
        item => item.type === 'team' && item.program === settings.selectedProgram
      );

      // Get favorites from other programs (unchanged)
      const otherFavorites = allFavorites.filter(
        item => !(item.type === 'team' && item.program === settings.selectedProgram)
      );

      // Create a map for quick lookup
      const teamMap = new Map(currentProgramTeams.map(team => [team.number!, team]));

      // Reorder teams based on the new order
      const reorderedTeams = teamNumbers
        .map(number => teamMap.get(number))
        .filter((team): team is FavoriteItem => team !== undefined);

      // Combine with other favorites
      const newAllFavorites = [...otherFavorites, ...reorderedTeams];
      await saveFavorites(newAllFavorites);
    } catch (error) {
      console.error('Failed to reorder teams:', error);
      throw error;
    }
  };

  const reorderEvents = async (eventSkus: string[]) => {
    try {
      // Get current program's event favorites
      const currentProgramEvents = allFavorites.filter(
        item => item.type === 'event' && item.program === settings.selectedProgram
      );

      // Get favorites from other programs (unchanged)
      const otherFavorites = allFavorites.filter(
        item => !(item.type === 'event' && item.program === settings.selectedProgram)
      );

      // Create a map for quick lookup
      const eventMap = new Map(currentProgramEvents.map(event => [event.sku!, event]));

      // Reorder events based on the new order
      const reorderedEvents = eventSkus
        .map(sku => eventMap.get(sku))
        .filter((event): event is FavoriteItem => event !== undefined);

      // Combine with other favorites
      const newAllFavorites = [...otherFavorites, ...reorderedEvents];
      await saveFavorites(newAllFavorites);
    } catch (error) {
      console.error('Failed to reorder events:', error);
      throw error;
    }
  };

  const value: FavoritesContextType = {
    favoriteTeams,
    favoriteEvents,
    favorites,
    favoritesLoading,
    addTeam,
    removeTeam,
    addEvent,
    removeEvent,
    isTeamFavorited,
    isEventFavorited,
    clearFavoriteTeams,
    clearFavoriteEvents,
    loadFavorites,
    reorderTeams,
    reorderEvents,
  };

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  );
};