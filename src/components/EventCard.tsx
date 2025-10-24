/**
 * Reusable Event Card Component
 *
 * Modern event card design used across multiple screens (EventLookup, TeamInfo, EventTeamView)
 * for consistent event display with status indicators, location, date, and favorite functionality.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../contexts/SettingsContext';
import { useFavorites } from '../contexts/FavoritesContext';
import { ExtendedEvent, getEventStatus, formatEventDate, prepareEventForFavorites } from '../utils/eventUtils';

interface EventCardProps {
  event: ExtendedEvent;
  onPress: (event: ExtendedEvent) => void;
  onLongPress?: (event: ExtendedEvent) => void;
  showFavoriteButton?: boolean;
  showTripleCrown?: boolean;
}

const EventCard: React.FC<EventCardProps> = ({
  event,
  onPress,
  onLongPress,
  showFavoriteButton = true,
  showTripleCrown = false
}) => {
  const settings = useSettings();
  const { addEvent, removeEvent, isEventFavorited } = useFavorites();


  const handleFavoritePress = async (e: any) => {
    e.stopPropagation();
    try {
      // Use uiId for league sessions (unique per session), otherwise use event ID
      const identifier = (event as any).uiId || event.id.toString();
      const eventForFavorites = prepareEventForFavorites(event);

      if (isEventFavorited(identifier)) {
        await removeEvent(identifier);
      } else {
        await addEvent(eventForFavorites);
      }
    } catch (error) {
      console.error('Failed to toggle event favorite:', error);
      Alert.alert('Error', 'Failed to update favorite status');
    }
  };

  const eventStatus = getEventStatus(event);

  return (
    <TouchableOpacity
      style={[styles.eventCard, {
        backgroundColor: settings.cardBackgroundColor,
        borderColor: settings.borderColor,
        shadowColor: settings.colorScheme === 'dark' ? '#FFFFFF' : '#000000'
      }]}
      onPress={() => onPress(event)}
      onLongPress={onLongPress ? () => onLongPress(event) : undefined}
      delayLongPress={600}
    >
      <View style={[styles.eventCardHeader, { borderBottomColor: settings.borderColor }]}>
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
              {event.name}
            </Text>
            <Text style={[styles.eventCode, { color: settings.secondaryTextColor }]}>
              {event.sku}
            </Text>
          </View>
        </View>
        <View style={styles.eventHeaderRight}>
          {showFavoriteButton && (
            <TouchableOpacity
              style={styles.favoriteButton}
              onPress={handleFavoritePress}
            >
              <Ionicons
                name={isEventFavorited((event as any).uiId || event.id.toString()) ? "heart" : "heart-outline"}
                size={20}
                color={isEventFavorited((event as any).uiId || event.id.toString()) ? "#FF6B6B" : settings.iconColor}
              />
            </TouchableOpacity>
          )}
          <Ionicons name="chevron-forward" size={18} color={settings.iconColor} />
        </View>
      </View>

      <View style={styles.eventDetails}>
        {event.location && (
          <View style={styles.eventDetailRow}>
            <Ionicons name="location-outline" size={16} color={settings.iconColor} />
            <Text style={[styles.eventDetailText, { color: settings.textColor }]} numberOfLines={1}>
              {event.location.city}, {event.location.region}
            </Text>
          </View>
        )}

        <View style={styles.eventDetailRow}>
          <Ionicons name="calendar-outline" size={16} color={settings.iconColor} />
          <Text style={[styles.eventDetailText, { color: settings.textColor }]}>
            {formatEventDate(event.start)}
            {event.start !== event.end && ` - ${formatEventDate(event.end)}`}
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
          {showTripleCrown && (
            <View style={styles.tripleCrownBadge}>
              <Ionicons name="medal" size={18} color="#FFD700" />
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
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
  eventHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
    marginTop: 2,
  },
  tripleCrownBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 'auto',
  },
  favoriteButton: {
    padding: 4,
  },
  eventDetails: {
    padding: 10,
    gap: 8,
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
});

export default EventCard;