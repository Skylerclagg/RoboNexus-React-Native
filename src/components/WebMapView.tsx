import React from 'react';
import { createLogger } from '../utils/logger';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../contexts/SettingsContext';
import { useFavorites } from '../contexts/FavoritesContext';
import { Event } from '../types';

const logger = createLogger('WebMapView');

interface WebMapViewProps {
  events: Event[];
  onEventPress?: (event: Event) => void;
}

/**
 * Web-compatible map view that displays events as a list
 * since web doesn't support react-native-maps
 */
const WebMapView: React.FC<WebMapViewProps> = ({
  events,
  onEventPress,
}) => {
  const settings = useSettings();
  const { addEvent, removeEvent, isEventFavorited } = useFavorites();

  // Filter events that have location coordinates
  const eventsWithLocation = events.filter(event =>
    event.location?.coordinates?.lat && event.location?.coordinates?.lon
  );

  // Group events by location for better organization
  const eventsByLocation = eventsWithLocation.reduce((acc, event) => {
    const locationKey = `${event.location?.city}, ${event.location?.region}`;
    if (!acc[locationKey]) {
      acc[locationKey] = [];
    }
    acc[locationKey].push(event);
    return acc;
  }, {} as Record<string, Event[]>);

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

  const getEventLevelColor = (level: string): string => {
    switch (level) {
      case 'World':
        return '#FFD700'; // Gold
      case 'National':
        return '#FF6B6B'; // Red
      case 'Regional':
        return '#9B59B6'; // Purple
      case 'State':
        return '#4ECDC4'; // Teal
      case 'Signature':
        return '#45B7D1'; // Blue
      case 'Other':
        return '#95A5A6'; // Gray
      default:
        return settings.buttonColor;
    }
  };

  const formatEventDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const openInMaps = (event: Event) => {
    if (event.location?.coordinates) {
      const { lat, lon } = event.location.coordinates;
      const url = `https://www.google.com/maps?q=${lat},${lon}`;
      window.open(url, '_blank');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: settings.backgroundColor }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: settings.cardBackgroundColor, borderBottomColor: settings.borderColor }]}>
        <Text style={[styles.headerTitle, { color: settings.textColor }]}>
          Events Map View
        </Text>
        <Text style={[styles.headerSubtitle, { color: settings.secondaryTextColor }]}>
          {eventsWithLocation.length} events in {Object.keys(eventsByLocation).length} locations
        </Text>
        <Text style={[styles.webNotice, { color: settings.secondaryTextColor }]}>
          📍 Interactive map view available on mobile app
        </Text>
      </View>

      {/* Legend */}
      <View style={[styles.legend, { backgroundColor: settings.cardBackgroundColor, borderColor: settings.borderColor }]}>
        <Text style={[styles.legendTitle, { color: settings.textColor }]}>Event Levels</Text>
        <View style={styles.legendItems}>
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#FFD700' }]} />
              <Text style={[styles.legendText, { color: settings.textColor }]}>World</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#FF6B6B' }]} />
              <Text style={[styles.legendText, { color: settings.textColor }]}>National</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#9B59B6' }]} />
              <Text style={[styles.legendText, { color: settings.textColor }]}>Regional</Text>
            </View>
          </View>
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#4ECDC4' }]} />
              <Text style={[styles.legendText, { color: settings.textColor }]}>State</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#45B7D1' }]} />
              <Text style={[styles.legendText, { color: settings.textColor }]}>Signature</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#95A5A6' }]} />
              <Text style={[styles.legendText, { color: settings.textColor }]}>Other</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Events List */}
      <ScrollView style={styles.eventsList} showsVerticalScrollIndicator={false}>
        {Object.entries(eventsByLocation).map(([location, locationEvents]) => (
          <View key={location} style={[styles.locationGroup, { backgroundColor: settings.cardBackgroundColor, borderColor: settings.borderColor }]}>
            <View style={styles.locationHeader}>
              <View style={styles.locationInfo}>
                <Ionicons name="location" size={16} color={settings.buttonColor} />
                <Text style={[styles.locationTitle, { color: settings.textColor }]}>{location}</Text>
                {locationEvents.length > 1 && (
                  <View style={[styles.countBadge, { backgroundColor: settings.buttonColor }]}>
                    <Text style={styles.countBadgeText}>{locationEvents.length}</Text>
                  </View>
                )}
              </View>
              {locationEvents[0].location?.coordinates && (
                <TouchableOpacity
                  style={[styles.mapsButton, { backgroundColor: settings.buttonColor }]}
                  onPress={() => openInMaps(locationEvents[0])}
                >
                  <Ionicons name="map" size={14} color="#FFFFFF" />
                  <Text style={styles.mapsButtonText}>Maps</Text>
                </TouchableOpacity>
              )}
            </View>

            {locationEvents.map((event) => (
              <View key={event.id} style={[styles.eventCard, { backgroundColor: settings.backgroundColor, borderColor: settings.borderColor }]}>
                <View style={styles.eventHeader}>
                  <View style={styles.eventInfo}>
                    <View style={styles.eventTitleRow}>
                      <View style={[styles.levelIndicator, { backgroundColor: getEventLevelColor(event.level) }]} />
                      <Text style={[styles.eventTitle, { color: settings.textColor }]} numberOfLines={2}>
                        {event.name}
                      </Text>
                    </View>
                    <Text style={[styles.eventLevel, { color: settings.secondaryTextColor }]}>
                      {event.level} Level
                    </Text>
                    <View style={styles.eventDetails}>
                      <View style={styles.eventDetailItem}>
                        <Ionicons name="calendar-outline" size={12} color={settings.secondaryTextColor} />
                        <Text style={[styles.eventDate, { color: settings.secondaryTextColor }]}>
                          {formatEventDate(event.start)}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.eventActions}>
                    <TouchableOpacity
                      style={styles.favoriteButton}
                      onPress={() => toggleEventFavorite(event)}
                    >
                      <Ionicons
                        name={isEventFavorited(event.sku) ? 'heart' : 'heart-outline'}
                        size={20}
                        color={isEventFavorited(event.sku) ? '#FF6B6B' : settings.secondaryTextColor}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.viewEventButton, { backgroundColor: settings.buttonColor }]}
                      onPress={() => onEventPress?.(event)}
                    >
                      <Text style={styles.viewEventButtonText}>View</Text>
                      <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))}
          </View>
        ))}

        {/* Events without location */}
        {events.length > eventsWithLocation.length && (
          <View style={[styles.locationGroup, { backgroundColor: settings.cardBackgroundColor, borderColor: settings.borderColor }]}>
            <View style={styles.locationHeader}>
              <View style={styles.locationInfo}>
                <Ionicons name="help-circle" size={16} color={settings.secondaryTextColor} />
                <Text style={[styles.locationTitle, { color: settings.textColor }]}>Location Not Available</Text>
                <View style={[styles.countBadge, { backgroundColor: settings.secondaryTextColor }]}>
                  <Text style={styles.countBadgeText}>{events.length - eventsWithLocation.length}</Text>
                </View>
              </View>
            </View>
            <Text style={[styles.noLocationText, { color: settings.secondaryTextColor }]}>
              These events don't have coordinate data and can't be displayed on a map.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    marginBottom: 8,
  },
  webNotice: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  legend: {
    margin: 16,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
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
  eventsList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  locationGroup: {
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  locationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 12,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  locationTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  countBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  mapsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  mapsButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  eventCard: {
    marginHorizontal: 12,
    marginBottom: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  eventInfo: {
    flex: 1,
    marginRight: 12,
  },
  eventTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  levelIndicator: {
    width: 4,
    height: 20,
    borderRadius: 2,
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  eventLevel: {
    fontSize: 12,
    marginBottom: 4,
  },
  eventDetails: {
    gap: 2,
  },
  eventDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  eventDate: {
    fontSize: 12,
  },
  eventActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  favoriteButton: {
    padding: 4,
  },
  viewEventButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  viewEventButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  noLocationText: {
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    fontStyle: 'italic',
  },
});

export default WebMapView;