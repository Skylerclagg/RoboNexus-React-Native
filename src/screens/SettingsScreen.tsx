/**
 * SETTINGS SCREEN
 *
 * App configuration screen allowing users to customize program selection,
 * theme preferences, and app behavior settings.
 *
 * NAVIGATION ACCESS:
 * - Dashboard tab → Settings button (gear icon)
 * - Main tab navigator (Settings tab)
 *
 * KEY FEATURES:
 * - Program selection (VEX V5, VEX IQ, VEX U, VEX AI, Aerial Drone)
 * - Theme mode selection (Light, Dark, Auto)
 * - Global season filtering toggle
 * - Developer mode and debug features
 * - App version and build information
 * - Data cache management
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createLogger } from '../utils/logger';

const logger = createLogger('SettingsScreen');
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  TextInput,
  Alert,
  Linking,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings, ProgramType, ThemeMode, ColorblindMode } from '../contexts/SettingsContext';
import { useFavorites } from '../contexts/FavoritesContext';
import { useNotes } from '../contexts/NotesContext';
import DropdownPicker from '../components/DropdownPicker';
import NotesManagementModal from '../components/NotesManagementModal';
import DevInfoModal from '../components/DevInfoModal';
import ColorOverrideModal from '../components/ColorOverrideModal';
import DeveloperModeDisableModal from '../components/DeveloperModeDisableModal';
import { robotEventsAPI } from '../services/apiRouter';
import * as Application from 'expo-application';
import { getProgramId, PROGRAM_CONFIGS, getAllProgramNames, isProgramLimitedMode, getProgramConfig } from '../utils/programMappings';
import { alerts } from '../utils/webCompatibility';

interface SettingsScreenProps {
  onShowWelcome?: () => void;
  navigation?: any;
}

const SettingsScreen: React.FC<SettingsScreenProps> = ({ onShowWelcome, navigation }) => {
  const { selectedProgram, ...settings } = useSettings();
  const favorites = useFavorites();
  const { clearAllNotes } = useNotes();
  const [developerCode, setDeveloperCode] = useState('');
  const [seasons, setSeasons] = useState<{ label: string; value: string }[]>([]);
  const [isLoadingSeasons, setIsLoadingSeasons] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [showDeveloperCodeInput, setShowDeveloperCodeInput] = useState(false);
  const [showCompactViewModal, setShowCompactViewModal] = useState(false);
  const [showScrollBarModal, setShowScrollBarModal] = useState(false);
  const [showDevInfoModal, setShowDevInfoModal] = useState(false);
  const [showColorOverrideModal, setShowColorOverrideModal] = useState(false);
  const [showDeveloperModeDisableModal, setShowDeveloperModeDisableModal] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  // Check if current program supports TrueSkill
  const programConfig = getProgramConfig(selectedProgram);
  const showTrueSkillToggle = programConfig.hasTrueSkill;

  // Check if current program has score calculators available
  // Show haptics if: program has calculators AND (doesn't require dev OR scoringCalculatorsEnabled)
  const showHapticsToggle = programConfig.hasScoreCalculators &&
    (!programConfig.scoreCalculatorRequiresDev || settings.scoringCalculatorsEnabled);

  // Get list of dev-only programs for display
  const devOnlyPrograms = useMemo(() => {
    const allPrograms = getAllProgramNames();
    return allPrograms.filter(program => PROGRAM_CONFIGS[program].devOnly);
  }, []);

  // Check if the selected program is in limited mode
  const isLimitedMode = isProgramLimitedMode(selectedProgram);

  // Format season options
  const formatSeasonOption = (raw: string) => {
    // Return the full season name without any shortening
    return raw;
  };

  // Load seasons when program changes
  const loadSeasons = async (program: ProgramType) => {
    setIsLoadingSeasons(true);
    try {
      // Get program ID for filtering
      const programId = getProgramId(program);

      const seasonData = await robotEventsAPI.getSeasons({ program: [programId] });
      const formattedSeasons = seasonData.data
        .sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime())
        .map(season => ({
          label: formatSeasonOption(season.name),
          value: season.id.toString()
        }));
      setSeasons(formattedSeasons);
    } catch (error) {
      logger.error('Failed to load seasons:', error);
    } finally {
      setIsLoadingSeasons(false);
    }
  };

  useEffect(() => {
    loadSeasons(selectedProgram);
  }, [selectedProgram]);

  const programOptions = settings.availablePrograms.map(program => ({
    label: program,
    value: program
  }));




  const handleClearFavoriteTeams = () => {
    Alert.alert(
      'Clear Favorite Teams',
      `Are you sure you want to clear ALL favorited teams for ${selectedProgram}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: async () => {
          try {
            await favorites.clearFavoriteTeams();
            Alert.alert('Success', `Favorite teams cleared for ${selectedProgram}!`);
          } catch (error) {
            Alert.alert('Error', 'Failed to clear favorite teams');
          }
        }},
      ]
    );
  };

  const handleClearFavoriteEvents = () => {
    Alert.alert(
      'Clear Favorite Events',
      `Are you sure you want to clear ALL favorited events for ${selectedProgram}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: async () => {
          try {
            await favorites.clearFavoriteEvents();
            Alert.alert('Success', `Favorite events cleared for ${selectedProgram}!`);
          } catch (error) {
            Alert.alert('Error', 'Failed to clear favorite events');
          }
        }},
      ]
    );
  };

  const handleClearMatchNotes = () => {
    Alert.alert(
      'Clear Match Notes',
      'Are you sure you want to clear ALL match notes? This includes all team notes and match notes.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: async () => {
          try {
            await clearAllNotes();
            Alert.alert('Success', 'All match notes and team notes cleared!');
          } catch (error) {
            logger.error('Failed to clear notes:', error);
            Alert.alert('Error', 'Failed to clear notes');
          }
        }},
      ]
    );
  };

  const handleApplyChanges = () => {
    Alert.alert(
      'Apply Changes',
      'Apply changes and restart app? This will close the app to apply visual changes.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Apply and Restart', style: 'destructive', onPress: () => {
          Alert.alert('Changes Applied', 'App will restart now');
          // In a real app, you'd restart or reload
        }},
      ]
    );
  };

  const handleDeveloperModeUnlock = async (code?: string) => {
    const codeToUse = code || developerCode;
    const success = await settings.enableDeveloperModeWithCode(codeToUse);
    if (success) {
      Alert.alert('Success', 'Developer Mode enabled!');
      setDeveloperCode('');
      setShowDeveloperCodeInput(false);
    } else {
      Alert.alert('Error', 'Invalid developer code');
      setDeveloperCode('');
    }
  };

  const handleDeveloperModeEnablePress = () => {
    if (Platform.OS === 'ios') {
      // Use iOS-native Alert.prompt
      Alert.prompt(
        'Developer Mode',
        'Enter developer code to enable:',
        [
          {
            text: 'Cancel',
            style: 'cancel'
          },
          {
            text: 'Unlock',
            onPress: (code?: string) => {
              if (code) {
                handleDeveloperModeUnlock(code);
              }
            }
          }
        ],
        'secure-text'
      );
    } else {
      // Use Android-compatible TextInput method
      setShowDeveloperCodeInput(true);
      handleDeveloperCodeFocus();
    }
  };

  const handleDeveloperModeDisable = () => {
    // Use custom modal on all platforms for consistent UX
    setShowDeveloperModeDisableModal(true);
  };

  const handleDisableTemporarily = () => {
    // The valid code is already stored in settings.storedDeveloperCode
    // We just need to disable developer mode temporarily
    settings.setIsDeveloperMode(false);
  };

  const handleDisablePermanently = async () => {
    // Fully disable and clear stored code
    await settings.setStoredDeveloperCode('');
    settings.setIsDeveloperMode(false);
    setDeveloperCode('');
  };

  const openDiscord = () => {
    Linking.openURL('https://discord.gg/KzaUshqfsZ');
  };

  const handleDeveloperCodeFocus = () => {
    // Scroll to the developer section when the text input is focused
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScrollView
        ref={scrollViewRef}
        style={[styles.container, { backgroundColor: settings.backgroundColor }]}
        contentContainerStyle={{ paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
      {/* Support RoboNexus */}
      <View style={[styles.section, {
        backgroundColor: settings.cardBackgroundColor,
        borderTopColor: settings.borderColor,
        borderBottomColor: settings.borderColor,
        marginTop: 8,
      }]}>
        <View style={styles.supportHeader}>
          <Ionicons name="heart" size={24} color={settings.errorColor} />
          <Text style={[styles.supportTitle, { color: settings.textColor }]}>Support RoboNexus</Text>
        </View>
        <Text style={[styles.supportMessage, { color: settings.secondaryTextColor }]}>
          RoboNexus will always be free. Donations are to help cover my yearly Apple Developer license fee of $100 and allow me to keep updating the app as well as keeping it available on the App Store. Thank you for your support!
        </Text>
        <TouchableOpacity
          style={[styles.donateButton, { backgroundColor: settings.buttonColor }]}
          onPress={() => Linking.openURL('https://www.paypal.com/donate/?business=6J7SHZWAF95QQ&no_recurring=0&item_name=Donations+allow+me+to+continue+to+make+RoboNexus+available+to+the+community.+&currency_code=USD')}
        >
          <Ionicons name="logo-paypal" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={styles.donateButtonText}>Donate via PayPal</Text>
        </TouchableOpacity>
      </View>

      {/* Program Selection */}
      <View style={[styles.section, {
        backgroundColor: settings.cardBackgroundColor,
        borderTopColor: settings.borderColor,
        borderBottomColor: settings.borderColor,
        marginTop: 8,
      }]}>
        <Text style={[styles.sectionTitle, { color: settings.secondaryTextColor, marginTop: 8 }]}>Program Selection</Text>
        <DropdownPicker
          options={programOptions}
          selectedValue={selectedProgram}
          onValueChange={(value) => {
            settings.setSelectedProgram(value as ProgramType);
          }}
          placeholder="Select Program"
          textAlign="center"
        />
      </View>

      {/* Season Selector - Hide in limited mode */}
      {!isLimitedMode && (
        <View style={[styles.section, {
          backgroundColor: settings.cardBackgroundColor,
          borderTopColor: settings.borderColor,
          borderBottomColor: settings.borderColor
        }]}>
          <Text style={[styles.sectionTitle, { color: settings.secondaryTextColor }]}>Season Selector</Text>
          {isLoadingSeasons ? (
            <View style={styles.optionRow}>
              <Text style={[styles.optionText, { color: settings.textColor }]}>Loading seasons...</Text>
            </View>
          ) : (
            <DropdownPicker
              options={seasons}
              selectedValue={settings.selectedSeason}
              onValueChange={settings.setSelectedSeason}
              placeholder="Select Season"
              textAlign="center"
            />
          )}
        </View>
      )}

      {/* General */}
      <View style={[styles.section, {
        backgroundColor: settings.cardBackgroundColor,
        borderTopColor: settings.borderColor,
        borderBottomColor: settings.borderColor
      }]}>
        <Text style={[styles.sectionTitle, { color: settings.secondaryTextColor }]}>General</Text>

        {/* Enable Haptics - Only show if program has score calculators (and enabled if dev-required) */}
        {showHapticsToggle && (
          <View style={[styles.optionRow, { backgroundColor: settings.cardBackgroundColor, borderBottomColor: settings.borderColor }]}>
            <View style={styles.optionTextContainer}>
              <Text style={[styles.optionText, { color: settings.textColor }]}>Enable Haptics</Text>
              <Text style={[styles.optionSubtext, { color: settings.secondaryTextColor }]}>
                Enables vibration for button presses in score calculators
              </Text>
            </View>
            <Switch
              value={settings.enableHaptics}
              onValueChange={settings.setEnableHaptics}
              trackColor={{ false: settings.switchTrackColorOff, true: settings.buttonColor }}
              thumbColor={settings.enableHaptics ? settings.switchThumbColorOn : settings.switchThumbColorOff}
            />
          </View>
        )}

        <View style={[styles.optionRow, { backgroundColor: settings.cardBackgroundColor, borderBottomColor: settings.borderColor }]}>
          <View style={styles.optionTextContainer}>
            <Text style={[styles.optionText, { color: settings.textColor }]}>Sort Dashboard by Next Match</Text>
            <Text style={[styles.optionSubtext, { color: settings.secondaryTextColor }]}>
              When enabled, teams at live events with upcoming matches appear first
            </Text>
          </View>
          <Switch
            value={settings.sortDashboardByNextMatch}
            onValueChange={settings.setSortDashboardByNextMatch}
            trackColor={{ false: settings.switchTrackColorOff, true: settings.buttonColor }}
            thumbColor={settings.sortDashboardByNextMatch ? settings.switchThumbColorOn : settings.switchThumbColorOff}
          />
        </View>
        <View style={[styles.optionRow, { backgroundColor: settings.cardBackgroundColor, borderBottomColor: settings.borderColor }]}>
          <View style={styles.optionTextContainer}>
            <Text style={[styles.optionText, { color: settings.textColor }]}>Date Filter</Text>
            <Text style={[styles.optionSubtext, { color: settings.secondaryTextColor }]}>
              Show events from the past {settings.dateFilter} days
            </Text>
          </View>
          <View style={styles.stepperContainer}>
            <TouchableOpacity
              style={[styles.stepperButton, { backgroundColor: settings.cardBackgroundColor, borderColor: settings.borderColor, borderWidth: 1 }]}
              onPress={() => settings.setDateFilter(Math.max(1, settings.dateFilter - 1))}
            >
              <Ionicons name="remove" size={18} color={settings.buttonColor} />
            </TouchableOpacity>
            <Text style={[styles.stepperValue, { color: settings.textColor }]}>{settings.dateFilter}</Text>
            <TouchableOpacity
              style={[styles.stepperButton, { backgroundColor: settings.cardBackgroundColor, borderColor: settings.borderColor, borderWidth: 1 }]}
              onPress={() => settings.setDateFilter(Math.min(30, settings.dateFilter + 1))}
            >
              <Ionicons name="add" size={18} color={settings.buttonColor} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={[styles.optionRow, { backgroundColor: settings.cardBackgroundColor, borderBottomColor: settings.borderColor }]}>
          <View style={styles.optionTextContainer}>
            <Text style={[styles.optionText, { color: settings.textColor }]}>Nearby Range</Text>
            <Text style={[styles.optionSubtext, { color: settings.secondaryTextColor }]}>
              Search radius for nearby events ({settings.nearbyRange} miles)
            </Text>
          </View>
          <View style={styles.stepperContainer}>
            <TouchableOpacity
              style={[styles.stepperButton, { backgroundColor: settings.cardBackgroundColor, borderColor: settings.borderColor, borderWidth: 1 }]}
              onPress={() => settings.setNearbyRange(Math.max(10, settings.nearbyRange - 10))}
            >
              <Ionicons name="remove" size={18} color={settings.buttonColor} />
            </TouchableOpacity>
            <Text style={[styles.stepperValue, { color: settings.textColor }]}>{settings.nearbyRange}</Text>
            <TouchableOpacity
              style={[styles.stepperButton, { backgroundColor: settings.cardBackgroundColor, borderColor: settings.borderColor, borderWidth: 1 }]}
              onPress={() => settings.setNearbyRange(Math.min(200, settings.nearbyRange + 10))}
            >
              <Ionicons name="add" size={18} color={settings.buttonColor} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={[styles.optionRow, { backgroundColor: settings.cardBackgroundColor, borderBottomColor: settings.borderColor }]}>
          <View style={styles.optionTextContainer}>
            <Text style={[styles.optionText, { color: settings.textColor }]}>Auto-Filter by Country</Text>
            <Text style={[styles.optionSubtext, { color: settings.secondaryTextColor }]}>
              Automatically apply country filter based on device location
            </Text>
          </View>
          <Switch
            value={settings.autoLocationCountryFilter}
            onValueChange={settings.setAutoLocationCountryFilter}
            trackColor={{ false: settings.switchTrackColorOff, true: settings.buttonColor }}
            thumbColor={settings.autoLocationCountryFilter ? settings.switchThumbColorOn : settings.switchThumbColorOff}
          />
        </View>
        <View style={[styles.optionRow, { backgroundColor: settings.cardBackgroundColor, borderBottomColor: settings.borderColor }]}>
          <View style={styles.optionTextContainer}>
            <Text style={[styles.optionText, { color: settings.textColor }]}>Global Season Selection</Text>
            <Text style={[styles.optionSubtext, { color: settings.secondaryTextColor }]}>
              When enabled, changing season on any screen updates all other screens
            </Text>
          </View>
          <Switch
            value={settings.globalSeasonEnabled}
            onValueChange={settings.setGlobalSeasonEnabled}
            trackColor={{ false: settings.switchTrackColorOff, true: settings.buttonColor }}
            thumbColor={settings.globalSeasonEnabled ? settings.switchThumbColorOn : settings.switchThumbColorOff}
          />
        </View>

        {/* TrueSkill Toggle - Only show if current program supports it */}
        {showTrueSkillToggle && (
          <View style={[styles.optionRow, { backgroundColor: settings.cardBackgroundColor, borderBottomColor: settings.borderColor }]}>
            <View style={styles.optionTextContainer}>
              <Text style={[styles.optionText, { color: settings.textColor }]}>TrueSkill Rankings</Text>
              <Text style={[styles.optionSubtext, { color: settings.secondaryTextColor }]}>
                Enable TrueSkill rankings and statistics for VEX V5 teams
              </Text>
            </View>
            <Switch
              value={settings.trueSkillEnabled}
              onValueChange={settings.setTrueSkillEnabled}
              trackColor={{ false: settings.switchTrackColorOff, true: settings.buttonColor }}
              thumbColor={settings.trueSkillEnabled ? settings.switchThumbColorOn : settings.switchThumbColorOff}
            />
          </View>
        )}
      </View>

      {/* Notes */}
      <View style={[styles.section, {
        backgroundColor: settings.cardBackgroundColor,
        borderTopColor: settings.borderColor,
        borderBottomColor: settings.borderColor
      }]}>
        <Text style={[styles.sectionTitle, { color: settings.secondaryTextColor }]}>Notes</Text>
        <TouchableOpacity
          style={[styles.optionRow, styles.lastOptionRow, { backgroundColor: settings.cardBackgroundColor }]}
          onPress={() => setShowNotesModal(true)}
        >
          <View style={styles.optionTextContainer}>
            <Text style={[styles.optionText, { color: settings.textColor }]}>Manage Notes</Text>
            <Text style={[styles.optionSubtext, { color: settings.secondaryTextColor }]}>View and delete individual notes by team or event</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={settings.iconColor} />
        </TouchableOpacity>
      </View>

      {/* App Customization */}
      <View style={[styles.section, {
        backgroundColor: settings.cardBackgroundColor,
        borderTopColor: settings.borderColor,
        borderBottomColor: settings.borderColor
      }]}>
        <Text style={[styles.sectionTitle, { color: settings.secondaryTextColor }]}>App Customization</Text>

        {/* Theme Mode Selector */}
        <View style={[styles.optionRow, { backgroundColor: settings.cardBackgroundColor, flexDirection: 'column', alignItems: 'stretch', borderBottomColor: settings.borderColor }]}>
          <Text style={[styles.optionText, { color: settings.textColor, marginBottom: 8 }]}>Theme</Text>
          <DropdownPicker
            options={[
              { label: 'Automatic', value: 'auto' },
              { label: 'Light', value: 'light' },
              { label: 'Dark', value: 'dark' }
            ]}
            selectedValue={settings.themeMode}
            onValueChange={(value) => settings.setThemeMode(value as ThemeMode)}
            placeholder="Select Theme"
            textAlign="center"
          />
        </View>

        {/* Compact View Settings */}
        <TouchableOpacity
          style={[styles.optionRow, { backgroundColor: settings.cardBackgroundColor, borderBottomColor: settings.borderColor }]}
          onPress={() => setShowCompactViewModal(true)}
        >
          <View style={styles.optionTextContainer}>
            <Text style={[styles.optionText, { color: settings.textColor }]}>Compact View Settings</Text>
            <Text style={[styles.optionSubtext, { color: settings.secondaryTextColor }]}>
              Configure compact mode for different list types
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={settings.secondaryTextColor} />
        </TouchableOpacity>

        {/* Scroll Bar Settings */}
        <TouchableOpacity
          style={[styles.optionRow, { backgroundColor: settings.cardBackgroundColor, borderBottomColor: settings.borderColor }]}
          onPress={() => setShowScrollBarModal(true)}
        >
          <View style={styles.optionTextContainer}>
            <Text style={[styles.optionText, { color: settings.textColor }]}>Scroll Bar Settings</Text>
            <Text style={[styles.optionSubtext, { color: settings.secondaryTextColor }]}>
              Show scroll indicators on lists
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={settings.secondaryTextColor} />
        </TouchableOpacity>

        {/* Colorblind Mode Selector */}
        <View style={[styles.optionRow, styles.lastOptionRow, { backgroundColor: settings.cardBackgroundColor, flexDirection: 'column', alignItems: 'stretch' }]}>
          <Text style={[styles.optionText, { color: settings.textColor, marginBottom: 8 }]}>Colorblind Mode</Text>
          <DropdownPicker
            options={[
              { label: 'None', value: 'none' },
              { label: 'Protanopia/Deuteranopia (Red-Green)', value: 'redgreen' },
              { label: 'Tritanopia (Blue-Yellow)', value: 'blueyellow' }
            ]}
            selectedValue={settings.colorblindMode}
            onValueChange={(value) => settings.setColorblindMode(value as 'none' | 'redgreen' | 'blueyellow')}
            placeholder="Select Colorblind Mode"
            textAlign="center"
          />
        </View>
      </View>

      {/* Danger */}
      <View style={[styles.section, {
        backgroundColor: settings.cardBackgroundColor,
        borderTopColor: settings.borderColor,
        borderBottomColor: settings.borderColor
      }]}>
        <Text style={[styles.sectionTitle, { color: settings.secondaryTextColor }]}>Danger</Text>
        <TouchableOpacity style={[styles.dangerButton, { backgroundColor: settings.buttonColor, shadowColor: settings.buttonColor }]} onPress={handleClearFavoriteTeams}>
          <Text style={styles.dangerButtonText}>Clear favorite teams</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.dangerButton, { backgroundColor: settings.buttonColor, shadowColor: settings.buttonColor }]} onPress={handleClearFavoriteEvents}>
          <Text style={styles.dangerButtonText}>Clear favorite events</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.dangerButton, { backgroundColor: settings.buttonColor, shadowColor: settings.buttonColor }]} onPress={handleClearMatchNotes}>
          <Text style={styles.dangerButtonText}>Clear all notes</Text>
        </TouchableOpacity>
      </View>

      {/* Developer */}
      <View style={[styles.section, {
        backgroundColor: settings.cardBackgroundColor,
        borderTopColor: settings.borderColor,
        borderBottomColor: settings.borderColor
      }]}>
        <Text style={[styles.sectionTitle, { color: settings.secondaryTextColor }]}>Developer</Text>
        <View style={[styles.infoRow, styles.lastInfoRow, { backgroundColor: settings.cardBackgroundColor, borderBottomColor: settings.borderColor }]}>
          <Text style={[styles.infoLabel, { color: settings.textColor }]}>Version</Text>
          <Text style={[styles.infoValue, { color: settings.secondaryTextColor }]}>
            {Application.nativeApplicationVersion || '2.5.0'} ({Application.nativeBuildVersion || '1'}) React Native
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.optionRow, { backgroundColor: settings.cardBackgroundColor, borderBottomColor: settings.borderColor }]}
          onPress={settings.isDeveloperMode ? handleDeveloperModeDisable : () => {
            // Handle enabling developer mode
            if (settings.storedDeveloperCode) {
              settings.setIsDeveloperMode(true);
              setDeveloperCode(settings.storedDeveloperCode);
            } else {
              handleDeveloperModeEnablePress();
            }
          }}
        >
          <View style={styles.optionTextContainer}>
            <Text style={[styles.optionText, {
              color: settings.isDeveloperMode ? settings.successColor : (settings.storedDeveloperCode ? settings.warningColor : settings.errorColor)
            }]}>
              Developer Mode
            </Text>
            <Text style={[styles.optionSubtext, { color: settings.secondaryTextColor }]}>
              {settings.isDeveloperMode
                ? 'Currently enabled - tap to disable'
                : settings.storedDeveloperCode
                  ? 'Temporarily disabled - tap to re-enable'
                  : 'Tap to enter code and enable'
              }
            </Text>
          </View>
          <Ionicons
            name={settings.isDeveloperMode ? "power" : settings.storedDeveloperCode ? "lock-open" : "lock-closed"}
            size={20}
            color={settings.isDeveloperMode ? settings.successColor : (settings.storedDeveloperCode ? settings.warningColor : settings.errorColor)}
          />
        </TouchableOpacity>

        {/* Developer Code Input - Shows when user wants to enable dev mode */}
        {showDeveloperCodeInput && !settings.isDeveloperMode && (
          <View style={{ backgroundColor: settings.cardBackgroundColor, paddingHorizontal: 20, paddingBottom: 16 }}>
            <View style={{ position: 'relative' }}>
              <TextInput
                style={[styles.textInput, {
                  borderColor: settings.borderColor,
                  backgroundColor: settings.backgroundColor,
                  color: settings.textColor,
                  marginBottom: 8,
                  paddingRight: developerCode.length > 0 ? 40 : 16
                }]}
                placeholder="Enter Developer Code"
                placeholderTextColor={settings.secondaryTextColor}
                value={developerCode}
                onChangeText={setDeveloperCode}
                secureTextEntry
                autoFocus
                returnKeyType="done"
                onSubmitEditing={() => handleDeveloperModeUnlock()}
              />
              {developerCode.length > 0 && (
                <TouchableOpacity
                  onPress={() => setDeveloperCode('')}
                  style={styles.clearButtonInInput}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close-circle" size={20} color={settings.secondaryTextColor} />
                </TouchableOpacity>
              )}
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: settings.buttonColor, flex: 1, marginHorizontal: 0 }]}
                onPress={() => handleDeveloperModeUnlock()}
              >
                <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>Unlock</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: settings.errorColor, flex: 1, marginHorizontal: 0 }]}
                onPress={() => {
                  setShowDeveloperCodeInput(false);
                  setDeveloperCode('');
                }}
              >
                <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {settings.isDeveloperMode && (
          <>

            {/* All Around Champion Eligibility Toggle */}
            <View style={[styles.optionRow, { backgroundColor: settings.cardBackgroundColor, borderBottomColor: settings.borderColor }]}>
              <View style={styles.optionTextContainer}>
                <Text style={[styles.optionText, { color: settings.textColor }]}>All Around Eligibility</Text>
                <Text style={[styles.optionSubtext, { color: settings.secondaryTextColor }]}>
                  Enable All Around Champion eligibility checking
                </Text>
              </View>
              <Switch
                value={settings.allAroundEligibilityEnabled}
                onValueChange={settings.setAllAroundEligibilityEnabled}
                trackColor={{ false: settings.switchTrackColorOff, true: settings.buttonColor }}
                thumbColor={settings.allAroundEligibilityEnabled ? settings.switchThumbColorOn : settings.switchThumbColorOff}
              />
            </View>

            {/* Testing Eligibility Features Toggle */}
            <View style={[styles.optionRow, { backgroundColor: settings.cardBackgroundColor, borderBottomColor: settings.borderColor }]}>
              <View style={styles.optionTextContainer}>
                <Text style={[styles.optionText, { color: settings.textColor }]}>Testing Eligibility Features</Text>
                <Text style={[styles.optionSubtext, { color: settings.secondaryTextColor }]}>
                  Enable eligibility testing for past events
                </Text>
              </View>
              <Switch
                value={settings.testingEligibilityEnabled}
                onValueChange={settings.setTestingEligibilityEnabled}
                trackColor={{ false: settings.switchTrackColorOff, true: settings.buttonColor }}
                thumbColor={settings.testingEligibilityEnabled ? settings.switchThumbColorOn : settings.switchThumbColorOff}
              />
            </View>

            {/* Dismiss Eligibility Warning Toggle */}
            <View style={[styles.optionRow, { backgroundColor: settings.cardBackgroundColor, borderBottomColor: settings.borderColor }]}>
              <View style={styles.optionTextContainer}>
                <Text style={[styles.optionText, { color: settings.textColor }]}>Dismiss Eligibility Warning</Text>
                <Text style={[styles.optionSubtext, { color: settings.secondaryTextColor }]}>
                  Permanently dismiss the disclaimer when viewing award eligibility
                </Text>
              </View>
              <Switch
                value={settings.eligibilityWarningDismissed}
                onValueChange={settings.setEligibilityWarningDismissed}
                trackColor={{ false: settings.switchTrackColorOff, true: settings.buttonColor }}
                thumbColor={settings.eligibilityWarningDismissed ? settings.switchThumbColorOn : settings.switchThumbColorOff}
              />
            </View>

            {/* Show Awards Summary Toggle */}
            <View style={[styles.optionRow, { backgroundColor: settings.cardBackgroundColor, borderBottomColor: settings.borderColor }]}>
              <View style={styles.optionTextContainer}>
                <Text style={[styles.optionText, { color: settings.textColor }]}>Show Awards Summary</Text>
                <Text style={[styles.optionSubtext, { color: settings.secondaryTextColor }]}>
                  Display statistics header on Event Division Awards screen with award counts
                </Text>
              </View>
              <Switch
                value={settings.showAwardsSummary}
                onValueChange={settings.setShowAwardsSummary}
                trackColor={{ false: settings.switchTrackColorOff, true: settings.buttonColor }}
                thumbColor={settings.showAwardsSummary ? settings.switchThumbColorOn : settings.switchThumbColorOff}
              />
            </View>

            {/* Live Event Simulation Toggle */}
            <View style={[styles.optionRow, { backgroundColor: settings.cardBackgroundColor, borderBottomColor: settings.borderColor }]}>
              <View style={styles.optionTextContainer}>
                <Text style={[styles.optionText, { color: settings.textColor }]}>Live Event Simulation</Text>
                <Text style={[styles.optionSubtext, { color: settings.secondaryTextColor }]}>
                  Simulate live events using recent events (within 1 week) for testing dashboard features
                </Text>
              </View>
              <Switch
                value={settings.devLiveEventSimulation}
                onValueChange={settings.setDevLiveEventSimulation}
                trackColor={{ false: settings.switchTrackColorOff, true: settings.buttonColor }}
                thumbColor={settings.devLiveEventSimulation ? settings.switchThumbColorOn : settings.switchThumbColorOff}
              />
            </View>

            {/* Test Event ID Input */}
            <View style={[styles.optionRow, { backgroundColor: settings.cardBackgroundColor, borderBottomColor: settings.borderColor, flexDirection: 'column', alignItems: 'stretch' }]}>
              <View style={styles.optionTextContainer}>
                <Text style={[styles.optionText, { color: settings.textColor }]}>Test Event ID</Text>
                <Text style={[styles.optionSubtext, { color: settings.secondaryTextColor }]}>
                  Force a specific event ID to be marked as live for testing (leave empty to use actual live events)
                </Text>
              </View>
              <View style={{ position: 'relative', marginTop: 8 }}>
                <TextInput
                  style={[styles.textInput, {
                    backgroundColor: settings.backgroundColor,
                    color: settings.textColor,
                    borderColor: settings.borderColor,
                    paddingRight: settings.devTestEventId && settings.devTestEventId.length > 0 ? 40 : 16
                  }]}
                  placeholder="Enter event ID (e.g., 12345)"
                  placeholderTextColor={settings.secondaryTextColor}
                  value={settings.devTestEventId}
                  onChangeText={settings.setDevTestEventId}
                  keyboardType="numeric"
                />
                {settings.devTestEventId && settings.devTestEventId.length > 0 && (
                  <TouchableOpacity
                    onPress={() => settings.setDevTestEventId('')}
                    style={styles.clearButtonInInput}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="close-circle" size={20} color={settings.secondaryTextColor} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Developer Tab Toggle */}
            <View style={[styles.optionRow, { backgroundColor: settings.cardBackgroundColor, borderBottomColor: settings.borderColor }]}>
              <View style={styles.optionTextContainer}>
                <Text style={[styles.optionText, { color: settings.textColor }]}>Developer Tab</Text>
                <Text style={[styles.optionSubtext, { color: settings.secondaryTextColor }]}>
                  Show developer information tab in team info screens with team IDs and debug data
                </Text>
              </View>
              <Switch
                value={settings.developerTabEnabled}
                onValueChange={settings.setDeveloperTabEnabled}
                trackColor={{ false: settings.switchTrackColorOff, true: settings.buttonColor }}
                thumbColor={settings.developerTabEnabled ? settings.switchThumbColorOn : settings.switchThumbColorOff}
              />
            </View>

            {/* Developer Information Button */}
            <TouchableOpacity
              style={[styles.optionRow, { backgroundColor: settings.cardBackgroundColor, borderBottomColor: settings.borderColor }]}
              onPress={() => setShowDevInfoModal(true)}
              activeOpacity={0.6}
            >
              <View style={styles.optionTextContainer}>
                <Text style={[styles.optionText, { color: settings.textColor }]}>Developer Information</Text>
                <Text style={[styles.optionSubtext, { color: settings.secondaryTextColor }]}>
                  View detailed app, API, and system debug information
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color={settings.secondaryTextColor} />
            </TouchableOpacity>

            {/* Color Override Button */}
            <TouchableOpacity
              style={[styles.optionRow, { backgroundColor: settings.cardBackgroundColor, borderBottomColor: settings.borderColor }]}
              onPress={() => setShowColorOverrideModal(true)}
              activeOpacity={0.6}
            >
              <View style={styles.optionTextContainer}>
                <Text style={[styles.optionText, { color: settings.textColor }]}>Program Color Overrides</Text>
                <Text style={[styles.optionSubtext, { color: settings.secondaryTextColor }]}>
                  Customize theme colors for each program
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color={settings.secondaryTextColor} />
            </TouchableOpacity>

            {/* Team Browser Toggle */}
            <View style={[styles.optionRow, { backgroundColor: settings.cardBackgroundColor, borderBottomColor: settings.borderColor }]}>
              <View style={styles.optionTextContainer}>
                <Text style={[styles.optionText, { color: settings.textColor }]}>Team Browser</Text>
                <Text style={[styles.optionSubtext, { color: settings.secondaryTextColor }]}>
                  Enable Team Browser tab in the Lookup screen
                </Text>
              </View>
              <Switch
                value={settings.teamBrowserEnabled}
                onValueChange={settings.setTeamBrowserEnabled}
                trackColor={{ false: settings.switchTrackColorOff, true: settings.buttonColor }}
                thumbColor={settings.teamBrowserEnabled ? settings.switchThumbColorOn : settings.switchThumbColorOff}
              />
            </View>

            {/* Use Bundled Game Manuals Toggle */}
            <View style={[styles.optionRow, { backgroundColor: settings.cardBackgroundColor, borderBottomColor: settings.borderColor }]}>
              <View style={styles.optionTextContainer}>
                <Text style={[styles.optionText, { color: settings.textColor }]}>Use Bundled Game Manuals</Text>
                <Text style={[styles.optionSubtext, { color: settings.secondaryTextColor }]}>
                  Force use of locally bundled game manual data instead of fetching from GitHub
                </Text>
              </View>
              <Switch
                value={settings.useBundledGameManuals}
                onValueChange={settings.setUseBundledGameManuals}
                trackColor={{ false: settings.switchTrackColorOff, true: settings.buttonColor }}
                thumbColor={settings.useBundledGameManuals ? settings.switchThumbColorOn : settings.switchThumbColorOff}
              />
            </View>

            {/* Dev-Only Programs Toggle */}
            <View style={[styles.optionRow, { backgroundColor: settings.cardBackgroundColor, borderBottomColor: settings.borderColor }]}>
              <View style={styles.optionTextContainer}>
                <Text style={[styles.optionText, { color: settings.textColor }]}>Dev-Only Programs</Text>
                <Text style={[styles.optionSubtext, { color: settings.secondaryTextColor }]}>
                  {devOnlyPrograms.length > 0
                    ? `Enable experimental programs: ${devOnlyPrograms.join(', ')}`
                    : 'Enable experimental programs marked as development-only'}
                </Text>
              </View>
              <Switch
                value={settings.devOnlyProgramsEnabled}
                onValueChange={settings.setDevOnlyProgramsEnabled}
                trackColor={{ false: settings.switchTrackColorOff, true: settings.buttonColor }}
                thumbColor={settings.devOnlyProgramsEnabled ? settings.switchThumbColorOn : settings.switchThumbColorOff}
              />
            </View>

            {/* Scoring Calculators Toggle */}
            <View style={[styles.optionRow, styles.lastOptionRow, { backgroundColor: settings.cardBackgroundColor, borderBottomColor: settings.borderColor }]}>
              <View style={styles.optionTextContainer}>
                <Text style={[styles.optionText, { color: settings.textColor }]}>Scoring Calculators</Text>
                <Text style={[styles.optionSubtext, { color: settings.secondaryTextColor }]}>
                  Enable scoring calculators tab for VEX games
                </Text>
              </View>
              <Switch
                value={settings.scoringCalculatorsEnabled}
                onValueChange={settings.setScoringCalculatorsEnabled}
                trackColor={{ false: settings.switchTrackColorOff, true: settings.buttonColor }}
                thumbColor={settings.scoringCalculatorsEnabled ? settings.switchThumbColorOn : settings.switchThumbColorOff}
              />
            </View>

            {/* Show Welcome Screen Button */}
            <TouchableOpacity
              style={[styles.button, { backgroundColor: settings.buttonColor, marginTop: 12 }]}
              onPress={onShowWelcome}
            >
              <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>Show Welcome Screen</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Credits */}
      <View style={[styles.section, {
        backgroundColor: settings.cardBackgroundColor,
        borderTopColor: settings.borderColor,
        borderBottomColor: settings.borderColor
      }]}>
        <Text style={[styles.creditText, { color: settings.secondaryTextColor }]}>
          Developed by Skyler Clagg, <Text style={[styles.warningText, { color: settings.errorColor }]}>Note this app is NOT an OFFICIAL RECF App.</Text> This app takes inspiration from VRC RoboScout.
        </Text>
        <TouchableOpacity style={[styles.button, { backgroundColor: settings.buttonColor, marginTop: 16 }]} onPress={openDiscord}>
          <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>Join the Discord Server</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>

      {/* Notes Management Modal */}
      <NotesManagementModal
        visible={showNotesModal}
        onClose={() => setShowNotesModal(false)}
      />

      {/* Developer Information Modal */}
      <DevInfoModal
        visible={showDevInfoModal}
        onClose={() => setShowDevInfoModal(false)}
      />

      {/* Color Override Modal */}
      <ColorOverrideModal
        visible={showColorOverrideModal}
        onClose={() => setShowColorOverrideModal(false)}
      />

      {/* Developer Mode Disable Modal */}
      <DeveloperModeDisableModal
        visible={showDeveloperModeDisableModal}
        onClose={() => setShowDeveloperModeDisableModal(false)}
        onDisableTemporarily={handleDisableTemporarily}
        onDisablePermanently={handleDisablePermanently}
      />

      {/* Compact View Settings Modal */}
      <Modal
        visible={showCompactViewModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCompactViewModal(false)}
      >
        <View style={[styles.fullScreenModal, { backgroundColor: settings.backgroundColor }]}>
          {/* Header */}
          <View style={[styles.fullScreenHeader, {
            backgroundColor: settings.topBarColor,
            borderBottomColor: settings.borderColor
          }]}>
            <Text style={[styles.fullScreenHeaderTitle, { color: settings.topBarContentColor }]}>
              Compact View Settings
            </Text>
            <TouchableOpacity style={styles.fullScreenCloseButton} onPress={() => setShowCompactViewModal(false)}>
              <Ionicons name="close" size={24} color={settings.topBarContentColor} />
            </TouchableOpacity>
          </View>

          {/* Modal Content */}
          <ScrollView style={styles.fullScreenModalContent}>
            <View style={[styles.modalCard, {
              backgroundColor: settings.cardBackgroundColor,
              borderTopColor: settings.borderColor,
              borderBottomColor: settings.borderColor
            }]}>
              <View style={[styles.modalOptionRow, { borderBottomColor: settings.borderColor }]}>
                <View style={styles.optionTextContainer}>
                  <Text style={[styles.optionText, { color: settings.textColor }]}>All Lists</Text>
                  <Text style={[styles.optionSubtext, { color: settings.secondaryTextColor }]}>
                    Enable compact mode for all list types
                  </Text>
                </View>
                <Switch
                  value={settings.compactViewAll}
                  onValueChange={settings.setCompactViewAll}
                  trackColor={{ false: settings.switchTrackColorOff, true: settings.buttonColor }}
                  thumbColor={settings.compactViewAll ? settings.switchThumbColorOn : settings.switchThumbColorOff}
                />
              </View>

              <View style={[styles.modalOptionRow, { borderBottomColor: settings.borderColor }]}>
                <View style={styles.optionTextContainer}>
                  <Text style={[styles.optionText, { color: settings.textColor }]}>Match Lists</Text>
                  <Text style={[styles.optionSubtext, { color: settings.secondaryTextColor }]}>
                    Show matches in compact view
                  </Text>
                </View>
                <Switch
                  value={settings.compactViewMatches}
                  onValueChange={settings.setCompactViewMatches}
                  trackColor={{ false: settings.switchTrackColorOff, true: settings.buttonColor }}
                  thumbColor={settings.compactViewMatches ? settings.switchThumbColorOn : settings.switchThumbColorOff}
                />
              </View>

              <View style={[styles.modalOptionRow, { borderBottomColor: settings.borderColor }]}>
                <View style={styles.optionTextContainer}>
                  <Text style={[styles.optionText, { color: settings.textColor }]}>Rankings</Text>
                  <Text style={[styles.optionSubtext, { color: settings.secondaryTextColor }]}>
                    Show rankings in compact view
                  </Text>
                </View>
                <Switch
                  value={settings.compactViewRankings}
                  onValueChange={settings.setCompactViewRankings}
                  trackColor={{ false: settings.switchTrackColorOff, true: settings.buttonColor }}
                  thumbColor={settings.compactViewRankings ? settings.switchThumbColorOn : settings.switchThumbColorOff}
                />
              </View>

              <View style={[styles.modalOptionRow, { borderBottomColor: settings.borderColor }]}>
                <View style={styles.optionTextContainer}>
                  <Text style={[styles.optionText, { color: settings.textColor }]}>Skills Rankings</Text>
                  <Text style={[styles.optionSubtext, { color: settings.secondaryTextColor }]}>
                    Show skills rankings in compact view
                  </Text>
                </View>
                <Switch
                  value={settings.compactViewSkills}
                  onValueChange={settings.setCompactViewSkills}
                  trackColor={{ false: settings.switchTrackColorOff, true: settings.buttonColor }}
                  thumbColor={settings.compactViewSkills ? settings.switchThumbColorOn : settings.switchThumbColorOff}
                />
              </View>

              <View style={[styles.modalOptionRow, { borderBottomWidth: 0 }]}>
                <View style={styles.optionTextContainer}>
                  <Text style={[styles.optionText, { color: settings.textColor }]}>Team Lists</Text>
                  <Text style={[styles.optionSubtext, { color: settings.secondaryTextColor }]}>
                    Show teams in compact view
                  </Text>
                </View>
                <Switch
                  value={settings.compactViewTeams}
                  onValueChange={settings.setCompactViewTeams}
                  trackColor={{ false: settings.switchTrackColorOff, true: settings.buttonColor }}
                  thumbColor={settings.compactViewTeams ? settings.switchThumbColorOn : settings.switchThumbColorOff}
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Scroll Bar Settings Modal */}
      <Modal
        visible={showScrollBarModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowScrollBarModal(false)}
      >
        <View style={[styles.fullScreenModal, { backgroundColor: settings.backgroundColor }]}>
          {/* Header */}
          <View style={[styles.fullScreenHeader, {
            backgroundColor: settings.topBarColor,
            borderBottomColor: settings.borderColor
          }]}>
            <Text style={[styles.fullScreenHeaderTitle, { color: settings.topBarContentColor }]}>
              Scroll Bar Settings
            </Text>
            <TouchableOpacity style={styles.fullScreenCloseButton} onPress={() => setShowScrollBarModal(false)}>
              <Ionicons name="close" size={24} color={settings.topBarContentColor} />
            </TouchableOpacity>
          </View>

          {/* Modal Content */}
          <ScrollView style={styles.fullScreenModalContent}>
            <View style={[styles.modalCard, {
              backgroundColor: settings.cardBackgroundColor,
              borderTopColor: settings.borderColor,
              borderBottomColor: settings.borderColor
            }]}>
              <View style={[styles.modalOptionRow, { borderBottomColor: settings.borderColor }]}>
                <View style={styles.optionTextContainer}>
                  <Text style={[styles.optionText, { color: settings.textColor }]}>Enable All Scroll Bars</Text>
                  <Text style={[styles.optionSubtext, { color: settings.secondaryTextColor }]}>
                    Show scroll indicators on all lists
                  </Text>
                </View>
                <Switch
                  value={settings.scrollBarEnabled}
                  onValueChange={settings.setScrollBarEnabled}
                  trackColor={{ false: settings.switchTrackColorOff, true: settings.buttonColor }}
                  thumbColor={settings.scrollBarEnabled ? settings.switchThumbColorOn : settings.switchThumbColorOff}
                />
              </View>

              <View style={[styles.modalOptionRow, { borderBottomColor: settings.borderColor }]}>
                <View style={styles.optionTextContainer}>
                  <Text style={[styles.optionText, { color: settings.textColor }]}>Match Lists</Text>
                  <Text style={[styles.optionSubtext, { color: settings.secondaryTextColor }]}>
                    Show scroll bar on match lists
                  </Text>
                </View>
                <Switch
                  value={settings.scrollBarMatches}
                  onValueChange={settings.setScrollBarMatches}
                  trackColor={{ false: settings.switchTrackColorOff, true: settings.buttonColor }}
                  thumbColor={settings.scrollBarMatches ? settings.switchThumbColorOn : settings.switchThumbColorOff}
                />
              </View>

              <View style={[styles.modalOptionRow, { borderBottomColor: settings.borderColor }]}>
                <View style={styles.optionTextContainer}>
                  <Text style={[styles.optionText, { color: settings.textColor }]}>Rankings</Text>
                  <Text style={[styles.optionSubtext, { color: settings.secondaryTextColor }]}>
                    Show scroll bar on rankings
                  </Text>
                </View>
                <Switch
                  value={settings.scrollBarRankings}
                  onValueChange={settings.setScrollBarRankings}
                  trackColor={{ false: settings.switchTrackColorOff, true: settings.buttonColor }}
                  thumbColor={settings.scrollBarRankings ? settings.switchThumbColorOn : settings.switchThumbColorOff}
                />
              </View>

              <View style={[styles.modalOptionRow, { borderBottomColor: settings.borderColor }]}>
                <View style={styles.optionTextContainer}>
                  <Text style={[styles.optionText, { color: settings.textColor }]}>Skills Rankings</Text>
                  <Text style={[styles.optionSubtext, { color: settings.secondaryTextColor }]}>
                    Show scroll bar on skills rankings
                  </Text>
                </View>
                <Switch
                  value={settings.scrollBarSkills}
                  onValueChange={settings.setScrollBarSkills}
                  trackColor={{ false: settings.switchTrackColorOff, true: settings.buttonColor }}
                  thumbColor={settings.scrollBarSkills ? settings.switchThumbColorOn : settings.switchThumbColorOff}
                />
              </View>

              <View style={[styles.modalOptionRow, { borderBottomColor: settings.borderColor }]}>
                <View style={styles.optionTextContainer}>
                  <Text style={[styles.optionText, { color: settings.textColor }]}>Team Lists</Text>
                  <Text style={[styles.optionSubtext, { color: settings.secondaryTextColor }]}>
                    Show scroll bar on team lists
                  </Text>
                </View>
                <Switch
                  value={settings.scrollBarTeams}
                  onValueChange={settings.setScrollBarTeams}
                  trackColor={{ false: settings.switchTrackColorOff, true: settings.buttonColor }}
                  thumbColor={settings.scrollBarTeams ? settings.switchThumbColorOn : settings.switchThumbColorOff}
                />
              </View>

              <View style={[styles.modalOptionRow, { borderBottomColor: settings.borderColor }]}>
                <View style={styles.optionTextContainer}>
                  <Text style={[styles.optionText, { color: settings.textColor }]}>World Skills Rankings</Text>
                  <Text style={[styles.optionSubtext, { color: settings.secondaryTextColor }]}>
                    Show scroll bar on world skills
                  </Text>
                </View>
                <Switch
                  value={settings.scrollBarWorldSkills}
                  onValueChange={settings.setScrollBarWorldSkills}
                  trackColor={{ false: settings.switchTrackColorOff, true: settings.buttonColor }}
                  thumbColor={settings.scrollBarWorldSkills ? settings.switchThumbColorOn : settings.switchThumbColorOff}
                />
              </View>

              <View style={[styles.modalOptionRow, { borderBottomWidth: 0 }]}>
                <View style={styles.optionTextContainer}>
                  <Text style={[styles.optionText, { color: settings.textColor }]}>Event & Team Lookup</Text>
                  <Text style={[styles.optionSubtext, { color: settings.secondaryTextColor }]}>
                    Show scroll bar on event lookup and team browser
                  </Text>
                </View>
                <Switch
                  value={settings.scrollBarEventLookup && settings.scrollBarTeamBrowser}
                  onValueChange={(enabled) => {
                    settings.setScrollBarEventLookup(enabled);
                    settings.setScrollBarTeamBrowser(enabled);
                  }}
                  trackColor={{ false: settings.switchTrackColorOff, true: settings.buttonColor }}
                  thumbColor={(settings.scrollBarEventLookup && settings.scrollBarTeamBrowser) ? settings.switchThumbColorOn : settings.switchThumbColorOff}
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    marginTop: 24,
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 12,
    marginTop: 32,
    marginLeft: 20,
    letterSpacing: 0.5,
    opacity: 0.8,
  },
  subSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 12,
    marginLeft: 20,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 56,
  },
  lastOptionRow: {
    borderBottomWidth: 0,
  },
  lastInfoRow: {
    borderBottomWidth: 0,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepperButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  stepperValue: {
    fontSize: 16,
    fontWeight: '600',
    minWidth: 40,
    textAlign: 'center',
  },
  textInput: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 16,
    marginHorizontal: 20,
    fontWeight: '500',
  },
  clearButtonInInput: {
    position: 'absolute',
    right: 32,
    top: 12,
    padding: 4,
  },
  button: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
    marginHorizontal: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  dangerButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    // backgroundColor and shadowColor applied dynamically with settings.errorColor
    marginBottom: 12,
    marginHorizontal: 20,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  dangerButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  supportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
    marginHorizontal: 20,
  },
  supportTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  supportMessage: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
    marginHorizontal: 20,
  },
  donateButton: {
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    marginHorizontal: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  donateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 56,
  },
  infoLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '400',
    opacity: 0.8,
  },
  creditText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 12,
    marginHorizontal: 20,
    marginTop: 20,
    opacity: 0.8,
  },
  warningText: {
    fontWeight: '600',
  },
  infoContainer: {
    flex: 1,
  },
  themeDescription: {
    fontSize: 14,
    marginTop: 4,
    lineHeight: 20,
    opacity: 0.7,
  },
  optionTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  optionSubtext: {
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
    opacity: 0.7,
  },
  // Full-screen modal styles (matching NotesManagementModal)
  fullScreenModal: {
    flex: 1,
  },
  fullScreenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  fullScreenHeaderTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  fullScreenCloseButton: {
    padding: 4,
  },
  fullScreenModalContent: {
    flex: 1,
    paddingTop: 16,
    paddingHorizontal: 16,
  },
  modalCard: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  // Legacy modal styles (kept for compatibility)
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  swipeIndicator: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  swipeHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    opacity: 0.5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 32,
  },
  modalOptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
});

export default SettingsScreen;
