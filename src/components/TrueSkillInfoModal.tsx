/**
 * TrueSkill Info Modal Component
 *
 * Educational modal that explains TrueSkill metrics and what they mean.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../contexts/SettingsContext';

interface TrueSkillInfoModalProps {
  visible: boolean;
  onClose: () => void;
}

const TrueSkillInfoModal: React.FC<TrueSkillInfoModalProps> = ({
  visible,
  onClose,
}) => {
  const settings = useSettings();

  const metrics = [
    {
      name: 'TrueSkill Rating',
      icon: 'trophy',
      description: 'TrueSkill rating value based on match performance and opponent strength. Uses Microsoft\'s Bayesian skill rating system to estimate team skill level.',
      range: null,
      interpretation: 'Higher values indicate stronger overall performance. This is the primary ranking metric used to compare teams.',
    },
    {
      name: 'Ranking Change',
      icon: 'trending-up',
      description: 'Change in TrueSkill ranking position since the last update.',
      range: '↑ positive = moved up, ↓ negative = moved down',
      interpretation: 'Shows momentum and recent performance trends. Larger changes indicate significant shifts.',
    },
    {
      name: 'CCWM',
      icon: 'calculator',
      description: 'Calculated Contribution to Winning Margin. Equals OPR minus DPR. Measures overall team impact.',
      range: 'Can be positive or negative',
      interpretation: 'Higher values are better.',
    },
    {
      name: 'OPR',
      icon: 'football',
      description: 'Offensive Power Rating. Statistical estimate of points a team contributes to their alliance\'s score.',
      range: 'Varies by season',
      interpretation: 'Higher is better.',
    },
    {
      name: 'DPR',
      icon: 'shield',
      description: 'Defensive Power Rating. Statistical estimate of points a team prevents opponents from scoring.',
      range: 'Can be positive or negative',
      interpretation: null,
    },
    {
      name: 'Record',
      icon: 'list',
      description: 'Total win-loss-tie record across all matches played this season.',
      range: 'W-L-T format',
      interpretation: 'Shows overall match performance. More wins indicate better competitive results.',
    },
    {
      name: 'Win %',
      icon: 'pie-chart',
      description: 'Overall win percentage calculated from total matches played.',
      range: '0-100%',
      interpretation: 'Higher is better.',
    },
    {
      name: 'Skills Ranking',
      icon: 'timer',
      description: 'Your VEX World Skills rank based on highest combined driver and autonomous skills scores.',
      range: null,
      interpretation: null,
    },
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: settings.backgroundColor }]}>
        {/* Header */}
        <View style={[styles.header, {
          backgroundColor: settings.cardBackgroundColor,
          borderBottomColor: settings.borderColor,
          shadowColor: settings.colorScheme === 'dark' ? '#FFFFFF' : '#000000'
        }]}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <Ionicons name="close" size={24} color={settings.iconColor} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: settings.textColor }]}>TrueSkill Metrics</Text>
          <View style={styles.headerButton} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Metrics */}
          {metrics.map((metric, index) => (
            <View
              key={index}
              style={[styles.metricCard, {
                backgroundColor: settings.cardBackgroundColor,
                borderColor: settings.borderColor,
                shadowColor: settings.colorScheme === 'dark' ? '#FFFFFF' : '#000000'
              }]}
            >
              <View style={styles.metricHeader}>
                <Ionicons name={metric.icon as any} size={24} color={settings.buttonColor} />
                <Text style={[styles.metricName, { color: settings.textColor }]}>{metric.name}</Text>
              </View>
              <Text style={[styles.metricDescription, { color: settings.secondaryTextColor }]}>
                {metric.description}
              </Text>
              <View style={styles.metricDetails}>
                {metric.range && (
                  <View style={styles.metricDetailRow}>
                    <Text style={[styles.metricDetailLabel, { color: settings.secondaryTextColor }]}>Range:</Text>
                    <Text style={[styles.metricDetailValue, { color: settings.textColor }]}>{metric.range}</Text>
                  </View>
                )}
                {metric.interpretation && (
                  <View style={styles.metricDetailRow}>
                    <Text style={[styles.metricDetailLabel, { color: settings.secondaryTextColor }]}>Interpretation:</Text>
                    <Text style={[styles.metricDetailValue, { color: settings.textColor }]}>{metric.interpretation}</Text>
                  </View>
                )}
              </View>
            </View>
          ))}

          {/* Data Source Attribution */}
          <View style={[styles.attributionCard, {
            backgroundColor: settings.cardBackgroundColor,
            borderColor: settings.borderColor,
            shadowColor: settings.colorScheme === 'dark' ? '#FFFFFF' : '#000000'
          }]}>
            <Ionicons name="information-circle" size={20} color={settings.buttonColor} />
            <Text style={[styles.attributionText, { color: settings.secondaryTextColor }]}>
              Data provided by{' '}
              <Text style={{ color: settings.buttonColor, fontWeight: '600' }}>vrc-data-analysis.com</Text>
            </Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  headerButton: {
    padding: 8,
    width: 40,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  metricCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  metricName: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  metricDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  metricDetails: {
    gap: 8,
  },
  metricDetailRow: {
    flexDirection: 'row',
    gap: 8,
  },
  metricDetailLabel: {
    fontSize: 13,
    fontWeight: '600',
    minWidth: 110,
  },
  metricDetailValue: {
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  attributionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 12,
    marginBottom: 32,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    gap: 8,
  },
  attributionText: {
    fontSize: 12,
    flex: 1,
  },
});

export default TrueSkillInfoModal;
