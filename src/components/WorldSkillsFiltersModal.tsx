import React, { useState, useEffect } from 'react';
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
import DropdownPicker from './DropdownPicker';

interface WorldSkillsFilters {
  season: string;
  region: string;
}

interface WorldSkillsFiltersModalProps {
  visible: boolean;
  onClose: () => void;
  filters: WorldSkillsFilters;
  onFiltersChange: (filters: WorldSkillsFilters) => void;
  seasons: { label: string; value: string }[];
  regions: { label: string; value: string }[];
  selectedProgram: string;
}

const WorldSkillsFiltersModal: React.FC<WorldSkillsFiltersModalProps> = ({
  visible,
  onClose,
  filters,
  onFiltersChange,
  seasons,
  regions,
  selectedProgram,
}) => {
  const settings = useSettings();
  const { updateGlobalSeason, globalSeasonEnabled, selectedSeason: globalSeason } = settings;
  const [localFilters, setLocalFilters] = useState<WorldSkillsFilters>(filters);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  // Sync with global season when global mode is enabled
  useEffect(() => {
    if (globalSeasonEnabled && globalSeason && globalSeason !== localFilters.season) {
      console.log('WorldSkillsFiltersModal: Syncing to global season:', globalSeason);
      setLocalFilters(prev => ({ ...prev, season: globalSeason }));
    }
  }, [globalSeasonEnabled, globalSeason, localFilters.season]);

  const handleApplyFilters = () => {
    console.log('WorldSkillsFiltersModal: Applying filters:', localFilters, 'globalSeasonEnabled:', globalSeasonEnabled);
    onFiltersChange(localFilters);

    // Update global season if a season is selected
    if (localFilters.season) {
      updateGlobalSeason(localFilters.season);
    }
    onClose();
  };

  const handleResetFilters = () => {
    // Use global season if global mode is enabled, otherwise use first available season
    const defaultSeason = (globalSeasonEnabled && globalSeason)
      ? globalSeason
      : (seasons.length > 0 ? seasons[0].value : '');

    const resetFilters: WorldSkillsFilters = {
      season: defaultSeason,
      region: '', // All regions
    };
    setLocalFilters(resetFilters);
  };

  const updateLocalFilter = <K extends keyof WorldSkillsFilters>(
    key: K,
    value: WorldSkillsFilters[K]
  ) => {
    setLocalFilters(prev => ({ ...prev, [key]: value }));
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: settings.backgroundColor }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: settings.borderColor }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={settings.textColor} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: settings.textColor }]}>
            World Skills Filters
          </Text>
          <TouchableOpacity onPress={handleResetFilters}>
            <Text style={[styles.resetButton, { color: settings.buttonColor }]}>Reset</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {/* Program Display */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: settings.textColor }]}>Program</Text>
            <View style={[styles.infoCard, {
              backgroundColor: settings.cardBackgroundColor,
              borderColor: settings.borderColor
            }]}>
              <Text style={[styles.programText, { color: settings.textColor }]}>
                {selectedProgram}
              </Text>
            </View>
          </View>

          {/* Season Filter */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: settings.textColor }]}>Season</Text>
            <DropdownPicker
              options={seasons}
              selectedValue={localFilters.season}
              onValueChange={(value) => updateLocalFilter('season', value)}
              placeholder={seasons.length === 0 ? "Loading seasons..." : "Select a season"}
            />
          </View>

          {/* Region Filter */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: settings.textColor }]}>Region</Text>
            <DropdownPicker
              options={[{ label: 'All Regions', value: '' }, ...regions]}
              selectedValue={localFilters.region}
              onValueChange={(value) => updateLocalFilter('region', value)}
              placeholder="All Regions"
            />
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, { borderTopColor: settings.borderColor }]}>
          <TouchableOpacity
            style={[styles.applyButton, { backgroundColor: settings.buttonColor }]}
            onPress={handleApplyFilters}
          >
            <Text style={[styles.applyButtonText, { color: 'white' }]}>
              Apply Filters
            </Text>
          </TouchableOpacity>
        </View>
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
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  closeButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  resetButton: {
    fontSize: 16,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  section: {
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  infoCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  programText: {
    fontSize: 16,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
  },
  applyButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default WorldSkillsFiltersModal;