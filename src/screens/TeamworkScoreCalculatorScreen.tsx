/**
 * Teamwork Score Calculator Screen
 *
 * Description:
 * Score calculator for VEX Aerial Drone Competition teamwork challenges.
 * Features collaborative scoring between multiple drones with specific task
 * limits and drone interaction requirements for team-based competition scoring.
 *
 * Navigation:
 * Accessed from the Score Calculators home screen when Aerial Drone Competition
 * is selected as the active program.
 *
 * Key Features:
 * - Multi-drone teamwork challenge scoring
 * - Collaborative task tracking with specific limits per task
 * - Drone selection and interaction scoring
 * - Real-time calculation with teamwork bonuses
 * - Reset functionality with haptic feedback
 * - Warning indicators for maximum value validation
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Vibration,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../contexts/SettingsContext';

interface TeamworkScoreCalculatorScreenProps {
  navigation: any;
}

interface CounterSectionProps {
  title: string;
  count: number;
  maxCount: number;
  onIncrement: () => void;
  onDecrement: () => void;
  onLongPressIncrement?: () => void;
  onLongPressDecrement?: () => void;
  showWarning?: boolean;
  accentColor?: string;
}

interface DroneOptionButtonProps {
  label: string;
  isSelected: boolean;
  isDisabled: boolean;
  droneColor: string;
  onPress: () => void;
  settings: any;
}

interface DroneBoxProps {
  droneColor: string;
  selectedOption: string;
  otherDroneSelection: string;
  onSelectionChange: (option: string) => void;
}

const TeamworkScoreCalculatorScreen: React.FC<TeamworkScoreCalculatorScreenProps> = ({ navigation }) => {
  const settings = useSettings();

  // State variables for input fields
  const [dropZoneCleared, setDropZoneCleared] = useState(0);
  const [loadingStationCleared, setLoadingStationCleared] = useState(0);
  const [pillarCleared, setPillarCleared] = useState(0);
  const [ballsInnerZone, setBallsInnerZone] = useState(0);
  const [ballsOuterZone, setBallsOuterZone] = useState(0);
  const [flightPathComplete, setFlightPathComplete] = useState(0);
  const [redDroneSelection, setRedDroneSelection] = useState('None');
  const [blueDroneSelection, setBlueDroneSelection] = useState('None');

  useEffect(() => {
    navigation.setOptions({
      title: 'Teamwork Score Calculator',
      headerStyle: {
        backgroundColor: settings.topBarColor,
      },
      headerTintColor: settings.topBarContentColor,
      headerTitleStyle: {
        fontWeight: '500',
        fontSize: 19,
      },
      headerRight: () => (
        <TouchableOpacity
          onPress={clearInputs}
          style={styles.headerButton}
        >
          <Ionicons name="trash" size={24} color={settings.topBarContentColor} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, settings.topBarColor, settings.topBarContentColor]);

  // Helper function to calculate landing score based on selection
  const landingScore = (selection: string): number => {
    switch (selection) {
      case 'None':
        return 0;
      case 'Bullseye':
        return 15;
      case 'Cube':
        return 10;
      case 'Pad':
        return 5;
      default:
        return 0;
    }
  };

  // Computed total score based on the rules
  const totalScore = (): number => {
    const dropZoneScore = dropZoneCleared * 20;
    const loadingStationScore = loadingStationCleared * 20;
    const pillarScore = pillarCleared * 5;
    const innerZoneScore = ballsInnerZone * 1;
    const outerZoneScore = ballsOuterZone * 3;
    const flightPathScore = flightPathComplete * 10;
    const redLandingScore = landingScore(redDroneSelection);
    const blueLandingScore = landingScore(blueDroneSelection);

    return (
      dropZoneScore +
      loadingStationScore +
      pillarScore +
      innerZoneScore +
      outerZoneScore +
      flightPathScore +
      redLandingScore +
      blueLandingScore
    );
  };

  const triggerHaptics = () => {
    if (settings.enableHaptics) {
      Vibration.vibrate(15);
    }
  };

  // Function to reset all inputs
  const clearInputs = () => {
    setDropZoneCleared(0);
    setLoadingStationCleared(0);
    setPillarCleared(0);
    setBallsInnerZone(0);
    setBallsOuterZone(0);
    setFlightPathComplete(0);
    setRedDroneSelection('None');
    setBlueDroneSelection('None');
    triggerHaptics();
  };

  return (
    <View style={[styles.container, { backgroundColor: settings.backgroundColor }]}>
      {/* Fixed Score View */}
      <ScoreView totalScore={totalScore()} settings={settings} />

      {/* Content */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Counters Grid */}
        <View style={styles.countersGrid}>
          {/* Left Column */}
          <View style={[styles.column, { backgroundColor: settings.cardBackgroundColor, borderColor: settings.borderColor }]}>
            <Text style={[styles.columnTitle, { color: settings.textColor }]}>Field Elements</Text>

            <CounterSection
              title="Clear Drop Zone"
              count={dropZoneCleared}
              maxCount={2}
              onIncrement={() => {
                if (dropZoneCleared < 2) {
                  setDropZoneCleared(dropZoneCleared + 1);
                  triggerHaptics();
                }
              }}
              onDecrement={() => {
                if (dropZoneCleared > 0) {
                  setDropZoneCleared(dropZoneCleared - 1);
                  triggerHaptics();
                }
              }}
              onLongPressIncrement={() => {
                if (dropZoneCleared < 2) {
                  setDropZoneCleared(2);
                  triggerHaptics();
                }
              }}
              onLongPressDecrement={() => {
                if (dropZoneCleared > 0) {
                  setDropZoneCleared(0);
                  triggerHaptics();
                }
              }}
              accentColor="#FF8C00"
              settings={settings}
            />

            <CounterSection
              title="Clear Loading Station"
              count={loadingStationCleared}
              maxCount={2}
              onIncrement={() => {
                if (loadingStationCleared < 2) {
                  setLoadingStationCleared(loadingStationCleared + 1);
                  triggerHaptics();
                }
              }}
              onDecrement={() => {
                if (loadingStationCleared > 0) {
                  setLoadingStationCleared(loadingStationCleared - 1);
                  triggerHaptics();
                }
              }}
              onLongPressIncrement={() => {
                if (loadingStationCleared < 2) {
                  setLoadingStationCleared(2);
                  triggerHaptics();
                }
              }}
              onLongPressDecrement={() => {
                if (loadingStationCleared > 0) {
                  setLoadingStationCleared(0);
                  triggerHaptics();
                }
              }}
              accentColor="#9370DB"
              settings={settings}
            />

            <CounterSection
              title="Clear Pillar"
              count={pillarCleared}
              maxCount={5}
              onIncrement={() => {
                if (pillarCleared < 5) {
                  setPillarCleared(pillarCleared + 1);
                  triggerHaptics();
                }
              }}
              onDecrement={() => {
                if (pillarCleared > 0) {
                  setPillarCleared(pillarCleared - 1);
                  triggerHaptics();
                }
              }}
              onLongPressIncrement={() => {
                if (pillarCleared < 5) {
                  setPillarCleared(5);
                  triggerHaptics();
                }
              }}
              onLongPressDecrement={() => {
                if (pillarCleared > 0) {
                  setPillarCleared(0);
                  triggerHaptics();
                }
              }}
              accentColor="#FFD700"
              settings={settings}
            />
          </View>

          {/* Right Column */}
          <View style={[styles.column, { backgroundColor: settings.cardBackgroundColor, borderColor: settings.borderColor }]}>
            <Text style={[styles.columnTitle, { color: settings.textColor }]}>Balls & Flight</Text>

            <CounterSection
              title="Balls in Inner Zone"
              count={ballsInnerZone}
              maxCount={37}
              onIncrement={() => {
                const totalBalls = ballsInnerZone + ballsOuterZone;
                if (totalBalls < 37) {
                  setBallsInnerZone(ballsInnerZone + 1);
                  triggerHaptics();
                }
              }}
              onDecrement={() => {
                if (ballsInnerZone > 0) {
                  setBallsInnerZone(ballsInnerZone - 1);
                  triggerHaptics();
                }
              }}
              onLongPressIncrement={() => {
                const totalBalls = ballsInnerZone + ballsOuterZone;
                const remainingSpace = 37 - totalBalls;
                const incrementAmount = Math.min(5, remainingSpace);
                if (incrementAmount > 0) {
                  setBallsInnerZone(ballsInnerZone + incrementAmount);
                  triggerHaptics();
                }
              }}
              onLongPressDecrement={() => {
                const decrementAmount = Math.min(5, ballsInnerZone);
                if (decrementAmount > 0) {
                  setBallsInnerZone(ballsInnerZone - decrementAmount);
                  triggerHaptics();
                }
              }}
              accentColor="#32CD32"
              settings={settings}
            />

            <CounterSection
              title="Balls in Outer Zone"
              count={ballsOuterZone}
              maxCount={37}
              onIncrement={() => {
                const totalBalls = ballsInnerZone + ballsOuterZone;
                if (totalBalls < 37) {
                  setBallsOuterZone(ballsOuterZone + 1);
                  triggerHaptics();
                }
              }}
              onDecrement={() => {
                if (ballsOuterZone > 0) {
                  setBallsOuterZone(ballsOuterZone - 1);
                  triggerHaptics();
                }
              }}
              onLongPressIncrement={() => {
                const totalBalls = ballsInnerZone + ballsOuterZone;
                const remainingSpace = 37 - totalBalls;
                const incrementAmount = Math.min(5, remainingSpace);
                if (incrementAmount > 0) {
                  setBallsOuterZone(ballsOuterZone + incrementAmount);
                  triggerHaptics();
                }
              }}
              onLongPressDecrement={() => {
                const decrementAmount = Math.min(5, ballsOuterZone);
                if (decrementAmount > 0) {
                  setBallsOuterZone(ballsOuterZone - decrementAmount);
                  triggerHaptics();
                }
              }}
              accentColor="#1E90FF"
              settings={settings}
            />

            <CounterSection
              title="Complete Flight Path"
              count={flightPathComplete}
              maxCount={2}
              onIncrement={() => {
                if (flightPathComplete < 2) {
                  setFlightPathComplete(flightPathComplete + 1);
                  triggerHaptics();
                }
              }}
              onDecrement={() => {
                if (flightPathComplete > 0) {
                  setFlightPathComplete(flightPathComplete - 1);
                  triggerHaptics();
                }
              }}
              onLongPressIncrement={() => {
                if (flightPathComplete < 2) {
                  setFlightPathComplete(2);
                  triggerHaptics();
                }
              }}
              onLongPressDecrement={() => {
                if (flightPathComplete > 0) {
                  setFlightPathComplete(0);
                  triggerHaptics();
                }
              }}
              accentColor={settings.bonusColor}
              settings={settings}
            />
          </View>
        </View>

        {/* Drones Section */}
        <View style={styles.dronesSection}>
          <DroneBox
            droneColor="Red"
            selectedOption={redDroneSelection}
            otherDroneSelection={blueDroneSelection}
            onSelectionChange={(option) => {
              setRedDroneSelection(option);
              triggerHaptics();
            }}
            settings={settings}
          />
          <DroneBox
            droneColor="Blue"
            selectedOption={blueDroneSelection}
            otherDroneSelection={redDroneSelection}
            onSelectionChange={(option) => {
              setBlueDroneSelection(option);
              triggerHaptics();
            }}
            settings={settings}
          />
        </View>
      </ScrollView>
    </View>
  );
};

// Score View Component
const ScoreView: React.FC<{ totalScore: number; settings: any }> = ({ totalScore, settings }) => (
  <View style={styles.scoreView}>
    <View style={[styles.scoreContainer, { backgroundColor: settings.buttonColor }]}>
      <Text style={styles.scoreText}>Score: {totalScore}</Text>
    </View>
  </View>
);

// Counter Section Component
const CounterSection: React.FC<CounterSectionProps & { settings: any }> = ({
  title,
  count,
  maxCount,
  onIncrement,
  onDecrement,
  onLongPressIncrement,
  onLongPressDecrement,
  showWarning = false,
  accentColor = '#000',
  settings,
}) => (
  <View style={[styles.counterSection, { backgroundColor: settings.backgroundColor }]}>
    <Text style={[styles.counterTitle, { color: accentColor }]}>{title}</Text>
    <View style={styles.counterControls}>
      <TouchableOpacity
        onPress={onDecrement}
        onLongPress={onLongPressDecrement}
        disabled={count <= 0}
        delayLongPress={500}
      >
        <Ionicons name="remove-circle" size={28} color={count <= 0 ? settings.secondaryTextColor : settings.errorColor} />
      </TouchableOpacity>
      <Text style={[styles.counterValue, { color: settings.textColor }]}>{count}</Text>
      <TouchableOpacity
        onPress={onIncrement}
        onLongPress={onLongPressIncrement}
        disabled={count >= maxCount}
        delayLongPress={500}
      >
        <Ionicons name="add-circle" size={28} color={count >= maxCount ? settings.secondaryTextColor : settings.successColor} />
      </TouchableOpacity>
    </View>
    {showWarning && (
      <Ionicons name="warning" size={16} color={settings.errorColor} />
    )}
  </View>
);

// Drone Option Button Component
const DroneOptionButton: React.FC<DroneOptionButtonProps> = ({
  label,
  isSelected,
  isDisabled,
  droneColor,
  onPress,
  settings,
}) => (
  <TouchableOpacity
    style={[
      styles.droneOptionButton,
      { backgroundColor: settings.backgroundColor },
      isSelected && { backgroundColor: droneColor + '99' },
      isDisabled && styles.droneOptionDisabled,
    ]}
    onPress={onPress}
    disabled={isDisabled}
  >
    <Text
      style={[
        styles.droneOptionText,
        { color: isDisabled ? settings.secondaryTextColor : isSelected ? '#fff' : droneColor },
      ]}
    >
      {label}
    </Text>
  </TouchableOpacity>
);

// Drone Box Component
const DroneBox: React.FC<DroneBoxProps & { settings: any }> = ({
  droneColor,
  selectedOption,
  otherDroneSelection,
  onSelectionChange,
  settings,
}) => {
  const droneUIColor = droneColor === 'Red' ? settings.redAllianceColor : settings.blueAllianceColor;

  // Function to determine if an option should be disabled
  const isOptionDisabled = (option: string): boolean => {
    // 2026 rules allow both drones to land on the same position type
    return false;
  };

  const options = ['None', 'Bullseye', 'Cube', 'Pad'];

  return (
    <View style={[styles.droneBox, { backgroundColor: settings.cardBackgroundColor, borderColor: droneUIColor }]}>
      <Text style={[styles.droneTitle, { color: droneUIColor }]}>{droneColor} Drone Landing</Text>
      <View style={styles.droneOptionsGrid}>
        {options.map((option) => (
          <DroneOptionButton
            key={option}
            label={option}
            isSelected={selectedOption === option}
            isDisabled={isOptionDisabled(option)}
            droneColor={droneUIColor}
            onPress={() => onSelectionChange(option)}
            settings={settings}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerButton: {
    padding: 8,
    marginRight: 8,
  },
  scoreView: {
    padding: 16,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  scoreText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginHorizontal: 12,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 10,
  },
  countersGrid: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  column: {
    flex: 1,
    borderRadius: 15,
    padding: 16,
    marginHorizontal: 4,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    borderWidth: 1,
  },
  columnTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  counterSection: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  counterTitle: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  counterControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  counterValue: {
    fontSize: 20,
    fontWeight: 'bold',
    minWidth: 30,
    textAlign: 'center',
  },
  dronesSection: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    maxHeight: 200,
  },
  droneBox: {
    flex: 1,
    borderRadius: 15,
    padding: 12,
    marginHorizontal: 4,
    borderWidth: 2,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
  },
  droneTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  droneOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  droneOptionButton: {
    width: '48%',
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
    alignItems: 'center',
  },
  droneOptionDisabled: {
    opacity: 0.5,
  },
  droneOptionText: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default TeamworkScoreCalculatorScreen;
