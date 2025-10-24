import { Team, WorldSkillsResponse } from '../types';
import { Alert, Platform } from 'react-native';
import { fileDownload, isWeb } from './webCompatibility';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { robotEventsAPI } from '../services/apiRouter';

export interface ExportData {
  teams?: Team[];
  eventName?: string;
  eventDate?: string;
  divisionName?: string;
  eventId?: number;
  divisionId?: number;
  seasonId?: number;
}

// Field selection for customizable export (matching Swift version)
export interface ExportableField {
  key: string;
  label: string;
  enabled: boolean;
  slow?: boolean; // Fields that require additional API calls
  category: 'info' | 'performance' | 'skills' | 'history';
}

export interface ExportOptions {
  selectedFields?: { [key: string]: boolean };
  includeAllData?: boolean;
}

// Match statistics data
export interface TeamMatchStats {
  totalMatches: number;
  totalWins: number;
  totalLosses: number;
  totalTies: number;
  winrate: number;
}

// World Skills data
export interface TeamWorldSkills {
  ranking: number;
  combined: number;
  programming: number;
  driver: number;
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
      console.error('Export error:', error);
      throw new Error(`Failed to create CSV file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Default field selection
  static getDefaultFields(): { [key: string]: boolean } {
    return {
      'Team Name': true,
      'Robot Name': true,
      'Organization': true,
      'Team Location': true,
      'Grade Level': true,
      'Total Matches': true,
      'Total Wins': true,
      'Total Losses': true,
      'Total Ties': true,
      'Winrate': true,
      'Event Rank': true,
      'World Skills Ranking': true,
      'Combined Skills': true,
      'Programming Skills': true,
      'Driver Skills': true,
      'Average Qualifiers Ranking': false, // slow
      'Total Events Attended': false, // slow
      'Total Awards': false, // slow
      'Award Details': false, // slow
    };
  }

  // Helper method to generate location string
  private static generateLocation(team: Team): string {
    const locationArray = [team.location?.city, team.location?.region, team.location?.country]
      .filter(item => item && item.trim() !== '');
    return locationArray.join(', ');
  }

  // Calculate match statistics for a team
  private static async calculateMatchStats(teamId: number, eventId?: number, seasonId?: number): Promise<TeamMatchStats> {
    try {
      let matchesResponse;
      if (eventId) {
        // Get matches for specific event
        matchesResponse = await robotEventsAPI.getTeamMatches(teamId, { event: [eventId] });
      } else if (seasonId) {
        // Get all matches for the season
        matchesResponse = await robotEventsAPI.getTeamMatches(teamId, { season: [seasonId] });
      } else {
        // No filter - shouldn't happen, but return empty stats
        return { totalMatches: 0, totalWins: 0, totalLosses: 0, totalTies: 0, winrate: 0 };
      }

      const matches = matchesResponse.data;

      let wins = 0;
      let losses = 0;
      let ties = 0;

      matches.forEach(match => {
        // Skip unscored matches
        if (!match.scored) return;

        const redAlliance = match.alliances.find(a => a.color === 'red');
        const blueAlliance = match.alliances.find(a => a.color === 'blue');

        if (!redAlliance || !blueAlliance) return;

        const isOnRed = redAlliance.teams.some(t => t.team.id === teamId);
        const isOnBlue = blueAlliance.teams.some(t => t.team.id === teamId);

        if (!isOnRed && !isOnBlue) return;

        const redScore = redAlliance.score;
        const blueScore = blueAlliance.score;

        if (redScore === blueScore) {
          ties++;
        } else if ((isOnRed && redScore > blueScore) || (isOnBlue && blueScore > redScore)) {
          wins++;
        } else {
          losses++;
        }
      });

      const totalMatches = wins + losses + ties;
      const winrate = totalMatches > 0 ? wins / totalMatches : 0;

      return { totalMatches, totalWins: wins, totalLosses: losses, totalTies: ties, winrate };
    } catch (error) {
      console.error(`Error calculating match stats for team ${teamId}:`, error);
      return { totalMatches: 0, totalWins: 0, totalLosses: 0, totalTies: 0, winrate: 0 };
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
      console.error(`Error fetching world skills for team ${team.number}:`, error);
      return { ranking: 0, combined: 0, programming: 0, driver: 0 };
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
      console.error(`Error calculating average ranking for team ${teamId}:`, error);
      return 0;
    }
  }

  // Get award details with event names
  private static async getAwardDetails(teamId: number): Promise<string> {
    try {
      const awardsResponse = await robotEventsAPI.getTeamAwards(teamId);
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
      console.error(`Error fetching award details for team ${teamId}:`, error);
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
      console.error(`Error fetching event rank for team ${teamId}:`, error);
      return null;
    }
  }

  static async exportTeamsWithStatsToCSV(
    data: ExportData,
    options?: ExportOptions,
    onProgress?: (current: number, total: number) => void
  ): Promise<void> {
    const { teams, eventName = 'Event', divisionName = 'Division', eventId, seasonId } = data;

    if (!teams || teams.length === 0) {
      throw new Error('No teams data available for export');
    }

    // Use provided field selection or defaults
    const selectedFields = options?.selectedFields || this.getDefaultFields();

    // Build headers
    const headers = ['Team Number'];
    for (const [field, enabled] of Object.entries(selectedFields)) {
      if (enabled) {
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
      let avgRanking: number | null = null;
      let eventRank: number | null = null;
      let totalEvents: number | null = null;
      let totalAwards: number | null = null;
      let awardDetails: string | null = null;

      if ((eventId || seasonId) && (selectedFields['Total Matches'] || selectedFields['Total Wins'] ||
          selectedFields['Total Losses'] || selectedFields['Total Ties'] || selectedFields['Winrate'])) {
        if (eventId) {
          console.log(`[DataExporter] Fetching match stats for team ${team.number} (ID: ${team.id}) at event ${eventId}`);
          matchStats = await this.calculateMatchStats(team.id, eventId);
        } else if (seasonId) {
          console.log(`[DataExporter] Fetching season match stats for team ${team.number} (ID: ${team.id}) for season ${seasonId}`);
          matchStats = await this.calculateMatchStats(team.id, undefined, seasonId);
        }
        console.log(`[DataExporter] Match stats for ${team.number}:`, matchStats);
      }

      if (eventId && selectedFields['Event Rank']) {
        console.log(`[DataExporter] Fetching event rank for team ${team.number} (ID: ${team.id})`);
        eventRank = await this.getEventRank(team.id, eventId, data.divisionId);
        console.log(`[DataExporter] Event rank for ${team.number}:`, eventRank);
      }

      if (seasonId && (selectedFields['World Skills Ranking'] || selectedFields['Combined Skills'] ||
          selectedFields['Programming Skills'] || selectedFields['Driver Skills'])) {
        console.log(`[DataExporter] Fetching world skills for team ${team.number} (ID: ${team.id}) season ${seasonId}`);
        worldSkills = await this.getWorldSkills(team, seasonId);
        console.log(`[DataExporter] World skills for ${team.number}:`, worldSkills);
      }

      if (selectedFields['Average Qualifiers Ranking']) {
        console.log(`[DataExporter] Calculating average ranking for team ${team.number} (ID: ${team.id})`);
        avgRanking = await this.calculateAverageRanking(team.id);
        console.log(`[DataExporter] Average ranking for ${team.number}:`, avgRanking);
      }

      if (selectedFields['Total Events Attended']) {
        try {
          console.log(`[DataExporter] Fetching events for team ${team.number} (ID: ${team.id})`);
          const eventsResponse = await robotEventsAPI.getTeamEvents(team.id);
          totalEvents = eventsResponse.data.length;
          console.log(`[DataExporter] Total events for ${team.number}:`, totalEvents);
        } catch (error) {
          console.error(`[DataExporter] Error fetching events for team ${team.number}:`, error);
          totalEvents = 0;
        }
      }

      if (selectedFields['Total Awards'] || selectedFields['Award Details']) {
        try {
          console.log(`[DataExporter] Fetching awards for team ${team.number} (ID: ${team.id})`);
          const awardsResponse = await robotEventsAPI.getTeamAwards(team.id);
          totalAwards = awardsResponse.data.length;

          if (selectedFields['Award Details']) {
            awardDetails = await this.getAwardDetails(team.id);
          }
          console.log(`[DataExporter] Total awards for ${team.number}:`, totalAwards);
        } catch (error) {
          console.error(`[DataExporter] Error fetching awards for team ${team.number}:`, error);
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
      if (selectedFields['Total Matches']) row.push(matchStats?.totalMatches ?? 0);
      if (selectedFields['Total Wins']) row.push(matchStats?.totalWins ?? 0);
      if (selectedFields['Total Losses']) row.push(matchStats?.totalLosses ?? 0);
      if (selectedFields['Total Ties']) row.push(matchStats?.totalTies ?? 0);
      if (selectedFields['Winrate']) row.push(matchStats ? (matchStats.winrate * 100).toFixed(1) + '%' : '0%');
      if (selectedFields['Event Rank']) row.push(eventRank ?? 'N/A');
      if (selectedFields['World Skills Ranking']) row.push(worldSkills?.ranking || 'N/A');
      if (selectedFields['Combined Skills']) row.push(worldSkills?.combined ?? 0);
      if (selectedFields['Programming Skills']) row.push(worldSkills?.programming ?? 0);
      if (selectedFields['Driver Skills']) row.push(worldSkills?.driver ?? 0);
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
}