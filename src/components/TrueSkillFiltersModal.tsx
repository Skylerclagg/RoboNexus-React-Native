/**
 * TrueSkill Filters Modal Component
 *
 * Modal for filtering TrueSkill rankings by region and favorites.
 * Unlike WorldSkillsFiltersModal, this doesn't include season filtering
 * since TrueSkill data only returns the current season.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../contexts/SettingsContext';
import DropdownPicker from './DropdownPicker';

interface TrueSkillFiltersModalProps {
  visible: boolean;
  onClose: () => void;
  filters: {
    country: string;
    region: string;
    favoritesOnly: boolean;
  };
  onFiltersChange: (filters: { country: string; region: string; favoritesOnly: boolean }) => void;
  countries: string[];
  regionsByCountry: {[country: string]: string[]};
}

const TrueSkillFiltersModal: React.FC<TrueSkillFiltersModalProps> = ({
  visible,
  onClose,
  filters,
  onFiltersChange,
  countries,
  regionsByCountry,
}) => {
  const settings = useSettings();
  const [localFilters, setLocalFilters] = useState(filters);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const handleApply = () => {
    onFiltersChange(localFilters);
    onClose();
  };

  const handleClear = () => {
    const clearedFilters = {
      country: '',
      region: '',
      favoritesOnly: false,
    };
    setLocalFilters(clearedFilters);
    onFiltersChange(clearedFilters);
  };

  // Prepare country options for dropdown
  const countryOptions = [
    { label: 'All Countries', value: '' },
    ...countries.map(country => ({ label: country, value: country }))
  ];

  // Get filtered regions based on selected country
  const getFilteredRegions = () => {
    if (!localFilters.country) {
      // Show all regions if no country selected
      const allRegions = Object.values(regionsByCountry).flat();
      const uniqueRegions = [...new Set(allRegions)].sort();
      return [
        { label: 'All Regions', value: '' },
        ...uniqueRegions.map(region => ({ label: region, value: region }))
      ];
    }

    // Get regions for the selected country
    const regionsForCountry = regionsByCountry[localFilters.country] || [];
    return [
      { label: 'All Regions', value: '' },
      ...regionsForCountry.map(region => ({ label: region, value: region }))
    ];
  };

  const regionOptions = getFilteredRegions();

  // Clear region when country changes
  const handleCountryChange = (value: string) => {
    setLocalFilters({ ...localFilters, country: value, region: '' });
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
          <Text style={[styles.headerTitle, { color: settings.textColor }]}>TrueSkill Filters</Text>
          <TouchableOpacity onPress={handleApply} style={[styles.applyHeaderButton, { backgroundColor: settings.buttonColor }]}>
            <Text style={styles.applyHeaderButtonText}>Apply</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Country Filter */}
          <View style={[styles.modernFilterCard, {
            backgroundColor: settings.cardBackgroundColor,
            borderColor: settings.borderColor,
            shadowColor: settings.colorScheme === 'dark' ? '#FFFFFF' : '#000000'
          }]}>
            <View style={styles.filterHeader}>
              <Ionicons name="globe-outline" size={20} color={settings.buttonColor} />
              <Text style={[styles.modernFilterTitle, { color: settings.textColor }]}>Country</Text>
            </View>
            <DropdownPicker
              options={countryOptions}
              selectedValue={localFilters.country}
              onValueChange={handleCountryChange}
              placeholder="All Countries"
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
              options={regionOptions}
              selectedValue={localFilters.region}
              onValueChange={(value) => setLocalFilters({ ...localFilters, region: value })}
              placeholder="All Regions"
            />
          </View>

          {/* Favorites Only Toggle */}
          <View style={[styles.modernFilterCard, {
            backgroundColor: settings.cardBackgroundColor,
            borderColor: settings.borderColor,
            shadowColor: settings.colorScheme === 'dark' ? '#FFFFFF' : '#000000'
          }]}>
            <View style={styles.filterRow}>
              <Ionicons name="heart" size={20} color={settings.buttonColor} />
              <View style={styles.filterTextContainer}>
                <Text style={[styles.modernFilterTitle, { color: settings.textColor }]}>Favorite Teams Only</Text>
                <Text style={[styles.filterSubtitle, { color: settings.secondaryTextColor }]}>
                  Show only teams you've favorited
                </Text>
              </View>
              <Switch
                value={localFilters.favoritesOnly}
                onValueChange={(value) => setLocalFilters({ ...localFilters, favoritesOnly: value })}
                trackColor={{ false: settings.borderColor, true: settings.buttonColor }}
                thumbColor={settings.switchThumbColorOn}
              />
            </View>
          </View>

          {/* Clear Filters */}
          <TouchableOpacity
            style={[styles.modernClearButton, {
              backgroundColor: settings.cardBackgroundColor,
              borderColor: settings.errorColor,
              shadowColor: settings.colorScheme === 'dark' ? '#FFFFFF' : '#000000'
            }]}
            onPress={handleClear}
          >
            <Ionicons name="refresh" size={20} color={settings.errorColor} />
            <Text style={[styles.modernClearButtonText, { color: settings.errorColor }]}>Clear All Filters</Text>
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
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterTextContainer: {
    marginLeft: 8,
    flex: 1,
  },
  modernFilterTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  filterSubtitle: {
    fontSize: 12,
    marginTop: 2,
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
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default TrueSkillFiltersModal;
