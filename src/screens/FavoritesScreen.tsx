/**
 * FAVORITES SCREEN
 *
 * Favorites management screen allowing users to add/remove favorite teams and events.
 * Provides bulk management capabilities and quick access to favorite items.
 *
 * NAVIGATION ACCESS:
 * - Dashboard tab → "Manage Favorites" when no favorites exist
 * - Settings screen → Favorites management option
 * - Main tab navigator (Favorites tab)
 *
 * KEY FEATURES:
 * - Add teams by number input
 * - Add events by search and selection
 * - Remove items with swipe gestures
 * - Bulk management operations
 * - Real-time favorites synchronization
 * - Quick navigation to team/event details
 */

import React, { useState, useEffect } from 'react';
import { createLogger } from '../utils/logger';

const logger = createLogger('FavoritesScreen');
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFavorites } from '../contexts/FavoritesContext';
import { useSettings } from '../contexts/SettingsContext';
import { robotEventsAPI } from '../services/apiRouter';

interface FavoriteItem {
  id: string;
  type: 'team' | 'event';
  number?: string;
  name: string;
  organization?: string;
  location?: string;
  sku?: string;
  eventApiId?: number;
}

interface Props {
  navigation: any;
}

const FavoritesScreen: React.FC<Props> = ({ navigation }) => {
  const { favorites, removeTeam, removeEvent } = useFavorites();
  const settings = useSettings();
  const [selectedTab, setSelectedTab] = useState<'team' | 'event'>('team');

  const removeFavorite = async (item: FavoriteItem) => {
    try {
      if (item.type === 'team' && item.number) {
        await removeTeam(item.number);
      } else if (item.type === 'event' && item.sku) {
        await removeEvent(item.sku);
      }
    } catch (error) {
      logger.error('Failed to remove favorite:', error);
      Alert.alert('Error', 'Failed to remove favorite');
    }
  };

  const filteredFavorites = favorites.filter(item => item.type === selectedTab);

  const navigateToLookup = () => {
    navigation.navigate('Lookup', {
      screen: 'LookupScreen',
      params: { initialTab: selectedTab }
    });
  };

  const handleFavoritePress = async (item: FavoriteItem) => {
    if (item.type === 'team' && item.number) {
      // Navigate to team info view (like Swift TeamInfoView)
      navigation.navigate('TeamInfo', {
        teamNumber: item.number,
        teamData: null, // Will be fetched in TeamInfo screen
      });
    } else if (item.type === 'event' && (item.eventApiId || item.sku)) {
      try {
        let eventToNavigate = null;

        // First, try to use the stored event ID for direct navigation
        if (item.eventApiId) {
          logger.debug('Using stored event ID:', item.eventApiId || 'Unknown');
          try {
            eventToNavigate = await robotEventsAPI.getEventDetails(item.eventApiId);
            logger.debug('Found event by ID:', eventToNavigate?.name, 'ID:', eventToNavigate?.id);
          } catch (error) {
            logger.debug('Failed to get event by ID, falling back to SKU search:', error);
          }
        }

        if (!eventToNavigate && item.sku) {
          logger.debug('Falling back to SKU search for:', item.sku || 'Unknown');

          const events = await robotEventsAPI.searchEvents({
            sku: [item.sku],
          });
          logger.debug('SKU search returned', events.length, 'events for SKU', item.sku || 'Unknown');

          if (events.length > 0) {
            // Filter to find exact SKU match
            const exactMatch = events.find(e => e.sku === item.sku);
            eventToNavigate = exactMatch || events[0];
            logger.debug('Found event by SKU:', eventToNavigate.name, 'ID:', eventToNavigate.id);
          }
        }

        // Navigate with the found event
        if (eventToNavigate) {
          navigation.navigate('EventMainView', { event: eventToNavigate });
        } else {
          // Final fallback: create a minimal event object
          logger.debug('Creating fallback event object');
          const event = {
            id: item.eventApiId || 0,
            sku: item.sku || '',
            name: item.name || 'Event',
            location: item.location ? {
              city: item.location.split(',')[0]?.trim() || '',
              region: item.location.split(',')[1]?.trim() || '',
              country: item.location.split(',')[2]?.trim() || ''
            } : { city: '', region: '', country: '' },
            start: '',
            end: '',
          };
          navigation.navigate('EventMainView', { event });
        }
      } catch (error) {
        logger.error('Failed to fetch event:', error);
        Alert.alert('Error', 'Failed to load event details');
      }
    }
  };

  const renderFavoriteItem = ({ item }: { item: FavoriteItem }) => {
    // Ensure all values are strings to prevent rendering errors
    const safeNumber = String(item.number || '');
    const safeName = String(item.name || '');
    const safeOrganization = String(item.organization || '');
    const safeLocation = String(item.location || '');

    return (
      <TouchableOpacity
        style={styles.favoriteItem}
        onPress={() => handleFavoritePress(item)}
      >
        <View style={styles.favoriteContent}>
          <View style={styles.favoriteInfo}>
            {item.type === 'team' && (
              <>
                <Text style={styles.favoriteNumber}>{safeNumber}</Text>
                <Text style={styles.favoriteName}>{safeName}</Text>
                {safeOrganization.trim() !== '' && (
                  <Text style={styles.favoriteOrganization}>{safeOrganization}</Text>
                )}
                {safeLocation.trim() !== '' && (
                  <Text style={styles.favoriteLocation}>📍 {safeLocation}</Text>
                )}
              </>
            )}
            {item.type === 'event' && (
              <>
                <Text style={styles.favoriteName}>{safeName}</Text>
                {safeLocation.trim() !== '' && (
                  <Text style={styles.favoriteLocation}>📍 {safeLocation}</Text>
                )}
              </>
            )}
          </View>
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => removeFavorite(item)}
          >
            <Ionicons name="heart" size={20} color="#FF6B6B" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const styles = createStyles(settings);

  return (
    <View style={[styles.container, { backgroundColor: settings.backgroundColor }]}>
      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'team' && styles.activeTab]}
          onPress={() => setSelectedTab('team')}
        >
          <Text style={[styles.tabText, selectedTab === 'team' && styles.activeTabText, { color: selectedTab === 'team' ? settings.buttonColor : settings.secondaryTextColor }]}>
            Teams
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'event' && styles.activeTab]}
          onPress={() => setSelectedTab('event')}
        >
          <Text style={[styles.tabText, selectedTab === 'event' && styles.activeTabText, { color: selectedTab === 'event' ? settings.buttonColor : settings.secondaryTextColor }]}>
            Events
          </Text>
        </TouchableOpacity>
      </View>

      {/* Favorites List */}
      {filteredFavorites.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="heart-outline" size={64} color={settings.iconColor} />
          <Text style={styles.emptyText}>No favorite {selectedTab || 'item'}s yet</Text>
          <Text style={styles.emptySubtext}>
            Add {selectedTab || 'item'}s to your favorites from the Lookup tab
          </Text>
          <TouchableOpacity style={styles.addButton} onPress={navigateToLookup}>
            <Text style={styles.addButtonText}>Go to Lookup</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredFavorites}
          renderItem={renderFavoriteItem}
          keyExtractor={(item) => item.id}
          style={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const createStyles = (settings: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: settings.cardBackgroundColor,
    borderBottomWidth: 1,
    borderBottomColor: settings.borderColor,
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: settings.buttonColor,
  },
  tabText: {
    fontSize: 16,
  },
  activeTabText: {
    color: settings.buttonColor,
    fontWeight: '600',
  },
  list: {
    flex: 1,
  },
  favoriteItem: {
    backgroundColor: settings.cardBackgroundColor,
    marginVertical: 2,
    marginHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: settings.borderColor,
    shadowColor: settings.colorScheme === 'dark' ? '#FFFFFF' : '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: settings.colorScheme === 'dark' ? 0.3 : 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  favoriteContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  favoriteInfo: {
    flex: 1,
  },
  favoriteNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: settings.textColor,
    marginBottom: 2,
  },
  favoriteName: {
    fontSize: 14,
    color: settings.secondaryTextColor,
    marginBottom: 2,
  },
  favoriteOrganization: {
    fontSize: 12,
    color: settings.secondaryTextColor,
    marginBottom: 2,
  },
  favoriteLocation: {
    fontSize: 11,
    color: settings.secondaryTextColor,
  },
  removeButton: {
    padding: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    color: settings.textColor,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: settings.secondaryTextColor,
    textAlign: 'center',
    lineHeight: 20,
  },
  addButton: {
    backgroundColor: settings.buttonColor,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 16,
    shadowColor: settings.colorScheme === 'dark' ? '#FFFFFF' : '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: settings.colorScheme === 'dark' ? 0.3 : 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  addButtonText: {
    color: '#fff', // Button text always white
    fontSize: 16,
    fontWeight: '600',
  },
});

export default FavoritesScreen;