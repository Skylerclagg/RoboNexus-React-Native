/**
 * EVENT DIVISION SCREEN
 *
 * Division overview screen showing teams, matches, rankings, and awards for a specific
 * event division. Provides quick navigation to detailed division data.
 *
 * NAVIGATION ACCESS:
 * - Event Detail Screen → Tap on division cards
 * - Event navigation → Division selection
 *
 * KEY FEATURES:
 * - Division information and statistics
 * - Teams list with quick team access
 * - Match schedule and results
 * - Qualification and skills rankings
 * - Awards and recognition
 * - Real-time competition updates
 * - Navigation to detailed match/ranking screens
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../contexts/SettingsContext';
import { Event, Team, Division } from '../types';
import EventTeamListScreen from './EventTeamListScreen';
import EventDivisionRankingsScreen from './EventDivisionRankingsScreen';
import EventDivisionMatchesScreen from './EventDivisionMatchesScreen';
import EventDivisionAwardsScreen from './EventDivisionAwardsScreen';

interface EventDivisionScreenProps {
  route: {
    params: {
      event: Event;
      eventTeams: Team[];
      division: Division;
      teamsMap: { [key: string]: string };
      divisionTeamsList: string[];
    };
  };
  navigation: any;
}

// Custom tab definitions
const tabs = [
  {
    key: 'teams',
    name: 'Teams',
    icon: 'people' as const,
  },
  {
    key: 'matches',
    name: 'Match List',
    icon: 'time' as const,
  },
  {
    key: 'rankings',
    name: 'Rankings',
    icon: 'list' as const,
  },
  {
    key: 'awards',
    name: 'Awards',
    icon: 'trophy' as const,
  },
];

// Tab components using actual screens
const EventTeamsTab: React.FC<{
  event: Event;
  division: Division;
  eventTeams: Team[];
  teamsMap: { [key: string]: string };
  divisionTeamsList: string[];
  navigation: any;
}> = ({ event, division, navigation }) => {
  return (
    <EventTeamListScreen
      route={{
        params: {
          event,
          division,
        },
      } as any}
      navigation={navigation}
    />
  );
};

const EventMatchListTab: React.FC<{
  event: Event;
  division: Division;
  teamsMap: { [key: string]: string };
  navigation: any;
}> = ({ event, division, teamsMap, navigation }) => {
  return (
    <EventDivisionMatchesScreen
      route={{
        params: {
          event,
          division,
          teamsMap,
        },
      } as any}
      navigation={navigation}
    />
  );
};

const EventRankingsTab: React.FC<{
  event: Event;
  division: Division;
  eventTeams: Team[];
  teamsMap: { [key: string]: string };
  navigation: any;
}> = ({ event, division, eventTeams, teamsMap, navigation }) => {
  return (
    <EventDivisionRankingsScreen
      route={{
        params: {
          event,
          division,
          eventTeams,
          teamsMap,
        },
      } as any}
      navigation={navigation}
    />
  );
};

const EventAwardsTab: React.FC<{
  event: Event;
  division: Division;
  navigation: any;
}> = ({ event, division, navigation }) => {
  return (
    <EventDivisionAwardsScreen
      route={{
        params: {
          event,
          division,
        },
      } as any}
      navigation={navigation}
    />
  );
};

const EventDivisionScreen = ({ route, navigation }: EventDivisionScreenProps) => {
  const settings = useSettings();
  const {
    buttonColor,
    backgroundColor,
    textColor,
    cardBackgroundColor,
    secondaryTextColor,
    iconColor,
    borderColor,
  } = settings;
  const { event, eventTeams, division, teamsMap, divisionTeamsList } = route.params;
  const [activeTab, setActiveTab] = useState('teams');
  const [currentTabTitle, setCurrentTabTitle] = useState('Teams');
  const [favorited, setFavorited] = useState(false);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: backgroundColor,
    },
    headerButtons: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    headerButton: {
      padding: 8,
      marginLeft: 8,
    },
    tabBar: {
      flexDirection: 'row',
      backgroundColor: cardBackgroundColor,
      paddingHorizontal: 8,
      paddingTop: 8,
      paddingBottom: 4,
      borderBottomWidth: 1,
      borderBottomColor: borderColor,
    },
    tabButton: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: 8,
      marginHorizontal: 4,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      borderRadius: 10,
    },
    activeTabButton: {
      backgroundColor: buttonColor + '15', // 15% opacity
    },
    tabIcon: {
      marginBottom: 4,
    },
    tabText: {
      fontSize: 11,
      fontWeight: '600',
      textAlign: 'center',
    },
    activeTabText: {
      color: buttonColor,
    },
    inactiveTabText: {
      color: secondaryTextColor,
    },
    tabContent: {
      flex: 1,
      backgroundColor: backgroundColor,
    },
  });

  useEffect(() => {
    navigation.setOptions({
      title: currentTabTitle,
      headerStyle: {
        backgroundColor: buttonColor,
      },
      headerTintColor: '#fff',
      headerTitleAlign: 'center',
      headerRight: () => {
        // Only show headerRight for Teams tab
        if (currentTabTitle !== 'Teams' && !currentTabTitle.includes('Teams')) {
          return null;
        }

        return (
          <View style={styles.headerButtons}>
            {/* Favorites button - shown when on Teams tab */}
            {currentTabTitle === 'Teams' && (
              <TouchableOpacity
                onPress={toggleFavorite}
                style={styles.headerButton}
              >
                <Ionicons
                  name={favorited ? "star" : "star-outline"}
                  size={24}
                  color="#fff"
                />
              </TouchableOpacity>
            )}

            {/* Data exporter - shown when title contains "Teams" */}
            {currentTabTitle.includes('Teams') && (
              <TouchableOpacity
                onPress={navigateToDataExporter}
                style={styles.headerButton}
              >
                <Ionicons name="document-attach" size={24} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
        );
      },
    });
  }, [navigation, buttonColor, currentTabTitle, favorited]);

  useEffect(() => {
    // Check if event is favorited (would integrate with favorites context)
    // setFavorited(favorites.favoriteEvents.includes(event.sku));
  }, [event.sku]);

  const toggleFavorite = () => {
    // This would interact with favorites context
    setFavorited(!favorited);
    // favorites.addEvent(event.sku) or favorites.removeEvent(event.sku)
  };

  const navigateToDataExporter = () => {
    navigation.navigate('DataExporter', { event, division });
  };

  const handleTabPress = (tabKey: string, tabName: string) => {
    setActiveTab(tabKey);
    setCurrentTabTitle(tabName);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'teams':
        return (
          <EventTeamsTab
            key={`teams-${event.id}-${division.id}`}
            event={event}
            division={division}
            eventTeams={eventTeams}
            teamsMap={teamsMap}
            divisionTeamsList={divisionTeamsList}
            navigation={navigation}
          />
        );
      case 'matches':
        return (
          <EventMatchListTab
            key={`matches-${event.id}-${division.id}`}
            event={event}
            division={division}
            teamsMap={teamsMap}
            navigation={navigation}
          />
        );
      case 'rankings':
        return (
          <EventRankingsTab
            key={`rankings-${event.id}-${division.id}`}
            event={event}
            division={division}
            eventTeams={eventTeams}
            teamsMap={teamsMap}
            navigation={navigation}
          />
        );
      case 'awards':
        return (
          <EventAwardsTab
            key={`awards-${event.id}-${division.id}`}
            event={event}
            division={division}
            navigation={navigation}
          />
        );
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {/* Custom Tab Bar */}
      <View style={styles.tabBar}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tabButton,
                isActive && styles.activeTabButton,
              ]}
              onPress={() => handleTabPress(tab.key, tab.name)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={tab.icon}
                size={22}
                color={isActive ? buttonColor : secondaryTextColor}
                style={styles.tabIcon}
              />
              <Text
                style={[
                  styles.tabText,
                  isActive ? styles.activeTabText : styles.inactiveTabText,
                ]}
                numberOfLines={1}
              >
                {tab.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Tab Content */}
      <View style={styles.tabContent}>
        {renderTabContent()}
      </View>
    </View>
  );
};

export default EventDivisionScreen; 