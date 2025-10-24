// Comprehensive API types for RobotEvents and RECF Events APIs

export interface APIKeyStatus {
  total: number;
  active: number;
  failed: number;
  current: number;
}

// Base pagination interface
export interface PageMeta {
  current_page: number;
  first_page_url: string;
  from: number;
  last_page: number;
  last_page_url: string;
  next_page_url: string | null;
  path: string;
  per_page: number;
  prev_page_url: string | null;
  to: number;
  total: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PageMeta;
}

// Program types
export interface Program {
  id: number;
  name: string;
  abbr: string;
}

// Season types
export interface Season {
  id: number;
  name: string;
  program: IdInfo;
  start: string;
  end: string;
  years_start: number;
  years_end: number;
}

// Common ID info interface
export interface IdInfo {
  id: number;
  name: string;
  code?: string;
}

// Location types
export interface Coordinates {
  lat: number;
  lon: number;
}

export interface Location {
  venue?: string;
  address_1?: string;
  address_2?: string;
  city: string;
  region: string;
  postcode?: string;
  country: string;
  coordinates?: Coordinates;
}

export interface Division {
  id: number;
  name: string;
  order: number;
}

// Event types
export type EventLevel = 'World' | 'National' | 'Regional' | 'State' | 'Signature' | 'Other';
export type EventType = 'tournament' | 'league' | 'workshop' | 'virtual';
export type Grade = 'College' | 'High School' | 'Middle School' | 'Elementary School';

export interface Event {
  id: number;
  sku: string;
  name: string;
  start: string;
  end: string;
  season: IdInfo;
  program: IdInfo;
  location: Location;
  locations?: Record<string, Location>;
  divisions: Division[];
  level: EventLevel;
  ongoing: boolean;
  awards_finalized: boolean;
  event_type: EventType;
}

// Team types
export interface Team {
  id: number;
  number: string;
  team_name: string;
  robot_name?: string;
  organization?: string;
  location: Location;
  registered: boolean;
  program: IdInfo;
  grade: Grade;
}

// Match types
export interface AllianceTeam {
  team: IdInfo;
  sitting: boolean;
}

export interface Alliance {
  color: 'red' | 'blue';
  score: number;
  teams: AllianceTeam[];
}

export interface Match {
  id: number;
  event: IdInfo;
  division: IdInfo;
  round: number;
  instance: number;
  matchnum: number;
  scheduled?: string;
  started?: string;
  field?: string;
  scored: boolean;
  name: string;
  alliances: Alliance[];
}

// Ranking types
export interface Ranking {
  id: number;
  event: IdInfo;
  division: IdInfo;
  rank: number;
  team: IdInfo;
  wins: number;
  losses: number;
  ties: number;
  wp: number;
  ap: number;
  sp: number;
  high_score: number;
  average_points: number;
  total_points: number;
}

// Skills types
export type SkillType = 'driver' | 'programming' | 'package_delivery_time';

export interface Skill {
  id: number;
  event: IdInfo;
  team: IdInfo;
  type: SkillType;
  season: IdInfo;
  division: IdInfo;
  rank: number;
  score: number;
  attempts: number;
}

// Award types
export type AwardClassification = 'champion' | 'finalist' | 'semifinalist' | 'quarterfinalist';
export type AwardDesignation = 'tournament' | 'division';

export interface TeamAwardWinner {
  division?: IdInfo;
  team: IdInfo;
}

export interface Award {
  id: number;
  event: IdInfo;
  order: number;
  title: string;
  qualifications: string[];
  designation?: AwardDesignation;
  classification?: AwardClassification;
  teamWinners: TeamAwardWinner[];
  individualWinners: string[];
}

// World Skills types
export interface WorldSkillsResponse {
  rank: number;
  team: {
    id: number;
    name: string;
    number: string;
    grade: string;
    location: {
      region: string;
      country: string;
    };
  };
  scores: {
    score: number;
    programming: number;
    driver: number;
  };
  season: {
    id: number;
    name: string;
  };
}

// Filter interfaces for comprehensive API coverage
export interface EventFilters {
  id?: number[];
  sku?: string[];
  team?: number[];
  season?: number[];
  start?: string;
  end?: string;
  region?: string;
  level?: EventLevel[];
  myEvents?: boolean;
  eventTypes?: EventType[];
  program?: number[];
  search?: string;
  page?: number;
  per_page?: number;
}

export interface TeamFilters {
  id?: number[];
  number?: string[];
  event?: number[];
  registered?: boolean;
  program?: number[];
  grade?: Grade[];
  country?: string[];
  myTeams?: boolean;
  page?: number;
  per_page?: number;
}

export interface SeasonFilters {
  id?: number[];
  program?: number[];
  team?: number[];
  start?: string;
  end?: string;
  active?: boolean;
  page?: number;
  per_page?: number;
}

export interface ProgramFilters {
  id?: number[];
  page?: number;
  per_page?: number;
}

export interface MatchFilters {
  team?: number[];
  event?: number[];
  season?: number[];
  round?: number[];
  instance?: number[];
  matchnum?: number[];
  page?: number;
  per_page?: number;
}

export interface RankingFilters {
  team?: number[];
  event?: number[];
  rank?: number[];
  season?: number[];
  page?: number;
  per_page?: number;
}

export interface SkillFilters {
  team?: number[];
  event?: number[];
  type?: SkillType[];
  season?: number[];
  page?: number;
  per_page?: number;
}

export interface AwardFilters {
  team?: number[];
  event?: number[];
  winner?: string[];
  season?: number[];
  page?: number;
  per_page?: number;
}

export interface EventTeamFilters {
  number?: string[];
  registered?: boolean;
  grade?: Grade[];
  country?: string[];
  myTeams?: boolean;
  page?: number;
  per_page?: number;
}

// RECF Events API types (placeholder for Aerial Drone Competition)
export interface RECFEvent {
  id: number;
  name: string;
  location: string;
  date: string;
  status: string;
  // Add more fields as needed when implementing RECF API
}

export interface RECFTeam {
  id: number;
  number: string;
  name: string;
  organization: string;
  // Add more fields as needed when implementing RECF API
}

// API Response types
export type EventsResponse = PaginatedResponse<Event>;
export type TeamsResponse = PaginatedResponse<Team>;
export type SeasonsResponse = PaginatedResponse<Season>;
export type ProgramsResponse = PaginatedResponse<Program>;
export type MatchesResponse = PaginatedResponse<Match>;
export type RankingsResponse = PaginatedResponse<Ranking>;
export type SkillsResponse = PaginatedResponse<Skill>;
export type AwardsResponse = PaginatedResponse<Award>;

// Error types
export interface APIError {
  code: number;
  message: string;
}

// Legacy compatibility - these types are already exported above