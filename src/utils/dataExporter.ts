import { createLogger } from './logger';
import { Team, WorldSkillsResponse } from '../types';
import { Alert, Platform } from 'react-native';
import { fileDownload, isWeb } from './webCompatibility';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { robotEventsAPI } from '../services/apiRouter';

const logger = createLogger('dataExporter');

export interface ExportData {
  teams?: Team[];
  eventName?: string;
  eventDate?: string;
  divisionName?: string;
  eventId?: number;
  divisionId?: number;
  seasonId?: number;
  exportScope?: 'event' | 'season' | 'season-by-event';
}

// Field selection for customizable export (matching Swift version)
export interface ExportableField {
  key: string;
  label: string;
  enabled: boolean;
  category: 'info' | 'performance' | 'skills' | 'history';
}

export interface ExportOptions {
  selectedFields?: { [key: string]: boolean };
  includeAllData?: boolean;
  eventAwardsScope?: 'event' | 'season'; // For single event exports: show event awards or season awards
}

// Match statistics data from rankings
export interface TeamMatchStats {
  totalMatches: number;
  totalWins: number;
  totalLosses: number;
  totalTies: number;
  winrate: number;
  wp: number;
  ap: number;
  sp: number;
  highScore: number;
  averagePoints: number;
  totalPoints: number;
}

// World Skills data
export interface TeamWorldSkills {
  ranking: number;
  combined: number;
  programming: number;
  driver: number;
}

// Event Skills data
export interface TeamEventSkills {
  driverRank: number;
  driverScore: number;
  programmingRank: number;
  programmingScore: number;
}

export class DataExporter {
  private static escapeCSVValue(value: string | number | undefined | null): string {
    if (value === null || value === undefined) {
      return '';
    }

    const stringValue = String(value);

    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }

    return stringValue;
  }

  private static formatCSVRow(values: (string | number | undefined | null)[]): string {
    return values.map(value => this.escapeCSVValue(value)).join(',');
  }

  static async shareCSVData(csvContent: string, fileName: string): Promise<void> {
    try {
      if (isWeb) {
        // Use web compatibility utility for download
        fileDownload.downloadText(csvContent, fileName, 'text/csv;charset=utf-8;');

        Alert.alert(
          'Download Started',
          `CSV file "${fileName}" download has been started. Check your downloads folder.`,
          [{ text: 'OK' }]
        );
      } else {
        // Native implementation using Expo file system and sharing
        const file = new FileSystem.File(FileSystem.Paths.cache, fileName);
        await file.write(csvContent);
        const filePath = file.uri;

        const isAvailable = await Sharing.isAvailableAsync();

        if (isAvailable) {
          await Sharing.shareAsync(filePath, {
            mimeType: 'text/csv',
            dialogTitle: `Export ${fileName}`,
            UTI: 'public.comma-separated-values-text'
          });
        } else {
          Alert.alert(
            'File Created',
            `CSV file "${fileName}" has been created successfully.\n\nFile location: ${filePath}`,
            [{ text: 'OK' }]
          );
        }
      }
    } catch (error) {
      logger.error('Export error:', error);
      throw new Error(`Failed to create CSV file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Default field selection - all fields enabled
  static getDefaultFields(): { [key: string]: boolean } {
    return {
      'Team Name': true,
      'Robot Name': true,
      'Organization': true,
      'Team Location': true,
      'Grade Level': true,
      'Event Name': true,
      'Total Matches': true,
      'Total Wins': true,
      'Total Losses': true,
      'Total Ties': true,
      'Winrate': true,
      'WP': true,
      'AP': true,
      'SP': true,
      'High Score': true,
      'Average Points': true,
      'Total Points': true,
      'Event Rank': true,
      'Skills Ranking': true,
      'Combined Skills': true,
      'Programming Skills': true,
      'Driver Skills': true,
      'Average Qualifiers Ranking': true,
      'Total Events Attended': true,
      'Total Awards': true,
      'Award Details': true,
    };
  }

  // Helper method to generate location string
  private static generateLocation(team: Team): string {
    const locationArray = [team.location?.city, team.location?.region, team.location?.country]
      .filter(item => item && item.trim() !== '');
    return locationArray.join(', ');
  }

  // Calculate match statistics for a team using rankings API
  private static async calculateMatchStats(teamId: number, eventId?: number, seasonId?: number): Promise<TeamMatchStats> {
    try {
      let rankingsResponse;
      if (eventId) {
        // Get rankings for specific event
        rankingsResponse = await robotEventsAPI.getTeamRankings(teamId, { event: [eventId] });
      } else if (seasonId) {
        // Get all rankings for the season
        rankingsResponse = await robotEventsAPI.getTeamRankings(teamId, { season: [seasonId] });
      } else {
        // No filter - shouldn't happen, but return empty stats
        return {
          totalMatches: 0, totalWins: 0, totalLosses: 0, totalTies: 0, winrate: 0,
          wp: 0, ap: 0, sp: 0, highScore: 0, averagePoints: 0, totalPoints: 0
        };
      }

      const rankings = rankingsResponse.data;

      // Sum up stats across all rankings (one per event)
      let totalWins = 0;
      let totalLosses = 0;
      let totalTies = 0;
      let totalWP = 0;
      let totalAP = 0;
      let totalSP = 0;
      let maxHighScore = 0;
      let sumAveragePoints = 0;
      let sumTotalPoints = 0;

      rankings.forEach(ranking => {
        totalWins += ranking.wins;
        totalLosses += ranking.losses;
        totalTies += ranking.ties;
        totalWP += ranking.wp;
        totalAP += ranking.ap;
        totalSP += ranking.sp;
        maxHighScore = Math.max(maxHighScore, ranking.high_score);
        sumAveragePoints += ranking.average_points;
        sumTotalPoints += ranking.total_points;
      });

      const totalMatches = totalWins + totalLosses + totalTies;
      const winrate = totalMatches > 0 ? totalWins / totalMatches : 0;

      // Average WP, AP, SP, and average points across events
      const numEvents = rankings.length;
      const avgWP = numEvents > 0 ? totalWP / numEvents : 0;
      const avgAP = numEvents > 0 ? totalAP / numEvents : 0;
      const avgSP = numEvents > 0 ? totalSP / numEvents : 0;
      const avgAveragePoints = numEvents > 0 ? sumAveragePoints / numEvents : 0;

      return {
        totalMatches,
        totalWins,
        totalLosses,
        totalTies,
        winrate,
        wp: avgWP,
        ap: avgAP,
        sp: avgSP,
        highScore: maxHighScore,
        averagePoints: avgAveragePoints,
        totalPoints: sumTotalPoints
      };
    } catch (error) {
      logger.error(`Error calculating match stats for team ${teamId}:`, error);
      return {
        totalMatches: 0, totalWins: 0, totalLosses: 0, totalTies: 0, winrate: 0,
        wp: 0, ap: 0, sp: 0, highScore: 0, averagePoints: 0, totalPoints: 0
      };
    }
  }

  // Get World Skills data for a team
  private static async getWorldSkills(team: Team, seasonId: number): Promise<TeamWorldSkills> {
    try {
      const rankings = await robotEventsAPI.getWorldSkillsRankings(seasonId, team.grade);
      const teamSkills = rankings.find(r => r.team.id === team.id);

      if (teamSkills) {
        return {
          ranking: teamSkills.rank,
          combined: teamSkills.scores.score,
          programming: teamSkills.scores.programming,
          driver: teamSkills.scores.driver,
        };
      }
      return { ranking: 0, combined: 0, programming: 0, driver: 0 };
    } catch (error) {
      logger.error(`Error fetching world skills for team ${team.number}:`, error);
      return { ranking: 0, combined: 0, programming: 0, driver: 0 };
    }
  }

  // Get Event Skills data for a team
  private static async getEventSkills(teamId: number, eventId: number): Promise<TeamEventSkills> {
    try {
      const skillsResponse = await robotEventsAPI.getEventSkills(eventId, { team: [teamId] });
      const skills = skillsResponse.data;

      const driverSkill = skills.find(s => s.type === 'driver');
      const programmingSkill = skills.find(s => s.type === 'programming');

      return {
        driverRank: driverSkill?.rank ?? 0,
        driverScore: driverSkill?.score ?? 0,
        programmingRank: programmingSkill?.rank ?? 0,
        programmingScore: programmingSkill?.score ?? 0,
      };
    } catch (error) {
      logger.error(`Error fetching event skills for team ${teamId}:`, error);
      return { driverRank: 0, driverScore: 0, programmingRank: 0, programmingScore: 0 };
    }
  }

  // Calculate average ranking from team's events
  private static async calculateAverageRanking(teamId: number): Promise<number> {
    try {
      // Get all rankings for this team across all events
      const rankingsResponse = await robotEventsAPI.getTeamRankings(teamId);
      const rankings = rankingsResponse.data;

      if (rankings.length === 0) {
        return 0;
      }

      // Calculate average of all valid rankings
      const validRankings = rankings.filter(r => r.rank > 0);
      if (validRankings.length === 0) {
        return 0;
      }

      const totalRank = validRankings.reduce((sum, r) => sum + r.rank, 0);
      return totalRank / validRankings.length;
    } catch (error) {
      logger.error(`Error calculating average ranking for team ${teamId}:`, error);
      return 0;
    }
  }

  // Get award details with event names
  private static async getAwardDetails(teamId: number, eventId?: number, seasonId?: number): Promise<string> {
    try {
      let awardsResponse;
      if (eventId) {
        awardsResponse = await robotEventsAPI.getTeamAwards(teamId, { event: [eventId] });
      } else if (seasonId) {
        awardsResponse = await robotEventsAPI.getTeamAwards(teamId, { season: [seasonId] });
      } else {
        awardsResponse = await robotEventsAPI.getTeamAwards(teamId);
      }
      const awards = awardsResponse.data;

      if (awards.length === 0) {
        return 'None';
      }

      // Format: "Award Name @ Event Name"
      const awardsList = awards.map(award => {
        const awardName = award.title || 'Unknown Award';
        const eventName = award.event?.name || 'Unknown Event';
        return `${awardName} @ ${eventName}`;
      }).join('; ');

      return awardsList;
    } catch (error) {
      logger.error(`Error fetching award details for team ${teamId}:`, error);
      return 'Error';
    }
  }

  // Get event qualification rank for a team
  private static async getEventRank(teamId: number, eventId: number, divisionId?: number): Promise<number | null> {
    try {
      if (divisionId) {
        const rankingsResponse = await robotEventsAPI.getEventDivisionRankings(eventId, divisionId);
        const teamRanking = rankingsResponse.data.find(r => r.team?.id === teamId);
        return teamRanking?.rank ?? null;
      }
      return null;
    } catch (error) {
      logger.error(`Error fetching event rank for team ${teamId}:`, error);
      return null;
    }
  }

  static async exportTeamsWithStatsToCSV(
    data: ExportData,
    options?: ExportOptions,
    onProgress?: (current: number, total: number) => void
  ): Promise<void> {
    const { teams, eventName = 'Event', divisionName = 'Division', eventId, seasonId, exportScope } = data;

    if (!teams || teams.length === 0) {
      throw new Error('No teams data available for export');
    }

    // If season-by-event breakdown is requested, use special export method
    if (exportScope === 'season-by-event' && seasonId) {
      return this.exportTeamsByEvent(data, options, onProgress);
    }

    // Use provided field selection or defaults
    const selectedFields = options?.selectedFields || this.getDefaultFields();

    // Build headers
    const headers = ['Team Number'];
    for (const [field, enabled] of Object.entries(selectedFields)) {
      if (enabled) {
        // Skip Event Rank header for season-wide exports (no eventId)
        if (field === 'Event Rank' && !eventId) {
          continue;
        }
        headers.push(field);
      }
    }

    const rows = [this.formatCSVRow(headers)];

    // Process each team
    for (let i = 0; i < teams.length; i++) {
      const team = teams[i];
      const row: (string | number)[] = [team.number];

      // Fetch additional data if needed
      let matchStats: TeamMatchStats | null = null;
      let worldSkills: TeamWorldSkills | null = null;
      let eventSkills: TeamEventSkills | null = null;
      let avgRanking: number | null = null;
      let eventRank: number | null = null;
      let totalEvents: number | null = null;
      let totalAwards: number | null = null;
      let awardDetails: string | null = null;

      if ((eventId || seasonId) && (selectedFields['Total Matches'] || selectedFields['Total Wins'] ||
          selectedFields['Total Losses'] || selectedFields['Total Ties'] || selectedFields['Winrate'] ||
          selectedFields['WP'] || selectedFields['AP'] || selectedFields['SP'] ||
          selectedFields['High Score'] || selectedFields['Average Points'] || selectedFields['Total Points'])) {
        if (eventId) {
          logger.debug(`Fetching match stats for team ${team.number} (ID: ${team.id}) at event ${eventId}`);
          matchStats = await this.calculateMatchStats(team.id, eventId);
        } else if (seasonId) {
          logger.debug(`Fetching season match stats for team ${team.number} (ID: ${team.id}) for season ${seasonId}`);
          matchStats = await this.calculateMatchStats(team.id, undefined, seasonId);
        }
        logger.debug(`Match stats for ${team.number}:`, matchStats);
      }

      // Only fetch event rank if we're doing an event-scoped export
      if (eventId && selectedFields['Event Rank']) {
        logger.debug(`Fetching event rank for team ${team.number} (ID: ${team.id})`);
        eventRank = await this.getEventRank(team.id, eventId, data.divisionId);
        logger.debug(`Event rank for ${team.number}:`, eventRank);
      }

      // Fetch skills data based on export type
      if (selectedFields['Skills Ranking'] || selectedFields['Combined Skills'] ||
          selectedFields['Programming Skills'] || selectedFields['Driver Skills']) {

        if (eventId) {
          // Single event export: fetch event skills
          logger.debug(`Fetching event skills for team ${team.number} (ID: ${team.id}) at event ${eventId}`);
          eventSkills = await this.getEventSkills(team.id, eventId);
          logger.debug(`Event skills for ${team.number}:`, eventSkills);
        } else if (seasonId) {
          // Season-wide export: fetch world skills
          logger.debug(`Fetching world skills for team ${team.number} (ID: ${team.id}) season ${seasonId}`);
          worldSkills = await this.getWorldSkills(team, seasonId);
          logger.debug(`World skills for ${team.number}:`, worldSkills);
        }
      }

      if (selectedFields['Average Qualifiers Ranking']) {
        logger.debug(`Calculating average ranking for team ${team.number} (ID: ${team.id})`);
        avgRanking = await this.calculateAverageRanking(team.id);
        logger.debug(`Average ranking for ${team.number}:`, avgRanking);
      }

      if (selectedFields['Total Events Attended']) {
        try {
          logger.debug(`Fetching events for team ${team.number} (ID: ${team.id})`);
          const eventsResponse = await robotEventsAPI.getTeamEvents(team.id);
          totalEvents = eventsResponse.data.length;
          logger.debug(`Total events for ${team.number}:`, totalEvents);
        } catch (error) {
          logger.error(`Error fetching events for team ${team.number}:`, error);
          totalEvents = 0;
        }
      }

      if (selectedFields['Total Awards'] || selectedFields['Award Details']) {
        try {
          logger.debug(`Fetching awards for team ${team.number} (ID: ${team.id})`);
          let awardsResponse;

          // Determine which awards to fetch based on export scope and options
          if (eventId && options?.eventAwardsScope === 'event') {
            // Single event export with event awards only
            awardsResponse = await robotEventsAPI.getTeamAwards(team.id, { event: [eventId] });
          } else if (seasonId) {
            // Season export or single event with season awards
            awardsResponse = await robotEventsAPI.getTeamAwards(team.id, { season: [seasonId] });
          } else {
            // Fallback to all awards (shouldn't happen)
            awardsResponse = await robotEventsAPI.getTeamAwards(team.id);
          }

          totalAwards = awardsResponse.data.length;

          if (selectedFields['Award Details']) {
            if (eventId && options?.eventAwardsScope === 'event') {
              awardDetails = await this.getAwardDetails(team.id, eventId);
            } else if (seasonId) {
              awardDetails = await this.getAwardDetails(team.id, undefined, seasonId);
            } else {
              awardDetails = await this.getAwardDetails(team.id);
            }
          }
          logger.debug(`Total awards for ${team.number}:`, totalAwards);
        } catch (error) {
          logger.error(`Error fetching awards for team ${team.number}:`, error);
          totalAwards = 0;
          awardDetails = 'Error';
        }
      }

      // Add each field if selected (in the order they appear in EXPORTABLE_FIELDS)
      if (selectedFields['Team Name']) row.push(team.team_name);
      if (selectedFields['Robot Name']) row.push(team.robot_name || '');
      if (selectedFields['Organization']) row.push(team.organization || '');
      if (selectedFields['Team Location']) row.push(this.generateLocation(team));
      if (selectedFields['Grade Level']) row.push(team.grade || '');
      if (selectedFields['Event Name']) row.push(eventId ? eventName : 'N/A'); // Show event name for single event, N/A for season
      if (selectedFields['Total Matches']) row.push(matchStats?.totalMatches ?? 0);
      if (selectedFields['Total Wins']) row.push(matchStats?.totalWins ?? 0);
      if (selectedFields['Total Losses']) row.push(matchStats?.totalLosses ?? 0);
      if (selectedFields['Total Ties']) row.push(matchStats?.totalTies ?? 0);
      if (selectedFields['Winrate']) row.push(matchStats ? (matchStats.winrate * 100).toFixed(1) + '%' : '0%');
      if (selectedFields['WP']) row.push(matchStats?.wp?.toFixed(2) ?? '0.00');
      if (selectedFields['AP']) row.push(matchStats?.ap?.toFixed(2) ?? '0.00');
      if (selectedFields['SP']) row.push(matchStats?.sp?.toFixed(2) ?? '0.00');
      if (selectedFields['High Score']) row.push(matchStats?.highScore ?? 0);
      if (selectedFields['Average Points']) row.push(matchStats?.averagePoints?.toFixed(2) ?? '0.00');
      if (selectedFields['Total Points']) row.push(matchStats?.totalPoints ?? 0);
      // Only include Event Rank for event-scoped exports
      if (selectedFields['Event Rank'] && eventId) row.push(eventRank ?? 'N/A');

      // Skills columns - populate with event skills OR world skills based on export type
      if (eventId) {
        // Single event export: use event skills data
        if (selectedFields['Skills Ranking']) {
          // For event skills, we'll show the combined rank (average of driver and programming ranks)
          const avgRank = eventSkills?.driverRank && eventSkills?.programmingRank
            ? Math.round((eventSkills.driverRank + eventSkills.programmingRank) / 2)
            : (eventSkills?.driverRank || eventSkills?.programmingRank || 'N/A');
          row.push(avgRank);
        }
        if (selectedFields['Combined Skills']) {
          // Combined = driver + programming scores
          const combined = (eventSkills?.driverScore ?? 0) + (eventSkills?.programmingScore ?? 0);
          row.push(combined);
        }
        if (selectedFields['Programming Skills']) row.push(eventSkills?.programmingScore ?? 0);
        if (selectedFields['Driver Skills']) row.push(eventSkills?.driverScore ?? 0);
      } else {
        // Season export: use world skills data
        if (selectedFields['Skills Ranking']) row.push(worldSkills?.ranking || 'N/A');
        if (selectedFields['Combined Skills']) row.push(worldSkills?.combined ?? 0);
        if (selectedFields['Programming Skills']) row.push(worldSkills?.programming ?? 0);
        if (selectedFields['Driver Skills']) row.push(worldSkills?.driver ?? 0);
      }
      if (selectedFields['Average Qualifiers Ranking']) row.push(avgRanking?.toFixed(2) || 'N/A');
      if (selectedFields['Total Events Attended']) row.push(totalEvents ?? 0);
      if (selectedFields['Total Awards']) row.push(totalAwards ?? 0);
      if (selectedFields['Award Details']) row.push(awardDetails || 'None');

      rows.push(this.formatCSVRow(row));

      // Report progress
      if (onProgress) {
        onProgress(i + 1, teams.length);
      }
    }

    const csvContent = rows.join('\n');
    const fileName = `${eventName}_${divisionName}_Teams_${new Date().toISOString().split('T')[0]}.csv`;

    await this.shareCSVData(csvContent, fileName);
  }

  // Export teams with one row per event (season-by-event breakdown)
  static async exportTeamsByEvent(
    data: ExportData,
    options?: ExportOptions,
    onProgress?: (current: number, total: number) => void
  ): Promise<void> {
    const { teams, eventName = 'Event', divisionName = 'Division', seasonId } = data;

    if (!teams || teams.length === 0) {
      throw new Error('No teams data available for export');
    }

    if (!seasonId) {
      throw new Error('Season ID is required for season-by-event breakdown');
    }

    const selectedFields = options?.selectedFields || this.getDefaultFields();

    // Build headers - always include Event Name for this mode
    const headers = ['Team Number'];
    if (selectedFields['Event Name']) headers.push('Event Name');

    for (const [field, enabled] of Object.entries(selectedFields)) {
      if (enabled && field !== 'Event Name') {
        headers.push(field);
      }
    }

    const rows = [this.formatCSVRow(headers)];
    let totalRows = 0;

    // Process each team
    for (let i = 0; i < teams.length; i++) {
      const team = teams[i];

      try {
        // Get all rankings for this team in the season (one per event)
        const rankingsResponse = await robotEventsAPI.getTeamRankings(team.id, { season: [seasonId] });
        const rankings = rankingsResponse.data;

        logger.debug(`Team ${team.number} attended ${rankings.length} events`);

        // Create one row per event
        for (const ranking of rankings) {
          const row: (string | number)[] = [team.number];

          // Add event name if selected
          if (selectedFields['Event Name']) {
            row.push(ranking.event.name || 'Unknown Event');
          }

          // Basic team info
          if (selectedFields['Team Name']) row.push(team.team_name);
          if (selectedFields['Robot Name']) row.push(team.robot_name || '');
          if (selectedFields['Organization']) row.push(team.organization || '');
          if (selectedFields['Team Location']) row.push(this.generateLocation(team));
          if (selectedFields['Grade Level']) row.push(team.grade || '');

          // Performance stats from this event's ranking
          const matches = ranking.wins + ranking.losses + ranking.ties;
          const winrate = matches > 0 ? ranking.wins / matches : 0;

          if (selectedFields['Total Matches']) row.push(matches);
          if (selectedFields['Total Wins']) row.push(ranking.wins);
          if (selectedFields['Total Losses']) row.push(ranking.losses);
          if (selectedFields['Total Ties']) row.push(ranking.ties);
          if (selectedFields['Winrate']) row.push((winrate * 100).toFixed(1) + '%');
          if (selectedFields['WP']) row.push(ranking.wp.toFixed(2));
          if (selectedFields['AP']) row.push(ranking.ap.toFixed(2));
          if (selectedFields['SP']) row.push(ranking.sp.toFixed(2));
          if (selectedFields['High Score']) row.push(ranking.high_score);
          if (selectedFields['Average Points']) row.push(ranking.average_points.toFixed(2));
          if (selectedFields['Total Points']) row.push(ranking.total_points);
          if (selectedFields['Event Rank']) row.push(ranking.rank);

          // Skills columns for individual event rows - use event skills
          if (selectedFields['Skills Ranking'] || selectedFields['Combined Skills'] ||
              selectedFields['Programming Skills'] || selectedFields['Driver Skills']) {
            try {
              const eventSkills = await this.getEventSkills(team.id, ranking.event.id);

              if (selectedFields['Skills Ranking']) {
                // For event skills, show average of driver and programming ranks
                const avgRank = eventSkills?.driverRank && eventSkills?.programmingRank
                  ? Math.round((eventSkills.driverRank + eventSkills.programmingRank) / 2)
                  : (eventSkills?.driverRank || eventSkills?.programmingRank || 'N/A');
                row.push(avgRank);
              }
              if (selectedFields['Combined Skills']) {
                const combined = (eventSkills?.driverScore ?? 0) + (eventSkills?.programmingScore ?? 0);
                row.push(combined);
              }
              if (selectedFields['Programming Skills']) row.push(eventSkills?.programmingScore ?? 0);
              if (selectedFields['Driver Skills']) row.push(eventSkills?.driverScore ?? 0);
            } catch (error) {
              logger.error(`Error fetching event skills for team ${team.number}:`, error);
              if (selectedFields['Skills Ranking']) row.push('N/A');
              if (selectedFields['Combined Skills']) row.push(0);
              if (selectedFields['Programming Skills']) row.push(0);
              if (selectedFields['Driver Skills']) row.push(0);
            }
          }

          // Cache world skills for SEASON TOTAL row (fetch once per team)
          if (rankings.indexOf(ranking) === 0) {
            const worldSkills = await this.getWorldSkills(team, seasonId);
            (team as any)._worldSkills = worldSkills;
          }

          // Season-level stats (same for all rows for this team)
          if (selectedFields['Average Qualifiers Ranking']) {
            if (rankings.indexOf(ranking) === 0) {
              const avgRanking = await this.calculateAverageRanking(team.id);
              (team as any)._avgRanking = avgRanking;
            }
            row.push((team as any)._avgRanking?.toFixed(2) || 'N/A');
          }

          if (selectedFields['Total Events Attended']) {
            row.push(rankings.length);
          }

          if (selectedFields['Total Awards'] || selectedFields['Award Details']) {
            // For individual event rows, fetch awards for that specific event
            try {
              const eventAwardsResponse = await robotEventsAPI.getTeamAwards(team.id, { event: [ranking.event.id] });
              const eventAwardsCount = eventAwardsResponse.data.length;

              if (selectedFields['Total Awards']) row.push(eventAwardsCount);

              if (selectedFields['Award Details']) {
                const eventAwardDetails = await this.getAwardDetails(team.id, ranking.event.id);
                row.push(eventAwardDetails);
              }
            } catch (error) {
              logger.error(`Error fetching event awards for team ${team.number}:`, error);
              if (selectedFields['Total Awards']) row.push(0);
              if (selectedFields['Award Details']) row.push('Error');
            }
          }

          rows.push(this.formatCSVRow(row));
          totalRows++;
        }

        // Add a season totals row for this team
        if (rankings.length > 0) {
          const seasonRow: (string | number)[] = [team.number];

          // Add "SEASON TOTAL" as event name
          if (selectedFields['Event Name']) {
            seasonRow.push('SEASON TOTAL');
          }

          // Basic team info
          if (selectedFields['Team Name']) seasonRow.push(team.team_name);
          if (selectedFields['Robot Name']) seasonRow.push(team.robot_name || '');
          if (selectedFields['Organization']) seasonRow.push(team.organization || '');
          if (selectedFields['Team Location']) seasonRow.push(this.generateLocation(team));
          if (selectedFields['Grade Level']) seasonRow.push(team.grade || '');

          // Aggregate performance stats across all events
          let totalWins = 0;
          let totalLosses = 0;
          let totalTies = 0;
          let totalWP = 0;
          let totalAP = 0;
          let totalSP = 0;
          let maxHighScore = 0;
          let sumAveragePoints = 0;
          let sumTotalPoints = 0;

          rankings.forEach(ranking => {
            totalWins += ranking.wins;
            totalLosses += ranking.losses;
            totalTies += ranking.ties;
            totalWP += ranking.wp;
            totalAP += ranking.ap;
            totalSP += ranking.sp;
            maxHighScore = Math.max(maxHighScore, ranking.high_score);
            sumAveragePoints += ranking.average_points;
            sumTotalPoints += ranking.total_points;
          });

          const totalMatches = totalWins + totalLosses + totalTies;
          const seasonWinrate = totalMatches > 0 ? totalWins / totalMatches : 0;
          const numEvents = rankings.length;

          if (selectedFields['Total Matches']) seasonRow.push(totalMatches);
          if (selectedFields['Total Wins']) seasonRow.push(totalWins);
          if (selectedFields['Total Losses']) seasonRow.push(totalLosses);
          if (selectedFields['Total Ties']) seasonRow.push(totalTies);
          if (selectedFields['Winrate']) seasonRow.push((seasonWinrate * 100).toFixed(1) + '%');
          if (selectedFields['WP']) seasonRow.push((totalWP / numEvents).toFixed(2));
          if (selectedFields['AP']) seasonRow.push((totalAP / numEvents).toFixed(2));
          if (selectedFields['SP']) seasonRow.push((totalSP / numEvents).toFixed(2));
          if (selectedFields['High Score']) seasonRow.push(maxHighScore);
          if (selectedFields['Average Points']) seasonRow.push((sumAveragePoints / numEvents).toFixed(2));
          if (selectedFields['Total Points']) seasonRow.push(sumTotalPoints);
          if (selectedFields['Event Rank']) seasonRow.push('N/A'); // No single rank for season

          // Skills columns for SEASON TOTAL row - use world skills
          const worldSkills = (team as any)._worldSkills;
          if (selectedFields['Skills Ranking']) seasonRow.push(worldSkills?.ranking || 'N/A');
          if (selectedFields['Combined Skills']) seasonRow.push(worldSkills?.combined ?? 0);
          if (selectedFields['Programming Skills']) seasonRow.push(worldSkills?.programming ?? 0);
          if (selectedFields['Driver Skills']) seasonRow.push(worldSkills?.driver ?? 0);

          // Season-level stats
          if (selectedFields['Average Qualifiers Ranking']) {
            seasonRow.push((team as any)._avgRanking?.toFixed(2) || 'N/A');
          }
          if (selectedFields['Total Events Attended']) {
            seasonRow.push(rankings.length);
          }

          // For SEASON TOTAL row, fetch season awards
          if (selectedFields['Total Awards'] || selectedFields['Award Details']) {
            try {
              const seasonAwardsResponse = await robotEventsAPI.getTeamAwards(team.id, { season: [seasonId] });
              const seasonAwardsCount = seasonAwardsResponse.data.length;

              if (selectedFields['Total Awards']) seasonRow.push(seasonAwardsCount);

              if (selectedFields['Award Details']) {
                const seasonAwardDetails = await this.getAwardDetails(team.id, undefined, seasonId);
                seasonRow.push(seasonAwardDetails);
              }
            } catch (error) {
              logger.error(`Error fetching season awards for team ${team.number}:`, error);
              if (selectedFields['Total Awards']) seasonRow.push(0);
              if (selectedFields['Award Details']) seasonRow.push('Error');
            }
          }

          rows.push(this.formatCSVRow(seasonRow));
          totalRows++;
        }

      } catch (error) {
        logger.error(`Error fetching data for team ${team.number}:`, error);
      }

      // Report progress
      if (onProgress) {
        onProgress(i + 1, teams.length);
      }
    }

    const csvContent = rows.join('\n');
    const fileName = `${eventName}_${divisionName}_ByEvent_${new Date().toISOString().split('T')[0]}.csv`;

    await this.shareCSVData(csvContent, fileName);
  }
}