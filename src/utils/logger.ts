// Global enable/disable
const GLOBAL_ENABLE_LOGS = true;

// Per-module configuration
export const MODULE_LOG_CONFIG = {
  // Utils
  eventUtils: false,
  logger: true,
  dataExporter: false,
  webCompatibility: false,
  eligibilityCalculator: false,

  // Screens
  DashboardScreen: false,
  AwardsScreen: false,
  EventAgendaScreen: false,
  EventDivisionAwardsScreen: false,
  EventDivisionMatchesScreen: false,
  EventDivisionRankingsScreen: false,
  EventInformationScreen: false,
  EventMainView: false,
  EventSkillsRankingsScreen: false,
  EventTeamInfoScreen: false,
  EventTeamListScreen: false,
  EventTeamMatchesScreen: false,
  FavoritesScreen: false,
  FavoriteTeamsMatchesScreen: false,
  GameManualScreen: false,
  LookupScreenSeparated: false,
  MatchNotesScreen: false,
  SettingsScreen: false,
  TeamBrowserScreen: false,
  TeamEventsScreen: false,
  TeamInfoScreen: false,
  WelcomeScreen: false,
  WorldSkillsScreen: false,

  // Components
  AnimatedScrollBar: false,
  DevInfoModal: false,
  EventCard: false,
  EventFiltersModal: false,
  EventLookup: false,
  EventsMapView: false,
  'EventsMapView.web': false,
  GameManualQuickReference: false,
  NotesManagementModal: false,
  TeamBrowserContent: false,
  TeamInfoCard: false,
  TeamLookup: false,
  WebMapView: false,
  WorldSkillsFiltersModal: false,

  // Contexts
  DataCacheContext: false,
  FavoritesContext: false,
  NotesContext: false,
  SettingsContext: false,
  TeamsContext: false,

  // Services
  robotEventsApi: false,
  apiRouter: false,
  gameManualService: false,
  recfEventsAPI: false,
} as const;

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

class ModuleLogger {
  private moduleName: string;

  constructor(moduleName: string) {
    this.moduleName = moduleName;
  }

  private isEnabled(): boolean {
    if (!GLOBAL_ENABLE_LOGS) {
      return false;
    }

    const moduleConfig = MODULE_LOG_CONFIG[this.moduleName as keyof typeof MODULE_LOG_CONFIG];

    if (moduleConfig === undefined) {
      return __DEV__;
    }

    return moduleConfig;
  }

  // Debug level logs
  debug(...args: any[]) {
    if (this.isEnabled()) {
      console.log(`[${this.moduleName}]`, ...args);
    }
  }

  // Info level logs
  info(...args: any[]) {
    if (this.isEnabled()) {
      console.log(`[${this.moduleName}]`, ...args);
    }
  }

  // Warning level logs
  warn(...args: any[]) {
    if (this.isEnabled()) {
      console.warn(`[${this.moduleName}]`, ...args);
    }
  }

  // Error level logs (always logged)
  error(...args: any[]) {
    console.error(`[${this.moduleName}]`, ...args);
  }

  // General purpose logs
  log(...args: any[]) {
    if (this.isEnabled()) {
      console.log(`[${this.moduleName}]`, ...args);
    }
  }
}

export const createLogger = (moduleName: string): ModuleLogger => {
  return new ModuleLogger(moduleName);
};

export default createLogger('default');
