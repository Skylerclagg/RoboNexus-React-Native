import React from 'react';
import { createLogger } from '../utils/logger';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../contexts/SettingsContext';
import { useFavorites } from '../contexts/FavoritesContext';
import { Event } from '../types';

const logger = createLogger('EventsMapView.web');

interface EventsMapViewProps {
  events: Event[];
  onEventPress?: (event: Event) => void;
  initialRegion?: any;
}

const EventsMapView: React.FC<EventsMapViewProps> = ({
  events,
  onEventPress,
  initialRegion,
}) => {
  const settings = useSettings();
  const { addEvent, removeEvent, isEventFavorited } = useFavorites();

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

  const formatEventDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const eventMarkers = events.filter(event =>
    event.location?.coordinates?.lat && event.location?.coordinates?.lon
  );

  return (
    <View style={[styles.container, { backgroundColor: settings.colorScheme === 'dark' ? '#000' : '#f5f5f5' }]}>
      <View style={[styles.webMapPlaceholder, { backgroundColor: settings.colorScheme === 'dark' ? '#1C1C1E' : '#FFFFFF' }]}>
        <Ionicons name="map-outline" size={48} color={settings.colorScheme === 'dark' ? '#8E8E93' : '#666'} />
        <Text style={[styles.webMapText, { color: settings.textColor }]}>
          Map View
        </Text>
        <Text style={[styles.webMapSubtext, { color: settings.secondaryTextColor }]}>
          Maps are not available in web version
        </Text>
        <Text style={[styles.webMapSubtext, { color: settings.secondaryTextColor }]}>
          {eventMarkers.length} events with coordinates
        </Text>
      </View>

      {/* Show events list instead */}
      <View style={styles.eventsList}>
        {eventMarkers.slice(0, 10).map((event) => (
          <View key={event.sku} style={[styles.eventItem, { backgroundColor: settings.colorScheme === 'dark' ? '#1C1C1E' : '#FFFFFF' }]}>
            <View style={styles.eventInfo}>
              <Text style={[styles.eventTitle, { color: settings.textColor }]} numberOfLines={2}>
                {event.name}
              </Text>
              <Text style={[styles.eventLevel, { color: settings.secondaryTextColor }]}>
                {event.level} Level
              </Text>
              <View style={styles.eventDetails}>
                <Text style={[styles.eventLocation, { color: settings.secondaryTextColor }]}>
                  {event.location?.city}, {event.location?.region}
                </Text>
                <Text style={[styles.eventDate, { color: settings.secondaryTextColor }]}>
                  {formatEventDate(event.start)}
                </Text>
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
                  color={isEventFavorited(event.sku) ? settings.errorColor : settings.secondaryTextColor}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.viewButton, { backgroundColor: settings.buttonColor }]}
                onPress={() => onEventPress?.(event)}
              >
                <Text style={styles.viewButtonText}>View</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
        {eventMarkers.length > 10 && (
          <Text style={[styles.moreEventsText, { color: settings.secondaryTextColor }]}>
            and {eventMarkers.length - 10} more events...
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  webMapPlaceholder: {
    height: 200,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  webMapText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 8,
  },
  webMapSubtext: {
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },
  eventsList: {
    flex: 1,
  },
  eventItem: {
    flexDirection: 'row',
    padding: 16,
    marginBottom: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  eventInfo: {
    flex: 1,
    marginRight: 12,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  eventLevel: {
    fontSize: 14,
    marginBottom: 8,
  },
  eventDetails: {
    gap: 4,
  },
  eventLocation: {
    fontSize: 13,
  },
  eventDate: {
    fontSize: 13,
  },
  eventActions: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  favoriteButton: {
    padding: 8,
  },
  viewButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  viewButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  moreEventsText: {
    textAlign: 'center',
    fontSize: 14,
    fontStyle: 'italic',
    marginTop: 16,
  },
});

export default EventsMapView;