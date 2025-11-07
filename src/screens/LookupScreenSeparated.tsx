/**
 * SEPARATED LOOKUP SCREEN
 *
 * Modern lookup screen using separated components for better maintainability.
 * This version uses the modular TeamLookup and EventLookup components.
 *
 * NAVIGATION ACCESS:
 * - Dashboard tab → Team Search button
 * - Main tab navigator (Lookup tab)
 * - Quick actions from various screens
 *
 * KEY FEATURES:
 * - Modular architecture with separated components
 * - Easy to maintain and extend
 * - Consistent UI across team and event lookup
 * - Better code organization
 */

import React, { useState, useEffect } from 'react';
import { createLogger } from '../utils/logger';

const logger = createLogger('LookupScreenSeparated');
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../contexts/SettingsContext';
import TeamLookup from '../components/TeamLookup';
import EventLookup from '../components/EventLookup';
import TeamBrowserContent from '../components/TeamBrowserContent';

interface LookupScreenSeparatedProps {
  navigation?: any;
  route?: {
    params?: {
      initialTab?: 'team' | 'event' | 'teamsMap';
    };
  };
}

const LookupScreenSeparated: React.FC<LookupScreenSeparatedProps> = ({ navigation, route }) => {
  logger.debug('[LookupScreenSeparated] Component loading...');
  const settings = useSettings();
  const { isDeveloperMode, teamBrowserEnabled } = settings;

  // Initialize lookupType based on route params: 0 = Teams, 1 = Team Browser, 2 = Events
  const initialTab = route?.params?.initialTab;
  const [lookupType, setLookupType] = useState(() => {
    if (initialTab === 'event') return 2;
    if (initialTab === 'teamsMap') return 1;
    return 0; // Default to teams
  });

  // View mode state for Events tab (list/map)
  const [eventViewMode, setEventViewMode] = useState<'list' | 'map'>('list');

  // Set up navigation header options
  useEffect(() => {
    const isEventsTab = lookupType === 2;
    const showMapToggle = isEventsTab && Platform.OS === 'ios';

    navigation?.setOptions?.({
      title: 'Lookup',
      headerStyle: {
        backgroundColor: settings.topBarColor,
      },
      headerTintColor: settings.topBarContentColor,
      headerTitleAlign: 'center',
      headerLeft: showMapToggle ? () => (
        <TouchableOpacity
          style={[styles.headerToggle, { backgroundColor: settings.buttonColor }]}
          onPress={() => setEventViewMode(eventViewMode === 'list' ? 'map' : 'list')}
        >
          <Ionicons
            name={eventViewMode === 'list' ? 'map' : 'list'}
            size={20}
            color="#FFFFFF"
          />
        </TouchableOpacity>
      ) : undefined,
    });
  }, [navigation, settings, lookupType, isDeveloperMode, eventViewMode]);

  return (
    <View style={[styles.container, { backgroundColor: settings.backgroundColor }]}>
      {/* Modern Tab Selector */}
      <View style={[styles.tabSelector, {
        backgroundColor: settings.cardBackgroundColor,
        borderColor: settings.borderColor,
        shadowColor: settings.colorScheme === 'dark' ? '#FFFFFF' : '#000000'
      }]}>
        <TouchableOpacity
          style={[
            styles.tabButton,
            lookupType === 0 && [styles.activeTab, { backgroundColor: settings.buttonColor }]
          ]}
          onPress={() => setLookupType(0)}
        >
          <Ionicons
            name="people"
            size={20}
            color={lookupType === 0 ? '#FFFFFF' : settings.iconColor}
            style={styles.tabIcon}
          />
          <Text style={[
            styles.tabText,
            { color: lookupType === 0 ? '#FFFFFF' : settings.textColor }
          ]}>
            Teams
          </Text>
        </TouchableOpacity>

        {/* Team Browser Tab - Developer Mode with Toggle Only */}
        {isDeveloperMode && teamBrowserEnabled && (
          <TouchableOpacity
            style={[
              styles.tabButton,
              lookupType === 1 && [styles.activeTab, { backgroundColor: settings.buttonColor }]
            ]}
            onPress={() => setLookupType(1)}
          >
            <Ionicons
              name="map"
              size={20}
              color={lookupType === 1 ? '#FFFFFF' : settings.iconColor}
              style={styles.tabIcon}
            />
            <Text style={[
              styles.tabText,
              { color: lookupType === 1 ? '#FFFFFF' : settings.textColor }
            ]}>
              Team Browser
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.tabButton,
            lookupType === 2 && [styles.activeTab, { backgroundColor: settings.buttonColor }]
          ]}
          onPress={() => setLookupType(2)}
        >
          <Ionicons
            name="calendar"
            size={20}
            color={lookupType === 2 ? '#FFFFFF' : settings.iconColor}
            style={styles.tabIcon}
          />
          <Text style={[
            styles.tabText,
            { color: lookupType === 2 ? '#FFFFFF' : settings.textColor }
          ]}>
            Events
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content - Using Separated Components */}
      {lookupType === 0 ? (
        <TeamLookup navigation={navigation} />
      ) : lookupType === 1 ? (
        <TeamBrowserContent navigation={navigation} viewMode="list" />
      ) : (
        <EventLookup navigation={navigation} viewMode={eventViewMode} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabSelector: {
    flexDirection: 'row',
    margin: 16,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  activeTab: {
    // Background color applied inline
  },
  tabIcon: {
    marginRight: 6,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    flexShrink: 1,
  },
  headerToggle: {
    borderRadius: 8,
    marginLeft: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default LookupScreenSeparated;