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
  const { updateGlobalSeason } = settings;
  const [localFilters, setLocalFilters] = useState<WorldSkillsFilters>(filters);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const handleApplyFilters = () => {
    console.log('WorldSkillsFiltersModal: Applying filters:', localFilters);

    // Update global season when applying filters
    if (localFilters.season) {
      updateGlobalSeason(localFilters.season);
    }

    onFiltersChange(localFilters);
    onClose();
  };

  const handleClearFilters = () => {
    const defaultSeason = seasons.length > 0 ? seasons[0].value : '';

    const clearedFilters: WorldSkillsFilters = {
      season: defaultSeason,
      region: '', // All regions
    };
    setLocalFilters(clearedFilters);
    onFiltersChange(clearedFilters);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: settings.backgroundColor }]}>
        {/* Modern Header */}
        <View style={[styles.header, {
          backgroundColor: settings.cardBackgroundColor,
          borderBottomColor: settings.borderColor,
          shadowColor: settings.colorScheme === 'dark' ? '#FFFFFF' : '#000000'
        }]}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <Ionicons name="close" size={24} color={settings.iconColor} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: settings.textColor }]}>World Skills Filters</Text>
          <TouchableOpacity onPress={handleApplyFilters} style={[styles.applyHeaderButton, { backgroundColor: settings.buttonColor }]}>
            <Text style={styles.applyHeaderButtonText}>Apply</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Season Filter */}
          <View style={[styles.modernFilterCard, {
            backgroundColor: settings.cardBackgroundColor,
            borderColor: settings.borderColor,
            shadowColor: settings.colorScheme === 'dark' ? '#FFFFFF' : '#000000'
          }]}>
            <View style={styles.filterHeader}>
              <Ionicons name="calendar-outline" size={20} color={settings.buttonColor} />
              <Text style={[styles.modernFilterTitle, { color: settings.textColor }]}>Season</Text>
            </View>
            <DropdownPicker
              options={seasons}
              selectedValue={localFilters.season}
              onValueChange={(value) => {
                // Only update local state, don't apply yet
                setLocalFilters({ ...localFilters, season: value });
              }}
              placeholder={seasons.length === 0 ? "Loading seasons..." : "Select Season"}
            />
          </View>

          {/* Region Filter */}
          <View style={[styles.modernFilterCard, {
            backgroundColor: settings.cardBackgroundColor,
            borderColor: settings.borderColor,
            shadowColor: settings.colorScheme === 'dark' ? '#FFFFFF' : '#000000'
          }]}>
            <View style={styles.filterHeader}>
              <Ionicons name="location-outline" size={20} color={settings.buttonColor} />
              <Text style={[styles.modernFilterTitle, { color: settings.textColor }]}>Region</Text>
            </View>
            <DropdownPicker
              options={[{ label: 'All Regions', value: '' }, ...regions]}
              selectedValue={localFilters.region}
              onValueChange={(value) => setLocalFilters({ ...localFilters, region: value })}
              placeholder="All Regions"
            />
          </View>

          {/* Clear Filters */}
          <TouchableOpacity
            style={[styles.modernClearButton, {
              backgroundColor: settings.cardBackgroundColor,
              borderColor: '#FF3B30',
              shadowColor: settings.colorScheme === 'dark' ? '#FFFFFF' : '#000000'
            }]}
            onPress={handleClearFilters}
          >
            <Ionicons name="refresh" size={20} color="#FF3B30" />
            <Text style={[styles.modernClearButtonText, { color: '#FF3B30' }]}>Clear All Filters</Text>
          </TouchableOpacity>
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
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  applyHeaderButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  applyHeaderButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  modernFilterCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  modernFilterTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  modernClearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
    marginBottom: 32,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  modernClearButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default WorldSkillsFiltersModal;