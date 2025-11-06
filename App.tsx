/**
 * Main App Entry Point
 *
 * This file sets up the entire navigation structure for the RoboNexus app.
 * It uses React Navigation to create a tab-based interface with stack navigation
 * for detailed screens.
 */


import React, { useState, useEffect } from 'react';
import { TouchableOpacity } from 'react-native';


import { NavigationContainer } from '@react-navigation/native';           
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'; 
import { createNativeStackNavigator } from '@react-navigation/native-stack'; 


import { StatusBar } from 'expo-status-bar';  
import { Ionicons } from '@expo/vector-icons'; 


import DashboardScreen from './src/screens/DashboardScreen';        
import FavoritesScreen from './src/screens/FavoritesScreen';         
import AwardsScreen from './src/screens/AwardsScreen';               
import WorldSkillsScreen from './src/screens/WorldSkillsScreen';     
import GameManualScreen from './src/screens/GameManualScreen';     
import SettingsScreen from './src/screens/SettingsScreen';           
import TeamEventsScreen from './src/screens/TeamEventsScreen';       


import EventMainView from './src/screens/EventMainView';
import EventInformationScreen from './src/screens/EventInformationScreen';
import EventAgendaScreen from './src/screens/EventAgendaScreen';
import EventDivisionScreen from './src/screens/EventDivisionScreen';
import EventTeamListScreen from './src/screens/EventTeamListScreen';
import EventSkillsRankingsScreen from './src/screens/EventSkillsRankingsScreen';
import EventDivisionRankingsScreen from './src/screens/EventDivisionRankingsScreen';
import EventDivisionMatchesScreen from './src/screens/EventDivisionMatchesScreen';
import EventTeamMatchesScreen from './src/screens/EventTeamMatchesScreen';
import EventTeamInfoScreen from './src/screens/EventTeamInfoScreen';
import EventDivisionAwardsScreen from './src/screens/EventDivisionAwardsScreen';
import FavoriteTeamsMatchesScreen from './src/screens/FavoriteTeamsMatchesScreen';
import TeamInfoScreen from './src/screens/TeamInfoScreen';
import { TeamEligibilityDetailScreen } from './src/screens/TeamEligibilityDetailScreen';
import MatchNotesScreen from './src/screens/MatchNotesScreen';
import WelcomeScreen from './src/screens/WelcomeScreen';                                  


import ScoreCalculatorsHomeScreen from './src/screens/ScoreCalculatorsHomeScreen';
import TeamworkScoreCalculatorScreen from './src/screens/TeamworkScoreCalculatorScreen';
import PilotingSkillsCalculatorScreen from './src/screens/PilotingSkillsCalculatorScreen';
import AutonomousFlightSkillsCalculatorScreen from './src/screens/AutonomousFlightSkillsCalculatorScreen';
import VEXv5ScoreCalculatorScreen from './src/screens/VEXv5ScoreCalculatorScreen'; 


import { SettingsProvider, useSettings } from './src/contexts/SettingsContext';
import { FavoritesProvider } from './src/contexts/FavoritesContext';
import { NotesProvider } from './src/contexts/NotesContext';
import { DataCacheProvider } from './src/contexts/DataCacheContext';
import { TeamsProvider } from './src/contexts/TeamsContext';
import LookupScreenSeparated from './src/screens/LookupScreenSeparated';
import { shouldShowScoreCalculators, isProgramLimitedMode } from './src/utils/programMappings';
import { robotEventsAPI } from './src/services/apiRouter';
import { Alert } from 'react-native';

// Define the navigation parameter types
type RootStackParamList = {
  EventMainView: any;
  EventInformation: any;
  EventAgenda: any;
  EventDivision: any;
  EventTeamList: any;
  EventSkillsRankings: any;
  EventDivisionRankings: any;
  EventDivisionMatches: any;
  EventTeamMatches: any;
  FavoriteTeamsMatches: any;
  TeamInfo: any;
  EventTeamInfo: any;
  EventDivisionAwards: any;
  TeamEligibilityDetail: any;
  MatchNotes: any;
  [key: string]: any;
};

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * TabNavigator Component
 *
 * Creates the bottom tab navigation that users see at the bottom of the screen.
 * Each tab represents a main section of the app.
 */
const TabNavigator = () => {

  const settings = useSettings();

  // Check if the program is in limited mode
  const isLimitedMode = isProgramLimitedMode(settings.selectedProgram);

  // Check if score calculators should be visible based on program config and settings
  // Note: scoringCalculatorsEnabled toggle only affects dev-mode-required calculators
  const showCalculatorsTab = shouldShowScoreCalculators(
    settings.selectedProgram,
    settings.isDeveloperMode,
    settings.scoringCalculatorsEnabled
  );

  return (
    <Tab.Navigator

      screenOptions={({ route, navigation }) => ({

        tabBarIcon: ({ focused, color, size }) => {

          let iconName: keyof typeof Ionicons.glyphMap;




          if (route.name === 'Dashboard') {
            iconName = focused ? 'grid' : 'grid-outline';
          } else if (route.name === 'World Skills') {
            iconName = focused ? 'globe' : 'globe-outline';
          } else if (route.name === 'Lookup') {
            iconName = focused ? 'search' : 'search-outline';
          } else if (route.name === 'Game Manual') {
            iconName = focused ? 'book' : 'book-outline';
          } else if (route.name === 'Calculators') {
            iconName = focused ? 'calculator' : 'calculator-outline';
          } else {
            iconName = 'help-outline';
          }


          return <Ionicons name={iconName} size={size} color={color} />;
        },

        tabBarActiveTintColor: settings.buttonColor,
        tabBarInactiveTintColor: settings.iconColor,
        tabBarStyle: {
          backgroundColor: settings.cardBackgroundColor,
          borderTopColor: settings.borderColor,
        },


        headerStyle: {
          backgroundColor: settings.topBarColor,
        },
        headerTintColor: settings.topBarContentColor,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        headerTitleAlign: 'center',


        headerRight: () => route.name !== 'Dashboard' ? (
          <TouchableOpacity
            onPress={() => navigation.navigate('Settings')}
            style={{ marginRight: 16 }}
          >
            <Ionicons name="settings" size={24} color={settings.topBarContentColor} />
          </TouchableOpacity>
        ) : null,
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      {!isLimitedMode && (
        <>
          <Tab.Screen name="World Skills" component={WorldSkillsScreen} />
          <Tab.Screen name="Lookup" component={LookupScreenSeparated} />
        </>
      )}
      <Tab.Screen name="Game Manual" component={GameManualScreen} />
      {showCalculatorsTab && (
        <Tab.Screen name="Calculators" component={ScoreCalculatorsHomeScreen} />
      )}
    </Tab.Navigator>
  );
};

/**
 * AppNavigator Component
 *
 * This is the main navigation component that wraps everything.
 * It manages the welcome screen and sets up the stack navigation
 * for all the detail screens that can be opened from the tabs.
 */
const AppNavigator = () => {

  const settings = useSettings();



  const [showWelcome, setShowWelcome] = useState(false);

  // Reset API failure state on app launch
  useEffect(() => {
    console.log('[App] Resetting API failure state on launch');
    robotEventsAPI.resetFailureState();
  }, []);

  // Check for API failures and show notification
  useEffect(() => {
    const checkApiFailure = () => {
      const failureInfo = robotEventsAPI.getFailureInfo();
      if (failureInfo.inFailure && failureInfo.shouldShowNotification) {
        Alert.alert(
          'API Keys Unavailable',
          failureInfo.message,
          [
            {
              text: 'OK',
              onPress: () => robotEventsAPI.markNotificationShown()
            }
          ]
        );
      }
    };

    // Check immediately
    checkApiFailure();

    // Check periodically (every 30 seconds)
    const interval = setInterval(checkApiFailure, 30000);

    return () => clearInterval(interval);
  }, []);


  useEffect(() => {

    const checkWelcome = async () => {
      const shouldShow = await settings.checkShouldShowWelcome();
      setShowWelcome(shouldShow);
    };
    checkWelcome();
  }, []);


  const handleWelcomeClose = () => {
    setShowWelcome(false);
  };


  const handleShowWelcome = () => {
    setShowWelcome(true);
  };

  return (

    <NavigationContainer>
      {/* StatusBar controls the top status bar (time, battery, etc.) */}
      {/* Set to light text on dark theme, dark text on light theme */}
      <StatusBar style={settings.colorScheme === 'dark' ? 'light' : 'dark'} />

      {/* Welcome screen - shown as overlay when needed */}
      <WelcomeScreen
        isVisible={showWelcome}
        onClose={handleWelcomeClose}
        showCloseButton={true}
      />
      {/* Stack Navigator for detail screens */}
      {/* headerShown: false means most screens won't show a header by default */}
      <Stack.Navigator screenOptions={{
        headerShown: false,
        headerBackTitle: 'Back',
        headerTitleAlign: 'center',
        headerStyle: {
          backgroundColor: settings.topBarColor,
        },
        headerTintColor: settings.topBarContentColor,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}>
          {/* Main screen contains the tab navigator */}
          <Stack.Screen name="Main" component={TabNavigator} />
          <Stack.Screen
            name="Settings"
            options={{
              headerShown: true,
              title: 'Settings',
            }}
          >
            {(props) => <SettingsScreen {...props} onShowWelcome={handleShowWelcome} />}
          </Stack.Screen>
          <Stack.Screen
            name="TeamEvents"
            component={TeamEventsScreen}
            options={{
              headerShown: true,
            }}
          />

          {/* Event-related screens */}
          <Stack.Screen
            name="EventMainView"
            component={EventMainView as any}
            options={{ headerShown: true }}
          />
          <Stack.Screen
            name="EventInformation"
            component={EventInformationScreen as any}
            options={{ headerShown: true }}
          />
          <Stack.Screen
            name="EventAgenda"
            component={EventAgendaScreen as any}
            options={{ headerShown: true }}
          />
          <Stack.Screen
            name="EventDivision"
            component={EventDivisionScreen as any}
            options={{ headerShown: true }}
          />
          <Stack.Screen
            name="EventTeamList"
            component={EventTeamListScreen as any}
            options={{ headerShown: true }}
          />
          <Stack.Screen
            name="EventSkillsRankings"
            component={EventSkillsRankingsScreen as any}
            options={{ headerShown: true }}
          />
          <Stack.Screen
            name="EventDivisionRankings"
            component={EventDivisionRankingsScreen as any}
            options={{ headerShown: true }}
          />
          <Stack.Screen
            name="EventDivisionMatches"
            component={EventDivisionMatchesScreen as any}
            options={{ headerShown: true }}
          />
          <Stack.Screen
            name="EventTeamMatches"
            component={EventTeamMatchesScreen as any}
            options={{ headerShown: true }}
          />
          <Stack.Screen
            name="FavoriteTeamsMatches"
            component={FavoriteTeamsMatchesScreen as any}
            options={{ headerShown: true }}
          />
          <Stack.Screen
            name="TeamInfo"
            component={TeamInfoScreen as any}
            options={{ headerShown: true }}
          />
          <Stack.Screen
            name="EventTeamInfo"
            component={EventTeamInfoScreen as any}
            options={{ headerShown: true }}
          />
          <Stack.Screen
            name="EventDivisionAwards"
            component={EventDivisionAwardsScreen as any}
            options={{ headerShown: true }}
          />
          <Stack.Screen
            name="TeamEligibilityDetail"
            component={TeamEligibilityDetailScreen as any}
            options={{ headerShown: true }}
          />

          {/* Calculator screens */}
          <Stack.Screen
            name="ScoreCalculatorsHome"
            component={ScoreCalculatorsHomeScreen}
            options={{ headerShown: true }}
          />
          <Stack.Screen
            name="TeamworkScoreCalculator"
            component={TeamworkScoreCalculatorScreen}
            options={{ headerShown: true }}
          />
          <Stack.Screen
            name="PilotingSkillsCalculator"
            component={PilotingSkillsCalculatorScreen}
            options={{ headerShown: true }}
          />
          <Stack.Screen
            name="AutonomousFlightSkillsCalculator"
            component={AutonomousFlightSkillsCalculatorScreen}
            options={{ headerShown: true }}
          />
          <Stack.Screen
            name="VEXv5ScoreCalculator"
            component={VEXv5ScoreCalculatorScreen}
            options={{ headerShown: true }}
          />
          <Stack.Screen
            name="MatchNotes"
            component={MatchNotesScreen as any}
            options={{ headerShown: true }}
          />
          <Stack.Screen
            name="Favorites"
            component={FavoritesScreen}
            options={{
              headerShown: true,
              title: 'Manage Favorites',
            }}
          />
          <Stack.Screen
            name="Awards"
            component={AwardsScreen}
            options={{
              headerShown: true,
              title: "Favorited Team's Awards",
            }}
          />
        </Stack.Navigator>
    </NavigationContainer>
  );
};

/**
 * Main App Component
 *
 * This is the root component of the entire app. It wraps everything
 * in context providers to make global state available throughout the app.
 * Think of this as the foundation that everything else is built on.
 */
export default function App() {
  return (
    /* Context Providers wrap the app to provide global state */
    /* These work like "layers" - inner components can access all outer providers */
    <SettingsProvider>        {/* Provides app settings (colors, preferences, etc.) */}
      <DataCacheProvider>     {/* Provides cached API data for performance */}
        <TeamsProvider>       {/* Provides teams data with background loading */}
          <FavoritesProvider> {/* Provides user's favorite teams and events */}
            <NotesProvider>   {/* Provides user's match notes and team notes */}
              <AppNavigator />{/* The actual app navigation and screens */}
            </NotesProvider>
          </FavoritesProvider>
        </TeamsProvider>
      </DataCacheProvider>
    </SettingsProvider>
  );
}
