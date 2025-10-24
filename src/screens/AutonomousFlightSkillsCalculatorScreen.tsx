/**
 * Autonomous Flight Skills Calculator Screen
 *
 * Description:
 * Score calculator for VEX Aerial Drone Competition autonomous flight skills challenges.
 * Features task-specific scoring with maximum limits per task and real-time total calculation
 * based on official autonomous flight competition rules and point values.
 *
 * Navigation:
 * Accessed from the Score Calculators home screen when Aerial Drone Competition
 * is selected as the active program.
 *
 * Key Features:
 * - Autonomous flight task scoring with limited attempts (max 2 per task)
 * - Color identification and navigation challenges
 * - Arch gate and keyhole flight maneuvers with specific limits
 * - Landing option selection with varied point values
 * - Real-time score calculation and modern card-based UI
 * - Reset functionality with haptic feedback support
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Vibration,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../contexts/SettingsContext';

interface AutonomousFlightSkillsCalculatorScreenProps {
  navigation: any;
}

interface CounterSectionProps {
  title: string;
  count: number;
  maxCount: number;
  onIncrement: () => void;
  onDecrement: () => void;
  accentColor?: string;
  settings: any;
  scaleFactor: number;
}

interface LandingOptionButtonProps {
  label: string;
  points: number;
  isSelected: boolean;
  onPress: () => void;
  buttonColor: string;
  scaleFactor: number;
}

const AutonomousFlightSkillsCalculatorScreen: React.FC<AutonomousFlightSkillsCalculatorScreenProps> = ({ navigation }) => {
  const settings = useSettings();
  const { height } = useWindowDimensions();

  // Calculate dynamic scale factor based on screen height
  // Base height is 844 (iPhone 14 Pro), scale down for smaller screens
  const scaleFactor = Math.min(height / 844, 1);

  // State variables for tasks
  const [didTakeOff, setDidTakeOff] = useState(false);
  const [blueArchGateCount, setBlueArchGateCount] = useState(0); // Max 2
  const [redArchGateCount, setRedArchGateCount] = useState(0); // Max 2
  const [greenKeyholeCount, setGreenKeyholeCount] = useState(0); // Max 2
  const [yellowKeyholeCount, setYellowKeyholeCount] = useState(0); // Max 2
  const [tunnelCount, setTunnelCount] = useState(0); // Max 2
  const [colorMat1Count, setColorMat1Count] = useState(0); // Max 1
  const [colorMat2Count, setColorMat2Count] = useState(0); // Max 1
  const [panelCount, setPanelCount] = useState(0); // Max 2
  const [smallHoleBonusCount, setSmallHoleBonusCount] = useState(0); // Max 2

  // Landing option
  const [selectedLanding, setSelectedLanding] = useState<string>('None');

  useEffect(() => {
    navigation.setOptions({
      title: 'Autonomous Flight Calculator',
      headerStyle: {
        backgroundColor: settings.topBarColor,
      },
      headerTintColor: settings.topBarContentColor,
      headerTitleAlign: 'center',
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

  // Total score computed property
  const totalScore = (): number => {
    let score = 0;

    // Take Off: 5 Points, Once
    if (didTakeOff) {
      score += 5;
    }

    score += blueArchGateCount * 5;
    score += redArchGateCount * 5;
    score += greenKeyholeCount * 15;
    score += yellowKeyholeCount * 15;
    score += tunnelCount * 25;
    score += colorMat1Count * 15;
    score += colorMat2Count * 15;
    score += panelCount * 40;
    score += smallHoleBonusCount * 10;

    switch (selectedLanding) {
      case 'Pad':
        score += 5;
        break;
      case 'Cube':
        score += 10;
        break;
      case 'Bullseye':
        score += 15;
        break;
    }

    return score;
  };

  const triggerHapticsIfEnabled = () => {
    if (settings.enableHaptics) {
      Vibration.vibrate(15);
    }
  };

  // Function to reset all inputs
  const clearInputs = () => {
    setDidTakeOff(false);
    setBlueArchGateCount(0);
    setRedArchGateCount(0);
    setGreenKeyholeCount(0);
    setYellowKeyholeCount(0);
    setTunnelCount(0);
    setColorMat1Count(0);
    setColorMat2Count(0);
    setPanelCount(0);
    setSmallHoleBonusCount(0);
    setSelectedLanding('None');
    triggerHapticsIfEnabled();
  };

  const dynamicStyles = getDynamicStyles(scaleFactor);

  return (
    <View style={[dynamicStyles.container, { backgroundColor: settings.backgroundColor }]}>
      {/* Fixed Score View */}
      <ScoreView totalScore={totalScore()} settings={settings} scaleFactor={scaleFactor} />

      {/* Content */}
      <ScrollView style={dynamicStyles.scrollView} contentContainerStyle={dynamicStyles.scrollContent}>
        {/* Take Off Section */}
        <View style={[dynamicStyles.section, { backgroundColor: settings.cardBackgroundColor, borderColor: settings.borderColor }]}>
          <View style={dynamicStyles.takeOffRow}>
            <View>
              <Text style={[dynamicStyles.takeOffLabel, { color: settings.textColor }]}>Take Off</Text>
              <Text style={[dynamicStyles.takeOffPoints, { color: settings.secondaryTextColor }]}>5 points (once per match)</Text>
            </View>
            <Switch
              value={didTakeOff}
              onValueChange={(value) => {
                setDidTakeOff(value);
                triggerHapticsIfEnabled();
              }}
              trackColor={{ false: '#767577', true: settings.buttonColor }}
              thumbColor={didTakeOff ? '#f5dd4b' : '#f4f3f4'}
            />
          </View>
        </View>

        {/* Color Identification Section */}
        <View style={[dynamicStyles.section, { backgroundColor: settings.cardBackgroundColor, borderColor: settings.borderColor }]}>
          <View style={dynamicStyles.taskGrid}>

            <CounterSection
              title="Identify Color Mat #1"
              count={colorMat1Count}
              maxCount={1}
              onIncrement={() => {
                if (colorMat1Count < 1) {
                  setColorMat1Count(colorMat1Count + 1);
                  triggerHapticsIfEnabled();
                }
              }}
              onDecrement={() => {
                if (colorMat1Count > 0) {
                  setColorMat1Count(colorMat1Count - 1);
                  triggerHapticsIfEnabled();
                }
              }}
              accentColor="#FF8C00"
              settings={settings}
              scaleFactor={scaleFactor}
            />

            <CounterSection
              title="Identify Color Mat #2"
              count={colorMat2Count}
              maxCount={1}
              onIncrement={() => {
                if (colorMat2Count < 1) {
                  setColorMat2Count(colorMat2Count + 1);
                  triggerHapticsIfEnabled();
                }
              }}
              onDecrement={() => {
                if (colorMat2Count > 0) {
                  setColorMat2Count(colorMat2Count - 1);
                  triggerHapticsIfEnabled();
                }
              }}
              accentColor="#00BCD4"
              settings={settings}
              scaleFactor={scaleFactor}
            />
          </View>
        </View>

        {/* Gates & Obstacles Section */}
        <View style={[dynamicStyles.section, { backgroundColor: settings.cardBackgroundColor, borderColor: settings.borderColor }]}>
          <View style={dynamicStyles.taskGrid}>
            <CounterSection
              title="Blue Arch Gate"
              count={blueArchGateCount}
              maxCount={2}
              onIncrement={() => {
                if (blueArchGateCount < 2) {
                  setBlueArchGateCount(blueArchGateCount + 1);
                  triggerHapticsIfEnabled();
                }
              }}
              onDecrement={() => {
                if (blueArchGateCount > 0) {
                  setBlueArchGateCount(blueArchGateCount - 1);
                  triggerHapticsIfEnabled();
                }
              }}
              accentColor="#1E90FF"
              settings={settings}
              scaleFactor={scaleFactor}
            />

            <CounterSection
              title="Red Arch Gate"
              count={redArchGateCount}
              maxCount={2}
              onIncrement={() => {
                if (redArchGateCount < 2) {
                  setRedArchGateCount(redArchGateCount + 1);
                  triggerHapticsIfEnabled();
                }
              }}
              onDecrement={() => {
                if (redArchGateCount > 0) {
                  setRedArchGateCount(redArchGateCount - 1);
                  triggerHapticsIfEnabled();
                }
              }}
              accentColor="#FF4444"
              settings={settings}
              scaleFactor={scaleFactor}
            />

            <CounterSection
              title="Green Keyhole"
              count={greenKeyholeCount}
              maxCount={2}
              onIncrement={() => {
                if (greenKeyholeCount < 2) {
                  setGreenKeyholeCount(greenKeyholeCount + 1);
                  triggerHapticsIfEnabled();
                }
              }}
              onDecrement={() => {
                if (greenKeyholeCount > 0) {
                  setGreenKeyholeCount(greenKeyholeCount - 1);
                  triggerHapticsIfEnabled();
                }
              }}
              accentColor="#00C853"
              settings={settings}
              scaleFactor={scaleFactor}
            />

            <CounterSection
              title="Yellow Keyhole"
              count={yellowKeyholeCount}
              maxCount={2}
              onIncrement={() => {
                if (yellowKeyholeCount < 2) {
                  setYellowKeyholeCount(yellowKeyholeCount + 1);
                  triggerHapticsIfEnabled();
                }
              }}
              onDecrement={() => {
                if (yellowKeyholeCount > 0) {
                  setYellowKeyholeCount(yellowKeyholeCount - 1);
                  triggerHapticsIfEnabled();
                }
              }}
              accentColor="#FFD700"
              settings={settings}
              scaleFactor={scaleFactor}
            />

            <CounterSection
              title="Tunnel"
              count={tunnelCount}
              maxCount={2}
              onIncrement={() => {
                if (tunnelCount < 2) {
                  setTunnelCount(tunnelCount + 1);
                  triggerHapticsIfEnabled();
                }
              }}
              onDecrement={() => {
                if (tunnelCount > 0) {
                  setTunnelCount(tunnelCount - 1);
                  triggerHapticsIfEnabled();
                }
              }}
              accentColor="#9370DB"
              settings={settings}
              scaleFactor={scaleFactor}
            />
          </View>
        </View>

        {/* Advanced Maneuvers Section */}
        <View style={[dynamicStyles.section, { backgroundColor: settings.cardBackgroundColor, borderColor: settings.borderColor }]}>
          <View style={dynamicStyles.taskGrid}>
            <CounterSection
              title="Fly Through Panel"
              count={panelCount}
              maxCount={2}
              onIncrement={() => {
                if (panelCount < 2) {
                  setPanelCount(panelCount + 1);
                  triggerHapticsIfEnabled();
                }
              }}
              onDecrement={() => {
                if (panelCount > 0) {
                  setPanelCount(panelCount - 1);
                  triggerHapticsIfEnabled();
                }
              }}
              accentColor="#E91E63"
              settings={settings}
              scaleFactor={scaleFactor}
            />

            <CounterSection
              title="Small Hole Bonus"
              count={smallHoleBonusCount}
              maxCount={2}
              onIncrement={() => {
                if (smallHoleBonusCount < 2) {
                  setSmallHoleBonusCount(smallHoleBonusCount + 1);
                  triggerHapticsIfEnabled();
                }
              }}
              onDecrement={() => {
                if (smallHoleBonusCount > 0) {
                  setSmallHoleBonusCount(smallHoleBonusCount - 1);
                  triggerHapticsIfEnabled();
                }
              }}
              accentColor="#FF6347"
              settings={settings}
              scaleFactor={scaleFactor}
            />
          </View>
        </View>

        {/* Landing Options Section */}
        <View style={[dynamicStyles.section, { backgroundColor: settings.cardBackgroundColor, borderColor: settings.borderColor }]}>
          <View style={dynamicStyles.landingGrid}>
            <LandingOptionButton
              label="None"
              points={0}
              isSelected={selectedLanding === 'None'}
              onPress={() => {
                setSelectedLanding('None');
                triggerHapticsIfEnabled();
              }}
              buttonColor={settings.buttonColor}
              settings={settings}
              scaleFactor={scaleFactor}
            />
            <LandingOptionButton
              label="Pad"
              points={5}
              isSelected={selectedLanding === 'Pad'}
              onPress={() => {
                setSelectedLanding('Pad');
                triggerHapticsIfEnabled();
              }}
              buttonColor={settings.buttonColor}
              settings={settings}
              scaleFactor={scaleFactor}
            />
            <LandingOptionButton
              label="Cube"
              points={10}
              isSelected={selectedLanding === 'Cube'}
              onPress={() => {
                setSelectedLanding('Cube');
                triggerHapticsIfEnabled();
              }}
              buttonColor={settings.buttonColor}
              settings={settings}
              scaleFactor={scaleFactor}
            />
            <LandingOptionButton
              label="Bullseye"
              points={15}
              isSelected={selectedLanding === 'Bullseye'}
              onPress={() => {
                setSelectedLanding('Bullseye');
                triggerHapticsIfEnabled();
              }}
              buttonColor={settings.buttonColor}
              settings={settings}
              scaleFactor={scaleFactor}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

// Score View Component
const ScoreView: React.FC<{ totalScore: number; settings: any; scaleFactor: number }> = ({ totalScore, settings, scaleFactor }) => {
  const dynamicStyles = getDynamicStyles(scaleFactor);
  return (
    <View style={dynamicStyles.scoreView}>
      <View style={[dynamicStyles.scoreContainer, { backgroundColor: settings.buttonColor }]}>
        <Text style={dynamicStyles.scoreText}>Score: {totalScore}</Text>
      </View>
    </View>
  );
};

// Counter Section Component
const CounterSection: React.FC<CounterSectionProps> = ({
  title,
  count,
  maxCount,
  onIncrement,
  onDecrement,
  accentColor = '#000',
  settings,
  scaleFactor,
}) => {
  const dynamicStyles = getDynamicStyles(scaleFactor);
  const iconSize = Math.round(24 * scaleFactor);

  return (
    <View style={[dynamicStyles.counterSection, { backgroundColor: settings.backgroundColor }]}>
      <Text style={[dynamicStyles.counterTitle, { color: accentColor }]}>{title}</Text>
      <View style={dynamicStyles.counterControls}>
        <TouchableOpacity onPress={onDecrement} disabled={count <= 0}>
          <Ionicons name="remove-circle" size={iconSize} color={count <= 0 ? settings.secondaryTextColor : '#FF4444'} />
        </TouchableOpacity>
        <Text style={[dynamicStyles.counterValue, { color: settings.textColor }]}>{count}</Text>
        <TouchableOpacity onPress={onIncrement} disabled={count >= maxCount}>
          <Ionicons name="add-circle" size={iconSize} color={count >= maxCount ? settings.secondaryTextColor : '#44BB44'} />
        </TouchableOpacity>
      </View>
      <Text style={[dynamicStyles.maxText, { color: settings.secondaryTextColor }]}>max {maxCount}</Text>
    </View>
  );
};

// Landing Option Button Component
const LandingOptionButton: React.FC<LandingOptionButtonProps & { settings: any }> = ({
  label,
  points,
  isSelected,
  onPress,
  buttonColor,
  settings,
  scaleFactor,
}) => {
  const dynamicStyles = getDynamicStyles(scaleFactor);

  return (
    <TouchableOpacity
      style={[
        dynamicStyles.landingButton,
        { backgroundColor: isSelected ? buttonColor : settings.cardBackgroundColor },
        { borderColor: isSelected ? buttonColor : settings.borderColor },
        { borderWidth: 2 },
      ]}
      onPress={onPress}
    >
      <Text style={[dynamicStyles.landingButtonText, { color: isSelected ? '#fff' : settings.textColor }]}>
        {label}
      </Text>
      {points > 0 && (
        <Text style={[dynamicStyles.landingButtonPoints, { color: isSelected ? '#fff' : settings.secondaryTextColor }]}>
          {points} pts
        </Text>
      )}
    </TouchableOpacity>
  );
};

// Dynamic styles based on screen size
const getDynamicStyles = (scaleFactor: number) => {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    headerButton: {
      padding: 8,
      marginRight: 8,
    },
    scoreView: {
      padding: Math.round(10 * scaleFactor),
    },
    scoreContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: Math.round(12 * scaleFactor),
      padding: Math.round(12 * scaleFactor),
      elevation: 5,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
    },
    scoreText: {
      fontSize: Math.round(22 * scaleFactor),
      fontWeight: 'bold',
      color: '#fff',
      marginHorizontal: Math.round(8 * scaleFactor),
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingVertical: Math.round(6 * scaleFactor),
      paddingHorizontal: Math.round(10 * scaleFactor),
      paddingBottom: Math.round(12 * scaleFactor),
    },
    section: {
      borderRadius: Math.round(12 * scaleFactor),
      padding: Math.round(10 * scaleFactor),
      marginBottom: Math.round(10 * scaleFactor),
      elevation: 3,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 3.84,
      borderWidth: 1,
    },
    takeOffRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    takeOffLabel: {
      fontSize: Math.round(15 * scaleFactor),
      fontWeight: '600',
      marginBottom: Math.round(2 * scaleFactor),
    },
    takeOffPoints: {
      fontSize: Math.round(10 * scaleFactor),
      fontStyle: 'italic',
    },
    taskGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    },
    counterSection: {
      width: '48%',
      borderRadius: Math.round(10 * scaleFactor),
      padding: Math.round(8 * scaleFactor),
      marginBottom: Math.round(8 * scaleFactor),
      alignItems: 'center',
    },
    counterTitle: {
      fontSize: Math.round(11 * scaleFactor),
      fontWeight: '600',
      textAlign: 'center',
      marginBottom: Math.round(4 * scaleFactor),
    },
    counterControls: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
      marginBottom: Math.round(2 * scaleFactor),
    },
    counterValue: {
      fontSize: Math.round(18 * scaleFactor),
      fontWeight: 'bold',
      minWidth: Math.round(28 * scaleFactor),
      textAlign: 'center',
    },
    maxText: {
      fontSize: Math.round(9 * scaleFactor),
      fontStyle: 'italic',
    },
    landingGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    },
    landingButton: {
      width: '48%',
      borderRadius: Math.round(10 * scaleFactor),
      padding: Math.round(10 * scaleFactor),
      marginBottom: Math.round(6 * scaleFactor),
      alignItems: 'center',
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
    },
    landingButtonText: {
      fontSize: Math.round(13 * scaleFactor),
      fontWeight: 'bold',
      marginBottom: Math.round(2 * scaleFactor),
    },
    landingButtonPoints: {
      fontSize: Math.round(11 * scaleFactor),
    },
  });
};

// Static styles that don't need dynamic sizing
const styles = StyleSheet.create({
  headerButton: {
    padding: 8,
    marginRight: 8,
  },
});

export default AutonomousFlightSkillsCalculatorScreen;
