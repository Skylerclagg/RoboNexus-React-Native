/**
 * Event utility functions
 *
 * Shared utilities for handling event status, league sessions, and other event-related logic
 * Used consistently across EventCard, EventLookup, Dashboard, and other components.
 */

export interface ExtendedEvent {
  id: number;
  name: string;
  start: string;
  end: string;
  sku: string;
  location?: {
    city: string;
    region: string;
    country?: string;
    coordinates?: {
      lat: number;
      lon: number;
    };
  };
  program: {
    id: number;
    name: string;
    code: string;
  };
  // League session properties
  originalEventId?: number;
  originalSku?: string;
  isLeagueSession?: boolean;
  sessionNumber?: number;
  totalSessions?: number;
  uiId?: string;
  // Additional properties for API compatibility
  locations?: { [date: string]: any };
  [key: string]: any;
}

export interface EventStatus {
  status: 'upcoming' | 'live' | 'completed' | 'cancelled' | 'active';
  color: string;
}

/**
 * Determines the status of an event, with special handling for league sessions
 * This is the authoritative function used across the entire app
 */
export const getEventStatus = (event: ExtendedEvent): EventStatus => {
  // Check if event is cancelled first (highest priority)
  const eventNameLower = event.name.toLowerCase();
  if (eventNameLower.includes('canceled') || eventNameLower.includes('cancelled')) {
    return { status: 'cancelled', color: '#FF3B30' }; // Red for cancelled
  }

  const now = new Date();
  const startDate = new Date(event.start);
  const endDate = new Date(event.end);

  // Check if this is an expanded league session (from EventLookup)
  if (event.isLeagueSession) {
    // Get today's date in the same timezone as the event
    const today = new Date();
    const todayDateString = today.toISOString().split('T')[0];
    const sessionDateString = startDate.toISOString().split('T')[0];

    if (todayDateString === sessionDateString) {
      return { status: 'live', color: '#34C759' }; // Green for session day only
    } else if (today < startDate) {
      return { status: 'upcoming', color: '#007AFF' }; // Blue before session
    } else {
      return { status: 'completed', color: '#8E8E93' }; // Gray after session
    }
  }

  // Check if this is a full league event (from Dashboard/API - has multiple locations)
  if (event.locations && Object.keys(event.locations).length > 1) {
    const today = new Date();
    const todayDateString = today.toISOString().split('T')[0];
    const sessionDates = Object.keys(event.locations);

    // Check if today is one of the session dates
    if (sessionDates.includes(todayDateString)) {
      return { status: 'live', color: '#34C759' }; // Green - league event is live today
    }

    // Check if all sessions are in the past
    const allSessionsComplete = sessionDates.every(dateStr => {
      const sessionDate = new Date(dateStr);
      return sessionDate < today;
    });

    if (allSessionsComplete) {
      return { status: 'completed', color: '#8E8E93' }; // Gray - all sessions complete
    }

    // At least one session is in the future
    return { status: 'upcoming', color: '#007AFF' }; // Blue - upcoming sessions
  }

  // Regular tournament event logic with improved date handling
  // Extend end date to end of day to handle events that run until end of day
  const adjustedEndDate = new Date(endDate);
  adjustedEndDate.setHours(23, 59, 59, 999);

  if (now < startDate) {
    return { status: 'upcoming', color: '#007AFF' };
  } else if (now >= startDate && now <= adjustedEndDate) {
    return { status: 'live', color: '#34C759' };
  } else {
    return { status: 'completed', color: '#8E8E93' };
  }
};

/**
 * Formats event date for display
 */
export const formatEventDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch {
    return 'Date TBD';
  }
};

/**
 * Checks if an event has multiple locations (league event)
 */
export const isLeagueEvent = (event: any): boolean => {
  return event.locations && Object.keys(event.locations).length > 1;
};

/**
 * Transforms a league event into individual session events
 */
export const expandLeagueEvent = (event: any): ExtendedEvent[] => {
  if (!isLeagueEvent(event)) {
    // Regular event, return as-is
    return [{
      ...event,
      program: {
        id: event.program.id,
        name: event.program.name,
        code: event.program.code || 'UNKNOWN',
      },
    }];
  }

  // Create a separate event card for each session
  const sessionDates = Object.keys(event.locations).sort();
  const sessions: ExtendedEvent[] = [];

  sessionDates.forEach((dateStr, index) => {
    const sessionLocation = event.locations[dateStr];

    sessions.push({
      ...event,
      id: event.id, // Keep original ID for favorites
      name: `${event.name} - Session ${index + 1}`,
      start: new Date(dateStr + 'T09:00:00').toISOString(), // Use system timezone
      end: new Date(dateStr + 'T17:00:00').toISOString(),   // Use system timezone
      location: sessionLocation,
      originalEventId: event.id,
      originalSku: event.sku,
      isLeagueSession: true,
      sessionNumber: index + 1,
      totalSessions: sessionDates.length,
      uiId: `${event.id}-session-${index + 1}`, // Unique UI identifier
      program: {
        id: event.program.id,
        name: event.program.name,
        code: event.program.code || 'UNKNOWN',
      },
    });
  });

  return sessions;
};

/**
 * Prepares event for favorites (removes session suffix for league events)
 */
export const prepareEventForFavorites = (event: ExtendedEvent): any => {
  if (event.isLeagueSession) {
    return {
      ...event,
      name: event.name.replace(/ - Session \d+$/, ''), // Remove session suffix for favorites
    };
  }
  return event;
};

/**
 * Filters events to find those that are currently "live" (happening now/today)
 * This is the centralized implementation used across Dashboard, TeamInfoScreen, etc.
 *
 * @param events - Array of events to filter
 * @param options - Optional configuration
 * @returns Array of events that are currently live
 */
export const filterLiveEvents = (
  events: any[],
  options?: {
    devLiveEventSimulation?: boolean;
    isDeveloperMode?: boolean;
    devTestEventId?: string;
  }
): any[] => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return events.filter(event => {
    try {
      // Safe date parsing - handle both "YYYY-MM-DD" and ISO format
      const start = new Date(event.start);
      const end = new Date(event.end);

      // Validate dates
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        // console.error('[eventUtils] Invalid date for event', event.name, '- Start:', event.start, 'End:', event.end);
        return false;
      }

      // console.log('[eventUtils] Checking event', event.name, '(ID:', event.id, ')');
      // console.log('[eventUtils]   Start:', start.toISOString(), 'End:', end.toISOString(), 'Now:', now.toISOString());

      // Developer mode: if test event ID is set, only match that event
      if (options?.isDeveloperMode && options?.devTestEventId && options.devTestEventId.trim() !== '') {
        const testEventIdNum = parseInt(options.devTestEventId.trim());
        const isTestEvent = event.id === testEventIdNum;
        if (isTestEvent) {
          // console.log('[eventUtils] Developer test mode - Event', event.name, 'matches test event ID:', testEventIdNum);
        }
        return isTestEvent;
      }

      // Developer mode simulation: if enabled, simulate live events by treating recent events as live
      if (options?.devLiveEventSimulation && options?.isDeveloperMode) {
        const oneWeekAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
        const oneWeekFromNow = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000));
        const isSimulatedLive = start >= oneWeekAgo && start <= oneWeekFromNow;
        console.warn('[eventUtils] ⚠️ DEVELOPER MODE: Live Event Simulation is ENABLED - treating events from past/future 7 days as live');
        // console.log('[eventUtils] Developer simulation mode - Event', event.name, 'is simulated live:', isSimulatedLive);
        return isSimulatedLive;
      }

      // Check if event has specific dates (league events) or just date range (tournaments)
      if (event.locations) {
        // League event with specific competition dates
        const todayString = today.toISOString().split('T')[0]; // Format: YYYY-MM-DD
        const eventDates = Object.keys(event.locations);
        const isLeagueCompetitionDay = eventDates.includes(todayString);
        // console.log('[eventUtils] League event', event.name, '- Competition dates:', eventDates, '- Today:', todayString, '- Is competition day:', isLeagueCompetitionDay);
        return isLeagueCompetitionDay;
      } else {
        // Regular event with continuous date range
        const withinDateRange = start <= now && end >= now;
        // console.log('[eventUtils] Regular event', event.name, 'is within date range:', withinDateRange);
        return withinDateRange;
      }
    } catch (error) {
      // console.error('[eventUtils] Error processing event', event.name, ':', error);
      return false;
    }
  });
};

/**
 * Helper function to check if a match has been played using the same logic as match lists
 * Checks for real scores, non-zero scores, and if any later match in the same division has been scored
 */
const isMatchPlayed = (match: any, allMatches: any[]): boolean => {
  const hasStarted = match.started && match.started !== null;
  const hasRealScores = match.alliances && match.alliances.some((alliance: any) => alliance.score > 0);
  const hasNonZeroScores = match.alliances && !match.alliances.every((alliance: any) =>
    (alliance.score === 0 || alliance.score === null || alliance.score === undefined)
  );

  // Check basic scoring
  if (hasStarted && (hasRealScores || hasNonZeroScores)) {
    return true;
  }

  // Check if any LATER match in the same division has been scored
  const extractMatchNumber = (matchName: string) => {
    const numbers = matchName.match(/\d+/g);
    return numbers ? parseInt(numbers[0]) : 0;
  };

  const currentMatchNum = extractMatchNumber(match.name);
  const laterMatchScored = allMatches.some(otherMatch => {
    // Same division check
    if (otherMatch.division?.id !== match.division?.id) return false;

    // Is it a later match?
    const otherMatchNum = extractMatchNumber(otherMatch.name);
    if (otherMatchNum <= currentMatchNum) return false;

    // Has it been scored?
    const otherHasRealScores = otherMatch.alliances && otherMatch.alliances.some((alliance: any) => alliance.score > 0);
    const otherHasNonZeroScores = otherMatch.alliances && !otherMatch.alliances.every((alliance: any) =>
      (alliance.score === 0 || alliance.score === null || alliance.score === undefined)
    );

    return otherHasRealScores || otherHasNonZeroScores;
  });

  return laterMatchScored;
};

/**
 * Selects the most relevant live event from a list of potentially live events
 * Uses match activity to determine which event the team is actually at today
 * Returns null if all matches at the event have been scored (event is complete)
 *
 * @param liveEvents - Array of potentially live events
 * @param getMatchesForEvent - Async function to get matches for an event
 * @param options - Optional configuration for developer overrides
 * @returns The selected live event or null if event is complete
 */
export const selectCurrentLiveEvent = async (
  liveEvents: any[],
  getMatchesForEvent: (eventId: number) => Promise<any[]>,
  options?: {
    isDeveloperMode?: boolean;
    devTestEventId?: string;
  }
): Promise<any | null> => {
  if (liveEvents.length === 0) return null;

  // Developer mode override: if a specific event ID is set, force-select it
  // This ensures dev test events work even if they have no matches or all matches are complete
  if (options?.isDeveloperMode && options?.devTestEventId && options.devTestEventId.trim() !== '') {
    const testEventIdNum = parseInt(options.devTestEventId.trim());
    const testEvent = liveEvents.find(event => event.id === testEventIdNum);
    if (testEvent) {
      // console.log('[eventUtils] Developer override active - force-selecting event:', testEvent.name, '(ID:', testEventIdNum, ')');
      return testEvent;
    }
  }

  // Check each live event for active matches to find which one is actually happening TODAY
  let selectedEvent = null;
  let maxActiveMatches = 0;
  let allEventsComplete = true; // Track if all events have all matches scored

  for (const event of liveEvents) {
    try {
      // console.log('[eventUtils] Checking event', event.name, '(ID:', event.id, ') for active matches');
      const matches = await getMatchesForEvent(event.id);

      if (matches.length === 0) {
        // console.log('[eventUtils] Event', event.name, 'has no matches yet');
        allEventsComplete = false;
        continue;
      }

      // Check if ALL matches have been played/scored
      const unplayedMatches = matches.filter(match => !isMatchPlayed(match, matches));
      const allMatchesPlayed = unplayedMatches.length === 0;

      // console.log('[eventUtils] Event', event.name, '- Total matches:', matches.length, ', Unplayed:', unplayedMatches.length, ', All complete:', allMatchesPlayed);

      if (allMatchesPlayed) {
        // console.log('[eventUtils] Event', event.name, 'is complete - all matches have been scored');
        // Don't select this event, but continue checking others
        continue;
      }

      // At least one event has unplayed matches
      allEventsComplete = false;

      // Count matches that are happening today
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const tomorrowStart = new Date(todayStart.getTime() + (24 * 60 * 60 * 1000));

      const activeMatchesCount = matches.filter(match => {
        const matchScheduled = match.scheduled ? new Date(match.scheduled) : null;

        // Match is incomplete if it hasn't been played (using our comprehensive logic)
        const isIncomplete = !isMatchPlayed(match, matches);

        let isToday = false;
        if (matchScheduled) {
          isToday = matchScheduled >= todayStart && matchScheduled < tomorrowStart;
        }

        // Consider match "active" if it's incomplete AND (scheduled for today OR no schedule info)
        const isActive = isIncomplete && (isToday || !matchScheduled);
        return isActive;
      }).length;

      // console.log('[eventUtils] Event', event.name, 'has', activeMatchesCount, 'active matches today');

      // Select the event with the most active matches today
      if (activeMatchesCount > maxActiveMatches) {
        maxActiveMatches = activeMatchesCount;
        selectedEvent = event;
      }
    } catch (error) {
      // console.error('[eventUtils] Failed to check matches for event', event.name, ':', error);
      allEventsComplete = false; // If we can't check, assume not complete
    }
  }

  // If all events are complete (all matches scored), return null
  if (allEventsComplete && liveEvents.length > 0) {
    // console.log('[eventUtils] All live events are complete (all matches scored) - team is no longer at a live event');
    return null;
  }

  // If no event has active matches, use intelligent fallback
  if (!selectedEvent) {
    // console.log('[eventUtils] No events with active matches found, using intelligent fallback');

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Sort by: events that started today first, then most recently started
    liveEvents.sort((a, b) => {
      const startA = new Date(a.start);
      const startB = new Date(b.start);

      // Check if event started today
      const startedTodayA = startA.getTime() === todayStart.getTime();
      const startedTodayB = startB.getTime() === todayStart.getTime();

      // Prioritize events that started today
      if (startedTodayA && !startedTodayB) return -1;
      if (!startedTodayA && startedTodayB) return 1;

      // Otherwise, prefer the most recently started event
      return startB.getTime() - startA.getTime();
    });

    selectedEvent = liveEvents[0];
    // console.log('[eventUtils] Fallback selected:', selectedEvent.name, 'started', selectedEvent.start);
  }

  // console.log('[eventUtils] Selected live event:', selectedEvent?.name, '(ID:', selectedEvent?.id, ') with', maxActiveMatches, 'active matches');
  return selectedEvent;
};