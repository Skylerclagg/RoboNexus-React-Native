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
  } else {
    // Regular tournament event logic
    if (now < startDate) {
      return { status: 'upcoming', color: '#007AFF' };
    } else if (now >= startDate && now <= endDate) {
      return { status: 'live', color: '#34C759' };
    } else {
      return { status: 'completed', color: '#8E8E93' };
    }
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