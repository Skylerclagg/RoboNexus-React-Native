/**
 * Welcome Screen
 *
 * Description:
 * Onboarding screen that allows users to select their VEX robotics competition program
 * when first launching the app or changing programs. Presents available programs in a
 * modal interface with program-specific configuration and theming.
 *
 * Navigation:
 * Shown automatically on first app launch or when program selection is needed.
 * Can be accessed from app settings to change the selected program.
 *
 * Key Features:
 * - Program selection interface for all VEX competition types
 * - Developer mode support for additional programs (Aerial Drone)
 * - Modal presentation with customizable titles and messages
 * - Program validation and settings persistence
 * - Theme-aware styling and visual feedback
 * - Success confirmation and error handling
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings, ProgramType, getProgramTheme } from '../contexts/SettingsContext';

interface WelcomeScreenProps {
  isVisible: boolean;
  onClose: () => void;
  showCloseButton?: boolean;
  title?: string;
  subtitle?: string;
  successMessage?: string;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  isVisible,
  onClose,
  showCloseButton = false,
  title = "Welcome to RoboNexus!",
  subtitle = "To get started, please select your program.",
  successMessage
}) => {
  const { selectedProgram: settingsSelectedProgram, ...settings } = useSettings();
  const [selectedProgram, setSelectedProgram] = useState<ProgramType>(
    settingsSelectedProgram
  );

  // Reset selected program and clear preview when modal opens/closes
  useEffect(() => {
    if (isVisible) {
      setSelectedProgram(settingsSelectedProgram);
      settings.setPreviewProgram(null); // Clear any previous preview
    } else {
      settings.setPreviewProgram(null); // Clear preview when modal closes
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible, settingsSelectedProgram]);

  const availablePrograms: ProgramType[] = settings.availablePrograms;

  // Get preview theme colors based on preview program (for immediate visual feedback)
  const previewTheme = useMemo(() => {
    return getProgramTheme(settings.previewProgram || selectedProgram, settings.colorScheme);
  }, [settings.previewProgram, selectedProgram, settings.colorScheme]);

  const handleApplyProgram = async () => {
    try {
      // Clear preview before applying
      settings.setPreviewProgram(null);

      // Set the selected program (this will automatically switch to the active season)
      await settings.setSelectedProgram(selectedProgram);

      // Mark that the welcome screen has been shown for this version
      const version = '1.0.0'; // In a real app, get this from app.json or Constants
      await settings.setLastWelcomeVersion(version);

      onClose();
      const defaultMessage = `Successfully configured RoboNexus for ${selectedProgram.replace('Robotics Competition', '').replace('Competition', '').trim()}!`;
      Alert.alert('Success!', successMessage || defaultMessage);
    } catch (error) {
      console.error('Error saving program selection:', error);
      Alert.alert('Error', 'Failed to save program selection');
    }
  };


  const styles = createStyles(settings);

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View style={[styles.container, { backgroundColor: settings.backgroundColor }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: settings.textColor }]}>
            {title}
          </Text>
          <Text style={[styles.headerSubtitle, { color: settings.textColor }]}>
            {subtitle}
          </Text>
          {showCloseButton && (
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
            >
              <Ionicons name="close" size={24} color={settings.textColor} />
            </TouchableOpacity>
          )}
        </View>

        {/* Program List */}
        <ScrollView style={styles.programList} showsVerticalScrollIndicator={false}>
          {availablePrograms.map((program) => {
            const isSelected = selectedProgram === program;

            return (
              <TouchableOpacity
                key={program}
                style={[
                  styles.programRow,
                  {
                    backgroundColor: isSelected
                      ? (settings.colorScheme === 'dark' ? '#2C2C2E' : '#F2F2F7')
                      : (settings.colorScheme === 'dark' ? '#1C1C1E' : '#FFFFFF'),
                  }
                ]}
                onPress={() => {
                  setSelectedProgram(program);
                  // Update preview program for immediate color changes without API calls
                  settings.setPreviewProgram(program);
                }}
              >
                <Text style={[styles.programText, { color: settings.textColor }]}>
                  {program}
                </Text>
                {isSelected && (
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={previewTheme.primary}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: settings.colorScheme === 'dark' ? '#8E8E93' : '#6D6D72' }]}>
            You can change your selected program anytime in the app settings.
          </Text>
          <Text style={[styles.disclaimerText, { color: '#FF3B30' }]}>
            Note: This app is NOT an OFFICIAL RECF App.
          </Text>
          <TouchableOpacity
            style={[styles.continueButton, { backgroundColor: previewTheme.primary }]}
            onPress={handleApplyProgram}
          >
            <Text style={styles.continueButtonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (settings: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingTop: 60,
    alignItems: 'center',
    position: 'relative',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 17,
    textAlign: 'center',
    lineHeight: 22,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 8,
    zIndex: 1,
  },
  programList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  programRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  programText: {
    fontSize: 17,
    fontWeight: '400',
    flex: 1,
  },
  footer: {
    padding: 20,
    paddingBottom: 40,
  },
  footerText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 8,
  },
  disclaimerText: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  continueButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  continueButtonText: {
    color: '#FFFFFF', // Button text always white
    fontSize: 17,
    fontWeight: '600',
  },
});

export default WelcomeScreen;