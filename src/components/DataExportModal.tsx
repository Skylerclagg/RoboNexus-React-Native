import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../contexts/SettingsContext';

interface ExportField {
  key: string;
  label: string;
  category: 'info' | 'performance' | 'skills' | 'history';
}

interface DataExportModalProps {
  visible: boolean;
  onClose: () => void;
  onExport: (selectedFields: { [key: string]: boolean }, exportScope: 'event' | 'season' | 'season-by-event', eventAwardsScope?: 'event' | 'season') => void;
  eventName: string;
  seasonName?: string;
  isExporting?: boolean;
  exportProgress?: { current: number; total: number; startTime?: number };
}

const EXPORTABLE_FIELDS: ExportField[] = [
  // Basic Info
  { key: 'Team Name', label: 'Team Name', category: 'info' },
  { key: 'Robot Name', label: 'Robot Name', category: 'info' },
  { key: 'Organization', label: 'Organization/School', category: 'info' },
  { key: 'Team Location', label: 'Location (City, Region, Country)', category: 'info' },
  { key: 'Grade Level', label: 'Grade Level', category: 'info' },
  { key: 'Event Name', label: 'Event Name (for by-event breakdown)', category: 'info' },

  // Performance
  { key: 'Total Matches', label: 'Match Count', category: 'performance' },
  { key: 'Total Wins', label: 'Wins', category: 'performance' },
  { key: 'Total Losses', label: 'Losses', category: 'performance' },
  { key: 'Total Ties', label: 'Ties', category: 'performance' },
  { key: 'Winrate', label: 'Win Rate (%)', category: 'performance' },
  { key: 'WP', label: 'WP', category: 'performance' },
  { key: 'AP', label: 'AP', category: 'performance' },
  { key: 'SP', label: 'SP', category: 'performance' },
  { key: 'High Score', label: 'Highest Score', category: 'performance' },
  { key: 'Average Points', label: 'Average Points', category: 'performance' },
  { key: 'Total Points', label: 'Total Points', category: 'performance' },
  { key: 'Event Rank', label: 'Qualification Rank', category: 'performance' },

  // Skills
  { key: 'Skills Ranking', label: 'Skills Ranking (Event rank or World rank)', category: 'skills' },
  { key: 'Combined Skills', label: 'Combined Score', category: 'skills' },
  { key: 'Programming Skills', label: 'Programming Score', category: 'skills' },
  { key: 'Driver Skills', label: 'Driver Score', category: 'skills' },

  // History (requires additional API calls per team)
  { key: 'Average Qualifiers Ranking', label: 'Season Avg. Rank', category: 'history' },
  { key: 'Total Events Attended', label: 'Events This Season', category: 'history' },
  { key: 'Total Awards', label: 'Awards This Season', category: 'history' },
  { key: 'Award Details', label: 'Award Names & Events', category: 'history' },
];

const DataExportModal: React.FC<DataExportModalProps> = ({
  visible,
  onClose,
  onExport,
  eventName,
  seasonName,
  isExporting = false,
  exportProgress,
}) => {
  const settings = useSettings();

  // Initialize with default selections - enable all fields by default
  const [selectedFields, setSelectedFields] = useState<{ [key: string]: boolean }>(() => {
    const defaults: { [key: string]: boolean } = {};
    EXPORTABLE_FIELDS.forEach(field => {
      defaults[field.key] = true;
    });
    return defaults;
  });

  const [exportScope, setExportScope] = useState<'event' | 'season' | 'season-by-event'>('event');
  const [eventAwardsScope, setEventAwardsScope] = useState<'event' | 'season'>('event');

  // Calculate estimated time remaining
  const getEstimatedTimeRemaining = (): string => {
    if (!exportProgress || !exportProgress.startTime || exportProgress.current === 0) {
      return 'Calculating...';
    }

    const elapsedMs = Date.now() - exportProgress.startTime;
    const avgTimePerTeam = elapsedMs / exportProgress.current;
    const remainingTeams = exportProgress.total - exportProgress.current;
    const estimatedRemainingMs = avgTimePerTeam * remainingTeams;

    // Convert to readable format
    const seconds = Math.ceil(estimatedRemainingMs / 1000);
    if (seconds < 60) {
      return `${seconds} second${seconds !== 1 ? 's' : ''}`;
    } else {
      const minutes = Math.ceil(seconds / 60);
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
  };

  const toggleField = (key: string) => {
    setSelectedFields(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const toggleCategory = (category: string) => {
    const categoryFields = EXPORTABLE_FIELDS.filter(f => f.category === category);
    const allEnabled = categoryFields.every(f => selectedFields[f.key]);

    const updated = { ...selectedFields };
    categoryFields.forEach(field => {
      updated[field.key] = !allEnabled;
    });
    setSelectedFields(updated);
  };

  const selectAll = () => {
    const allSelected: { [key: string]: boolean } = {};
    EXPORTABLE_FIELDS.forEach(field => {
      allSelected[field.key] = true;
    });
    setSelectedFields(allSelected);
  };

  const selectNone = () => {
    const noneSelected: { [key: string]: boolean } = {};
    EXPORTABLE_FIELDS.forEach(field => {
      noneSelected[field.key] = false;
    });
    setSelectedFields(noneSelected);
  };

  const handleExport = () => {
    const selectedCount = Object.values(selectedFields).filter(Boolean).length;
    if (selectedCount === 0) {
      Alert.alert('No Fields Selected', 'Please select at least one field to export.');
      return;
    }

    // Show confirmation for all exports
    Alert.alert(
      'Start Export',
      'This export will make API calls for each team and may take a few minutes to complete. Please do not leave this screen until the export finishes.\n\nAre you sure you want to continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue', onPress: () => onExport(selectedFields, exportScope, eventAwardsScope) },
      ]
    );
  };

  const getCategoryIcon = (category: string): string => {
    switch (category) {
      case 'info': return 'information-circle';
      case 'performance': return 'trophy';
      case 'skills': return 'ribbon';
      case 'history': return 'time';
      default: return 'list';
    }
  };

  const getCategoryLabel = (category: string): string => {
    switch (category) {
      case 'info': return 'Basic Information';
      case 'performance': return 'Event Performance';
      case 'skills': return 'Skills Rankings';
      case 'history': return 'Season History';
      default: return category;
    }
  };

  const renderCategory = (category: string) => {
    const categoryFields = EXPORTABLE_FIELDS.filter(f => f.category === category);
    const allEnabled = categoryFields.every(f => selectedFields[f.key]);
    const someEnabled = categoryFields.some(f => selectedFields[f.key]);

    return (
      <View key={category} style={styles.categoryContainer}>
        <TouchableOpacity
          style={[
            styles.categoryHeader,
            {
              backgroundColor: settings.cardBackgroundColor,
              borderColor: settings.borderColor,
              shadowColor: settings.colorScheme === 'dark' ? '#FFFFFF' : '#000000',
            }
          ]}
          onPress={() => toggleCategory(category)}
        >
          <View style={styles.categoryTitleContainer}>
            <View style={[styles.categoryIconContainer, { backgroundColor: `${settings.buttonColor}20` }]}>
              <Ionicons name={getCategoryIcon(category) as any} size={20} color={settings.buttonColor} />
            </View>
            <Text style={[styles.categoryTitle, { color: settings.textColor }]}>
              {getCategoryLabel(category)}
            </Text>
          </View>
          <Ionicons
            name={allEnabled ? "checkmark-circle" : (someEnabled ? "ellipse-outline" : "ellipse-outline")}
            size={24}
            color={allEnabled || someEnabled ? settings.buttonColor : settings.secondaryTextColor}
          />
        </TouchableOpacity>

        <View style={styles.fieldsContainer}>
          {categoryFields.map(field => (
            <TouchableOpacity
              key={field.key}
              style={[
                styles.fieldRow,
                {
                  backgroundColor: settings.cardBackgroundColor,
                  borderColor: settings.borderColor,
                }
              ]}
              onPress={() => toggleField(field.key)}
              activeOpacity={0.7}
            >
              <View style={styles.fieldLabelContainer}>
                <Text style={[styles.fieldLabel, { color: settings.textColor }]}>
                  {field.label}
                </Text>
              </View>
              <Switch
                value={selectedFields[field.key]}
                onValueChange={() => toggleField(field.key)}
                trackColor={{ false: '#767577', true: settings.buttonColor }}
                thumbColor={selectedFields[field.key] ? '#FFFFFF' : '#f4f3f4'}
              />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: settings.backgroundColor }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: settings.topBarColor, borderBottomColor: settings.borderColor }]}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <Ionicons name="close" size={28} color={settings.topBarContentColor} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: settings.topBarContentColor }]}>
            Export Data
          </Text>
          <TouchableOpacity onPress={handleExport} style={styles.headerButton}>
            <Text style={[styles.headerButtonText, { color: settings.topBarContentColor }]}>Export</Text>
          </TouchableOpacity>
        </View>

        {/* Progress Overlay */}
        {isExporting && exportProgress && (
          <View style={[styles.progressOverlay, { backgroundColor: `${settings.backgroundColor}E6` }]}>
            <View style={[styles.progressCard, {
              backgroundColor: settings.cardBackgroundColor,
              borderColor: settings.borderColor,
              shadowColor: settings.colorScheme === 'dark' ? '#FFFFFF' : '#000000',
            }]}>
              <View style={[styles.progressIconContainer, { backgroundColor: `${settings.buttonColor}20` }]}>
                <Ionicons name="cloud-download" size={32} color={settings.buttonColor} />
              </View>

              <Text style={[styles.progressTitle, { color: settings.textColor }]}>
                Exporting Data
              </Text>

              <Text style={[styles.progressSubtitle, { color: settings.secondaryTextColor }]}>
                Processing team {exportProgress.current} of {exportProgress.total}
              </Text>

              {/* Progress Bar */}
              <View style={[styles.progressBarContainer, { backgroundColor: settings.borderColor }]}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      backgroundColor: settings.buttonColor,
                      width: `${(exportProgress.current / exportProgress.total) * 100}%`
                    }
                  ]}
                />
              </View>

              {/* Percentage */}
              <Text style={[styles.progressPercentage, { color: settings.buttonColor }]}>
                {Math.round((exportProgress.current / exportProgress.total) * 100)}%
              </Text>

              {/* Estimated Time Remaining */}
              <Text style={[styles.progressTimeRemaining, { color: settings.secondaryTextColor }]}>
                Estimated time remaining: {getEstimatedTimeRemaining()}
              </Text>

              <Text style={[styles.progressNote, { color: settings.secondaryTextColor }]}>
                Please wait, this may take a few moments...
              </Text>
            </View>
          </View>
        )}

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Export Scope Selection */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Ionicons name="calendar" size={20} color={settings.buttonColor} style={{ marginRight: 8 }} />
              <Text style={[styles.sectionTitle, { color: settings.textColor }]}>Data Source</Text>
            </View>
            <Text style={[styles.sectionSubtitle, { color: settings.secondaryTextColor }]}>
              Select which teams and data to export
            </Text>

            <TouchableOpacity
              style={[
                styles.scopeOption,
                exportScope === 'event' && styles.scopeOptionSelected,
                {
                  backgroundColor: exportScope === 'event' ? `${settings.buttonColor}15` : settings.cardBackgroundColor,
                  borderColor: exportScope === 'event' ? settings.buttonColor : settings.borderColor,
                  shadowColor: settings.colorScheme === 'dark' ? '#FFFFFF' : '#000000',
                }
              ]}
              onPress={() => setExportScope('event')}
              activeOpacity={0.7}
            >
              <View style={styles.scopeOptionContent}>
                <View style={[
                  styles.radioButton,
                  exportScope === 'event' && styles.radioButtonSelected,
                  { borderColor: exportScope === 'event' ? settings.buttonColor : settings.borderColor }
                ]}>
                  {exportScope === 'event' && (
                    <View style={[styles.radioButtonInner, { backgroundColor: settings.buttonColor }]} />
                  )}
                </View>
                <View style={styles.scopeOptionText}>
                  <Text style={[styles.scopeOptionTitle, { color: settings.textColor }]}>
                    Single Event
                  </Text>
                  <Text style={[styles.scopeOptionDescription, { color: settings.secondaryTextColor }]} numberOfLines={1}>
                    Teams from {eventName}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>

            {seasonName && (
              <TouchableOpacity
                style={[
                  styles.scopeOption,
                  exportScope === 'season' && styles.scopeOptionSelected,
                  {
                    backgroundColor: exportScope === 'season' ? `${settings.buttonColor}15` : settings.cardBackgroundColor,
                    borderColor: exportScope === 'season' ? settings.buttonColor : settings.borderColor,
                    shadowColor: settings.colorScheme === 'dark' ? '#FFFFFF' : '#000000',
                  }
                ]}
                onPress={() => setExportScope('season')}
                activeOpacity={0.7}
              >
                <View style={styles.scopeOptionContent}>
                  <View style={[
                    styles.radioButton,
                    exportScope === 'season' && styles.radioButtonSelected,
                    { borderColor: exportScope === 'season' ? settings.buttonColor : settings.borderColor }
                  ]}>
                    {exportScope === 'season' && (
                      <View style={[styles.radioButtonInner, { backgroundColor: settings.buttonColor }]} />
                    )}
                  </View>
                  <View style={styles.scopeOptionText}>
                    <Text style={[styles.scopeOptionTitle, { color: settings.textColor }]}>
                      Full Season
                    </Text>
                    <Text style={[styles.scopeOptionDescription, { color: settings.secondaryTextColor }]} numberOfLines={2}>
                      Season-wide data for teams at {eventName}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            )}

            {seasonName && (
              <TouchableOpacity
                style={[
                  styles.scopeOption,
                  exportScope === 'season-by-event' && styles.scopeOptionSelected,
                  {
                    backgroundColor: exportScope === 'season-by-event' ? `${settings.buttonColor}15` : settings.cardBackgroundColor,
                    borderColor: exportScope === 'season-by-event' ? settings.buttonColor : settings.borderColor,
                    shadowColor: settings.colorScheme === 'dark' ? '#FFFFFF' : '#000000',
                  }
                ]}
                onPress={() => setExportScope('season-by-event')}
                activeOpacity={0.7}
              >
                <View style={styles.scopeOptionContent}>
                  <View style={[
                    styles.radioButton,
                    exportScope === 'season-by-event' && styles.radioButtonSelected,
                    { borderColor: exportScope === 'season-by-event' ? settings.buttonColor : settings.borderColor }
                  ]}>
                    {exportScope === 'season-by-event' && (
                      <View style={[styles.radioButtonInner, { backgroundColor: settings.buttonColor }]} />
                    )}
                  </View>
                  <View style={styles.scopeOptionText}>
                    <Text style={[styles.scopeOptionTitle, { color: settings.textColor }]}>
                      Season by Event
                    </Text>
                    <Text style={[styles.scopeOptionDescription, { color: settings.secondaryTextColor }]} numberOfLines={2}>
                      One row per event per team (detailed breakdown, takes longer)
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            )}
          </View>

          {/* Awards Scope for Single Event */}
          {exportScope === 'event' && seasonName && (selectedFields['Total Awards'] || selectedFields['Award Details']) && (
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeader}>
                <Ionicons name="trophy" size={20} color={settings.buttonColor} style={{ marginRight: 8 }} />
                <Text style={[styles.sectionTitle, { color: settings.textColor }]}>Awards Scope</Text>
              </View>
              <Text style={[styles.sectionSubtitle, { color: settings.secondaryTextColor }]}>
                Choose which awards to export for single event
              </Text>

              <TouchableOpacity
                style={[
                  styles.scopeOption,
                  eventAwardsScope === 'event' && styles.scopeOptionSelected,
                  {
                    backgroundColor: eventAwardsScope === 'event' ? `${settings.buttonColor}15` : settings.cardBackgroundColor,
                    borderColor: eventAwardsScope === 'event' ? settings.buttonColor : settings.borderColor,
                    shadowColor: settings.colorScheme === 'dark' ? '#FFFFFF' : '#000000',
                  }
                ]}
                onPress={() => setEventAwardsScope('event')}
                activeOpacity={0.7}
              >
                <View style={styles.scopeOptionContent}>
                  <View style={[
                    styles.radioButton,
                    eventAwardsScope === 'event' && styles.radioButtonSelected,
                    { borderColor: eventAwardsScope === 'event' ? settings.buttonColor : settings.borderColor }
                  ]}>
                    {eventAwardsScope === 'event' && (
                      <View style={[styles.radioButtonInner, { backgroundColor: settings.buttonColor }]} />
                    )}
                  </View>
                  <View style={styles.scopeOptionText}>
                    <Text style={[styles.scopeOptionTitle, { color: settings.textColor }]}>
                      Event Awards Only
                    </Text>
                    <Text style={[styles.scopeOptionDescription, { color: settings.secondaryTextColor }]} numberOfLines={1}>
                      Awards won at {eventName}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.scopeOption,
                  eventAwardsScope === 'season' && styles.scopeOptionSelected,
                  {
                    backgroundColor: eventAwardsScope === 'season' ? `${settings.buttonColor}15` : settings.cardBackgroundColor,
                    borderColor: eventAwardsScope === 'season' ? settings.buttonColor : settings.borderColor,
                    shadowColor: settings.colorScheme === 'dark' ? '#FFFFFF' : '#000000',
                  }
                ]}
                onPress={() => setEventAwardsScope('season')}
                activeOpacity={0.7}
              >
                <View style={styles.scopeOptionContent}>
                  <View style={[
                    styles.radioButton,
                    eventAwardsScope === 'season' && styles.radioButtonSelected,
                    { borderColor: eventAwardsScope === 'season' ? settings.buttonColor : settings.borderColor }
                  ]}>
                    {eventAwardsScope === 'season' && (
                      <View style={[styles.radioButtonInner, { backgroundColor: settings.buttonColor }]} />
                    )}
                  </View>
                  <View style={styles.scopeOptionText}>
                    <Text style={[styles.scopeOptionTitle, { color: settings.textColor }]}>
                      Season Awards
                    </Text>
                    <Text style={[styles.scopeOptionDescription, { color: settings.secondaryTextColor }]} numberOfLines={1}>
                      All awards won during {seasonName}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          )}

          {/* Quick Actions */}
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={[
                styles.quickActionButton,
                {
                  backgroundColor: settings.cardBackgroundColor,
                  borderColor: settings.borderColor,
                  shadowColor: settings.colorScheme === 'dark' ? '#FFFFFF' : '#000000',
                }
              ]}
              onPress={selectAll}
              activeOpacity={0.7}
            >
              <Ionicons name="checkmark-done" size={18} color={settings.buttonColor} style={{ marginRight: 6 }} />
              <Text style={[styles.quickActionText, { color: settings.buttonColor }]}>Select All</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.quickActionButton,
                {
                  backgroundColor: settings.cardBackgroundColor,
                  borderColor: settings.borderColor,
                  shadowColor: settings.colorScheme === 'dark' ? '#FFFFFF' : '#000000',
                }
              ]}
              onPress={selectNone}
              activeOpacity={0.7}
            >
              <Ionicons name="close-circle-outline" size={18} color={settings.buttonColor} style={{ marginRight: 6 }} />
              <Text style={[styles.quickActionText, { color: settings.buttonColor }]}>Clear All</Text>
            </TouchableOpacity>
          </View>

          {/* Field Selection by Category */}
          <View style={styles.fieldsTitleContainer}>
            <Ionicons name="list" size={20} color={settings.buttonColor} style={{ marginRight: 8 }} />
            <Text style={[styles.fieldsTitle, { color: settings.textColor }]}>Select Fields to Export</Text>
          </View>
          {renderCategory('info')}
          {renderCategory('performance')}
          {renderCategory('skills')}
          {renderCategory('history')}
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerButton: {
    padding: 4,
    minWidth: 60,
  },
  headerButtonText: {
    fontSize: 17,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    paddingBottom: 24,
  },
  sectionContainer: {
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  sectionSubtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  scopeOption: {
    borderWidth: 2,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  scopeOptionSelected: {
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  scopeOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButtonSelected: {
    borderWidth: 2,
  },
  radioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  scopeOptionText: {
    marginLeft: 14,
    flex: 1,
  },
  scopeOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  scopeOptionDescription: {
    fontSize: 13,
  },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 16,
  },
  quickActionButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  fieldsTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
  },
  fieldsTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  categoryContainer: {
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  categoryTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  fieldsContainer: {
    gap: 6,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
  },
  fieldLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  fieldLabel: {
    fontSize: 15,
  },
  slowBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    gap: 3,
  },
  slowBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  progressOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressCard: {
    width: '85%',
    maxWidth: 400,
    borderRadius: 20,
    borderWidth: 1,
    padding: 32,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  progressIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  progressTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  progressSubtitle: {
    fontSize: 15,
    marginBottom: 24,
    textAlign: 'center',
  },
  progressBarContainer: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressPercentage: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  progressTimeRemaining: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
    fontWeight: '500',
  },
  progressNote: {
    fontSize: 13,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default DataExportModal;
