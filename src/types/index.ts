// Event Level types matching Robot Events API
export type EventLevel = 'World' | 'National' | 'Regional' | 'State' | 'Signature' | 'Other';

export interface Team {
  id: number;
  number: string;
  team_name: string;
  robot_name?: string;
  organization: string;
  location: {
    venue?: string;
    address_1?: string;
    address_2?: string;
    city: string;
    region: string;
    postcode?: string;
    country: string;
  };
  registered: boolean;
  program: {
    id: number;
    name: string;
    code: string;
  };
  grade: string;
}

export interface Event {
  id: number;
  sku: string;
  name: string;
  start: string;
  end: string;
  season: {
    id: number;
    name: string;
    program: {
      id: number;
      name: string;
      code: string;
    };
  };
  program: {
    id: number;
    name: string;
    code: string;
  };
  location: {
    venue?: string;
    address_1?: string;
    address_2?: string;
    city: string;
    region: string;
    postcode?: string;
    country: string;
    coordinates?: {
      lat: number;
      lon: number;
    };
  };
  locations?: {
    [date: string]: {
      venue?: string;
      address_1?: string;
      address_2?: string;
      city: string;
      region: string;
      postcode?: string;
      country: string;
      coordinates?: {
        lat: number;
        lon: number;
      };
    };
  };
  divisions: Division[];
  level: EventLevel;
  ongoing: boolean;
  awards_finalized: boolean;
}

export interface Division {
  id: number;
  name: string;
  order: number;
}

export interface WorldSkillsResponse {
  id: string;
  rank: number;
  team: {
    id: number;
    team: string;
    teamName: string;
    organization: string;
    city: string;
    region: string;
    country: string;
    grade: string;
  };
  scores: {
    score: number;
    programming: number;
    driver: number;
    maxProgramming: number;
    maxDriver: number;
    tier: string;
  };
  event: {
    id: number;
    name: string;
    code: string;
  };
}

export type ProgramType =
  | 'VEX V5 Robotics Competition'
  | 'VEX IQ Robotics Competition'
  | 'VEX U Robotics Competition'
  | 'VEX AI Robotics Competition'
  | 'Aerial Drone Competition';