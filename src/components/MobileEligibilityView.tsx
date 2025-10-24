import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { TeamSkills, RobotProgram, ProgramRules } from '../utils/eligibility/types';
import { Ionicons } from '@expo/vector-icons';

interface ThemeColors {
  backgroundColor: string;
  cardBackgroundColor: string;
  textColor: string;
  secondaryTextColor: string;
  buttonColor: string;
  iconColor: string;
  borderColor: string;
}

interface MobileEligibilityViewProps {
  eligibleRecords: TeamSkills[];
  ineligibleRecords: TeamSkills[];
  selectedProgram?: RobotProgram;
  programRules?: ProgramRules;
  onTeamPress?: (teamSkills: TeamSkills) => void;
  themeColors?: ThemeColors;
}

export const MobileEligibilityView: React.FC<MobileEligibilityViewProps> = ({
  eligibleRecords,
  ineligibleRecords,
  selectedProgram,
  programRules,
  onTeamPress,
  themeColors
}) => {
  // Default theme colors if not provided
  const theme = themeColors || {
    backgroundColor: '#ffffff',
    cardBackgroundColor: '#f8f9fa',
    textColor: '#000000',
    secondaryTextColor: '#6b7280',
    buttonColor: '#3b82f6',
    iconColor: '#6b7280',
    borderColor: '#e5e7eb'
  };
  const buildSectionHeader = (title: string) => (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionHeaderText, { color: theme.buttonColor }]}>{title}</Text>
    </View>
  );

  const buildMobileTeamRow = (record: TeamSkills) => {
    const team = record.team;

    // Construct location string using city, state (region), and country
    const locationParts: string[] = [];
    if (team.location?.city) locationParts.push(team.location.city);
    if (team.location?.region) locationParts.push(team.location.region);
    if (team.location?.country) locationParts.push(team.location.country);
    const locationString = locationParts.join(', ');

    return (
      <TouchableOpacity
        key={team.id}
        style={[styles.teamCard, { backgroundColor: theme.cardBackgroundColor }]}
        onPress={() => onTeamPress?.(record)}
        activeOpacity={0.7}
      >
        <View style={styles.teamRow}>
          <Text style={[
            styles.teamNumber,
            { color: record.eligible ? '#22c55e' : theme.secondaryTextColor }
          ]}>
            {team.number}
          </Text>

          <View style={styles.teamInfo}>
            <Text style={[styles.teamName, { color: theme.textColor }]} numberOfLines={1}>
              {team.team_name}
            </Text>
            {locationString ? (
              <Text style={[styles.locationText, { color: theme.secondaryTextColor }]} numberOfLines={1}>
                {locationString}
              </Text>
            ) : null}
          </View>

          <Ionicons
            name={record.eligible ? "checkmark-circle-outline" : "close-circle-outline"}
            size={20}
            color={record.eligible ? '#22c55e' : '#ef4444'}
          />
        </View>
      </TouchableOpacity>
    );
  };

  if (eligibleRecords.length === 0 && ineligibleRecords.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={[styles.emptyText, { color: theme.secondaryTextColor }]}>No teams to display with current filters.</Text>
      </View>
    );
  }

  const listItems: React.ReactNode[] = [];

  if (eligibleRecords.length > 0) {
    listItems.push(buildSectionHeader(`Eligible Teams (${eligibleRecords.length})`));
    eligibleRecords.forEach(record => {
      listItems.push(buildMobileTeamRow(record));
    });
  }

  if (ineligibleRecords.length > 0) {
    if (listItems.length > 0) {
      listItems.push(
        <View key="divider" style={styles.divider}>
          <View style={[styles.dividerLine, { backgroundColor: theme.borderColor }]} />
        </View>
      );
    }
    listItems.push(buildSectionHeader(`Ineligible Teams (${ineligibleRecords.length})`));
    ineligibleRecords.forEach(record => {
      listItems.push(buildMobileTeamRow(record));
    });
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {listItems}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingTop: 8,
    paddingBottom: 80,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
  sectionHeader: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sectionHeaderText: {
    fontSize: 18,
    fontWeight: '600',
  },
  teamCard: {
    marginHorizontal: 8,
    marginVertical: 4,
    borderRadius: 8,
    elevation: 1.5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  teamNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    minWidth: 60,
  },
  teamInfo: {
    flex: 1,
    marginLeft: 10,
  },
  teamName: {
    fontSize: 14,
    fontWeight: '500',
  },
  locationText: {
    fontSize: 12,
    marginTop: 2,
  },
  divider: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  dividerLine: {
    height: 1,
  },
});