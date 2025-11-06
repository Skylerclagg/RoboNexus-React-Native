import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Platform,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings, ProgramType, ColorProperty, ColorOverride, ProgramColorOverrides } from '../contexts/SettingsContext';
import { getAllProgramNames } from '../utils/programMappings';
import { alerts } from '../utils/webCompatibility';

interface ColorOverrideModalProps {
  visible: boolean;
  onClose: () => void;
}

// Color property display names
const COLOR_PROPERTY_NAMES: Record<ColorProperty, string> = {
  primary: 'Primary Color',
  topBarColor: 'Top Bar Color',
  topBarContentColor: 'Top Bar Content Color',
  buttonColor: 'Button Color',
  cardBackgroundColor: 'Card Background Color',
  backgroundColor: 'Background Color',
  textColor: 'Text Color',
  secondaryTextColor: 'Secondary Text Color',
  borderColor: 'Border Color',
  iconColor: 'Icon Color',
};

// Preset colors for quick selection
const PRESET_COLORS = [
  '#FF3B30', // Red
  '#FF9500', // Orange
  '#FFCC00', // Yellow
  '#34C759', // Green
  '#00C7BE', // Teal
  '#30B0C7', // Cyan
  '#32ADE6', // Light Blue
  '#007AFF', // Blue
  '#5856D6', // Indigo
  '#AF52DE', // Purple
  '#FF2D55', // Pink
  '#8E8E93', // Gray
  '#48484A', // Dark Gray
  '#000000', // Black
  '#FFFFFF', // White
];

const ColorOverrideModal: React.FC<ColorOverrideModalProps> = ({ visible, onClose }) => {
  const settings = useSettings();
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [allPrograms] = useState<ProgramType[]>(getAllProgramNames());

  // Create/Edit form state
  const [selectedProperty, setSelectedProperty] = useState<ColorProperty>('primary');
  const [selectedPrograms, setSelectedPrograms] = useState<Set<ProgramType>>(new Set());
  const [editingProgram, setEditingProgram] = useState<ProgramType | null>(null);

  // Store overrides for all properties being configured
  const [pendingOverrides, setPendingOverrides] = useState<Map<ColorProperty, { lightMode: string; darkMode: string }>>(new Map());

  // Store original overrides when entering edit mode (for cancel restoration)
  const [originalOverrides, setOriginalOverrides] = useState<ProgramColorOverrides>({});

  // Refresh trigger for forcing list view updates
  const [refreshKey, setRefreshKey] = useState(0);

  // Reset form when modal closes
  useEffect(() => {
    if (!visible) {
      setMode('list');
      resetForm();
    }
  }, [visible]);

  const resetForm = () => {
    setSelectedProperty('primary');
    setPendingOverrides(new Map());
    setSelectedPrograms(new Set());
    setEditingProgram(null);
    setOriginalOverrides({});
  };

  // Get current property values from pending overrides
  const getCurrentPropertyValues = () => {
    const values = pendingOverrides.get(selectedProperty);
    return {
      lightModeValue: values?.lightMode || '',
      darkModeValue: values?.darkMode || '',
    };
  };

  // Update pending overrides for current property
  const updateCurrentProperty = (lightMode: string, darkMode: string) => {
    const newPending = new Map(pendingOverrides);
    if (!lightMode && !darkMode) {
      // If both are empty, remove this property from pending
      newPending.delete(selectedProperty);
    } else {
      newPending.set(selectedProperty, { lightMode, darkMode });
    }
    setPendingOverrides(newPending);

    // Apply live preview if a program is selected
    if (selectedPrograms.size > 0) {
      applyLivePreview(newPending);
    }
  };

  const { lightModeValue, darkModeValue } = getCurrentPropertyValues();

  // Apply live preview of pending overrides
  const applyLivePreview = (pending: Map<ColorProperty, { lightMode: string; darkMode: string }>) => {
    if (selectedPrograms.size === 0) return;

    // Get the first selected program for preview
    const previewProgram = Array.from(selectedPrograms)[0];

    // Create temporary overrides for preview
    const tempOverrides: ColorOverride[] = [];
    pending.forEach((values, property) => {
      const override: ColorOverride = { property };
      if (values.lightMode) override.lightModeValue = values.lightMode;
      if (values.darkMode) override.darkModeValue = values.darkMode;
      tempOverrides.push(override);
    });

    // Build preview overrides object
    const previewOverrides = { ...settings.programColorOverrides };
    const existingOverrides = previewOverrides[previewProgram] || [];
    const updatedProperties = new Set(tempOverrides.map(o => o.property));
    const filteredOverrides = existingOverrides.filter(o => !updatedProperties.has(o.property));
    previewOverrides[previewProgram] = [...filteredOverrides, ...tempOverrides];

    // Apply preview by temporarily updating the overrides
    settings.setProgramColorOverrides(previewOverrides);
    settings.setPreviewProgram(previewProgram);
  };

  // Clear preview when leaving create/edit mode
  const clearPreview = () => {
    settings.setPreviewProgram(null);
  };

  const isValidHex = (hex: string): boolean => {
    if (!hex) return true; // Empty is valid (means no override for that mode)
    return /^#[0-9A-F]{6}$/i.test(hex);
  };

  const formatHexInput = (input: string): string => {
    let cleaned = input.toUpperCase().replace(/[^0-9A-F]/g, '');
    cleaned = cleaned.substring(0, 6);
    return cleaned ? `#${cleaned}` : '';
  };

  const toggleProgram = (program: ProgramType) => {
    const newSet = new Set(selectedPrograms);
    if (newSet.has(program)) {
      newSet.delete(program);
    } else {
      newSet.add(program);
    }
    setSelectedPrograms(newSet);

    // Update preview when program selection changes
    if (newSet.size > 0 && pendingOverrides.size > 0) {
      applyLivePreview(pendingOverrides);
    } else if (newSet.size === 0) {
      clearPreview();
    }
  };

  const selectAllPrograms = () => {
    const newSet = new Set(allPrograms);
    setSelectedPrograms(newSet);
    if (pendingOverrides.size > 0) {
      applyLivePreview(pendingOverrides);
    }
  };

  const deselectAllPrograms = () => {
    setSelectedPrograms(new Set());
    clearPreview();
  };

  const handleCreateNew = () => {
    resetForm();
    // Save original state for cancel restoration
    setOriginalOverrides({ ...settings.programColorOverrides });
    setMode('create');
  };

  const handleEditOverride = (program: ProgramType, property?: ColorProperty) => {
    const programOverrides = settings.programColorOverrides[program] || [];

    // Save original state for cancel restoration
    setOriginalOverrides({ ...settings.programColorOverrides });

    // Load all existing overrides for this program into pending state
    const newPending = new Map<ColorProperty, { lightMode: string; darkMode: string }>();
    programOverrides.forEach(override => {
      newPending.set(override.property, {
        lightMode: override.lightModeValue || '',
        darkMode: override.darkModeValue || '',
      });
    });

    setPendingOverrides(newPending);
    setSelectedProperty(property || 'primary');
    setSelectedPrograms(new Set([program]));
    setEditingProgram(program);
    setMode('edit');

    // Apply preview immediately when editing
    if (newPending.size > 0) {
      setTimeout(() => {
        applyLivePreview(newPending);
      }, 0);
    }
  };

  const handleDeleteOverride = async (program: ProgramType, property: ColorProperty) => {
    const confirmed = await alerts.showDestructiveConfirm(
      'Delete Override',
      `Are you sure you want to delete the ${COLOR_PROPERTY_NAMES[property]} override for ${program}?`,
      'Delete',
      'Cancel'
    );

    if (!confirmed) {
      return;
    }

    // Clear preview if this program is currently being previewed
    if (settings.previewProgram === program) {
      settings.setPreviewProgram(null);
    }

    // Delete the override
    await settings.resetProgramColorOverrides([program], [property]);

    // Force component to re-render
    setRefreshKey(prev => prev + 1);
  };

  const handleDeleteAllOverrides = async (program: ProgramType) => {
    const confirmed = await alerts.showDestructiveConfirm(
      'Delete All Overrides',
      `Are you sure you want to delete all color overrides for ${program}?`,
      'Delete All',
      'Cancel'
    );

    if (!confirmed) {
      return;
    }

    // Clear preview if this program is currently being previewed
    if (settings.previewProgram === program) {
      settings.setPreviewProgram(null);
    }

    // Delete all overrides for this program
    await settings.resetProgramColorOverrides([program]);

    // Force component to re-render
    setRefreshKey(prev => prev + 1);
  };

  const handleApplyOverride = async () => {
    // Validate all pending overrides
    for (const [property, values] of pendingOverrides.entries()) {
      if (!isValidHex(values.lightMode)) {
        alerts.showAlert('Invalid Color', `${COLOR_PROPERTY_NAMES[property]} Light Mode value must be a valid hex color (e.g., #FF0000)`);
        return;
      }
      if (!isValidHex(values.darkMode)) {
        alerts.showAlert('Invalid Color', `${COLOR_PROPERTY_NAMES[property]} Dark Mode value must be a valid hex color (e.g., #FF0000)`);
        return;
      }
    }

    if (selectedPrograms.size === 0) {
      alerts.showAlert('No Programs Selected', 'Please select at least one program to apply the overrides.');
      return;
    }

    if (pendingOverrides.size === 0) {
      alerts.showAlert('No Overrides Configured', 'Please configure at least one color property.');
      return;
    }

    // Convert pending overrides to ColorOverride array
    const newOverrides: ColorOverride[] = [];
    pendingOverrides.forEach((values, property) => {
      const override: ColorOverride = { property };
      if (values.lightMode) override.lightModeValue = values.lightMode;
      if (values.darkMode) override.darkModeValue = values.darkMode;
      newOverrides.push(override);
    });

    // Apply to selected programs
    const allOverrides = { ...settings.programColorOverrides };
    selectedPrograms.forEach(program => {
      const existingOverrides = allOverrides[program] || [];

      // Get properties that are being updated
      const updatedProperties = new Set(newOverrides.map(o => o.property));

      // Keep existing overrides for properties NOT being updated
      const filteredOverrides = existingOverrides.filter(o => !updatedProperties.has(o.property));

      // Combine filtered overrides with new overrides
      allOverrides[program] = [...filteredOverrides, ...newOverrides];
    });

    await settings.setProgramColorOverrides(allOverrides);

    // Clear preview after successful save
    clearPreview();

    const overrideCount = pendingOverrides.size;
    const programCount = selectedPrograms.size;

    // Show success message
    alerts.showAlert(
      'Success',
      `${overrideCount} color override${overrideCount > 1 ? 's' : ''} applied to ${programCount} program${programCount > 1 ? 's' : ''}`
    );

    // Reset form
    resetForm();
    setMode('list');
  };

  const handleCancel = () => {
    // Restore original overrides (remove preview changes)
    clearPreview();

    // Restore the saved state from before we started editing
    if (Object.keys(originalOverrides).length > 0) {
      settings.setProgramColorOverrides(originalOverrides);
    }

    resetForm();
    setMode('list');
  };

  // Handle updating light or dark mode for current property
  const updateLightMode = (color: string) => {
    updateCurrentProperty(color, darkModeValue);
  };

  const updateDarkMode = (color: string) => {
    updateCurrentProperty(lightModeValue, color);
  };

  // Render color preset picker
  const renderColorPicker = (label: string, value: string, onChange: (color: string) => void) => (
    <View style={styles.colorPickerSection}>
      <Text style={[styles.colorPickerLabel, { color: settings.textColor }]}>{label}</Text>

      {/* Hex Input */}
      <View style={styles.hexInputRow}>
        <TextInput
          style={[
            styles.hexInput,
            {
              backgroundColor: settings.backgroundColor,
              color: settings.textColor,
              borderColor: isValidHex(value) ? settings.borderColor : '#FF3B30',
            },
          ]}
          placeholder="#FF0000"
          placeholderTextColor={settings.secondaryTextColor}
          value={value}
          onChangeText={(text) => onChange(formatHexInput(text))}
          maxLength={7}
          autoCapitalize="characters"
        />
        {value && isValidHex(value) && (
          <View style={[styles.colorPreview, { backgroundColor: value, borderColor: settings.borderColor }]} />
        )}
        {value && (
          <TouchableOpacity onPress={() => onChange('')} style={styles.clearButton}>
            <Ionicons name="close-circle" size={24} color={settings.secondaryTextColor} />
          </TouchableOpacity>
        )}
      </View>

      {/* Color Presets */}
      <View style={styles.presetsGrid}>
        {PRESET_COLORS.map((color) => (
          <TouchableOpacity
            key={color}
            style={[
              styles.presetColor,
              { backgroundColor: color, borderColor: settings.borderColor },
              value === color && styles.presetColorSelected,
            ]}
            onPress={() => onChange(color)}
            activeOpacity={0.7}
          />
        ))}
      </View>
    </View>
  );

  // Render the list view showing all existing overrides
  const renderListView = () => {
    const programsWithOverrides = allPrograms.filter(
      program => settings.programColorOverrides[program] && settings.programColorOverrides[program]!.length > 0
    );

    return (
      <ScrollView style={styles.content} key={refreshKey}>
        {/* Header Info */}
        <View style={[styles.infoCard, { backgroundColor: settings.cardBackgroundColor, borderColor: settings.borderColor }]}>
          <Text style={[styles.infoText, { color: settings.secondaryTextColor }]}>
            Manage color overrides for programs. You can override any color property shown in the Dev Info Modal.
          </Text>
        </View>

        {/* Create Button */}
        <TouchableOpacity
          style={[styles.createButton, { backgroundColor: settings.buttonColor }]}
          onPress={handleCreateNew}
          activeOpacity={0.7}
        >
          <Ionicons name="add-circle-outline" size={24} color="#FFFFFF" />
          <Text style={styles.createButtonText}>Create New Override</Text>
        </TouchableOpacity>

        {/* Existing Overrides */}
        {programsWithOverrides.length > 0 ? (
          <>
            <Text style={[styles.sectionTitle, { color: settings.textColor }]}>
              Active Overrides ({programsWithOverrides.length} programs)
            </Text>
            {programsWithOverrides.map((program) => {
              const overrides = settings.programColorOverrides[program]!;
              return (
                <View
                  key={program}
                  style={[styles.overrideCard, { backgroundColor: settings.cardBackgroundColor, borderColor: settings.borderColor }]}
                >
                  <View style={styles.programCardHeader}>
                    <Text style={[styles.programTitle, { color: settings.textColor }]}>{program}</Text>
                    <View style={styles.programCardActions}>
                      <TouchableOpacity
                        onPress={() => handleEditOverride(program)}
                        style={[styles.programActionButton, { borderColor: settings.buttonColor }]}
                      >
                        <Ionicons name="pencil" size={16} color={settings.buttonColor} />
                        <Text style={[styles.programActionButtonText, { color: settings.buttonColor }]}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDeleteAllOverrides(program)}
                        style={[styles.programActionButton, { borderColor: '#FF3B30' }]}
                      >
                        <Ionicons name="trash-outline" size={16} color="#FF3B30" />
                        <Text style={[styles.programActionButtonText, { color: '#FF3B30' }]}>Delete All</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  {overrides.map((override) => (
                    <View key={override.property} style={styles.overrideItem}>
                      <View style={styles.overrideInfo}>
                        <Text style={[styles.propertyName, { color: settings.textColor }]}>
                          {COLOR_PROPERTY_NAMES[override.property]}
                        </Text>
                        <View style={styles.overrideColors}>
                          {override.lightModeValue && (
                            <View style={styles.colorChip}>
                              <View style={[styles.colorChipSwatch, { backgroundColor: override.lightModeValue, borderColor: settings.borderColor }]} />
                              <Text style={[styles.colorChipText, { color: settings.secondaryTextColor }]}>
                                Light: {override.lightModeValue}
                              </Text>
                            </View>
                          )}
                          {override.darkModeValue && (
                            <View style={styles.colorChip}>
                              <View style={[styles.colorChipSwatch, { backgroundColor: override.darkModeValue, borderColor: settings.borderColor }]} />
                              <Text style={[styles.colorChipText, { color: settings.secondaryTextColor }]}>
                                Dark: {override.darkModeValue}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleDeleteOverride(program, override.property)}
                        style={styles.individualDeleteButton}
                      >
                        <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              );
            })}
          </>
        ) : (
          <View style={[styles.emptyState, { backgroundColor: settings.cardBackgroundColor, borderColor: settings.borderColor }]}>
            <Ionicons name="color-palette-outline" size={48} color={settings.secondaryTextColor} />
            <Text style={[styles.emptyStateText, { color: settings.secondaryTextColor }]}>
              No color overrides configured
            </Text>
            <Text style={[styles.emptyStateSubtext, { color: settings.secondaryTextColor }]}>
              Create your first override to customize program colors
            </Text>
          </View>
        )}
      </ScrollView>
    );
  };

  // Render the create/edit view
  const renderCreateEditView = () => (
    <ScrollView style={styles.content}>
      {/* Header */}
      <Text style={[styles.formTitle, { color: settings.textColor }]}>
        {mode === 'edit' ? 'Edit Override' : 'Create New Override'}
      </Text>

      {/* Step 1: Select Property */}
      <View style={[styles.formSection, { backgroundColor: settings.cardBackgroundColor, borderColor: settings.borderColor }]}>
        <View style={styles.formSectionHeader}>
          <Text style={[styles.formSectionTitle, { color: settings.textColor }]}>
            1. Select Color Property
          </Text>
          <Text style={[styles.configuredCountBadge, { color: settings.buttonColor }]}>
            {pendingOverrides.size} configured
          </Text>
        </View>
        <View style={styles.propertyGrid}>
          {(Object.keys(COLOR_PROPERTY_NAMES) as ColorProperty[]).map((property) => {
            const isConfigured = pendingOverrides.has(property);
            const isSelected = selectedProperty === property;
            return (
              <TouchableOpacity
                key={property}
                style={[
                  styles.propertyButton,
                  {
                    backgroundColor: isSelected ? settings.buttonColor : settings.backgroundColor,
                    borderColor: isConfigured ? settings.buttonColor : settings.borderColor,
                    borderWidth: isConfigured ? 2 : 1,
                  },
                ]}
                onPress={() => setSelectedProperty(property)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.propertyButtonText,
                    { color: isSelected ? '#FFFFFF' : settings.textColor },
                  ]}
                >
                  {COLOR_PROPERTY_NAMES[property]}
                  {isConfigured && !isSelected && ' ✓'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Step 2: Set Colors */}
      <View style={[styles.formSection, { backgroundColor: settings.cardBackgroundColor, borderColor: settings.borderColor }]}>
        <Text style={[styles.formSectionTitle, { color: settings.textColor }]}>
          2. Set Color Values for {COLOR_PROPERTY_NAMES[selectedProperty]}
        </Text>
        <Text style={[styles.formSectionSubtitle, { color: settings.secondaryTextColor }]}>
          Set at least one color. Leave blank to use default. Your selections are saved as you switch properties.
        </Text>

        {renderColorPicker('Light Mode', lightModeValue, updateLightMode)}
        {renderColorPicker('Dark Mode', darkModeValue, updateDarkMode)}
      </View>

      {/* Step 3: Select Programs */}
      <View style={[styles.formSection, { backgroundColor: settings.cardBackgroundColor, borderColor: settings.borderColor }]}>
        <View style={styles.formSectionHeader}>
          <Text style={[styles.formSectionTitle, { color: settings.textColor }]}>
            3. Select Programs ({selectedPrograms.size}/{allPrograms.length})
          </Text>
          <View style={styles.selectButtons}>
            <TouchableOpacity onPress={selectAllPrograms} style={styles.selectButton}>
              <Text style={[styles.selectButtonText, { color: settings.buttonColor }]}>All</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={deselectAllPrograms} style={styles.selectButton}>
              <Text style={[styles.selectButtonText, { color: settings.secondaryTextColor }]}>None</Text>
            </TouchableOpacity>
          </View>
        </View>

        {allPrograms.map((program) => {
          const isSelected = selectedPrograms.has(program);
          const programOverrides = settings.programColorOverrides[program];

          // Check which properties will be replaced
          const existingProperties = new Set(programOverrides?.map(o => o.property) || []);
          const propertiesBeingConfigured = Array.from(pendingOverrides.keys());
          const willReplaceProperties = propertiesBeingConfigured.filter(p => existingProperties.has(p));

          return (
            <TouchableOpacity
              key={program}
              style={[
                styles.programRow,
                {
                  backgroundColor: settings.backgroundColor,
                  borderColor: settings.borderColor,
                  borderWidth: isSelected ? 2 : 1,
                  borderLeftColor: isSelected ? settings.buttonColor : settings.borderColor,
                  borderLeftWidth: isSelected ? 4 : 1,
                },
              ]}
              onPress={() => toggleProgram(program)}
              activeOpacity={0.7}
              disabled={mode === 'edit' && editingProgram !== program}
            >
              <View style={styles.programInfo}>
                <Text style={[styles.programName, { color: settings.textColor }]}>{program}</Text>
                {willReplaceProperties.length > 0 && (
                  <Text style={[styles.existingOverrideBadge, { color: '#FF9800' }]}>
                    • Will replace {willReplaceProperties.length} existing override{willReplaceProperties.length > 1 ? 's' : ''}
                  </Text>
                )}
              </View>
              <Switch
                value={isSelected}
                onValueChange={() => toggleProgram(program)}
                trackColor={{ false: '#767577', true: settings.buttonColor }}
                thumbColor={isSelected ? '#FFFFFF' : '#f4f3f4'}
                disabled={mode === 'edit' && editingProgram !== program}
              />
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Action Buttons */}
      <View style={styles.formActions}>
        <TouchableOpacity
          style={[styles.formButton, styles.cancelButton, { borderColor: settings.secondaryTextColor }]}
          onPress={handleCancel}
          activeOpacity={0.7}
        >
          <Text style={[styles.formButtonText, { color: settings.secondaryTextColor }]}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.formButton, styles.applyButton, { backgroundColor: settings.buttonColor }]}
          onPress={handleApplyOverride}
          activeOpacity={0.7}
        >
          <Text style={[styles.formButtonText, { color: '#FFFFFF' }]}>Apply Override</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: settings.backgroundColor }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: settings.cardBackgroundColor, borderBottomColor: settings.borderColor }]}>
          <View style={styles.headerLeft}>
            {mode !== 'list' && (
              <TouchableOpacity onPress={handleCancel} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color={settings.textColor} />
              </TouchableOpacity>
            )}
            <Text style={[styles.headerTitle, { color: settings.textColor }]}>Color Overrides</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color={settings.textColor} />
          </TouchableOpacity>
        </View>

        {mode === 'list' ? renderListView() : renderCreateEditView()}
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
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  infoCard: {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 16,
    borderRadius: 12,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 24,
    marginBottom: 12,
  },
  overrideCard: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  programCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.2)',
  },
  programTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  programCardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  programActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  programActionButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  overrideItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.2)',
  },
  overrideInfo: {
    flex: 1,
    marginRight: 8,
  },
  individualDeleteButton: {
    padding: 8,
    marginTop: -4,
  },
  propertyName: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  overrideColors: {
    gap: 6,
  },
  colorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  colorChipSwatch: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 1,
  },
  colorChipText: {
    fontSize: 12,
  },
  emptyState: {
    marginTop: 32,
    padding: 32,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  formTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 24,
    marginBottom: 16,
  },
  formSection: {
    marginBottom: 24,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  formSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  formSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  formSectionSubtitle: {
    fontSize: 13,
    marginBottom: 12,
  },
  configuredCountBadge: {
    fontSize: 13,
    fontWeight: '600',
  },
  propertyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  propertyButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  propertyButtonText: {
    fontSize: 13,
    fontWeight: '500',
  },
  colorPickerSection: {
    marginBottom: 20,
  },
  colorPickerLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  hexInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  hexInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  colorPreview: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 2,
  },
  clearButton: {
    padding: 4,
  },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetColor: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 2,
  },
  presetColorSelected: {
    borderWidth: 3,
    borderColor: '#007AFF',
  },
  selectButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  selectButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  selectButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  programRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  programInfo: {
    flex: 1,
  },
  programName: {
    fontSize: 14,
    fontWeight: '500',
  },
  existingOverrideBadge: {
    fontSize: 11,
    marginTop: 4,
    fontWeight: '600',
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    marginBottom: 32,
  },
  formButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    borderWidth: 2,
    backgroundColor: 'transparent',
  },
  applyButton: {
    borderWidth: 0,
  },
  formButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ColorOverrideModal;
