import React, { useState, useEffect, useRef } from 'react';
import { createLogger } from '../utils/logger';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
  Modal,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../contexts/SettingsContext';

const logger = createLogger('EventsMapView');
import { useFavorites } from '../contexts/FavoritesContext';
import { Event } from '../types';
import { isWeb, location as webLocation } from '../utils/webCompatibility';
import WebMapView from './WebMapView';

interface EventsMapViewProps {
  events: Event[];
  onEventPress?: (event: Event) => void;
  initialRegion?: any; // Region type from react-native-maps, made generic for web compatibility
}

interface EventMarker extends Event {
  coordinate?: {
    latitude: number;
    longitude: number;
  };
}

interface EventCluster {
  id: string;
  coordinate: {
    latitude: number;
    longitude: number;
  };
  events: Event[];
  count: number;
}


const { width, height } = Dimensions.get('window');

const EventsMapView: React.FC<EventsMapViewProps> = ({
  events,
  onEventPress,
  initialRegion,
}) => {
  const settings = useSettings();
  const { addEvent, removeEvent, isEventFavorited } = useFavorites();

  // All state hooks
  const [MapView, setMapView] = useState<any>(null);
  const [Marker, setMarker] = useState<any>(null);
  const [Callout, setCallout] = useState<any>(null);
  const [Location, setLocation] = useState<any>(null);
  const [userLocation, setUserLocation] = useState<any>(null);
  const [locationPermission, setLocationPermission] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const defaultRegion = initialRegion || {
    latitude: 39.8283, // Center of US
    longitude: -98.5795,
    latitudeDelta: 50,
    longitudeDelta: 50,
  };
  const [mapRegion, setMapRegion] = useState<any>(defaultRegion);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [selectedEventIndex, setSelectedEventIndex] = useState<{ [clusterId: string]: number }>({});
  const [selectedCluster, setSelectedCluster] = useState<EventCluster | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentZoomLevel, setCurrentZoomLevel] = useState<number>(defaultRegion.latitudeDelta);

  // All refs
  const mapRef = useRef<any>(null);

  // Helper functions
  const getClusteringLevel = (zoomLevel: number): 'country' | 'region' | 'city' | 'venue' | 'individual' => {
    // Determine clustering level based on zoom
    if (zoomLevel >= 20) return 'country';     // Very zoomed out - cluster by country
    if (zoomLevel >= 5) return 'region';       // Zoomed out - cluster by state/region
    if (zoomLevel >= 1) return 'city';         // Medium zoom - cluster by city
    if (zoomLevel >= 0.2) return 'venue';      // Zoomed in - cluster by venue/exact location
    return 'individual'; // Very zoomed in - show individual events
  };

  const clusterEvents = (events: EventMarker[], zoomLevel: number): EventCluster[] => {
    const clusteringLevel = getClusteringLevel(zoomLevel);
    logger.debug(`[Clustering] Processing ${events.length} events with zoom level ${zoomLevel.toFixed(3)} using ${clusteringLevel} clustering`);

    // Group events by the appropriate geographic level
    const groups: { [key: string]: EventMarker[] } = {};

    events.forEach((event) => {
      let groupKey: string;

      switch (clusteringLevel) {
        case 'country':
          groupKey = event.location?.country || 'Unknown Country';
          break;
        case 'region':
          groupKey = `${event.location?.region || 'Unknown Region'}, ${event.location?.country || 'Unknown Country'}`;
          break;
        case 'city':
          groupKey = `${event.location?.city || 'Unknown City'}, ${event.location?.region || 'Unknown Region'}`;
          break;
        case 'venue':
          groupKey = `${event.coordinate!.latitude.toFixed(6)}-${event.coordinate!.longitude.toFixed(6)}`;
          break;
        case 'individual':
        default:
          groupKey = `individual-${event.id}`;
          break;
      }

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(event);
    });

    // Convert groups to clusters
    const clusters: EventCluster[] = Object.entries(groups).map(([groupKey, groupEvents]) => {
      // Calculate center coordinate for the cluster
      const centerLat = groupEvents.reduce((sum, event) => sum + event.coordinate!.latitude, 0) / groupEvents.length;
      const centerLon = groupEvents.reduce((sum, event) => sum + event.coordinate!.longitude, 0) / groupEvents.length;

      return {
        id: `cluster-${clusteringLevel}-${groupKey}-${groupEvents.length}-z${zoomLevel.toFixed(3)}`,
        coordinate: {
          latitude: centerLat,
          longitude: centerLon,
        },
        events: groupEvents,
        count: groupEvents.length,
      };
    });

    logger.debug(`[Clustering] Created ${clusters.length} ${clusteringLevel}-level clusters from ${events.length} events`);
    return clusters;
  };


  // Process events to extract coordinates
  const eventMarkers: EventMarker[] = events
    .filter(event => {
      // Check if event has location coordinates
      return event.location?.coordinates?.lat && event.location?.coordinates?.lon;
    })
    .map(event => ({
      ...event,
      coordinate: {
        latitude: event.location!.coordinates!.lat,
        longitude: event.location!.coordinates!.lon,
      }
    }));

  const eventClusters = clusterEvents(eventMarkers, currentZoomLevel);

  const requestLocationPermission = async () => {
    if (!Location) return;

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setLocationPermission(true);
      } else {
        setLocationPermission(false);
      }
    } catch (error) {
      logger.error('Failed to get location permission:', error);
      setLocationPermission(false);
    }
  };

  const fitToEvents = () => {
    if (eventClusters.length === 0 || !mapRef.current) return;

    if (eventClusters.length === 1) {
      const cluster = eventClusters[0];
      mapRef.current.animateToRegion({
        latitude: cluster.coordinate.latitude,
        longitude: cluster.coordinate.longitude,
        latitudeDelta: 2, // Larger delta for better context
        longitudeDelta: 2,
      }, 1000);
    } else {
      mapRef.current.fitToCoordinates(
        eventClusters.map(cluster => cluster.coordinate),
        {
          edgePadding: {
            top: 100,
            right: 100,
            bottom: 150, // Extra bottom padding for controls
            left: 100,
          },
          animated: true,
        }
      );
    }
  };

  // All effects
  useEffect(() => {
    // Load native dependencies only on mobile
    const loadNativeComponents = async () => {
      if (isWeb) {
        // On web, we don't need react-native-maps, use our webCompatibility location
        setLocation(webLocation);
        return;
      }

      try {
        const mapComponents = await import('react-native-maps');

        setMapView(() => mapComponents.default);
        setMarker(() => mapComponents.Marker);
        setCallout(() => mapComponents.Callout);
        // Use our webCompatibility location module instead of expo-location directly
        setLocation(webLocation);
      } catch (error) {
        logger.error('Failed to load react-native-maps:', error);
        setLoadError('Failed to load map components. Map view may not be available on this device.');
      }
    };

    loadNativeComponents();
  }, []);

  useEffect(() => {
    const requestLocationPermission = async () => {
      try {
        const { status } = await Location?.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          setLocationPermission(true);
        } else {
          setLocationPermission(false);
        }
      } catch (error) {
        logger.error('Failed to get location permission:', error);
        setLocationPermission(false);
      }
    };

    if (Location) {
      requestLocationPermission();
    }
  }, [Location]);

  useEffect(() => {
    if (events.length > 0 && !initialRegion && !hasInitialized) {
      setHasInitialized(true);
      // Add a small delay to ensure map is ready
      setTimeout(() => {
        fitToEvents();
      }, 500);
    }
  }, [events, hasInitialized, initialRegion]);

  if (isWeb) {
    return <WebMapView events={events} onEventPress={onEventPress} />;
  }

  // On Android, show a list view instead of map (to avoid Google Maps API key requirement)
  if (Platform.OS === 'android') {
    return (
      <View style={[styles.container, { backgroundColor: settings.backgroundColor }]}>
        <View style={[styles.androidMapDisabled, { backgroundColor: settings.cardBackgroundColor }]}>
          <Ionicons name="map-outline" size={48} color={settings.secondaryTextColor} />
          <Text style={[styles.androidMapTitle, { color: settings.textColor }]}>
            Map View (Android)
          </Text>
          <Text style={[styles.androidMapMessage, { color: settings.secondaryTextColor }]}>
            Map view requires Google Maps API setup. Showing event list instead.
          </Text>
        </View>

        <ScrollView style={styles.androidEventList} showsVerticalScrollIndicator={false}>
          {eventMarkers.map((event) => (
            <TouchableOpacity
              key={event.id}
              style={[
                styles.eventCard,
                {
                  backgroundColor: settings.colorScheme === 'dark' ? '#1C1C1E' : '#FFFFFF',
                  borderColor: settings.borderColor,
                }
              ]}
              onPress={() => onEventPress?.(event)}
            >
              <View style={styles.eventHeader}>
                <View style={styles.eventInfo}>
                  <Text style={[styles.eventTitle, { color: settings.textColor }]} numberOfLines={2}>
                    {event.name}
                  </Text>
                  <Text style={[styles.eventLevel, { color: getMarkerColor(event) }]}>
                    {event.level} Level
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.favoriteButton}
                  onPress={() => toggleEventFavorite(event)}
                >
                  <Ionicons
                    name={isEventFavorited(event.sku) ? 'heart' : 'heart-outline'}
                    size={24}
                    color={isEventFavorited(event.sku) ? settings.errorColor : settings.textColor}
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.eventDetails}>
                <View style={styles.eventDetailRow}>
                  <Ionicons name="location-outline" size={16} color={settings.textColor} />
                  <Text style={[styles.eventDetailText, { color: settings.textColor }]}>
                    {event.location?.city}, {event.location?.region}
                  </Text>
                </View>

                <View style={styles.eventDetailRow}>
                  <Ionicons name="calendar-outline" size={16} color={settings.textColor} />
                  <Text style={[styles.eventDetailText, { color: settings.textColor }]}>
                    {formatEventDate(event.start)}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  }


  if (loadError) {
    return (
      <View style={[styles.container, { backgroundColor: settings.backgroundColor }]}>
        <View style={styles.loadingContainer}>
          <Ionicons name="map-outline" size={64} color={settings.secondaryTextColor} />
          <Text style={[styles.loadingText, { color: settings.textColor, marginTop: 16, textAlign: 'center', paddingHorizontal: 32 }]}>
            Map view is not available
          </Text>
          <Text style={[styles.errorText, { color: settings.secondaryTextColor, marginTop: 8, textAlign: 'center', paddingHorizontal: 32 }]}>
            {loadError}
          </Text>
        </View>
      </View>
    );
  }

  if (!Location || !MapView || !Marker || !Callout) {
    return (
      <View style={[styles.container, { backgroundColor: settings.backgroundColor }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={settings.buttonColor} />
          <Text style={[styles.loadingText, { color: settings.textColor }]}>Loading map...</Text>
        </View>
      </View>
    );
  }

  const centerOnUserLocation = async () => {
    if (!locationPermission) {
      await requestLocationPermission();
      if (!locationPermission) {
        Alert.alert(
          'Location Permission Required',
          'Please enable location permission to use this feature.',
          [{ text: 'OK' }]
        );
        return;
      }
    }

    try {
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setUserLocation(position);

      if (mapRef.current) {
        mapRef.current.animateToRegion({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          latitudeDelta: 0.5, // Smaller delta for closer zoom
          longitudeDelta: 0.5,
        }, 1000); // 1 second animation
      }
    } catch (error) {
      logger.error('Failed to get current location:', error);
      Alert.alert('Error', 'Failed to get your current location. Make sure location services are enabled.');
    }
  };

  const toggleEventFavorite = async (event: Event) => {
    try {
      if (isEventFavorited(event.sku)) {
        await removeEvent(event.sku);
      } else {
        await addEvent(event);
      }
    } catch (error) {
      logger.error('Failed to toggle event favorite:', error);
      Alert.alert('Error', 'Failed to update favorite');
    }
  };

  const getMarkerColor = (event: Event): string => {
    // Color code markers based on event level
    switch (event.level) {
      case 'World':
        return settings.worldEventColor;
      case 'National':
        return settings.nationalEventColor;
      case 'Regional':
        return settings.regionalEventColor;
      case 'State':
        return settings.stateEventColor;
      case 'Signature':
        return settings.signatureEventColor;
      case 'Other':
        return settings.otherEventColor;
      default:
        return settings.buttonColor; // Use app theme color
    }
  };

  const getClusterColor = (cluster: EventCluster): string => {
    const levelPriority = {
      'World': 6,
      'National': 5,
      'Regional': 4,
      'State': 3,
      'Signature': 2,
      'Other': 1,
    };

    const highestLevel = cluster.events.reduce((highest, event) => {
      const currentPriority = levelPriority[event.level as keyof typeof levelPriority] || 0;
      const highestPriority = levelPriority[highest as keyof typeof levelPriority] || 0;
      return currentPriority > highestPriority ? event.level : highest;
    }, cluster.events[0].level);

    return getMarkerColor({ level: highestLevel } as Event);
  };


  const formatEventDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={Platform.OS === 'ios' ? undefined : null}
        style={styles.map}
        initialRegion={mapRegion}
        showsUserLocation={locationPermission}
        showsMyLocationButton={false}
        toolbarEnabled={false}
        zoomEnabled={true}
        scrollEnabled={true}
        pitchEnabled={false}
        rotateEnabled={false}
        onPress={() => {
          logger.debug('Map pressed');
          if (modalVisible) {
            setModalVisible(false);
            setSelectedCluster(null);
          }
        }}
        onRegionChangeComplete={(region: any) => {
          // Update zoom level for dynamic clustering
          // latitudeDelta represents the zoom level (smaller = more zoomed in)
          logger.debug('Map zoom changed - latitudeDelta:', region.latitudeDelta, 'clustering level:', getClusteringLevel(region.latitudeDelta));
          setCurrentZoomLevel(region.latitudeDelta);
        }}
      >
        {eventClusters.map((cluster) => (
          <Marker
            key={cluster.id}
            coordinate={cluster.coordinate}
            onPress={(markerEvent: any) => {
              logger.debug('Marker pressed:', cluster.count === 1 ? cluster.events[0].name : `${cluster.count} events`);
              markerEvent.stopPropagation();
              setSelectedCluster(cluster);
              setModalVisible(true);
            }}
            tracksViewChanges={false}
          >
            {cluster.count === 1 ? (
              // Single event - use standard pin
              <View style={[styles.singlePin, { backgroundColor: getClusterColor(cluster) }]} />
            ) : (
              // Multi-event cluster - custom view with count
              <View style={[styles.clusterPin, { backgroundColor: getClusterColor(cluster) }]}>
                <Text style={styles.clusterPinText}>{cluster.count}</Text>
              </View>
            )}
          </Marker>
        ))}
      </MapView>

      {/* Control buttons */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.controlButton, { backgroundColor: settings.colorScheme === 'dark' ? '#1C1C1E' : '#FFFFFF' }]}
          onPress={centerOnUserLocation}
        >
          <Ionicons
            name="locate"
            size={20}
            color={settings.textColor}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, { backgroundColor: settings.colorScheme === 'dark' ? '#1C1C1E' : '#FFFFFF' }]}
          onPress={fitToEvents}
        >
          <Ionicons
            name="contract-outline"
            size={20}
            color={settings.textColor}
          />
        </TouchableOpacity>
      </View>

      {/* Legend */}
      <View style={[styles.legend, { backgroundColor: settings.colorScheme === 'dark' ? '#1C1C1E' : '#FFFFFF' }]}>
        <Text style={[styles.legendTitle, { color: settings.textColor }]}>Event Levels</Text>
        <View style={styles.legendItems}>
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: settings.worldEventColor }]} />
              <Text style={[styles.legendText, { color: settings.textColor }]}>World</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: settings.nationalEventColor }]} />
              <Text style={[styles.legendText, { color: settings.textColor }]}>National</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: settings.regionalEventColor }]} />
              <Text style={[styles.legendText, { color: settings.textColor }]}>Regional</Text>
            </View>
          </View>
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: settings.stateEventColor }]} />
              <Text style={[styles.legendText, { color: settings.textColor }]}>State</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: settings.signatureEventColor }]} />
              <Text style={[styles.legendText, { color: settings.textColor }]}>Signature</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: settings.otherEventColor }]} />
              <Text style={[styles.legendText, { color: settings.textColor }]}>Other</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Events count */}
      <View style={[styles.eventCount, { backgroundColor: settings.colorScheme === 'dark' ? '#1C1C1E' : '#FFFFFF' }]}>
        <Text style={[styles.eventCountText, { color: settings.textColor }]}>
          {eventMarkers.length} events in {eventClusters.length} {eventClusters.length === 1 ? 'location' : 'locations'}
        </Text>
        {events.length > eventMarkers.length && (
          <Text style={[styles.eventCountSubtext, { color: settings.secondaryTextColor }]}>
            {events.length - eventMarkers.length} events without coordinates
          </Text>
        )}
      </View>

      {/* Event Selection Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setModalVisible(false);
          setSelectedCluster(null);
        }}
      >
        <View style={[styles.modalContainer, { backgroundColor: settings.backgroundColor }]}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: settings.textColor }]}>
              {selectedCluster?.count === 1 ? 'Event Details' : `${selectedCluster?.count} Events at this Location`}
            </Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => {
                setModalVisible(false);
                setSelectedCluster(null);
              }}
            >
              <Ionicons name="close" size={24} color={settings.textColor} />
            </TouchableOpacity>
          </View>

          {/* Modal Content */}
          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {selectedCluster?.events.map((event) => (
              <View
                key={event.id}
                style={[
                  styles.eventCard,
                  {
                    backgroundColor: settings.colorScheme === 'dark' ? '#1C1C1E' : '#FFFFFF',
                    borderColor: settings.borderColor,
                  }
                ]}
              >
                {/* Event Header */}
                <View style={styles.eventHeader}>
                  <View style={styles.eventInfo}>
                    <Text style={[styles.eventTitle, { color: settings.textColor }]} numberOfLines={2}>
                      {event.name}
                    </Text>
                    <Text style={[styles.eventLevel, { color: getMarkerColor(event) }]}>
                      {event.level} Level
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.favoriteButton}
                    onPress={() => toggleEventFavorite(event)}
                  >
                    <Ionicons
                      name={isEventFavorited(event.sku) ? 'heart' : 'heart-outline'}
                      size={24}
                      color={isEventFavorited(event.sku) ? settings.errorColor : settings.textColor}
                    />
                  </TouchableOpacity>
                </View>

                {/* Event Details */}
                <View style={styles.eventDetails}>
                  <View style={styles.eventDetailRow}>
                    <Ionicons name="location-outline" size={16} color={settings.textColor} />
                    <Text style={[styles.eventDetailText, { color: settings.textColor }]}>
                      {event.location?.city}, {event.location?.region}
                    </Text>
                  </View>

                  <View style={styles.eventDetailRow}>
                    <Ionicons name="calendar-outline" size={16} color={settings.textColor} />
                    <Text style={[styles.eventDetailText, { color: settings.textColor }]}>
                      {formatEventDate(event.start)}
                    </Text>
                  </View>
                </View>

                {/* View Event Button */}
                <TouchableOpacity
                  style={[styles.viewEventButtonModal, { backgroundColor: settings.buttonColor }]}
                  onPress={() => {
                    logger.debug('View event pressed:', event.name);
                    onEventPress?.(event);
                    setModalVisible(false);
                    setSelectedCluster(null);
                  }}
                >
                  <Text style={styles.viewEventButtonTextModal}>View Event Details</Text>
                  <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  errorText: {
    fontSize: 14,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  controls: {
    position: 'absolute',
    top: 50,
    right: 16,
    gap: 8,
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  legend: {
    position: 'absolute',
    bottom: 80,
    left: 16,
    right: 16,
    padding: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  legendTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  legendItems: {
    gap: 8,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
  },
  eventCount: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    padding: 8,
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  eventCountText: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  eventCountSubtext: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 2,
  },
  callout: {
    width: 250,
  },
  calloutContainer: {
    padding: 8,
  },
  calloutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  calloutTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000', // This is OK as callouts are always white background
    flex: 1,
    marginRight: 8,
  },
  favoriteButton: {
    padding: 4,
  },
  calloutLevel: {
    fontSize: 12,
    color: '#666', // This is OK as callouts are always white background
    marginBottom: 4,
  },
  calloutInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  calloutLocation: {
    fontSize: 12,
    color: '#666', // This is OK as callouts are always white background
    flex: 1,
  },
  calloutDate: {
    fontSize: 12,
    color: '#666', // This is OK as callouts are always white background
  },
  calloutTap: {
    fontSize: 11,
    color: '#999', // This is OK as callouts are always white background
    textAlign: 'center',
    marginTop: 4,
    fontStyle: 'italic',
  },
  navButton: {
    padding: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 16,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eventCounter: {
    flex: 1,
    alignItems: 'center',
  },
  eventCounterText: {
    fontSize: 12,
    color: '#666', // This is OK as callouts are always white background
    fontWeight: '500',
  },
  calloutActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  viewEventButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  viewEventButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  calloutTapArea: {
    paddingVertical: 4,
  },
  clusterEvents: {
    gap: 8,
  },
  clusterEventItem: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
    marginVertical: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  clusterEventItemPressed: {
    backgroundColor: '#e3f2fd',
    borderLeftColor: '#1976d2',
  },
  clusterEventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  clusterEventInfo: {
    flex: 1,
    marginRight: 8,
  },
  clusterEventActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clusterEventTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#000', // This is OK as callouts are always white background
    marginBottom: 2,
  },
  clusterFavoriteButton: {
    padding: 4,
  },
  clusterEventLevel: {
    fontSize: 11,
    color: '#666', // This is OK as callouts are always white background
  },
  clusterBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  clusterBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  // New pin styles
  singlePin: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  clusterPin: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clusterPinText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    paddingTop: 50,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    flex: 1,
  },
  closeButton: {
    padding: 8,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  eventCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  eventInfo: {
    flex: 1,
    marginRight: 12,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  eventLevel: {
    fontSize: 14,
    fontWeight: '500',
  },
  eventDetails: {
    marginBottom: 16,
  },
  eventDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  eventDetailText: {
    fontSize: 16,
    marginLeft: 8,
  },
  viewEventButtonModal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  viewEventButtonTextModal: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  androidMapDisabled: {
    padding: 20,
    margin: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  androidMapTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 12,
  },
  androidMapMessage: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  androidEventList: {
    flex: 1,
    paddingHorizontal: 16,
  },
});

export default EventsMapView;