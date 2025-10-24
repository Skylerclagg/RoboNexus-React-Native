import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { Appearance, ColorSchemeName } from 'react-native';
import { storage } from '../utils/webCompatibility';
import { robotEventsAPI } from '../services/apiRouter';
import { getAllProgramNames, getProgramConfig } from '../utils/programMappings';
import CryptoJS from 'crypto-js';

export type ProgramType =
  | 'VEX V5 Robotics Competition'
  | 'VEX IQ Robotics Competition'
  | 'VEX U Robotics Competition'
  | 'VEX AI Robotics Competition'
  | 'Aerial Drone Competition'
  | 'VEX AIR Drone Competition';

export type ThemeMode = 'auto' | 'light' | 'dark';

interface SettingsContextType {
  selectedProgram: ProgramType;
  selectedSeason: string;
  enableHaptics: boolean;
  dateFilter: number;
  nearbyRange: number;
  mapViewEnabled: boolean;
  themeMode: ThemeMode;
  topBarColor: string;
  topBarContentColor: string;
  buttonColor: string;
  isDeveloperMode: boolean;
  allAroundEligibilityEnabled: boolean;
  testingEligibilityEnabled: boolean;
  eligibilityWarningDismissed: boolean;
  showAwardsSummary: boolean;
  globalSeasonEnabled: boolean;
  devLiveEventSimulation: boolean;
  devTestEventId: string;
  developerTabEnabled: boolean;
  devOnlyProgramsEnabled: boolean;
  scoringCalculatorsEnabled: boolean;
  teamBrowserEnabled: boolean;
  compactViewAll: boolean;
  compactViewMatches: boolean;
  compactViewRankings: boolean;
  compactViewSkills: boolean;
  compactViewTeams: boolean;
  storedDeveloperCode: string;
  setStoredDeveloperCode: (code: string) => void;
  setCompactViewAll: (enabled: boolean) => void;
  setCompactViewMatches: (enabled: boolean) => void;
  setCompactViewRankings: (enabled: boolean) => void;
  setCompactViewSkills: (enabled: boolean) => void;
  setCompactViewTeams: (enabled: boolean) => void;
  availablePrograms: ProgramType[];
  colorScheme: ColorSchemeName;
  backgroundColor: string;
  textColor: string;
  cardBackgroundColor: string;
  secondaryTextColor: string;
  iconColor: string;
  borderColor: string;
  previewProgram: ProgramType | null;
  setPreviewProgram: (program: ProgramType | null) => void;
  setSelectedProgram: (program: ProgramType) => void;
  setSelectedSeason: (season: string) => void;
  setEnableHaptics: (enabled: boolean) => void;
  setDateFilter: (days: number) => void;
  setNearbyRange: (miles: number) => void;
  setMapViewEnabled: (enabled: boolean) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setIsDeveloperMode: (enabled: boolean) => void;
  setAllAroundEligibilityEnabled: (enabled: boolean) => void;
  setTestingEligibilityEnabled: (enabled: boolean) => void;
  setEligibilityWarningDismissed: (enabled: boolean) => void;
  setShowAwardsSummary: (enabled: boolean) => void;
  setGlobalSeasonEnabled: (enabled: boolean) => void;
  setDevLiveEventSimulation: (enabled: boolean) => void;
  setDevTestEventId: (eventId: string) => void;
  setDeveloperTabEnabled: (enabled: boolean) => void;
  setDevOnlyProgramsEnabled: (enabled: boolean) => void;
  setScoringCalculatorsEnabled: (enabled: boolean) => void;
  setTeamBrowserEnabled: (enabled: boolean) => void;
  updateGlobalSeason: (season: string) => void;
  validateDeveloperCode: (code: string) => boolean;
  enableDeveloperModeWithCode: (code: string) => Promise<boolean>;
  checkShouldShowWelcome: () => Promise<boolean>;
  setLastWelcomeVersion: (version: string) => Promise<void>;
  showWelcomeManually: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const STORAGE_KEYS = {
  selectedProgram: 'selectedProgram',
  selectedSeason: 'selectedSeason',
  enableHaptics: 'enableHaptics',
  dateFilter: 'dateFilter',
  nearbyRange: 'nearbyRange',
  mapViewEnabled: 'mapViewEnabled',
  themeMode: 'themeMode',
  isDeveloperMode: 'isDeveloperMode',
  allAroundEligibilityEnabled: 'allAroundEligibilityEnabled',
  testingEligibilityEnabled: 'testingEligibilityEnabled',
  eligibilityWarningDismissed: 'eligibilityWarningDismissed',
  showAwardsSummary: 'showAwardsSummary',
  globalSeasonEnabled: 'globalSeasonEnabled',
  devLiveEventSimulation: 'devLiveEventSimulation',
  devTestEventId: 'devTestEventId',
  developerTabEnabled: 'developerTabEnabled',
  devOnlyProgramsEnabled: 'devOnlyProgramsEnabled',
  scoringCalculatorsEnabled: 'scoringCalculatorsEnabled',
  teamBrowserEnabled: 'teamBrowserEnabled',
  compactViewAll: 'compactViewAll',
  compactViewMatches: 'compactViewMatches',
  compactViewRankings: 'compactViewRankings',
  compactViewSkills: 'compactViewSkills',
  compactViewTeams: 'compactViewTeams',
  storedDeveloperCode: 'storedDeveloperCode',
  lastWelcomeVersion: 'lastWelcomeVersion',
};

// Developer mode security - SHA-256 hashes of valid codes
const VALID_DEV_CODE_HASHES = [
  'ec7a1425f5c313b93e6b5b66978130a1f92b2e5bdfcaa52013de0d568094336e', // Learning1
  '1e7f5f3f24c25a6d647ccfd84799491d11e6bc09433fba5270a4ad363e6111a6', // WVRobotics
];

// Function to validate developer codes using SHA-256 hashing
const validateDeveloperCode = (code: string): boolean => {
  const codeHash = CryptoJS.SHA256(code).toString();
  return VALID_DEV_CODE_HASHES.includes(codeHash);
};

// Program-based theming function
export const getProgramTheme = (program: ProgramType, colorScheme: ColorSchemeName) => {
  const isDark = colorScheme === 'dark';

  switch (program) {
    case 'VEX V5 Robotics Competition':
    case 'VEX U Robotics Competition':
      return {
        primary: '#FF3B30',    // Red
        background: isDark ? '#000000' : '#FFFFFF',
        content: isDark ? '#FFFFFF' : '#000000',
      };

    case 'VEX AI Robotics Competition':
      return {
        primary: '#48484A',    // Dark Gray
        background: isDark ? '#000000' : '#FFFFFF',
        content: isDark ? '#FFFFFF' : '#000000',
      };

    case 'VEX IQ Robotics Competition':
      return {
        primary: '#007AFF',    // Blue
        background: isDark ? '#000000' : '#FFFFFF',
        content: isDark ? '#FFFFFF' : '#000000',
      };

    case 'Aerial Drone Competition':
      return {
        primary: '#34C759',    // Green
        background: isDark ? '#000000' : '#FFFFFF',
        content: isDark ? '#FFFFFF' : '#000000',
      };

    case 'VEX AIR Drone Competition':
      return {
        primary: '#FF9500',    // Orange
        background: isDark ? '#000000' : '#FFFFFF',
        content: isDark ? '#FFFFFF' : '#000000',
      };

    default:
      return {
        primary: '#FF3B30',    // Default to red
        background: isDark ? '#000000' : '#FFFFFF',
        content: isDark ? '#FFFFFF' : '#000000',
      };
  }
};

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  console.log('[SettingsProvider] Starting initialization...');

  // All hooks must be called at the top level, before any conditional logic
  const [selectedProgram, setSelectedProgramState] = useState<ProgramType>('VEX V5 Robotics Competition');
  const [selectedSeason, setSelectedSeasonState] = useState('2025-2026');
  const [enableHaptics, setEnableHapticsState] = useState(true);
  const [dateFilter, setDateFilterState] = useState(7);
  const [nearbyRange, setNearbyRangeState] = useState(100);
  const [mapViewEnabled, setMapViewEnabledState] = useState(false);
  const [themeMode, setThemeModeState] = useState<ThemeMode>('auto');
  const [isDeveloperMode, setIsDeveloperModeState] = useState(false);
  const [allAroundEligibilityEnabled, setAllAroundEligibilityEnabledState] = useState(false);
  const [testingEligibilityEnabled, setTestingEligibilityEnabledState] = useState(false);
  const [eligibilityWarningDismissed, setEligibilityWarningDismissedState] = useState(false);
  const [showAwardsSummary, setShowAwardsSummaryState] = useState(false);
  const [globalSeasonEnabled, setGlobalSeasonEnabledState] = useState(true);
  const [devLiveEventSimulation, setDevLiveEventSimulationState] = useState(false);
  const [devTestEventId, setDevTestEventIdState] = useState('');
  const [developerTabEnabled, setDeveloperTabEnabledState] = useState(false);
  const [devOnlyProgramsEnabled, setDevOnlyProgramsEnabledState] = useState(false);
  const [scoringCalculatorsEnabled, setScoringCalculatorsEnabledState] = useState(false);
  const [teamBrowserEnabled, setTeamBrowserEnabledState] = useState(false);
  const [compactViewAll, setCompactViewAllState] = useState(false);
  const [compactViewMatches, setCompactViewMatchesState] = useState(false);
  const [compactViewRankings, setCompactViewRankingsState] = useState(false);
  const [compactViewSkills, setCompactViewSkillsState] = useState(false);
  const [compactViewTeams, setCompactViewTeamsState] = useState(false);
  const [storedDeveloperCode, setStoredDeveloperCodeState] = useState('');
  const [deviceColorScheme, setDeviceColorScheme] = useState<ColorSchemeName>(Appearance.getColorScheme());
  const [previewProgram, setPreviewProgramState] = useState<ProgramType | null>(null);

  // Calculate effective color scheme based on theme mode
  const colorScheme: ColorSchemeName = themeMode === 'auto'
    ? deviceColorScheme
    : themeMode === 'dark'
      ? 'dark'
      : 'light';

  // Get theme colors based on program and effective color scheme
  // Use preview program if set (for temporary visual preview), otherwise use selected program
  const effectiveProgram = previewProgram || selectedProgram;
  console.log('[SettingsProvider] Getting theme for program:', effectiveProgram, 'themeMode:', themeMode, 'effectiveColorScheme:', colorScheme);
  const theme = getProgramTheme(effectiveProgram, colorScheme);
  console.log('[SettingsProvider] Theme calculated:', theme);
  const isDark = colorScheme === 'dark';
  const topBarColor = theme.primary;
  const topBarContentColor = '#FFFFFF'; // Always white for navigation bars
  const buttonColor = theme.primary;
  const backgroundColor = theme.background;
  const textColor = theme.content;
  const cardBackgroundColor = isDark ? '#1C1C1E' : '#FFFFFF';
  const secondaryTextColor = isDark ? '#8E8E93' : '#666666';
  const iconColor = isDark ? '#8E8E93' : '#666666';
  const borderColor = isDark ? '#38383A' : '#E5E5E7';

  // Define available programs dynamically from program mappings based on devOnly setting
  const availablePrograms: ProgramType[] = useMemo(() => {
    const allPrograms = getAllProgramNames();
    return allPrograms.filter(program => {
      const config = getProgramConfig(program);
      if (config.devOnly) {
        return isDeveloperMode && devOnlyProgramsEnabled;
      }
      // Otherwise, always show
      return true;
    });
  }, [isDeveloperMode, devOnlyProgramsEnabled]);

  // Load settings from AsyncStorage on app start
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const savedProgram = await storage.getItem(STORAGE_KEYS.selectedProgram);
        const savedSeason = await storage.getItem(STORAGE_KEYS.selectedSeason);
        const savedHaptics = await storage.getItem(STORAGE_KEYS.enableHaptics);
        const savedDateFilter = await storage.getItem(STORAGE_KEYS.dateFilter);
        const savedNearbyRange = await storage.getItem(STORAGE_KEYS.nearbyRange);
        const savedMapViewEnabled = await storage.getItem(STORAGE_KEYS.mapViewEnabled);
        const savedThemeMode = await storage.getItem(STORAGE_KEYS.themeMode);
        const savedDeveloperMode = await storage.getItem(STORAGE_KEYS.isDeveloperMode);
        const savedAllAroundEligibility = await storage.getItem(STORAGE_KEYS.allAroundEligibilityEnabled);
        const savedTestingEligibility = await storage.getItem(STORAGE_KEYS.testingEligibilityEnabled);
        const savedEligibilityWarningDismissed = await storage.getItem(STORAGE_KEYS.eligibilityWarningDismissed);
        const savedShowAwardsSummary = await storage.getItem(STORAGE_KEYS.showAwardsSummary);
        const savedGlobalSeason = await storage.getItem(STORAGE_KEYS.globalSeasonEnabled);
        const savedDevLiveEventSimulation = await storage.getItem(STORAGE_KEYS.devLiveEventSimulation);
        const savedDevTestEventId = await storage.getItem(STORAGE_KEYS.devTestEventId);
        const savedDeveloperTabEnabled = await storage.getItem(STORAGE_KEYS.developerTabEnabled);
        const savedDevOnlyProgramsEnabled = await storage.getItem(STORAGE_KEYS.devOnlyProgramsEnabled);
        const savedScoringCalculatorsEnabled = await storage.getItem(STORAGE_KEYS.scoringCalculatorsEnabled);
        const savedTeamBrowserEnabled = await storage.getItem(STORAGE_KEYS.teamBrowserEnabled);
        const savedCompactViewAll = await storage.getItem(STORAGE_KEYS.compactViewAll);
        const savedCompactViewMatches = await storage.getItem(STORAGE_KEYS.compactViewMatches);
        const savedCompactViewRankings = await storage.getItem(STORAGE_KEYS.compactViewRankings);
        const savedCompactViewSkills = await storage.getItem(STORAGE_KEYS.compactViewSkills);
        const savedCompactViewTeams = await storage.getItem(STORAGE_KEYS.compactViewTeams);
        const savedStoredDeveloperCode = await storage.getItem(STORAGE_KEYS.storedDeveloperCode);

        if (savedProgram) setSelectedProgramState(savedProgram as ProgramType);
        if (savedSeason) setSelectedSeasonState(savedSeason);
        if (savedHaptics) setEnableHapticsState(JSON.parse(savedHaptics));
        if (savedDateFilter) setDateFilterState(parseInt(savedDateFilter));
        if (savedNearbyRange) setNearbyRangeState(parseInt(savedNearbyRange));
        if (savedMapViewEnabled) setMapViewEnabledState(JSON.parse(savedMapViewEnabled));
        if (savedThemeMode) setThemeModeState(savedThemeMode as ThemeMode);
        if (savedDeveloperMode) setIsDeveloperModeState(JSON.parse(savedDeveloperMode));
        if (savedAllAroundEligibility) setAllAroundEligibilityEnabledState(JSON.parse(savedAllAroundEligibility));
        if (savedTestingEligibility) setTestingEligibilityEnabledState(JSON.parse(savedTestingEligibility));
        if (savedEligibilityWarningDismissed) setEligibilityWarningDismissedState(JSON.parse(savedEligibilityWarningDismissed));
        if (savedShowAwardsSummary) setShowAwardsSummaryState(JSON.parse(savedShowAwardsSummary));
        if (savedGlobalSeason) setGlobalSeasonEnabledState(JSON.parse(savedGlobalSeason));
        if (savedDevLiveEventSimulation) setDevLiveEventSimulationState(JSON.parse(savedDevLiveEventSimulation));
        if (savedDevTestEventId) setDevTestEventIdState(savedDevTestEventId);
        if (savedDeveloperTabEnabled) setDeveloperTabEnabledState(JSON.parse(savedDeveloperTabEnabled));
        if (savedDevOnlyProgramsEnabled) setDevOnlyProgramsEnabledState(JSON.parse(savedDevOnlyProgramsEnabled));
        if (savedScoringCalculatorsEnabled) setScoringCalculatorsEnabledState(JSON.parse(savedScoringCalculatorsEnabled));
        if (savedTeamBrowserEnabled) setTeamBrowserEnabledState(JSON.parse(savedTeamBrowserEnabled));
        if (savedCompactViewAll) setCompactViewAllState(JSON.parse(savedCompactViewAll));
        if (savedCompactViewMatches) setCompactViewMatchesState(JSON.parse(savedCompactViewMatches));
        if (savedCompactViewRankings) setCompactViewRankingsState(JSON.parse(savedCompactViewRankings));
        if (savedCompactViewSkills) setCompactViewSkillsState(JSON.parse(savedCompactViewSkills));
        if (savedCompactViewTeams) setCompactViewTeamsState(JSON.parse(savedCompactViewTeams));
        if (savedStoredDeveloperCode) setStoredDeveloperCodeState(savedStoredDeveloperCode);
      } catch (error) {
        console.error('Failed to load settings:', error);
      }
    };

    loadSettings();
  }, []);

  // Listen for device appearance changes
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setDeviceColorScheme(colorScheme);
    });

    return () => subscription?.remove();
  }, []);

  // Update API when program changes
  useEffect(() => {
    robotEventsAPI.setSelectedProgram(selectedProgram);
  }, [selectedProgram]);

  const setSelectedProgram = async (program: ProgramType) => {
    // Check if program is dev-only and whether it's allowed
    const config = getProgramConfig(program);
    if (config.devOnly && (!isDeveloperMode || !devOnlyProgramsEnabled)) {
      return; // Don't allow dev-only programs without developer mode and dev-only toggle enabled
    }

    setSelectedProgramState(program);
    await storage.setItem(STORAGE_KEYS.selectedProgram, program);
    robotEventsAPI.setSelectedProgram(program);

    // Automatically switch to the current season for the new program
    try {
      const currentSeasonId = await robotEventsAPI.getCurrentSeasonId(program);
      if (currentSeasonId) {
        console.log('Auto-switching to current season for', program || 'Unknown', ': (ID:', currentSeasonId || 'Unknown', ')');
        setSelectedSeasonState(currentSeasonId.toString());
        await storage.setItem(STORAGE_KEYS.selectedSeason, currentSeasonId.toString());
      } else {
        console.log('No current season found for', program || 'Unknown', ', keeping current season');
      }
    } catch (error) {
      console.error('Failed to auto-switch season:', error);
    }
  };

  const setSelectedSeason = async (season: string) => {
    setSelectedSeasonState(season);
    await storage.setItem(STORAGE_KEYS.selectedSeason, season);
  };

  const setEnableHaptics = async (enabled: boolean) => {
    setEnableHapticsState(enabled);
    await storage.setItem(STORAGE_KEYS.enableHaptics, JSON.stringify(enabled));
  };

  const setDateFilter = async (days: number) => {
    setDateFilterState(days);
    await storage.setItem(STORAGE_KEYS.dateFilter, days.toString());
  };

  const setNearbyRange = async (miles: number) => {
    setNearbyRangeState(miles);
    await storage.setItem(STORAGE_KEYS.nearbyRange, miles.toString());
  };

  const setMapViewEnabled = async (enabled: boolean) => {
    setMapViewEnabledState(enabled);
    await storage.setItem(STORAGE_KEYS.mapViewEnabled, JSON.stringify(enabled));
  };

  const setThemeMode = async (mode: ThemeMode) => {
    setThemeModeState(mode);
    await storage.setItem(STORAGE_KEYS.themeMode, mode);
  };


  const setIsDeveloperMode = async (enabled: boolean) => {
    setIsDeveloperModeState(enabled);
    await storage.setItem(STORAGE_KEYS.isDeveloperMode, JSON.stringify(enabled));

    const config = getProgramConfig(selectedProgram);
    if (!enabled && config.devOnly) {
      await setSelectedProgram('VEX V5 Robotics Competition');
    }

    if (!enabled && devOnlyProgramsEnabled) {
      await setDevOnlyProgramsEnabled(false);
    }
    if (!enabled && scoringCalculatorsEnabled) {
      await setScoringCalculatorsEnabled(false);
    }
    if (!enabled && teamBrowserEnabled) {
      await setTeamBrowserEnabled(false);
    }
  };

  const setAllAroundEligibilityEnabled = async (enabled: boolean) => {
    setAllAroundEligibilityEnabledState(enabled);
    await storage.setItem(STORAGE_KEYS.allAroundEligibilityEnabled, JSON.stringify(enabled));
  };

  const setTestingEligibilityEnabled = async (enabled: boolean) => {
    setTestingEligibilityEnabledState(enabled);
    await storage.setItem(STORAGE_KEYS.testingEligibilityEnabled, JSON.stringify(enabled));
  };

  const setEligibilityWarningDismissed = async (enabled: boolean) => {
    setEligibilityWarningDismissedState(enabled);
    await storage.setItem(STORAGE_KEYS.eligibilityWarningDismissed, JSON.stringify(enabled));
  };

  const setShowAwardsSummary = async (enabled: boolean) => {
    setShowAwardsSummaryState(enabled);
    await storage.setItem(STORAGE_KEYS.showAwardsSummary, JSON.stringify(enabled));
  };

  const setGlobalSeasonEnabled = async (enabled: boolean) => {
    setGlobalSeasonEnabledState(enabled);
    await storage.setItem(STORAGE_KEYS.globalSeasonEnabled, JSON.stringify(enabled));
  };

  const setDevLiveEventSimulation = async (enabled: boolean) => {
    setDevLiveEventSimulationState(enabled);
    await storage.setItem(STORAGE_KEYS.devLiveEventSimulation, JSON.stringify(enabled));
  };

  const setDevTestEventId = async (eventId: string) => {
    setDevTestEventIdState(eventId);
    await storage.setItem(STORAGE_KEYS.devTestEventId, eventId);
  };

  const setDeveloperTabEnabled = async (enabled: boolean) => {
    setDeveloperTabEnabledState(enabled);
    await storage.setItem(STORAGE_KEYS.developerTabEnabled, JSON.stringify(enabled));
  };

  const setDevOnlyProgramsEnabled = async (enabled: boolean) => {
    setDevOnlyProgramsEnabledState(enabled);
    await storage.setItem(STORAGE_KEYS.devOnlyProgramsEnabled, JSON.stringify(enabled));

    const config = getProgramConfig(selectedProgram);
    if (!enabled && config.devOnly) {
      await setSelectedProgram('VEX V5 Robotics Competition');
    }
  };

  const setScoringCalculatorsEnabled = async (enabled: boolean) => {
    setScoringCalculatorsEnabledState(enabled);
    await storage.setItem(STORAGE_KEYS.scoringCalculatorsEnabled, JSON.stringify(enabled));
  };

  const setTeamBrowserEnabled = async (enabled: boolean) => {
    setTeamBrowserEnabledState(enabled);
    await storage.setItem(STORAGE_KEYS.teamBrowserEnabled, JSON.stringify(enabled));
  };

  const setCompactViewAll = async (enabled: boolean) => {
    setCompactViewAllState(enabled);
    await storage.setItem(STORAGE_KEYS.compactViewAll, JSON.stringify(enabled));
    setCompactViewMatchesState(enabled);
    setCompactViewRankingsState(enabled);
    setCompactViewSkillsState(enabled);
    setCompactViewTeamsState(enabled);
    await storage.setItem(STORAGE_KEYS.compactViewMatches, JSON.stringify(enabled));
    await storage.setItem(STORAGE_KEYS.compactViewRankings, JSON.stringify(enabled));
    await storage.setItem(STORAGE_KEYS.compactViewSkills, JSON.stringify(enabled));
    await storage.setItem(STORAGE_KEYS.compactViewTeams, JSON.stringify(enabled));
  };

  const setCompactViewMatches = async (enabled: boolean) => {
    setCompactViewMatchesState(enabled);
    await storage.setItem(STORAGE_KEYS.compactViewMatches, JSON.stringify(enabled));
    // Update "All" toggle based on whether all individual toggles are enabled
    updateCompactViewAll();
  };

  const setCompactViewRankings = async (enabled: boolean) => {
    setCompactViewRankingsState(enabled);
    await storage.setItem(STORAGE_KEYS.compactViewRankings, JSON.stringify(enabled));
    updateCompactViewAll();
  };

  const setCompactViewSkills = async (enabled: boolean) => {
    setCompactViewSkillsState(enabled);
    await storage.setItem(STORAGE_KEYS.compactViewSkills, JSON.stringify(enabled));
    updateCompactViewAll();
  };

  const setCompactViewTeams = async (enabled: boolean) => {
    setCompactViewTeamsState(enabled);
    await storage.setItem(STORAGE_KEYS.compactViewTeams, JSON.stringify(enabled));
    updateCompactViewAll();
  };

  const updateCompactViewAll = async () => {
    // Get current values from storage to ensure consistency
    const matches = await storage.getItem(STORAGE_KEYS.compactViewMatches);
    const rankings = await storage.getItem(STORAGE_KEYS.compactViewRankings);
    const skills = await storage.getItem(STORAGE_KEYS.compactViewSkills);
    const teams = await storage.getItem(STORAGE_KEYS.compactViewTeams);

    const allEnabled = matches === 'true' && rankings === 'true' && skills === 'true' && teams === 'true';
    setCompactViewAllState(allEnabled);
    await storage.setItem(STORAGE_KEYS.compactViewAll, JSON.stringify(allEnabled));
  };

  const setStoredDeveloperCode = async (code: string) => {
    setStoredDeveloperCodeState(code);
    await storage.setItem(STORAGE_KEYS.storedDeveloperCode, code);
  };

  const updateGlobalSeason = async (season: string) => {
    if (globalSeasonEnabled) {
      await setSelectedSeason(season);
    }
  };

  const enableDeveloperModeWithCode = async (code: string): Promise<boolean> => {
    if (validateDeveloperCode(code)) {
      await setIsDeveloperMode(true);
      // Store the valid code for future temporary disable/re-enable
      await setStoredDeveloperCode(code);
      return true;
    }
    return false;
  };

  const checkShouldShowWelcome = async (): Promise<boolean> => {
    try {
      const currentVersion = '1.0.0'; // In a real app, get this from app.json or Constants
      const lastWelcomeVersion = await storage.getItem(STORAGE_KEYS.lastWelcomeVersion);
      return lastWelcomeVersion !== currentVersion;
    } catch (error) {
      console.error('Failed to check welcome version:', error);
      return true; // Show welcome on error to be safe
    }
  };

  const setLastWelcomeVersion = async (version: string): Promise<void> => {
    try {
      await storage.setItem(STORAGE_KEYS.lastWelcomeVersion, version);
    } catch (error) {
      console.error('Failed to save welcome version:', error);
    }
  };

  const showWelcomeManually = () => {
    // This will be used to trigger the welcome screen manually from developer mode
    // The logic will be handled in the App component
  };

  console.log('[SettingsProvider] Creating context value object...');

  try {
    const value: SettingsContextType = {
    selectedProgram,
    selectedSeason,
    enableHaptics,
    dateFilter,
    nearbyRange,
    mapViewEnabled,
    themeMode,
    topBarColor,
    topBarContentColor,
    buttonColor,
    isDeveloperMode,
    allAroundEligibilityEnabled,
    testingEligibilityEnabled,
    eligibilityWarningDismissed,
    showAwardsSummary,
    globalSeasonEnabled,
    devLiveEventSimulation,
    devTestEventId,
    developerTabEnabled,
    devOnlyProgramsEnabled,
    scoringCalculatorsEnabled,
    teamBrowserEnabled,
    compactViewAll,
    compactViewMatches,
    compactViewRankings,
    compactViewSkills,
    compactViewTeams,
    storedDeveloperCode,
    setStoredDeveloperCode,
    setCompactViewAll,
    setCompactViewMatches,
    setCompactViewRankings,
    setCompactViewSkills,
    setCompactViewTeams,
    availablePrograms,
    colorScheme,
    backgroundColor,
    textColor,
    cardBackgroundColor,
    secondaryTextColor,
    iconColor,
    borderColor,
    previewProgram,
    setPreviewProgram: setPreviewProgramState,
    setSelectedProgram,
    setSelectedSeason,
    setEnableHaptics,
    setDateFilter,
    setNearbyRange,
    setMapViewEnabled,
    setThemeMode,
    setIsDeveloperMode,
    setAllAroundEligibilityEnabled,
    setTestingEligibilityEnabled,
    setEligibilityWarningDismissed,
    setShowAwardsSummary,
    setGlobalSeasonEnabled,
    setDevLiveEventSimulation,
    setDevTestEventId,
    setDeveloperTabEnabled,
    setDevOnlyProgramsEnabled,
    setScoringCalculatorsEnabled,
    setTeamBrowserEnabled,
    updateGlobalSeason,
    validateDeveloperCode,
    enableDeveloperModeWithCode,
    checkShouldShowWelcome,
    setLastWelcomeVersion,
    showWelcomeManually,
  };

    console.log('[SettingsProvider] About to render with value:', typeof value);
    console.log('[SettingsProvider] Children type:', typeof children);

    return (
      <SettingsContext.Provider value={value}>
        {children}
      </SettingsContext.Provider>
    );

  } catch (error) {
    console.error('[SettingsProvider] ERROR:', error);
    console.error('[SettingsProvider] Error stack:', error instanceof Error ? error.stack : 'Unknown error');

    // Return a basic fallback
    return (
      <SettingsContext.Provider value={{} as SettingsContextType}>
        {children}
      </SettingsContext.Provider>
    );
  }
};

export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};