import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { createLogger } from '../utils/logger';
import { Appearance, ColorSchemeName } from 'react-native';
import { storage } from '../utils/webCompatibility';
import { robotEventsAPI } from '../services/apiRouter';
import { getAllProgramNames, getProgramConfig } from '../utils/programMappings';
import { setUseBundledGameManuals as setGameManualServiceBundled } from '../services/gameManualService';
import CryptoJS from 'crypto-js';

const logger = createLogger('SettingsContext');

export type ProgramType =
  | 'VEX V5 Robotics Competition'
  | 'VEX IQ Robotics Competition'
  | 'VEX U Robotics Competition'
  | 'VEX AI Robotics Competition'
  | 'Aerial Drone Competition'
  | 'VEX AIR Drone Competition';

export type ThemeMode = 'auto' | 'light' | 'dark';

export type ColorProperty =
  | 'primary'
  | 'topBarColor'
  | 'topBarContentColor'
  | 'buttonColor'
  | 'cardBackgroundColor'
  | 'backgroundColor'
  | 'textColor'
  | 'secondaryTextColor'
  | 'borderColor'
  | 'iconColor';

export interface ColorOverride {
  property: ColorProperty;
  lightModeValue?: string;
  darkModeValue?: string;
}

export type ProgramColorOverrides = {
  [program in ProgramType]?: ColorOverride[];
};

interface SettingsContextType {
  programColorOverrides: ProgramColorOverrides;
  setProgramColorOverrides: (overrides: ProgramColorOverrides) => void;
  resetProgramColorOverrides: (programs: ProgramType[], properties?: ColorProperty[]) => void;
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
  useBundledGameManuals: boolean;
  compactViewAll: boolean;
  compactViewMatches: boolean;
  compactViewRankings: boolean;
  compactViewSkills: boolean;
  compactViewTeams: boolean;
  sortDashboardByNextMatch: boolean;
  scrollBarEnabled: boolean;
  scrollBarMatches: boolean;
  scrollBarRankings: boolean;
  scrollBarSkills: boolean;
  scrollBarTeams: boolean;
  scrollBarWorldSkills: boolean;
  scrollBarEventLookup: boolean;
  scrollBarTeamBrowser: boolean;
  storedDeveloperCode: string;
  setStoredDeveloperCode: (code: string) => void;
  setCompactViewAll: (enabled: boolean) => void;
  setSortDashboardByNextMatch: (enabled: boolean) => void;
  setCompactViewMatches: (enabled: boolean) => void;
  setCompactViewRankings: (enabled: boolean) => void;
  setCompactViewSkills: (enabled: boolean) => void;
  setCompactViewTeams: (enabled: boolean) => void;
  setScrollBarEnabled: (enabled: boolean) => void;
  setScrollBarMatches: (enabled: boolean) => void;
  setScrollBarRankings: (enabled: boolean) => void;
  setScrollBarSkills: (enabled: boolean) => void;
  setScrollBarTeams: (enabled: boolean) => void;
  setScrollBarWorldSkills: (enabled: boolean) => void;
  setScrollBarEventLookup: (enabled: boolean) => void;
  setScrollBarTeamBrowser: (enabled: boolean) => void;
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
  setUseBundledGameManuals: (enabled: boolean) => void;
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
  useBundledGameManuals: 'useBundledGameManuals',
  compactViewAll: 'compactViewAll',
  compactViewMatches: 'compactViewMatches',
  compactViewRankings: 'compactViewRankings',
  compactViewSkills: 'compactViewSkills',
  compactViewTeams: 'compactViewTeams',
  sortDashboardByNextMatch: 'sortDashboardByNextMatch',
  scrollBarEnabled: 'scrollBarEnabled',
  scrollBarMatches: 'scrollBarMatches',
  scrollBarRankings: 'scrollBarRankings',
  scrollBarSkills: 'scrollBarSkills',
  scrollBarTeams: 'scrollBarTeams',
  scrollBarWorldSkills: 'scrollBarWorldSkills',
  scrollBarEventLookup: 'scrollBarEventLookup',
  scrollBarTeamBrowser: 'scrollBarTeamBrowser',
  storedDeveloperCode: 'storedDeveloperCode',
  lastWelcomeVersion: 'lastWelcomeVersion',
  programColorOverrides: 'programColorOverrides',
  globalSeasonMigrated: 'globalSeasonMigrated', // One-time migration flag
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

// Program-based theming function with optional override support
export const getProgramTheme = (program: ProgramType, colorScheme: ColorSchemeName, overrides?: ProgramColorOverrides) => {
  const isDark = colorScheme === 'dark';

  // Get default theme
  let defaultTheme;
  switch (program) {
    case 'VEX V5 Robotics Competition':
    case 'VEX U Robotics Competition':
      defaultTheme = {
        primary: '#FF3B30',    // Red
        background: isDark ? '#000000' : '#FFFFFF',
        content: isDark ? '#FFFFFF' : '#000000',
      };
      break;

    case 'VEX AI Robotics Competition':
      defaultTheme = {
        primary: '#48484A',    // Dark Gray
        background: isDark ? '#000000' : '#FFFFFF',
        content: isDark ? '#FFFFFF' : '#000000',
      };
      break;

    case 'VEX IQ Robotics Competition':
      defaultTheme = {
        primary: '#007AFF',    // Blue
        background: isDark ? '#000000' : '#FFFFFF',
        content: isDark ? '#FFFFFF' : '#000000',
      };
      break;

    case 'Aerial Drone Competition':
      defaultTheme = {
        primary: '#34C759',    // Green
        background: isDark ? '#000000' : '#FFFFFF',
        content: isDark ? '#FFFFFF' : '#000000',
      };
      break;

    case 'VEX AIR Drone Competition':
      defaultTheme = {
        primary: '#FF9500',    // Orange
        background: isDark ? '#000000' : '#FFFFFF',
        content: isDark ? '#FFFFFF' : '#000000',
      };
      break;

    default:
      defaultTheme = {
        primary: '#FF3B30',    // Default to red
        background: isDark ? '#000000' : '#FFFFFF',
        content: isDark ? '#FFFFFF' : '#000000',
      };
  }

  // Apply overrides if they exist
  if (overrides && overrides[program]) {
    const programOverrides = overrides[program]!;
    programOverrides.forEach(override => {
      if (override.property === 'primary') {
        if (isDark && override.darkModeValue) {
          defaultTheme.primary = override.darkModeValue;
        } else if (!isDark && override.lightModeValue) {
          defaultTheme.primary = override.lightModeValue;
        }
      }
    });
  }

  return defaultTheme;
};

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  logger.debug('Starting initialization...');

  // All hooks must be called at the top level, before any conditional logic
  const [selectedProgram, setSelectedProgramState] = useState<ProgramType>('VEX V5 Robotics Competition');
  const [selectedSeason, setSelectedSeasonState] = useState('');
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
  const [useBundledGameManuals, setUseBundledGameManualsState] = useState(false);
  const [compactViewAll, setCompactViewAllState] = useState(false);
  const [compactViewMatches, setCompactViewMatchesState] = useState(false);
  const [compactViewRankings, setCompactViewRankingsState] = useState(false);
  const [compactViewSkills, setCompactViewSkillsState] = useState(false);
  const [compactViewTeams, setCompactViewTeamsState] = useState(false);
  const [sortDashboardByNextMatch, setSortDashboardByNextMatchState] = useState(true);
  const [scrollBarEnabled, setScrollBarEnabledState] = useState(false);
  const [scrollBarMatches, setScrollBarMatchesState] = useState(false);
  const [scrollBarRankings, setScrollBarRankingsState] = useState(false);
  const [scrollBarSkills, setScrollBarSkillsState] = useState(false);
  const [scrollBarTeams, setScrollBarTeamsState] = useState(false);
  const [scrollBarWorldSkills, setScrollBarWorldSkillsState] = useState(false);
  const [scrollBarEventLookup, setScrollBarEventLookupState] = useState(false);
  const [scrollBarTeamBrowser, setScrollBarTeamBrowserState] = useState(false);
  const [storedDeveloperCode, setStoredDeveloperCodeState] = useState('');
  const [deviceColorScheme, setDeviceColorScheme] = useState<ColorSchemeName>(Appearance.getColorScheme());
  const [previewProgram, setPreviewProgramState] = useState<ProgramType | null>(null);
  const [programColorOverrides, setProgramColorOverridesState] = useState<ProgramColorOverrides>({});

  // Calculate effective color scheme based on theme mode
  const colorScheme: ColorSchemeName = themeMode === 'auto'
    ? deviceColorScheme
    : themeMode === 'dark'
      ? 'dark'
      : 'light';

  // Get theme colors based on program and effective color scheme
  // Use preview program if set (for temporary visual preview), otherwise use selected program
  const effectiveProgram = previewProgram || selectedProgram;
  logger.debug('Getting theme for program:', effectiveProgram, 'themeMode:', themeMode, 'effectiveColorScheme:', colorScheme);
  const theme = getProgramTheme(effectiveProgram, colorScheme, programColorOverrides);
  logger.debug('Theme calculated:', theme);
  const isDark = colorScheme === 'dark';

  // Helper function to get color with override support
  const getColorWithOverride = (property: ColorProperty, defaultValue: string): string => {
    const overrides = programColorOverrides[effectiveProgram];
    if (!overrides) return defaultValue;

    const override = overrides.find(o => o.property === property);
    if (!override) return defaultValue;

    if (isDark && override.darkModeValue) {
      return override.darkModeValue;
    } else if (!isDark && override.lightModeValue) {
      return override.lightModeValue;
    }

    return defaultValue;
  };

  // Apply overrides to all color properties
  const topBarColor = getColorWithOverride('topBarColor', theme.primary);
  const topBarContentColor = getColorWithOverride('topBarContentColor', '#FFFFFF');
  const buttonColor = getColorWithOverride('buttonColor', theme.primary);
  const backgroundColor = getColorWithOverride('backgroundColor', theme.background);
  const textColor = getColorWithOverride('textColor', theme.content);
  const cardBackgroundColor = getColorWithOverride('cardBackgroundColor', isDark ? '#1C1C1E' : '#FFFFFF');
  const secondaryTextColor = getColorWithOverride('secondaryTextColor', isDark ? '#8E8E93' : '#666666');
  const iconColor = getColorWithOverride('iconColor', isDark ? '#8E8E93' : '#666666');
  const borderColor = getColorWithOverride('borderColor', isDark ? '#38383A' : '#E5E5E7');

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
        const savedUseBundledGameManuals = await storage.getItem(STORAGE_KEYS.useBundledGameManuals);
        const savedCompactViewAll = await storage.getItem(STORAGE_KEYS.compactViewAll);
        const savedCompactViewMatches = await storage.getItem(STORAGE_KEYS.compactViewMatches);
        const savedCompactViewRankings = await storage.getItem(STORAGE_KEYS.compactViewRankings);
        const savedCompactViewSkills = await storage.getItem(STORAGE_KEYS.compactViewSkills);
        const savedCompactViewTeams = await storage.getItem(STORAGE_KEYS.compactViewTeams);
        const savedSortDashboardByNextMatch = await storage.getItem(STORAGE_KEYS.sortDashboardByNextMatch);
        const savedScrollBarEnabled = await storage.getItem(STORAGE_KEYS.scrollBarEnabled);
        const savedScrollBarMatches = await storage.getItem(STORAGE_KEYS.scrollBarMatches);
        const savedScrollBarRankings = await storage.getItem(STORAGE_KEYS.scrollBarRankings);
        const savedScrollBarSkills = await storage.getItem(STORAGE_KEYS.scrollBarSkills);
        const savedScrollBarTeams = await storage.getItem(STORAGE_KEYS.scrollBarTeams);
        const savedScrollBarWorldSkills = await storage.getItem(STORAGE_KEYS.scrollBarWorldSkills);
        const savedScrollBarEventLookup = await storage.getItem(STORAGE_KEYS.scrollBarEventLookup);
        const savedScrollBarTeamBrowser = await storage.getItem(STORAGE_KEYS.scrollBarTeamBrowser);
        const savedStoredDeveloperCode = await storage.getItem(STORAGE_KEYS.storedDeveloperCode);
        const savedProgramColorOverrides = await storage.getItem(STORAGE_KEYS.programColorOverrides);
        const globalSeasonMigrated = await storage.getItem(STORAGE_KEYS.globalSeasonMigrated);

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

        // Global Season Migration: Enable by default for new users and migrate old users
        if (!globalSeasonMigrated) {
          // First time running with this migration
          if (savedGlobalSeason === null) {
            // New user - set to true (new default)
            setGlobalSeasonEnabledState(true);
            await storage.setItem(STORAGE_KEYS.globalSeasonEnabled, JSON.stringify(true));
          } else {
            // Existing user with old false default - migrate to true
            setGlobalSeasonEnabledState(true);
            await storage.setItem(STORAGE_KEYS.globalSeasonEnabled, JSON.stringify(true));
          }
          // Mark migration as complete
          await storage.setItem(STORAGE_KEYS.globalSeasonMigrated, 'true');
        } else {
          // Migration already done - respect user's current setting
          if (savedGlobalSeason !== null) {
            setGlobalSeasonEnabledState(JSON.parse(savedGlobalSeason));
          }
        }

        if (savedDevLiveEventSimulation) setDevLiveEventSimulationState(JSON.parse(savedDevLiveEventSimulation));
        if (savedDevTestEventId) setDevTestEventIdState(savedDevTestEventId);
        if (savedDeveloperTabEnabled) setDeveloperTabEnabledState(JSON.parse(savedDeveloperTabEnabled));
        if (savedDevOnlyProgramsEnabled) setDevOnlyProgramsEnabledState(JSON.parse(savedDevOnlyProgramsEnabled));
        if (savedScoringCalculatorsEnabled) setScoringCalculatorsEnabledState(JSON.parse(savedScoringCalculatorsEnabled));
        if (savedTeamBrowserEnabled) setTeamBrowserEnabledState(JSON.parse(savedTeamBrowserEnabled));
        if (savedUseBundledGameManuals) setUseBundledGameManualsState(JSON.parse(savedUseBundledGameManuals));
        if (savedCompactViewAll) setCompactViewAllState(JSON.parse(savedCompactViewAll));
        if (savedCompactViewMatches) setCompactViewMatchesState(JSON.parse(savedCompactViewMatches));
        if (savedCompactViewRankings) setCompactViewRankingsState(JSON.parse(savedCompactViewRankings));
        if (savedCompactViewSkills) setCompactViewSkillsState(JSON.parse(savedCompactViewSkills));
        if (savedCompactViewTeams) setCompactViewTeamsState(JSON.parse(savedCompactViewTeams));
        if (savedSortDashboardByNextMatch !== null) {
          setSortDashboardByNextMatchState(JSON.parse(savedSortDashboardByNextMatch));
        }
        if (savedScrollBarEnabled) setScrollBarEnabledState(JSON.parse(savedScrollBarEnabled));
        if (savedScrollBarMatches) setScrollBarMatchesState(JSON.parse(savedScrollBarMatches));
        if (savedScrollBarRankings) setScrollBarRankingsState(JSON.parse(savedScrollBarRankings));
        if (savedScrollBarSkills) setScrollBarSkillsState(JSON.parse(savedScrollBarSkills));
        if (savedScrollBarTeams) setScrollBarTeamsState(JSON.parse(savedScrollBarTeams));
        if (savedScrollBarWorldSkills) setScrollBarWorldSkillsState(JSON.parse(savedScrollBarWorldSkills));
        if (savedScrollBarEventLookup) setScrollBarEventLookupState(JSON.parse(savedScrollBarEventLookup));
        if (savedScrollBarTeamBrowser) setScrollBarTeamBrowserState(JSON.parse(savedScrollBarTeamBrowser));
        if (savedStoredDeveloperCode) setStoredDeveloperCodeState(savedStoredDeveloperCode);
        if (savedProgramColorOverrides) setProgramColorOverridesState(JSON.parse(savedProgramColorOverrides));
      } catch (error) {
        logger.error('Failed to load settings:', error);
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

  // Update game manual service when bundled setting changes
  useEffect(() => {
    setGameManualServiceBundled(useBundledGameManuals);
  }, [useBundledGameManuals]);

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
        logger.debug('Auto-switching to current season for', program || 'Unknown', ': (ID:', currentSeasonId || 'Unknown', ')');
        setSelectedSeasonState(currentSeasonId.toString());
        await storage.setItem(STORAGE_KEYS.selectedSeason, currentSeasonId.toString());
      } else {
        logger.debug('No current season found for', program || 'Unknown', ', keeping current season');
      }
    } catch (error) {
      logger.error('Failed to auto-switch season:', error);
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

  const setUseBundledGameManuals = async (enabled: boolean) => {
    setUseBundledGameManualsState(enabled);
    await storage.setItem(STORAGE_KEYS.useBundledGameManuals, JSON.stringify(enabled));
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

  const setSortDashboardByNextMatch = async (enabled: boolean) => {
    setSortDashboardByNextMatchState(enabled);
    await storage.setItem(STORAGE_KEYS.sortDashboardByNextMatch, JSON.stringify(enabled));
  };

  // Scroll Bar Settings Functions
  const setScrollBarEnabled = async (enabled: boolean) => {
    setScrollBarEnabledState(enabled);
    await storage.setItem(STORAGE_KEYS.scrollBarEnabled, JSON.stringify(enabled));
    setScrollBarMatchesState(enabled);
    setScrollBarRankingsState(enabled);
    setScrollBarSkillsState(enabled);
    setScrollBarTeamsState(enabled);
    setScrollBarWorldSkillsState(enabled);
    setScrollBarEventLookupState(enabled);
    setScrollBarTeamBrowserState(enabled);
    await storage.setItem(STORAGE_KEYS.scrollBarMatches, JSON.stringify(enabled));
    await storage.setItem(STORAGE_KEYS.scrollBarRankings, JSON.stringify(enabled));
    await storage.setItem(STORAGE_KEYS.scrollBarSkills, JSON.stringify(enabled));
    await storage.setItem(STORAGE_KEYS.scrollBarTeams, JSON.stringify(enabled));
    await storage.setItem(STORAGE_KEYS.scrollBarWorldSkills, JSON.stringify(enabled));
    await storage.setItem(STORAGE_KEYS.scrollBarEventLookup, JSON.stringify(enabled));
    await storage.setItem(STORAGE_KEYS.scrollBarTeamBrowser, JSON.stringify(enabled));
  };

  const setScrollBarMatches = async (enabled: boolean) => {
    setScrollBarMatchesState(enabled);
    await storage.setItem(STORAGE_KEYS.scrollBarMatches, JSON.stringify(enabled));
    updateScrollBarAll();
  };

  const setScrollBarRankings = async (enabled: boolean) => {
    setScrollBarRankingsState(enabled);
    await storage.setItem(STORAGE_KEYS.scrollBarRankings, JSON.stringify(enabled));
    updateScrollBarAll();
  };

  const setScrollBarSkills = async (enabled: boolean) => {
    setScrollBarSkillsState(enabled);
    await storage.setItem(STORAGE_KEYS.scrollBarSkills, JSON.stringify(enabled));
    updateScrollBarAll();
  };

  const setScrollBarTeams = async (enabled: boolean) => {
    setScrollBarTeamsState(enabled);
    await storage.setItem(STORAGE_KEYS.scrollBarTeams, JSON.stringify(enabled));
    updateScrollBarAll();
  };

  const setScrollBarWorldSkills = async (enabled: boolean) => {
    setScrollBarWorldSkillsState(enabled);
    await storage.setItem(STORAGE_KEYS.scrollBarWorldSkills, JSON.stringify(enabled));
    updateScrollBarAll();
  };

  const setScrollBarEventLookup = async (enabled: boolean) => {
    setScrollBarEventLookupState(enabled);
    await storage.setItem(STORAGE_KEYS.scrollBarEventLookup, JSON.stringify(enabled));
    updateScrollBarAll();
  };

  const setScrollBarTeamBrowser = async (enabled: boolean) => {
    setScrollBarTeamBrowserState(enabled);
    await storage.setItem(STORAGE_KEYS.scrollBarTeamBrowser, JSON.stringify(enabled));
    updateScrollBarAll();
  };

  const updateScrollBarAll = async () => {
    const matches = await storage.getItem(STORAGE_KEYS.scrollBarMatches);
    const rankings = await storage.getItem(STORAGE_KEYS.scrollBarRankings);
    const skills = await storage.getItem(STORAGE_KEYS.scrollBarSkills);
    const teams = await storage.getItem(STORAGE_KEYS.scrollBarTeams);
    const worldSkills = await storage.getItem(STORAGE_KEYS.scrollBarWorldSkills);
    const eventLookup = await storage.getItem(STORAGE_KEYS.scrollBarEventLookup);
    const teamBrowser = await storage.getItem(STORAGE_KEYS.scrollBarTeamBrowser);

    const allEnabled = matches === 'true' && rankings === 'true' && skills === 'true' &&
                      teams === 'true' && worldSkills === 'true' && eventLookup === 'true' &&
                      teamBrowser === 'true';
    setScrollBarEnabledState(allEnabled);
    await storage.setItem(STORAGE_KEYS.scrollBarEnabled, JSON.stringify(allEnabled));
  };

  const setStoredDeveloperCode = async (code: string) => {
    setStoredDeveloperCodeState(code);
    await storage.setItem(STORAGE_KEYS.storedDeveloperCode, code);
  };

  const setProgramColorOverrides = async (overrides: ProgramColorOverrides) => {
    setProgramColorOverridesState(overrides);
    await storage.setItem(STORAGE_KEYS.programColorOverrides, JSON.stringify(overrides));
  };

  const resetProgramColorOverrides = async (programs: ProgramType[], properties?: ColorProperty[]) => {
    logger.debug('resetProgramColorOverrides called');
    logger.debug('Programs:', programs);
    logger.debug('Properties to remove:', properties);
    logger.debug('Current overrides:', JSON.stringify(programColorOverrides));

    const newOverrides = { ...programColorOverrides };
    programs.forEach(program => {
      if (properties && properties.length > 0) {
        // Remove specific properties only
        logger.debug('Removing specific properties for:', program);
        if (newOverrides[program]) {
          const beforeLength = newOverrides[program]!.length;
          newOverrides[program] = newOverrides[program]!.filter(
            override => !properties.includes(override.property)
          );
          const afterLength = newOverrides[program]!.length;
          logger.debug('Filtered overrides:', beforeLength, '->', afterLength);

          // If no overrides left, remove the program entry entirely
          if (newOverrides[program]!.length === 0) {
            logger.debug('No overrides left, removing program entry');
            delete newOverrides[program];
          }
        }
      } else {
        // Remove all overrides for this program
        logger.debug('Removing ALL overrides for:', program);
        delete newOverrides[program];
      }
    });

    logger.debug('New overrides:', JSON.stringify(newOverrides));
    logger.debug('Calling setProgramColorOverridesState');
    setProgramColorOverridesState(newOverrides);

    logger.debug('Saving to storage');
    await storage.setItem(STORAGE_KEYS.programColorOverrides, JSON.stringify(newOverrides));
    logger.debug('Save complete');
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
      logger.error('Failed to check welcome version:', error);
      return true; // Show welcome on error to be safe
    }
  };

  const setLastWelcomeVersion = async (version: string): Promise<void> => {
    try {
      await storage.setItem(STORAGE_KEYS.lastWelcomeVersion, version);
    } catch (error) {
      logger.error('Failed to save welcome version:', error);
    }
  };

  const showWelcomeManually = () => {
    // This will be used to trigger the welcome screen manually from developer mode
    // The logic will be handled in the App component
  };

  logger.debug('Creating context value object...');

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
    useBundledGameManuals,
    compactViewAll,
    compactViewMatches,
    compactViewRankings,
    compactViewSkills,
    compactViewTeams,
    sortDashboardByNextMatch,
    scrollBarEnabled,
    scrollBarMatches,
    scrollBarRankings,
    scrollBarSkills,
    scrollBarTeams,
    scrollBarWorldSkills,
    scrollBarEventLookup,
    scrollBarTeamBrowser,
    storedDeveloperCode,
    setStoredDeveloperCode,
    programColorOverrides,
    setProgramColorOverrides,
    resetProgramColorOverrides,
    setCompactViewAll,
    setCompactViewMatches,
    setCompactViewRankings,
    setCompactViewSkills,
    setCompactViewTeams,
    setSortDashboardByNextMatch,
    setScrollBarEnabled,
    setScrollBarMatches,
    setScrollBarRankings,
    setScrollBarSkills,
    setScrollBarTeams,
    setScrollBarWorldSkills,
    setScrollBarEventLookup,
    setScrollBarTeamBrowser,
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
    setUseBundledGameManuals,
    updateGlobalSeason,
    validateDeveloperCode,
    enableDeveloperModeWithCode,
    checkShouldShowWelcome,
    setLastWelcomeVersion,
    showWelcomeManually,
  };

    logger.debug('About to render with value:', typeof value);
    logger.debug('Children type:', typeof children);

    return (
      <SettingsContext.Provider value={value}>
        {children}
      </SettingsContext.Provider>
    );

  } catch (error) {
    logger.error('ERROR:', error);
    logger.error('Error stack:', error instanceof Error ? error.stack : 'Unknown error');

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