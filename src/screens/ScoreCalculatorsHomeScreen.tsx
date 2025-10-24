/**
 * Score Calculators Home Screen
 *
 * Description:
 * Central hub for accessing all VEX robotics competition score calculators.
 * Provides navigation to program-specific calculators based on the selected
 * competition type (V5, IQ, U, AI, Aerial Drone) with appropriate options.
 *
 * Navigation:
 * Accessed from the main navigation or tools section when users want to
 * access scoring calculators for their selected VEX competition program.
 *
 * Key Features:
 * - Program-specific calculator listings based on selected competition
 * - Quick access to all available score calculators
 * - Calculator type organization (match, skills, autonomous, etc.)
 * - Visual calculator cards with descriptive information
 * - Theme-aware interface with proper navigation integration
 * - Support for different competition formats and rule sets
 */
import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../contexts/SettingsContext';
import {
  getCalculatorScreens,
  shouldShowScoreCalculators
} from '../utils/programMappings';

interface ScoreCalculatorsHomeScreenProps {
  navigation: any;
}

const ScoreCalculatorsHomeScreen: React.FC<ScoreCalculatorsHomeScreenProps> = ({ navigation }) => {
  const settings = useSettings();
  const {
    buttonColor,
    backgroundColor,
    textColor,
    cardBackgroundColor,
    secondaryTextColor,
    borderColor,
    selectedProgram,
    topBarColor,
    topBarContentColor,
    isDeveloperMode,
  } = settings;

  // Get available calculator screens for the selected program
  const availableCalculators = getCalculatorScreens(selectedProgram);
  const showCalculators = shouldShowScoreCalculators(
    selectedProgram,
    settings.isDeveloperMode,
    settings.scoringCalculatorsEnabled
  );

  useEffect(() => {
    navigation.setOptions({
      title: 'Score Calculators',
      headerStyle: {
        backgroundColor: topBarColor,
      },
      headerTintColor: topBarContentColor,
      headerTitleAlign: 'center',
      headerTitleStyle: {
        fontWeight: '500',
        fontSize: 19,
      },
    });
  }, [navigation, topBarColor, topBarContentColor]);

  const navigateToCalculator = (screenName: string) => {
    navigation.navigate(screenName);
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: backgroundColor,
    },
    content: {
      flex: 1,
      padding: 16,
    },
    calculatorCard: {
      backgroundColor: cardBackgroundColor,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: borderColor,
      marginBottom: 16,
      shadowColor: settings.colorScheme === 'dark' ? '#FFFFFF' : '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    calculatorButton: {
      padding: 20,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    calculatorLeft: {
      flex: 1,
      marginRight: 12,
    },
    calculatorTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: textColor,
      marginBottom: 4,
    },
    calculatorDescription: {
      fontSize: 14,
      color: secondaryTextColor,
      lineHeight: 20,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 40,
    },
    emptyIcon: {
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: textColor,
      marginBottom: 8,
      textAlign: 'center',
    },
    emptyText: {
      fontSize: 16,
      color: secondaryTextColor,
      textAlign: 'center',
      lineHeight: 24,
    },
  });

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Show calculators if available and permitted for the selected program */}
        {showCalculators && availableCalculators.length > 0 ? (
          availableCalculators.map((calculator, index) => (
            <TouchableOpacity
              key={index}
              style={styles.calculatorCard}
              onPress={() => navigateToCalculator(calculator.screenName)}
              activeOpacity={0.7}
            >
              <View style={styles.calculatorButton}>
                <View style={styles.calculatorLeft}>
                  <Text style={styles.calculatorTitle}>{calculator.displayName}</Text>
                  {calculator.description && (
                    <Text style={styles.calculatorDescription}>{calculator.description}</Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={24} color={buttonColor} />
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons
              name="calculator-outline"
              size={80}
              color={secondaryTextColor}
              style={styles.emptyIcon}
            />
            <Text style={styles.emptyTitle}>No Calculators Available</Text>
            <Text style={styles.emptyText}>
              Score calculators are not yet available for {selectedProgram}. Check back later for updates!
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

export default ScoreCalculatorsHomeScreen;