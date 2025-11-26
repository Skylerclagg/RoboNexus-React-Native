import React, { useState, useEffect } from 'react';
import { createLogger } from '../utils/logger';
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

const logger = createLogger('EventFiltersModal');

interface EventFilters {
  season: string;
  level: string;
  region: string;
  state: string;
  country: string;
  dateFilter: boolean;
  nearbyFilter: boolean;
  liveEventsOnly: boolean;
}

interface EventFiltersModalProps {
  visible: boolean;
  onClose: () => void;
  filters: EventFilters;
  onFiltersChange: (filters: EventFilters) => void;
  seasons: { label: string; value: string }[];
  selectedProgram: string;
  availableRegions?: { label: string; value: string }[] | string[];
  availableStates?: { label: string; value: string }[] | string[];
  availableCountries?: { label: string; value: string }[] | string[];
  regionsByCountry?: {[country: string]: string[]};
}

const EventFiltersModal: React.FC<EventFiltersModalProps> = ({
  visible,
  onClose,
  filters,
  onFiltersChange,
  seasons,
  selectedProgram,
  availableRegions,
  availableStates,
  availableCountries,
  regionsByCountry,
}) => {
  const settings = useSettings();
  const { updateGlobalSeason } = settings;
  const [localFilters, setLocalFilters] = useState<EventFilters>(filters);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const levelOptions = [
    { label: 'All Levels', value: '' },
    { label: 'World', value: 'World' },
    { label: 'National', value: 'National' },
    { label: 'Regional', value: 'Regional' },
    { label: 'State', value: 'State' },
    { label: 'Signature', value: 'Signature' },
    { label: 'Other', value: 'Other' },
  ];

  // ADC regions (US geographical regions)
  const adcRegions = [
    { label: 'All Regions', value: '' },
    { label: 'Northeast', value: 'Northeast' },
    { label: 'North Central', value: 'North Central' },
    { label: 'Southeast', value: 'Southeast' },
    { label: 'South Central', value: 'South Central' },
    { label: 'West', value: 'West' },
  ];

  // US states for ADC state filtering
  const usStates = [
    { label: 'All States', value: '' },
    { label: 'Alabama', value: 'Alabama' },
    { label: 'Alaska', value: 'Alaska' },
    { label: 'Arizona', value: 'Arizona' },
    { label: 'Arkansas', value: 'Arkansas' },
    { label: 'California', value: 'California' },
    { label: 'Colorado', value: 'Colorado' },
    { label: 'Connecticut', value: 'Connecticut' },
    { label: 'Delaware', value: 'Delaware' },
    { label: 'Florida', value: 'Florida' },
    { label: 'Georgia', value: 'Georgia' },
    { label: 'Hawaii', value: 'Hawaii' },
    { label: 'Idaho', value: 'Idaho' },
    { label: 'Illinois', value: 'Illinois' },
    { label: 'Indiana', value: 'Indiana' },
    { label: 'Iowa', value: 'Iowa' },
    { label: 'Kansas', value: 'Kansas' },
    { label: 'Kentucky', value: 'Kentucky' },
    { label: 'Louisiana', value: 'Louisiana' },
    { label: 'Maine', value: 'Maine' },
    { label: 'Maryland', value: 'Maryland' },
    { label: 'Massachusetts', value: 'Massachusetts' },
    { label: 'Michigan', value: 'Michigan' },
    { label: 'Minnesota', value: 'Minnesota' },
    { label: 'Mississippi', value: 'Mississippi' },
    { label: 'Missouri', value: 'Missouri' },
    { label: 'Montana', value: 'Montana' },
    { label: 'Nebraska', value: 'Nebraska' },
    { label: 'Nevada', value: 'Nevada' },
    { label: 'New Hampshire', value: 'New Hampshire' },
    { label: 'New Jersey', value: 'New Jersey' },
    { label: 'New Mexico', value: 'New Mexico' },
    { label: 'New York', value: 'New York' },
    { label: 'North Carolina', value: 'North Carolina' },
    { label: 'North Dakota', value: 'North Dakota' },
    { label: 'Ohio', value: 'Ohio' },
    { label: 'Oklahoma', value: 'Oklahoma' },
    { label: 'Oregon', value: 'Oregon' },
    { label: 'Pennsylvania', value: 'Pennsylvania' },
    { label: 'Rhode Island', value: 'Rhode Island' },
    { label: 'South Carolina', value: 'South Carolina' },
    { label: 'South Dakota', value: 'South Dakota' },
    { label: 'Tennessee', value: 'Tennessee' },
    { label: 'Texas', value: 'Texas' },
    { label: 'Utah', value: 'Utah' },
    { label: 'Vermont', value: 'Vermont' },
    { label: 'Virginia', value: 'Virginia' },
    { label: 'Washington', value: 'Washington' },
    { label: 'West Virginia', value: 'West Virginia' },
    { label: 'Wisconsin', value: 'Wisconsin' },
    { label: 'Wyoming', value: 'Wyoming' },
  ];

  // International regions for non-ADC programs
  const internationalRegions = [
    { label: 'All Regions', value: '' },
    { label: 'North America', value: 'North America' },
    { label: 'Asia Pacific', value: 'Asia Pacific' },
    { label: 'Europe', value: 'Europe' },
    { label: 'Middle East', value: 'Middle East' },
    { label: 'Africa', value: 'Africa' },
    { label: 'South America', value: 'South America' },
  ];

  const isADC = selectedProgram === 'Aerial Drone Competition';

  // Convert regions to consistent format
  const regionOptions = availableRegions && availableRegions.length > 0
    ? (typeof availableRegions[0] === 'object'
        ? availableRegions as { label: string; value: string }[] // Already in { label, value } format
        : [{ label: 'All Regions', value: '' }, ...(availableRegions as string[]).map((region: string) => ({ label: region, value: region }))])
    : (isADC ? adcRegions : internationalRegions);

  // Convert states to consistent format
  const stateOptions = availableStates && availableStates.length > 0
    ? (typeof availableStates[0] === 'object'
        ? availableStates as { label: string; value: string }[] // Already in { label, value } format
        : [{ label: 'All States', value: '' }, ...(availableStates as string[]).map((state: string) => ({ label: state, value: state }))])
    : usStates;

  // Transform country array to dropdown format
  const countryOptions = availableCountries && availableCountries.length > 0
    ? (typeof availableCountries[0] === 'object'
        ? availableCountries as { label: string; value: string }[] // Already in { label, value } format
        : [{ label: 'All Countries', value: '' }, ...(availableCountries as string[]).map((country: string) => ({ label: country, value: country }))])
    : [{ label: 'All Countries', value: '' }];

  // Get filtered regions based on selected country
  const getFilteredRegions = () => {
    if (!localFilters.country || !regionsByCountry) {
      return availableRegions && availableRegions.length > 0
        ? (typeof availableRegions[0] === 'object'
            ? availableRegions as { label: string; value: string }[] // Already in { label, value } format
            : [{ label: 'All Regions', value: '' }, ...(availableRegions as string[]).map((region: string) => ({ label: region, value: region }))])
        : [{ label: 'All Regions', value: '' }];
    }

    // Get regions for the selected country
    const regionsForCountry = regionsByCountry[localFilters.country] || [];
    return [
      { label: 'All Regions', value: '' },
      ...regionsForCountry.map((region: string) => ({ label: region, value: region }))
    ];
  };

  const filteredRegionOptions = getFilteredRegions();

  const applyFilters = () => {
    logger.debug('Applying filters:', localFilters);
    onFiltersChange(localFilters);
    onClose();
  };

  const clearFilters = () => {
    const defaultSeason = seasons.length > 0 ? seasons[0].value : '';

    const clearedFilters: EventFilters = {
      season: defaultSeason,
      level: '',
      region: '',
      state: '',
      country: '',
      dateFilter: false, // Always disable date filter when clearing all filters
      nearbyFilter: false,
      liveEventsOnly: false,
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
          <Text style={[styles.headerTitle, { color: settings.textColor }]}>Event Filters</Text>
          <TouchableOpacity onPress={applyFilters} style={[styles.applyHeaderButton, { backgroundColor: settings.buttonColor }]}>
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
                // Check if this is the current/active season (first in the list)
                const isActiveSeason = seasons.length > 0 && value === seasons[0].value;

                setLocalFilters({
                  ...localFilters,
                  season: value,
                  // Auto-enable date filter for active season, disable for non-active seasons
                  dateFilter: isActiveSeason
                });
                updateGlobalSeason(value);
              }}
              placeholder="Select Season"
            />
          </View>

          {/* Level Filter */}
          <View style={[styles.modernFilterCard, {
            backgroundColor: settings.cardBackgroundColor,
            borderColor: settings.borderColor,
            shadowColor: settings.colorScheme === 'dark' ? '#FFFFFF' : '#000000'
          }]}>
            <View style={styles.filterHeader}>
              <Ionicons name="trophy-outline" size={20} color={settings.buttonColor} />
              <Text style={[styles.modernFilterTitle, { color: settings.textColor }]}>Competition Level</Text>
            </View>
            <DropdownPicker
              options={levelOptions}
              selectedValue={localFilters.level}
              onValueChange={(value) =>
                setLocalFilters({ ...localFilters, level: value })
              }
              placeholder="All Levels"
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
              <Text style={[styles.modernFilterTitle, { color: settings.textColor }]}>
                {isADC ? 'Region' : 'Region'}
              </Text>
            </View>
            <DropdownPicker
              options={filteredRegionOptions}
              selectedValue={localFilters.region}
              onValueChange={(value) =>
                setLocalFilters({ ...localFilters, region: value })
              }
              placeholder="All Regions"
            />
          </View>

          {/* State Filter (only for ADC) */}
          {isADC && (
            <View style={[styles.modernFilterCard, {
              backgroundColor: settings.cardBackgroundColor,
              borderColor: settings.borderColor,
              shadowColor: settings.colorScheme === 'dark' ? '#FFFFFF' : '#000000'
            }]}>
              <View style={styles.filterHeader}>
                <Ionicons name="map-outline" size={20} color={settings.buttonColor} />
                <Text style={[styles.modernFilterTitle, { color: settings.textColor }]}>State</Text>
              </View>
              <DropdownPicker
                options={stateOptions}
                selectedValue={localFilters.state}
                onValueChange={(value) =>
                  setLocalFilters({ ...localFilters, state: value })
                }
                placeholder="All States"
              />
            </View>
          )}

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
              onValueChange={(value) => {
                // Reset region when country changes since the available regions change
                setLocalFilters({
                  ...localFilters,
                  country: value,
                  region: '' // Reset region selection
                });
              }}
              placeholder="All Countries"
            />
          </View>

          {/* Date Filter */}
          <View style={[styles.modernFilterCard, {
            backgroundColor: settings.cardBackgroundColor,
            borderColor: settings.borderColor,
            shadowColor: settings.colorScheme === 'dark' ? '#FFFFFF' : '#000000'
          }]}>
            <View style={styles.modernSwitchRow}>
              <View style={styles.switchIconAndInfo}>
                <Ionicons name="time-outline" size={20} color={settings.buttonColor} />
                <View style={styles.switchTextInfo}>
                  <Text style={[styles.modernFilterTitle, { color: settings.textColor }]}>Date Filter</Text>
                  <Text style={[styles.modernFilterDescription, { color: settings.secondaryTextColor }]}>
                    Show events from {settings.dateFilter} days ago onwards
                  </Text>
                </View>
              </View>
              <Switch
                value={localFilters.dateFilter}
                onValueChange={(value) =>
                  setLocalFilters({ ...localFilters, dateFilter: value })
                }
                trackColor={{ false: '#ccc', true: settings.buttonColor }}
                thumbColor={localFilters.dateFilter ? settings.switchThumbColorOn : settings.switchThumbColorOff}
              />
            </View>
          </View>

          {/* Nearby Filter */}
          <View style={[styles.modernFilterCard, {
            backgroundColor: settings.cardBackgroundColor,
            borderColor: settings.borderColor,
            shadowColor: settings.colorScheme === 'dark' ? '#FFFFFF' : '#000000'
          }]}>
            <View style={styles.modernSwitchRow}>
              <View style={styles.switchIconAndInfo}>
                <Ionicons name="navigate-outline" size={20} color={settings.buttonColor} />
                <View style={styles.switchTextInfo}>
                  <Text style={[styles.modernFilterTitle, { color: settings.textColor }]}>Nearby Events</Text>
                  <Text style={[styles.modernFilterDescription, { color: settings.secondaryTextColor }]}>
                    Show events within {settings.nearbyRange} miles of your location
                  </Text>
                </View>
              </View>
              <Switch
                value={localFilters.nearbyFilter}
                onValueChange={(value) =>
                  setLocalFilters({ ...localFilters, nearbyFilter: value })
                }
                trackColor={{ false: '#ccc', true: settings.buttonColor }}
                thumbColor={localFilters.nearbyFilter ? settings.switchThumbColorOn : settings.switchThumbColorOff}
              />
            </View>
          </View>

          {/* Live Events Filter */}
          <View style={[styles.modernFilterCard, {
            backgroundColor: settings.cardBackgroundColor,
            borderColor: settings.borderColor,
            shadowColor: settings.colorScheme === 'dark' ? '#FFFFFF' : '#000000'
          }]}>
            <View style={styles.modernSwitchRow}>
              <View style={styles.switchIconAndInfo}>
                <Ionicons name="radio-button-on" size={20} color={settings.buttonColor} />
                <View style={styles.switchTextInfo}>
                  <Text style={[styles.modernFilterTitle, { color: settings.textColor }]}>Live Events Only</Text>
                  <Text style={[styles.modernFilterDescription, { color: settings.secondaryTextColor }]}>
                    Show only events that are currently happening
                  </Text>
                </View>
              </View>
              <Switch
                value={localFilters.liveEventsOnly}
                onValueChange={(value) =>
                  setLocalFilters({ ...localFilters, liveEventsOnly: value })
                }
                trackColor={{ false: '#ccc', true: settings.buttonColor }}
                thumbColor={localFilters.liveEventsOnly ? settings.switchThumbColorOn : settings.switchThumbColorOff}
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
            onPress={clearFilters}
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
  headerButtonText: {
    fontSize: 16,
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
  applyButton: {
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  // Modern card-based filter sections
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
  // Modern switch row styling
  modernSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchIconAndInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  switchTextInfo: {
    marginLeft: 8,
    flex: 1,
  },
  modernFilterDescription: {
    fontSize: 14,
    marginTop: 2,
    lineHeight: 18,
  },
  filterSection: {
    marginBottom: 24,
  },
  filterTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  filterDescription: {
    fontSize: 14,
    marginTop: 2,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchInfo: {
    flex: 1,
  },
  // Modern clear button
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
  // Legacy styles
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    borderWidth: 1,
  },
  clearButtonText: {
    fontSize: 16,
    color: '#FF3B30',
    marginLeft: 8,
    fontWeight: '500',
  },
});

export default EventFiltersModal;