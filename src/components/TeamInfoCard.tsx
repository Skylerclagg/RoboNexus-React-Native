/**
 * Reusable Team Info Card Component
 *
 * Modern team information card design used across multiple screens (TeamLookup, TeamInfo, EventTeamView)
 * for consistent team display with statistics, World Skills, awards, and match records.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../contexts/SettingsContext';
import { useFavorites } from '../contexts/FavoritesContext';
import { Team } from '../types';
import { getSkillsDisplayInfo } from '../utils/matchDisplay';
import { getProgramConfig } from '../utils/programMappings';

interface MatchRecord {
  wins: number;
  losses: number;
  ties: number;
  totalMatches: number;
}

interface EventMatchRecord {
  eventWins: number;
  eventLosses: number;
  eventTies: number;
}

interface WorldSkillsData {
  ranking: number;
  combined: number;
  driver: number;
  programming: number;
  highestDriver: number;
  highestProgramming: number;
  totalTeams: number;
}

interface AwardCounts {
  [awardTitle: string]: number;
}

interface TeamInfoCardProps {
  team: Team;
  onPress?: (team: Team) => void;

  // Match record data
  matchRecord?: MatchRecord | null;
  matchRecordLoading?: boolean;

  // Event-specific match record (only for EventTeamViewScreen)
  eventMatchRecord?: EventMatchRecord | null;
  eventMatchRecordLoading?: boolean;

  // World Skills data
  worldSkillsData?: WorldSkillsData | null;
  worldSkillsLoading?: boolean;

  // Awards data
  awardCounts?: AwardCounts;
  awardCountsLoading?: boolean;

  // Event Skills data (for EventTeamViewScreen)
  eventSkillsRanking?: any | null;
  eventSkillsLoading?: boolean;

  // Configuration
  showFavoriteButton?: boolean;
  showHeader?: boolean;
  compactMode?: boolean;
  selectedProgram?: string;
}

const TeamInfoCard: React.FC<TeamInfoCardProps> = ({
  team,
  onPress,
  matchRecord,
  matchRecordLoading = false,
  eventMatchRecord,
  eventMatchRecordLoading = false,
  worldSkillsData,
  worldSkillsLoading = false,
  awardCounts = {},
  awardCountsLoading = false,
  eventSkillsRanking,
  eventSkillsLoading = false,
  showFavoriteButton = true,
  showHeader = true,
  compactMode = false,
  selectedProgram = 'VEX V5 Robotics Competition'
}) => {
  const settings = useSettings();
  const { addTeam, removeTeam, isTeamFavorited } = useFavorites();

  const [isWorldSkillsExpanded, setIsWorldSkillsExpanded] = useState(false);
  const [isAwardsExpanded, setIsAwardsExpanded] = useState(false);

  // Get skills display info using format-aware system
  const skillsDisplayInfo = getSkillsDisplayInfo(selectedProgram);
  const programConfig = getProgramConfig(selectedProgram);

  const getDynamicLabel = (defaultLabel: string) => {
    if (skillsDisplayInfo.competitorType === 'drone') {
      return defaultLabel.replace('Robot', 'Drone');
    }
    return defaultLabel;
  };

  const handleFavoritePress = async (e: any) => {
    e.stopPropagation();
    try {
      if (isTeamFavorited(team.number)) {
        await removeTeam(team.number);
      } else {
        await addTeam(team);
      }
    } catch (error) {
      console.error('Failed to toggle team favorite:', error);
    }
  };

  const renderModernTeamInfo = (label: string, value: string) => (
    <View style={styles.modernInfoRow} key={label}>
      <Text style={[styles.modernInfoLabel, { color: settings.secondaryTextColor }]}>{label}</Text>
      <Text style={[styles.modernInfoValue, { color: settings.textColor }]}>{value}</Text>
    </View>
  );

  const handleCardPress = () => {
    if (onPress) {
      onPress(team);
    }
  };

  return (
    <View style={styles.teamCardContainer}>
      <TouchableOpacity
        style={[
          styles.teamCard,
          {
            backgroundColor: settings.cardBackgroundColor,
            borderColor: settings.borderColor,
            shadowColor: settings.colorScheme === 'dark' ? '#FFFFFF' : '#000000'
          }
        ]}
        onPress={handleCardPress}
        disabled={!onPress}
        activeOpacity={onPress ? 0.7 : 1}
      >
      {/* Team Header */}
      {showHeader && (
        <View style={[styles.teamCardHeader, { borderBottomColor: settings.borderColor }]}>
          <View style={styles.teamHeaderLeft}>
            <View style={[styles.teamNumberBadge, { backgroundColor: settings.buttonColor }]}>
              <Text style={styles.teamNumberBadgeText}>{team.number}</Text>
            </View>
            <View style={styles.teamHeaderInfo}>
              <Text style={[styles.teamCardName, { color: settings.textColor }]}>{team.team_name}</Text>
              <Text style={[styles.teamCardOrg, { color: settings.secondaryTextColor }]}>{team.organization}</Text>
            </View>
          </View>
          <View style={styles.teamHeaderRight}>
            {showFavoriteButton && (
              <TouchableOpacity
                style={styles.modernFavoriteButton}
                onPress={handleFavoritePress}
              >
                <Ionicons
                  name={isTeamFavorited(team.number) ? "heart" : "heart-outline"}
                  size={20}
                  color={isTeamFavorited(team.number) ? "#FF6B6B" : settings.iconColor}
                />
              </TouchableOpacity>
            )}
            {onPress && <Ionicons name="chevron-forward" size={18} color={settings.iconColor} />}
          </View>
        </View>
      )}

      {/* Team Information Grid */}
      <View style={styles.teamInfoGrid}>
        {!showHeader && (
          <>
            {renderModernTeamInfo('Name', team.team_name || '')}
            {renderModernTeamInfo(getDynamicLabel('Robot Name'), team.robot_name || '')}
            {renderModernTeamInfo('Grade Level', team.grade || '')}
            {renderModernTeamInfo('Organization', team.organization || '')}
            {renderModernTeamInfo('Location', team.location ? `${team.location.city}, ${team.location.region}` : '')}
          </>
        )}

        {/* Event Match Record Section (EventTeamViewScreen only) */}
        {eventMatchRecord !== undefined && (
          <View style={styles.skillsSection}>
            <View style={styles.modernInfoRow}>
              <Text style={[styles.modernInfoLabel, { color: settings.secondaryTextColor }]}>Event Match Record</Text>
              <View style={styles.scoreWithChevron}>
                {eventMatchRecordLoading ? (
                  <ActivityIndicator size="small" color={settings.buttonColor} />
                ) : (
                  <Text style={[styles.modernInfoValue, { color: settings.textColor }]}>
                    {eventMatchRecord ? `${eventMatchRecord.eventWins}-${eventMatchRecord.eventLosses}-${eventMatchRecord.eventTies}` : 'No Data Available'}
                  </Text>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Overall Match Record Section */}
        {matchRecord !== undefined && (
          <View style={styles.skillsSection}>
            <View style={styles.modernInfoRow}>
              <Text style={[styles.modernInfoLabel, { color: settings.secondaryTextColor }]}>
                {eventMatchRecord !== undefined ? 'Overall Match Record' : 'Match Record'}
              </Text>
              <View style={styles.scoreWithChevron}>
                {matchRecordLoading ? (
                  <ActivityIndicator size="small" color={settings.buttonColor} />
                ) : (
                  <Text style={[styles.modernInfoValue, { color: settings.textColor }]}>
                    {matchRecord?.totalMatches ? `${matchRecord.wins}-${matchRecord.losses}-${matchRecord.ties}` : 'No Data Available'}
                  </Text>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Event Skills Section (only shown on EventTeamViewScreen) */}
        {eventSkillsRanking !== undefined && (
          <View style={styles.skillsSection}>
            <View style={styles.modernInfoRow}>
              <Text style={[styles.modernInfoLabel, { color: settings.secondaryTextColor }]}>Event Skills Ranking</Text>
              <View style={styles.scoreWithChevron}>
                {eventSkillsLoading ? (
                  <ActivityIndicator size="small" color={settings.buttonColor} />
                ) : (
                  <Text style={[styles.modernInfoValue, { color: settings.textColor }]}>
                    {eventSkillsRanking?.rank ? `#${eventSkillsRanking.rank}` : 'No Data Available'}
                  </Text>
                )}
              </View>
            </View>

            {eventSkillsRanking && eventSkillsRanking.combined_score >= 0 && (
              <View style={styles.modernSkillsBreakdown}>
                {/* Combined Score - always show if we have event skills data */}
                <View style={[styles.modernSkillsBreakdownRow, { borderBottomColor: settings.borderColor }]}>
                  <Text style={[styles.modernSkillsLabel, { color: settings.secondaryTextColor }]}>
                    Combined Score
                  </Text>
                  <Text style={[styles.modernSkillsValue, { color: settings.textColor }]}>
                    {eventSkillsRanking.combined_score}
                  </Text>
                </View>

                {/* Primary Skill - check hasDriverSkills to determine which score field to use */}
                {skillsDisplayInfo.hasPrimarySkill && (
                  <View style={[styles.modernSkillsBreakdownRow, { borderBottomColor: settings.borderColor }]}>
                    <Text style={[styles.modernSkillsLabel, { color: settings.secondaryTextColor }]}>
                      {skillsDisplayInfo.primaryLabel}
                    </Text>
                    <Text style={[styles.modernSkillsValue, { color: settings.textColor }]}>
                      {programConfig.hasDriverSkills
                        ? `${eventSkillsRanking.driver_score || 0} (${eventSkillsRanking.driver_attempts || 0} attempts)`
                        : `${eventSkillsRanking.programming_score || 0} (${eventSkillsRanking.programming_attempts || 0} attempts)`
                      }
                    </Text>
                  </View>
                )}

                {/* Secondary Skill - only show if program has both driver AND programming skills */}
                {programConfig.hasDriverSkills && programConfig.hasProgrammingSkills && eventSkillsRanking.programming_score !== null && eventSkillsRanking.programming_score !== undefined && (
                  <View style={[styles.modernSkillsBreakdownRow, { borderBottomColor: settings.borderColor }]}>
                    <Text style={[styles.modernSkillsLabel, { color: settings.secondaryTextColor }]}>
                      {skillsDisplayInfo.secondaryLabel}
                    </Text>
                    <Text style={[styles.modernSkillsValue, { color: settings.textColor }]}>
                      {eventSkillsRanking.programming_score} ({eventSkillsRanking.programming_attempts || 0} attempts)
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* World Skills Section */}
        {worldSkillsData !== undefined && (
          <View style={styles.skillsSection}>
            <View style={styles.modernInfoRow}>
              <Text style={[styles.modernInfoLabel, { color: settings.secondaryTextColor }]}>World Skills Ranking</Text>
              <View style={styles.scoreWithChevron}>
                {worldSkillsLoading ? (
                  <ActivityIndicator size="small" color={settings.buttonColor} />
                ) : (
                  <Text style={[styles.modernInfoValue, { color: settings.textColor }]}>
                    {worldSkillsData?.ranking ?
                      `#${worldSkillsData.ranking} of ${worldSkillsData.totalTeams}` :
                      'No Data Available'
                    }
                  </Text>
                )}
              </View>
            </View>

            <TouchableOpacity
              style={styles.modernInfoRow}
              onPress={() => worldSkillsData && worldSkillsData.combined > 0 && setIsWorldSkillsExpanded(!isWorldSkillsExpanded)}
              disabled={!worldSkillsData || worldSkillsData.combined === 0}
            >
              <Text style={[styles.modernInfoLabel, { color: settings.secondaryTextColor }]}>World Skills Score</Text>
              <View style={styles.scoreWithChevron}>
                {worldSkillsLoading ? (
                  <ActivityIndicator size="small" color={settings.buttonColor} />
                ) : (
                  <>
                    <Text style={[styles.modernInfoValue, { color: settings.textColor }]}>
                      {worldSkillsData?.combined || 'No Data Available'}
                    </Text>
                    {worldSkillsData && worldSkillsData.combined > 0 && (
                      <Ionicons
                        name={isWorldSkillsExpanded ? "chevron-up" : "chevron-down"}
                        size={16}
                        color={settings.iconColor}
                        style={styles.chevronIcon}
                      />
                    )}
                  </>
                )}
              </View>
            </TouchableOpacity>

            {worldSkillsData && worldSkillsData.combined > 0 && isWorldSkillsExpanded && (
              <View style={styles.modernSkillsBreakdown}>
                <View style={[styles.modernSkillsBreakdownRow, { borderBottomColor: settings.borderColor }]}>
                  <Text style={[styles.modernSkillsLabel, { color: settings.secondaryTextColor }]}>
                    {skillsDisplayInfo.primaryLabel}
                  </Text>
                  <Text style={[styles.modernSkillsValue, { color: settings.textColor }]}>
                    {worldSkillsData.driver}
                  </Text>
                </View>
                {skillsDisplayInfo.secondaryLabel && (
                  <View style={[styles.modernSkillsBreakdownRow, { borderBottomColor: settings.borderColor }]}>
                    <Text style={[styles.modernSkillsLabel, { color: settings.secondaryTextColor }]}>
                      {skillsDisplayInfo.secondaryLabel}
                    </Text>
                    <Text style={[styles.modernSkillsValue, { color: settings.textColor }]}>
                      {worldSkillsData.programming}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* Awards Section */}
        {awardCounts !== undefined && (
          <TouchableOpacity
            style={styles.modernInfoRow}
            onPress={() => Object.keys(awardCounts).length > 0 && setIsAwardsExpanded(!isAwardsExpanded)}
            disabled={Object.keys(awardCounts).length === 0}
          >
            <Text style={[styles.modernInfoLabel, { color: settings.secondaryTextColor }]}>Awards</Text>
            <View style={styles.scoreWithChevron}>
              {awardCountsLoading ? (
                <ActivityIndicator size="small" color={settings.buttonColor} />
              ) : (
                <>
                  <Text style={[styles.modernInfoValue, { color: settings.textColor }]}>
                    {Object.values(awardCounts).reduce((sum, count) => sum + count, 0)}
                  </Text>
                  {Object.keys(awardCounts).length > 0 && (
                    <Ionicons
                      name={isAwardsExpanded ? "chevron-up" : "chevron-down"}
                      size={16}
                      color={settings.iconColor}
                      style={styles.chevronIcon}
                    />
                  )}
                </>
              )}
            </View>
          </TouchableOpacity>
        )}

        {Object.keys(awardCounts).length > 0 && isAwardsExpanded && (
          <View style={styles.modernAwardsBreakdown}>
            {Object.entries(awardCounts).map(([awardTitle, count]) => (
              <View key={awardTitle} style={[styles.modernSkillsBreakdownRow, { borderBottomColor: settings.borderColor }]}>
                <Text style={[styles.modernSkillsLabel, { color: settings.secondaryTextColor }]}>
                  {awardTitle}
                </Text>
                <Text style={[styles.modernSkillsValue, { color: settings.textColor }]}>
                  {count}x
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
      </TouchableOpacity>

      {/* Floating Favorite Button (when showHeader is false) */}
      {!showHeader && showFavoriteButton && (
        <TouchableOpacity
          style={[styles.floatingFavoriteButton, { backgroundColor: settings.cardBackgroundColor, borderColor: settings.borderColor }]}
          onPress={handleFavoritePress}
        >
          <Ionicons
            name={isTeamFavorited(team.number) ? "heart" : "heart-outline"}
            size={18}
            color={isTeamFavorited(team.number) ? "#FF6B6B" : settings.iconColor}
          />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  teamCardContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  teamCard: {
    borderRadius: 12,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  teamCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  teamHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  teamNumberBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 12,
  },
  teamNumberBadgeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  teamHeaderInfo: {
    flex: 1,
  },
  teamCardName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  teamCardOrg: {
    fontSize: 13,
  },
  teamHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modernFavoriteButton: {
    padding: 4,
  },
  teamInfoGrid: {
    padding: 16,
  },
  modernInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  modernInfoLabel: {
    fontSize: 14,
    flex: 1,
  },
  modernInfoValue: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'right',
  },
  skillsSection: {
    marginTop: 8,
  },
  scoreWithChevron: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chevronIcon: {
    marginLeft: 4,
  },
  modernSkillsBreakdown: {
    marginTop: 8,
    paddingTop: 8,
    paddingLeft: 16,
  },
  modernSkillsBreakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modernSkillsLabel: {
    fontSize: 13,
  },
  modernSkillsValue: {
    fontSize: 13,
    fontWeight: '500',
  },
  modernAwardsBreakdown: {
    marginTop: 8,
    paddingTop: 8,
    paddingLeft: 16,
  },
  floatingFavoriteButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
});

export default TeamInfoCard;