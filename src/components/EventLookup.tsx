/**
 * EVENT LOOKUP COMPONENT
 *
 * Modern event search and discovery component with enhanced UI/UX design.
 * Features improved search results, better event information display, and modern styling.
 *
 * KEY FEATURES:
 * - Real-time debounced search (no enter key required)
 * - Modern card-based search results
 * - Enhanced event information display
 * - Improved visual hierarchy and spacing
 * - Better loading states and visual feedback
 * - Event filtering and sorting capabilities
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createLogger } from '../utils/logger';

const logger = createLogger('EventLookup');
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
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { location as Location, storage } from '../utils/webCompatibility';
import { robotEventsAPI } from '../services/apiRouter';
import { useSettings } from '../contexts/SettingsContext';
import { useFavorites } from '../contexts/FavoritesContext';
import { Event } from '../types';
import DropdownPicker from './DropdownPicker';
import EventFiltersModal from './EventFiltersModal';
import EventsMapView from './EventsMapView';
import EventCardSkeleton from './EventCardSkeleton';
import AnimatedScrollBar from './AnimatedScrollBar';
import { getProgramId, getProgramShortName } from '../utils/programMappings';
import { getEventStatus as getEventStatusUtil, formatEventDate as formatEventDateUtil, ExtendedEvent } from '../utils/eventUtils';

// Note: ExtendedEvent interface is now imported from eventUtils for consistency

interface EventLookupProps {
  navigation?: any;
  viewMode?: 'list' | 'map';
}

const EventLookup: React.FC<EventLookupProps> = ({ navigation, viewMode = 'list' }) => {
  logger.debug('Component loading...');
  const settings = useSettings();
  const { selectedProgram, globalSeasonEnabled, selectedSeason: globalSeason, updateGlobalSeason, isDeveloperMode, filterResetTrigger, autoLocationCountryFilter } = settings;
  const { addEvent, removeEvent, isEventFavorited } = useFavorites();

  // Events State
  const [selectedSeason, setSelectedSeason] = useState<string>('');
  const [seasons, setSeasons] = useState<{label: string, value: string}[]>([]);
  const [eventQuery, setEventQuery] = useState('');
  const [allEvents, setAllEvents] = useState<ExtendedEvent[]>([]);
  const [events, setEvents] = useState<ExtendedEvent[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<ExtendedEvent[]>([]);
  const [eventLoading, setEventLoading] = useState(false);
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [eventFilters, setEventFilters] = useState({
    season: '',
    level: '',
    region: '',
    state: '',
    country: '',
    dateFilter: false,
    nearbyFilter: false,
    liveEventsOnly: false,
  });

  // Location state for nearby filtering
  const [userLocation, setUserLocation] = useState<any | null>(null);
  const [locationPermission, setLocationPermission] = useState<boolean>(false);

  // Detected location info for auto-filtering
  const [detectedCountry, setDetectedCountry] = useState<string>('');
  const [autoFiltersApplied, setAutoFiltersApplied] = useState<boolean>(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreEvents, setHasMoreEvents] = useState(true);
  const eventsPerPage = 25;

  // Dynamic regions based on actual event data
  const [availableRegions, setAvailableRegions] = useState<string[]>([]);
  const [availableStates, setAvailableStates] = useState<string[]>([]);
  const [availableCountries, setAvailableCountries] = useState<string[]>([]);
  // Store all regions with their associated countries for dynamic filtering
  const [regionsByCountry, setRegionsByCountry] = useState<{[country: string]: string[]}>({});

  // Debounced search state
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Scroll tracking for AnimatedScrollBar
  const [scrollY, setScrollY] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const flatListRef = useRef<any>(null);

  // Cache management - use program short name for cache keys
  const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds
  const getCacheKey = (program: string, seasonId: string) => {
    const shortName = getProgramShortName(program);
    return `events_cache_${shortName}_${seasonId}`;
  };
  const getCacheTimestampKey = (program: string, seasonId: string) => {
    const shortName = getProgramShortName(program);
    return `events_cache_timestamp_${shortName}_${seasonId}`;
  };

  // Load seasons when component mounts or program changes
  useEffect(() => {
    loadSeasons();
  }, [selectedProgram]);

  // Reset all filters when program changes
  useEffect(() => {
    if (filterResetTrigger > 0) {
      logger.debug('Filter reset triggered - clearing all event filters');
      setEventFilters({
        season: '',
        level: '',
        region: '',
        state: '',
        country: '',
        dateFilter: false,
        nearbyFilter: false,
        liveEventsOnly: false,
      });
      setEventQuery('');
      setCurrentPage(1);
    }
  }, [filterResetTrigger]);

  // Sync with global season when global mode is enabled
  useEffect(() => {
    if (globalSeasonEnabled && globalSeason && globalSeason !== selectedSeason) {
      setSelectedSeason(globalSeason);
    }
  }, [globalSeasonEnabled, globalSeason]);

  // Sync event filters season with global season when global mode is enabled
  useEffect(() => {
    if (globalSeasonEnabled && globalSeason && globalSeason !== eventFilters.season) {
      setEventFilters(prev => ({ ...prev, season: globalSeason }));
    }
  }, [globalSeasonEnabled, globalSeason, eventFilters.season]);

  // Auto-manage date filter based on active vs non-active seasons
  useEffect(() => {
    if (seasons.length > 0 && eventFilters.season) {
      const isActiveSeason = eventFilters.season === seasons[0].value;

      if (isActiveSeason && !eventFilters.dateFilter) {
        // Auto-enable date filter for active season
        setEventFilters(prev => ({ ...prev, dateFilter: true }));
        logger.debug('Auto-enabled date filter for active season:', eventFilters.season);
      } else if (!isActiveSeason && eventFilters.dateFilter) {
        // Auto-disable date filter for non-active seasons
        setEventFilters(prev => ({ ...prev, dateFilter: false }));
        logger.debug('Auto-disabled date filter for non-active season:', eventFilters.season);
      }
    }
  }, [eventFilters.season, seasons]);

  useEffect(() => {
    if (seasons.length > 0 && eventFilters.season) {
      setAllEvents([]);
      loadAllEvents();
    }
  }, [seasons, eventFilters.season, selectedProgram]);

  // Re-apply filters when search query changes
  useEffect(() => {
    if (allEvents && allEvents.length > 0) {
      applyFiltersAndPagination(allEvents, eventFilters, 1);
    }
  }, [eventQuery]);

  // Request location permission when nearby filter is enabled
  useEffect(() => {
    logger.debug('nearbyFilter changed:', eventFilters.nearbyFilter, 'locationPermission:', locationPermission);
    if (eventFilters.nearbyFilter && !locationPermission) {
      logger.debug('Triggering location permission request');
      requestLocationPermission();
    }
  }, [eventFilters.nearbyFilter]);

  // Re-apply filters when user location is obtained
  useEffect(() => {
    logger.debug('userLocation useEffect triggered, userLocation:', !!userLocation, 'nearbyFilter:', eventFilters.nearbyFilter);
    if (userLocation && allEvents && allEvents.length > 0 && eventFilters.nearbyFilter) {
      logger.debug('Re-applying filters due to location update');
      applyFiltersAndPagination(allEvents, eventFilters, 1);
    }
  }, [userLocation, eventFilters.nearbyFilter, allEvents]);

  // Re-apply filters when event filters change
  useEffect(() => {
    logger.debug('eventFilters useEffect triggered with filters:', eventFilters);
    if (allEvents && allEvents.length > 0) {
      applyFiltersAndPagination(allEvents, eventFilters, 1);
    }
  }, [eventFilters]);

  // Request location for auto-filtering when enabled
  useEffect(() => {
    if (autoLocationCountryFilter && !detectedCountry && !autoFiltersApplied) {
      logger.debug('Auto-location filter enabled, requesting location...');
      requestLocationPermission(true);
    }
  }, [autoLocationCountryFilter]);

  // Apply auto-filters when detected location and available options are ready
  useEffect(() => {
    if (autoFiltersApplied) return; // Only apply once per session

    const shouldApplyCountry = autoLocationCountryFilter && detectedCountry && availableCountries.length > 0;

    if (shouldApplyCountry) {
      let newFilters = { ...eventFilters };
      let filtersChanged = false;

      // Match detected country to available countries
      if (shouldApplyCountry && !eventFilters.country) {
        const matchedCountry = availableCountries.find(c =>
          c.toLowerCase() === detectedCountry.toLowerCase() ||
          detectedCountry.toLowerCase().includes(c.toLowerCase()) ||
          c.toLowerCase().includes(detectedCountry.toLowerCase())
        );
        if (matchedCountry) {
          logger.debug('Auto-applying country filter:', matchedCountry);
          newFilters.country = matchedCountry;
          filtersChanged = true;
        }
      }

      if (filtersChanged) {
        logger.debug('Auto-filter: Setting new filters and applying to events');
        setEventFilters(newFilters);
        setAutoFiltersApplied(true);
        // Directly apply filters to ensure they take effect immediately
        if (allEvents && allEvents.length > 0) {
          applyFiltersAndPagination(allEvents, newFilters, 1);
        }
      }
    }
  }, [detectedCountry, availableCountries, autoLocationCountryFilter, autoFiltersApplied, allEvents]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      const checkAndRefreshCache = async () => {
        if (!eventFilters.season || !selectedProgram) return;

        if (allEvents.length > 0) {
          logger.debug('Data already loaded, skipping reload');
          return;
        }

        try {
          const timestampKey = getCacheTimestampKey(selectedProgram, eventFilters.season);
          const cachedTimestamp = await storage.getItem(timestampKey);

          if (cachedTimestamp) {
            const lastFetchTime = parseInt(cachedTimestamp);
            const now = Date.now();
            const timeSinceLastFetch = now - lastFetchTime;

            if (timeSinceLastFetch > CACHE_DURATION) {
              logger.debug('Cache expired (older than 1 hour), refreshing...');
              loadAllEvents();
            } else {
              logger.debug('Cache is fresh, loading from cache...');
              loadCachedEvents();
            }
          } else {
            logger.debug('No cache found, loading events...');
            loadAllEvents();
          }
        } catch (error) {
          logger.error('Error checking cache:', error);
        }
      };

      checkAndRefreshCache();
    }, [selectedProgram, eventFilters.season, allEvents.length])
  );

  const loadSeasons = async () => {
    try {
      logger.debug('Loading seasons for program:', selectedProgram || 'Unknown');
      // Get program ID for filtering
      const programId = getProgramId(selectedProgram);

      const seasonResponse = await robotEventsAPI.getSeasons({ program: [programId] });
      logger.debug('Seasons loaded for', selectedProgram || 'Unknown', ':', seasonResponse.data.length, seasonResponse.data.map(s => ({
        id: s.id,
        name: s.name,
        program: s.program?.name || s.program?.code || 'Unknown'
      })));
      const formattedSeasons = seasonResponse.data
        .sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime())
        .map(season => {
          // Return the full season name without any shortening
          return {
            label: season.name,
            value: season.id.toString()
          };
        });
      setSeasons(formattedSeasons);
      if (formattedSeasons.length > 0 && !selectedSeason) {
        // Use global season if global mode is enabled, otherwise use first season
        const defaultSeason = globalSeasonEnabled && globalSeason
          ? globalSeason
          : formattedSeasons[0].value;
        setSelectedSeason(defaultSeason);
      }

      // Set default event filter season (always update when seasons change due to program change)
      if (formattedSeasons.length > 0) {
        const defaultSeason = globalSeasonEnabled && globalSeason
          ? globalSeason
          : formattedSeasons[0].value;

        // Check if this is the current/active season (most recent season)
        const isActiveSeason = defaultSeason === formattedSeasons[0].value;

        setEventFilters(prev => ({
          ...prev,
          season: defaultSeason,
          // Enable date filter by default for the active season
          dateFilter: isActiveSeason
        }));
        logger.debug('Set event filter season for program:', defaultSeason, 'isActiveSeason:', isActiveSeason);
      }
    } catch (error) {
      logger.error('Failed to load seasons:', error);
    }
  };

  const formatSeasonOption = (raw: string) => {
    if (!raw) return 'Unknown Season';
    return raw;
  };

  const loadCachedEvents = async () => {
    if (!eventFilters.season || !selectedProgram) return;

    try {
      const cacheKey = getCacheKey(selectedProgram, eventFilters.season);
      const cachedData = await storage.getItem(cacheKey);

      if (cachedData) {
        const parsedEvents: ExtendedEvent[] = JSON.parse(cachedData);
        logger.debug('Loaded', parsedEvents.length, 'events from cache for', selectedProgram, 'season', eventFilters.season);

        setAllEvents(parsedEvents);
        extractRegionsAndStates(parsedEvents);
        applyFiltersAndPagination(parsedEvents, eventFilters, 1);
      } else {
        logger.debug('No cached data found, loading fresh events');
        loadAllEvents();
      }
    } catch (error) {
      logger.error('Error loading cached events:', error);
      loadAllEvents();
    }
  };

  const saveCachedEvents = async (events: ExtendedEvent[]) => {
    if (!eventFilters.season || !selectedProgram) return;

    try {
      const cacheKey = getCacheKey(selectedProgram, eventFilters.season);
      const timestampKey = getCacheTimestampKey(selectedProgram, eventFilters.season);

      await storage.setItem(cacheKey, JSON.stringify(events));
      await storage.setItem(timestampKey, Date.now().toString());

      logger.debug('Saved', events.length, 'events to cache for', selectedProgram, 'season', eventFilters.season);
    } catch (error) {
      logger.error('Error saving events to cache:', error);
    }
  };

  const loadAllEvents = async () => {
    setEventLoading(true);
    try {
      // Get program ID for filtering
      const programId = getProgramId(selectedProgram);

      // Use the current season from eventFilters, or fall back to the most recent season
      const seasonId = eventFilters.season ? parseInt(eventFilters.season) :
                      seasons.length > 0 ? parseInt(seasons[0].value) : undefined;

      if (!seasonId) {
        logger.error('No season ID available, cannot load events');
        setAllEvents([]);
        setEvents([]);
        setFilteredEvents([]);
        return;
      }

      logger.debug('Loading all events for season (with pagination):', {
        program: selectedProgram,
        seasonId,
        dateFilterEnabled: eventFilters.dateFilter,
      });

      // Load all events for the season by paginating through all pages
      let allAPIEvents: any[] = [];
      let currentPage = 1;
      let hasMorePages = true;
      const pageSize = 250; // Maximum page size for RobotEvents API

      while (hasMorePages) {
        logger.debug('Fetching events page', currentPage, '(page size:', pageSize, ')');

        const eventsResponse = await robotEventsAPI.getEvents({
          program: [programId],
          season: [seasonId],
          page: currentPage,
          per_page: pageSize,
        });

        if (eventsResponse.data && eventsResponse.data.length > 0) {
          allAPIEvents = allAPIEvents.concat(eventsResponse.data);
          logger.debug('Page', currentPage, ': Got', eventsResponse.data.length, 'events. Total so far:', allAPIEvents.length);

          // Check if we have more pages
          hasMorePages = eventsResponse.data.length === pageSize;
          currentPage++;
        } else {
          logger.debug('Page', currentPage, ': No more events found. Stopping pagination.');
          hasMorePages = false;
        }
      }

      logger.debug('Events returned for', selectedProgram || 'Unknown', ':', allAPIEvents.length);
      if (allAPIEvents.length > 0) {
        logger.debug('Sample event programs:', allAPIEvents.slice(0, 3).map(event => ({
          name: event.name,
          program: event.program?.name || event.program?.code || 'Unknown',
          programId: event.program?.id
        })));
      }

      // Filter out workshops
      allAPIEvents = allAPIEvents.filter(event =>
        !event.name.toLowerCase().includes('workshop')
      );

      logger.debug('Loaded', allAPIEvents.length, 'events for season (after filtering workshops)');

      // Transform API events to UI events and expand league events into separate session cards
      const uiEvents: ExtendedEvent[] = [];

      allAPIEvents.forEach(event => {
        const baseEvent = {
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
        };

        // Check if this is a league event - multiple locations OR name contains "league"
        const hasMultipleLocations = event.locations && Object.keys(event.locations).length > 1;
        const isNamedLeague = event.name.toLowerCase().includes('league');
        const isLeagueEvent = (hasMultipleLocations || isNamedLeague) && event.locations;

        if (isLeagueEvent) {
          // Create a separate event card for each session
          const sessionDates = Object.keys(event.locations).sort();

          sessionDates.forEach((dateStr, index) => {
            const sessionDate = new Date(dateStr);
            const sessionLocation = event.locations[dateStr];

            uiEvents.push({
              ...baseEvent,
              // Keep original event ID for API calls
              id: event.id,
              // Create unique UI identifier for React keys and internal tracking
              uiId: `${event.id}_session_${index}`,
              // Update name to include session info
              name: `${event.name} - Session ${index + 1}`,
              // Set start and end to the specific session date using system timezone
              start: new Date(dateStr + 'T09:00:00').toISOString(),
              end: new Date(dateStr + 'T17:00:00').toISOString(),
              // Use the specific location for this session
              location: sessionLocation,
              // Keep original event data for reference
              originalEventId: event.id,
              originalSku: event.sku,
              isLeagueSession: true,
              sessionNumber: index + 1,
              totalSessions: sessionDates.length
            });
          });
        } else {
          // Regular event, add as-is
          uiEvents.push(baseEvent);
        }
      });

      // Sort all events (including league sessions) by date first, then alphabetically
      uiEvents.sort((a, b) => {
        const dateA = new Date(a.start);
        const dateB = new Date(b.start);

        // Primary sort: by start date
        if (dateA.getTime() !== dateB.getTime()) {
          return dateA.getTime() - dateB.getTime();
        }

        // Secondary sort: alphabetically by name
        return a.name.localeCompare(b.name);
      });

      setAllEvents(uiEvents);

      // Save events to cache for this program and season
      saveCachedEvents(uiEvents);

      // Extract unique regions and states from the events
      extractRegionsAndStates(uiEvents);

      // Apply current filters and pagination
      applyFiltersAndPagination(uiEvents, eventFilters, 1);

    } catch (error) {
      logger.error('Failed to load events:', error);
      setAllEvents([]);
      setEvents([]);
      setFilteredEvents([]);
    } finally {
      setEventLoading(false);
    }
  };

  const requestLocationPermission = async (forAutoFilter: boolean = false) => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setLocationPermission(true);
        // Get current location
        try {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          setUserLocation(location);

          // If auto-filters are enabled, do reverse geocoding to get country
          if (forAutoFilter && autoLocationCountryFilter) {
            try {
              const geocodeResults = await Location.reverseGeocodeAsync({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
              });

              if (geocodeResults && geocodeResults.length > 0) {
                const result = geocodeResults[0];
                logger.debug('Reverse geocode result:', result);

                if (result.country) {
                  setDetectedCountry(result.country);
                }
              }
            } catch (geocodeError) {
              logger.error('Reverse geocoding failed:', geocodeError);
            }
          }
        } catch (locationError) {
          // Disable nearby filter if we can't get location
          if (!forAutoFilter) {
            setEventFilters(prev => ({ ...prev, nearbyFilter: false }));
            Alert.alert(
              'Location Error',
              'Unable to get your current location. Please try again or check your location settings.',
              [{ text: 'OK' }]
            );
          }
        }
      } else {
        setLocationPermission(false);
        if (!forAutoFilter) {
          Alert.alert(
            'Location Permission Required',
            'Location permission is needed to filter nearby events. Please enable location permission in settings.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Settings', onPress: () => Linking.openSettings() }
            ]
          );
          // Disable nearby filter if permission denied
          setEventFilters(prev => ({ ...prev, nearbyFilter: false }));
        }
      }
    } catch (error) {
      logger.error('Failed to get location permission:', error);
      setLocationPermission(false);
      if (!forAutoFilter) {
        setEventFilters(prev => ({ ...prev, nearbyFilter: false }));
      }
    }
  };

  // Calculate distance between two points in miles
  const getDistanceBetweenPoints = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const extractRegionsAndStates = (events: ExtendedEvent[]) => {
    const regions = new Set<string>();
    const states = new Set<string>();
    const countries = new Set<string>();
    const regionsMap: {[country: string]: Set<string>} = {};

    // Define what we consider as countries to exclude from regions
    const countryNames = new Set([
      'United States', 'Canada', 'Australia', 'United Kingdom', 'New Zealand',
      'South Africa', 'Germany', 'France', 'Netherlands', 'Belgium', 'Switzerland',
      'Austria', 'Italy', 'Spain', 'Portugal', 'Sweden', 'Norway', 'Denmark',
      'Finland', 'Poland', 'Czech Republic', 'Hungary', 'Romania', 'Bulgaria',
      'Croatia', 'Slovenia', 'Slovakia', 'Estonia', 'Latvia', 'Lithuania',
      'Ireland', 'Luxembourg', 'Malta', 'Cyprus', 'Greece', 'Turkey', 'Israel',
      'Japan', 'South Korea', 'Taiwan', 'Hong Kong', 'Singapore', 'Malaysia',
      'Thailand', 'Philippines', 'Indonesia', 'Vietnam', 'India', 'China',
      'Mexico', 'Brazil', 'Argentina', 'Chile', 'Colombia', 'Peru', 'Ecuador',
      'Uruguay', 'Paraguay', 'Bolivia', 'Venezuela', 'Guyana', 'Suriname',
      'French Guiana'
    ]);

    events.forEach(event => {
      if (event.location?.country) {
        countries.add(event.location.country);

        // Initialize country in regions map if not exists
        if (!regionsMap[event.location.country]) {
          regionsMap[event.location.country] = new Set<string>();
        }
      }

      if (event.location?.region && event.location?.country) {
        if (!countryNames.has(event.location.region)) {
          regions.add(event.location.region);
          // Map this region to its country
          regionsMap[event.location.country].add(event.location.region);
        }
      }

      if (event.location?.region && selectedProgram === 'Aerial Drone Competition') {
        if (!countryNames.has(event.location.region)) {
          states.add(event.location.region);
        }
      }
    });

    // Convert sets to arrays for regions by country
    const regionsByCountryMap: {[country: string]: string[]} = {};
    Object.keys(regionsMap).forEach(country => {
      regionsByCountryMap[country] = Array.from(regionsMap[country]).sort();
    });

    const regionOptions = [
      ...Array.from(regions).sort().map(region => region)
    ];

    const stateOptions = [
      ...Array.from(states).sort().map(state => state)
    ];

    const countryOptions = [
      ...Array.from(countries).sort().map(country => country)
    ];

    setAvailableRegions(regionOptions);
    setAvailableStates(stateOptions);
    setAvailableCountries(countryOptions);
    setRegionsByCountry(regionsByCountryMap);

    logger.debug('Extracted regions (excluding countries):', regionOptions.length);
    logger.debug('Extracted states:', stateOptions.length);
    logger.debug('Extracted countries:', countryOptions.length);
    logger.debug('Regions by country mapping:', regionsByCountryMap);
  };

  const applyFiltersAndPagination = (events: ExtendedEvent[], filters: typeof eventFilters, page: number = 1) => {
    // Safety check to ensure events is an array
    if (!events || !Array.isArray(events)) {
      logger.error('applyFiltersAndPagination called with invalid events:', events);
      setEvents([]);
      setFilteredEvents([]);
      return;
    }

    // Apply filters
    let filtered = events.filter(event => {
      // Date filter - client-side filtering
      // Show events from X days ago onwards (where X is the dateFilter setting)
      if (filters.dateFilter) {
        const eventStart = new Date(event.start);
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - settings.dateFilter);

        // Show events that start on or after the cutoff date
        // This includes past events (within the date range), current events, and future events
        if (eventStart < cutoffDate) {
          return false;
        }
      }

      // Level filter
      if (filters.level && event.level !== filters.level) {
        return false;
      }

      // Region filter
      if (filters.region && event.location?.region !== filters.region) {
        return false;
      }

      // State filter (for ADC)
      if (filters.state && event.location?.region !== filters.state) {
        return false;
      }

      // Country filter
      if (filters.country && event.location?.country !== filters.country) {
        return false;
      }

      // Live events only filter
      if (filters.liveEventsOnly) {
        const eventStatus = getEventStatus(event);
        logger.debug('Live filter check for', event.name, '- status:', eventStatus.status);
        if (eventStatus.status !== 'live') {
          return false;
        }
      }

      // Nearby filter (within specified range)
      if (filters.nearbyFilter && userLocation) {
        if (!event.location?.coordinates?.lat || !event.location?.coordinates?.lon) {
          return false; // Exclude events without coordinates when nearby filter is on
        }

        const distance = getDistanceBetweenPoints(
          userLocation.coords.latitude,
          userLocation.coords.longitude,
          event.location.coordinates.lat,
          event.location.coordinates.lon
        );

        if (distance > settings.nearbyRange) { // Use settings nearby range
          return false;
        }
      }

      return true;
    });

    // Apply text search
    if (eventQuery.trim()) {
      filtered = filtered.filter(event =>
        event.name.toLowerCase().includes(eventQuery.toLowerCase())
      );
    }

    setFilteredEvents(filtered);

    // Apply pagination
    const startIndex = (page - 1) * eventsPerPage;
    const endIndex = startIndex + eventsPerPage;
    const paginatedEvents = filtered.slice(0, endIndex); // Show from start up to current page

    setEvents(paginatedEvents);
    setCurrentPage(page);
    setHasMoreEvents(endIndex < filtered.length);

    logger.debug('Applied filters:', JSON.stringify(filters, null, 2));
    logger.debug('Filtered from', events.length, 'to', filtered.length, 'events, showing', paginatedEvents.length, '(page', page, ')');
  };

  const loadMoreEvents = () => {
    if (!isLoadingMore && hasMoreEvents && allEvents && allEvents.length > 0) {
      setIsLoadingMore(true);
      setTimeout(() => {
        applyFiltersAndPagination(allEvents, eventFilters, currentPage + 1);
        setIsLoadingMore(false);
      }, 500);
    }
  };

  const handleFiltersChange = (newFilters: typeof eventFilters) => {
    logger.debug('Filters changed from:', eventFilters, 'to:', newFilters);
    setEventFilters(newFilters);

    // Force immediate re-application of filters
    if (allEvents && allEvents.length > 0) {
      // The useEffect for userLocation will handle it once location is obtained
      if (newFilters.nearbyFilter && !userLocation) {
        logger.debug('Nearby filter enabled but no location yet, waiting for location...');
        return;
      }

      // Use a timeout to ensure the state update has been processed
      setTimeout(() => {
        applyFiltersAndPagination(allEvents, newFilters, 1);
      }, 0);
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
      setFilteredEvents(allEvents);
      setIsSearching(false);
      return;
    }

    // Debounce the actual search by 500ms for faster response
    searchTimeoutRef.current = setTimeout(() => {
      performSearch(searchText);
      setIsSearching(false);
    }, 500);
  }, [allEvents]);

  const performSearch = (query: string) => {
    const searchTerm = query.toLowerCase().trim();

    const filtered = allEvents.filter(event => {
      // Event name search
      const nameMatch = event.name?.toLowerCase().includes(searchTerm);

      // Event SKU search
      const skuMatch = event.sku?.toLowerCase().includes(searchTerm);

      let originalNameMatch = false;
      if (event.isLeagueSession) {
        const originalName = event.name.replace(/ - Session \d+$/, '');
        originalNameMatch = originalName.toLowerCase().includes(searchTerm);
      }

      return nameMatch || skuMatch || originalNameMatch;
    });

    setFilteredEvents(filtered);
  };

  // Use centralized utility functions for consistency across the app
  const formatEventDate = formatEventDateUtil;
  const getEventStatus = getEventStatusUtil;

  const openEventPage = (event: ExtendedEvent) => {
    // SKU is now preserved as the original for all events including league sessions
    const url = `https://www.robotevents.com/events/${event.sku}`;
    Linking.openURL(url);
  };

  const navigateToEventDetail = (event: ExtendedEvent) => {
    if (navigation) {
      const eventToPass = event.isLeagueSession ? {
        ...event,
        // Include session context for the detail screen
        displayName: event.name,
        sessionInfo: {
          sessionNumber: event.sessionNumber,
          totalSessions: event.totalSessions,
          isLeagueSession: true
        }
      } : event;

      navigation.navigate('EventMainView', { event: eventToPass });
    }
  };

  // Modern Event Card Component
  const renderEventCard = ({ item }: { item: ExtendedEvent }) => {
    const eventStatus = getEventStatus(item);

    return (
      <TouchableOpacity
        style={[styles.eventCard, {
          backgroundColor: settings.cardBackgroundColor,
          borderColor: settings.borderColor,
          shadowColor: settings.colorScheme === 'dark' ? '#FFFFFF' : '#000000'
        }]}
        onPress={() => navigateToEventDetail(item)}
      >
        <View style={styles.eventCardHeader}>
          <View style={styles.eventHeaderLeft}>
            <View style={[styles.eventStatusIndicator, { backgroundColor: eventStatus.color }]} />
            <View style={styles.eventInfo}>
              <Text style={[
                styles.eventName,
                {
                  color: eventStatus.status === 'cancelled' ? eventStatus.color : settings.textColor,
                  textDecorationLine: eventStatus.status === 'cancelled' ? 'line-through' : 'none',
                  textDecorationColor: eventStatus.status === 'cancelled' ? eventStatus.color : undefined
                }
              ]}>
                {item.name}
              </Text>
              <Text style={[styles.eventCode, { color: settings.secondaryTextColor }]}>
                {item.sku}
              </Text>
            </View>
          </View>
          <View style={styles.eventHeaderRight}>
            <TouchableOpacity
              style={styles.favoriteButton}
              onPress={async () => {
                try {
                  const identifier = item.uiId || item.id.toString();
                  const eventForFavorites = item as Event;

                  if (isEventFavorited(identifier)) {
                    await removeEvent(identifier);
                  } else {
                    await addEvent(eventForFavorites);
                  }
                } catch (error) {
                  logger.error('Failed to toggle event favorite:', error);
                  Alert.alert('Error', 'Failed to update favorite status');
                }
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name={isEventFavorited(item.uiId || item.id.toString()) ? "heart" : "heart-outline"}
                size={20}
                color={isEventFavorited(item.uiId || item.id.toString()) ? "#FF6B6B" : settings.iconColor}
              />
            </TouchableOpacity>
            <Ionicons name="chevron-forward" size={18} color={settings.iconColor} />
          </View>
        </View>

        <View style={styles.eventDetails}>
          {item.location && (
            <View style={styles.eventDetailRow}>
              <Ionicons name="location-outline" size={16} color={settings.iconColor} />
              <Text style={[styles.eventDetailText, { color: settings.textColor }]} numberOfLines={1}>
                {item.location.city}, {item.location.region}
              </Text>
            </View>
          )}

          <View style={styles.eventDetailRow}>
            <Ionicons name="calendar-outline" size={16} color={settings.iconColor} />
            <Text style={[styles.eventDetailText, { color: settings.textColor }]}>
              {formatEventDate(item.start)}
              {item.start !== item.end && ` - ${formatEventDate(item.end)}`}
            </Text>
          </View>

          <View style={styles.eventDetailRow}>
            <Ionicons
              name={eventStatus.status === 'upcoming' ? "time-outline" :
                    eventStatus.status === 'live' ? "radio-button-on" :
                    eventStatus.status === 'active' ? "calendar" :
                    eventStatus.status === 'cancelled' ? "close-circle" : "checkmark-circle-outline"}
              size={16}
              color={eventStatus.color}
            />
            <Text style={[styles.eventDetailText, { color: eventStatus.color }]}>
              {eventStatus.status === 'active' ? 'Active Period' : eventStatus.status.charAt(0).toUpperCase() + eventStatus.status.slice(1)}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Search Section */}
      <View style={[styles.sectionCard, {
        backgroundColor: settings.cardBackgroundColor,
        borderColor: settings.borderColor,
        shadowColor: settings.colorScheme === 'dark' ? '#FFFFFF' : '#000000'
      }]}>
        <View style={styles.searchHeader}>
          <Text style={[styles.sectionTitle, { color: settings.textColor }]}>Event Search</Text>
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setShowFiltersModal(true)}
          >
            <Ionicons name="filter" size={20} color={settings.buttonColor} />
            <Text style={[styles.filterText, { color: settings.buttonColor }]}>Filters</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.searchInput, {
          backgroundColor: settings.backgroundColor,
          borderColor: settings.borderColor
        }]}>
          <Ionicons name="search" size={20} color={settings.iconColor} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchTextInput, { color: settings.textColor }]}
            value={eventQuery}
            onChangeText={(text) => {
              setEventQuery(text);
              debouncedSearch(text);
            }}
            placeholder="Search by event name or SKU..."
            placeholderTextColor={settings.secondaryTextColor}
            returnKeyType="search"
            autoCorrect={false}
          />
          {eventQuery.length > 0 && !isSearching && (
            <TouchableOpacity
              onPress={() => {
                setEventQuery('');
                debouncedSearch('');
              }}
              style={styles.clearButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close-circle" size={20} color={settings.secondaryTextColor} />
            </TouchableOpacity>
          )}
          {isSearching && (
            <ActivityIndicator
              size="small"
              color={settings.buttonColor}
              style={styles.searchLoadingIndicator}
            />
          )}
        </View>
      </View>

      {/* Events Content - List or Map View */}
      <View style={styles.eventsContainer}>
        {eventLoading ? (
          <ScrollView style={styles.skeletonContainer} contentContainerStyle={styles.skeletonContentContainer}>
            {[...Array(8)].map((_, index) => (
              <EventCardSkeleton key={index} />
            ))}
          </ScrollView>
        ) : filteredEvents.length > 0 ? (
          viewMode === 'map' ? (
            <EventsMapView
              events={filteredEvents as Event[]}
              onEventPress={navigateToEventDetail}
            />
          ) : (
            // List View
            <View style={styles.eventsContainer}>
              <FlatList
                ref={flatListRef}
                data={filteredEvents}
                keyExtractor={(item) => item.uiId || item.id.toString()}
                renderItem={renderEventCard}
                onEndReached={loadMoreEvents}
                onEndReachedThreshold={0.1}
                ListFooterComponent={() => (
                  hasMoreEvents ? (
                    <View style={styles.loadMoreContainer}>
                      {isLoadingMore ? (
                        <ActivityIndicator size="small" color={settings.buttonColor} />
                      ) : (
                        <TouchableOpacity onPress={loadMoreEvents} style={styles.loadMoreButton}>
                          <Text style={[styles.loadMoreText, { color: '#FFFFFF' }]}>Load More</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ) : filteredEvents.length > 0 ? (
                    <Text style={[styles.endOfList, { color: settings.secondaryTextColor }]}>End of results</Text>
                  ) : (
                    <Text style={[styles.noEventsText, { color: settings.textColor }]}>No events found</Text>
                  )
                )}
                ItemSeparatorComponent={() => <View style={styles.cardSeparator} />}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.listContentContainer}
                onScroll={(event) => {
                  const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
                  setScrollY(contentOffset.y);
                  setContentHeight(contentSize.height);
                  setViewportHeight(layoutMeasurement.height);
                }}
                scrollEventThrottle={16}
              />
              <AnimatedScrollBar
                scrollY={scrollY}
                contentHeight={contentHeight}
                viewportHeight={viewportHeight}
                color={settings.buttonColor}
                enabled={settings.scrollBarEnabled && settings.scrollBarEventLookup}
                scrollViewRef={flatListRef}
              />
            </View>
          )
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={64} color={settings.iconColor} />
            <Text style={[styles.emptyStateTitle, { color: settings.textColor }]}>
              {eventQuery ? 'No Events Found' : 'No Events Available'}
            </Text>
            <Text style={[styles.emptyStateSubtitle, { color: settings.secondaryTextColor }]}>
              {eventQuery
                ? `No events match "${eventQuery}"`
                : 'Select a season to view available events'
              }
            </Text>
          </View>
        )}
      </View>

      {/* Event Filters Modal */}
      <EventFiltersModal
        visible={showFiltersModal}
        onClose={() => setShowFiltersModal(false)}
        filters={eventFilters}
        onFiltersChange={handleFiltersChange}
        seasons={seasons}
        selectedProgram={selectedProgram}
        availableRegions={availableRegions}
        availableStates={availableStates}
        availableCountries={availableCountries}
        regionsByCountry={regionsByCountry}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sectionCard: {
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  searchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  filterText: {
    marginLeft: 4,
    fontSize: 14,
    fontWeight: '500',
  },
  searchInput: {
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
  eventsContainer: {
    flex: 1,
  },
  eventsCount: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 8,
  },
  loadMoreContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  loadMoreButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  endOfList: {
    textAlign: 'center',
    padding: 20,
    fontSize: 14,
  },
  noEventsText: {
    textAlign: 'center',
    padding: 40,
    fontSize: 16,
  },
  eventCard: {
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  eventCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  eventHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  eventStatusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
    marginTop: 2,
  },
  eventInfo: {
    flex: 1,
  },
  eventName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 0,
    lineHeight: 18,
  },
  eventCode: {
    fontSize: 12,
    fontWeight: '500',
  },
  eventHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  favoriteButton: {
    padding: 4,
  },
  eventDetails: {
    padding: 12,
    gap: 6,
  },
  eventDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eventDetailText: {
    fontSize: 13,
    flex: 1,
  },
  skeletonContainer: {
    flex: 1,
  },
  skeletonContentContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '500',
  },
  loadMoreText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cardSeparator: {
    height: 8,
  },
  listContentContainer: {
    paddingBottom: 20,
  },
  emptyState: {
    flex: 1,
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

export default EventLookup;