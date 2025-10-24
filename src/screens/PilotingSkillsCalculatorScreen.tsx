/**
 * Piloting Skills Calculator Screen
 *
 * Description:
 * Score calculator for VEX Aerial Drone Competition piloting skills challenges.
 * Allows users to input completed tasks and automatically calculates total scores
 * based on official competition scoring rules and point values.
 *
 * Navigation:
 * Accessed from the Score Calculators home screen when Aerial Drone Competition
 * is selected as the active program.
 *
 * Key Features:
 * - Interactive scoring for take-off, phase completions, and bonuses
 * - Unlimited task tracking for phase completions
 * - Landing option selection with different point values
 * - Real-time score calculation with modern card-based UI
 * - Reset functionality with haptic feedback
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../contexts/SettingsContext';

interface PilotingSkillsCalculatorScreenProps {
  navigation: any;
}

interface CounterSectionProps {
  title: string;
  count: number;
  onIncrement: () => void;
  onDecrement: () => void;
  accentColor?: string;
  settings: any;
}

interface LandingOptionButtonProps {
  label: string;
  points: number;
  isSelected: boolean;
  onPress: () => void;
  buttonColor: string;
}

const PilotingSkillsCalculatorScreen: React.FC<PilotingSkillsCalculatorScreenProps> = ({ navigation }) => {
  const settings = useSettings();

  // State variables for tasks
  const [didTakeOff, setDidTakeOff] = useState(false);
  const [phase1Count, setPhase1Count] = useState(0);
  const [phase2Count, setPhase2Count] = useState(0);
  const [phase3Count, setPhase3Count] = useState(0);
  const [smallHoleBonusCount, setSmallHoleBonusCount] = useState(0);

  // Landing option
  const [selectedLanding, setSelectedLanding] = useState<string>('None');

  useEffect(() => {
    navigation.setOptions({
      title: 'Piloting Skills Calculator',
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

    // Phase 1: 5 Points per completion (unlimited)
    score += phase1Count * 5;

    // Phase 2: 10 Points per completion (unlimited)
    score += phase2Count * 10;

    // Phase 3: 15 Points per completion (unlimited)
    score += phase3Count * 15;

    // Small Hole Bonus: 10 Points per completion (unlimited)
    score += smallHoleBonusCount * 10;

    // Landing Options
    switch (selectedLanding) {
      case 'Pad':
        score += 10;
        break;
      case 'Bullseye':
        score += 20;
        break;
      case 'Cube':
        score += 25;
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
    setPhase1Count(0);
    setPhase2Count(0);
    setPhase3Count(0);
    setSmallHoleBonusCount(0);
    setSelectedLanding('None');
    triggerHapticsIfEnabled();
  };

  return (
    <View style={[styles.container, { backgroundColor: settings.backgroundColor }]}>
      {/* Fixed Score View */}
      <ScoreView totalScore={totalScore()} settings={settings} />

      {/* Content */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Take Off Section */}
        <View style={[styles.section, { backgroundColor: settings.cardBackgroundColor, borderColor: settings.borderColor }]}>
          <View style={styles.takeOffRow}>
            <View>
              <Text style={[styles.takeOffLabel, { color: settings.textColor }]}>Take Off</Text>
              <Text style={[styles.takeOffPoints, { color: settings.secondaryTextColor }]}>5 points (once per match)</Text>
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

        {/* Phases Section */}
        <View style={[styles.section, { backgroundColor: settings.cardBackgroundColor, borderColor: settings.borderColor }]}>
          <View style={styles.phaseGrid}>
            <CounterSection
              title="Phase 1"
              count={phase1Count}
              onIncrement={() => {
                if (phase1Count < 999) {
                  setPhase1Count(phase1Count + 1);
                  triggerHapticsIfEnabled();
                }
              }}
              onDecrement={() => {
                if (phase1Count > 0) {
                  setPhase1Count(phase1Count - 1);
                  triggerHapticsIfEnabled();
                }
              }}
              accentColor="#32CD32"
              settings={settings}
            />

            <CounterSection
              title="Phase 2"
              count={phase2Count}
              onIncrement={() => {
                if (phase2Count < 999) {
                  setPhase2Count(phase2Count + 1);
                  triggerHapticsIfEnabled();
                }
              }}
              onDecrement={() => {
                if (phase2Count > 0) {
                  setPhase2Count(phase2Count - 1);
                  triggerHapticsIfEnabled();
                }
              }}
              accentColor="#1E90FF"
              settings={settings}
            />

            <CounterSection
              title="Phase 3"
              count={phase3Count}
              onIncrement={() => {
                if (phase3Count < 999) {
                  setPhase3Count(phase3Count + 1);
                  triggerHapticsIfEnabled();
                }
              }}
              onDecrement={() => {
                if (phase3Count > 0) {
                  setPhase3Count(phase3Count - 1);
                  triggerHapticsIfEnabled();
                }
              }}
              accentColor="#9370DB"
              settings={settings}
            />

            <CounterSection
              title="Small Hole Bonus"
              count={smallHoleBonusCount}
              onIncrement={() => {
                if (smallHoleBonusCount < 999) {
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
            />
          </View>
        </View>

        {/* Landing Options Section */}
        <View style={[styles.section, { backgroundColor: settings.cardBackgroundColor, borderColor: settings.borderColor }]}>
          <View style={styles.landingGrid}>
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
            />
            <LandingOptionButton
              label="Pad"
              points={10}
              isSelected={selectedLanding === 'Pad'}
              onPress={() => {
                setSelectedLanding('Pad');
                triggerHapticsIfEnabled();
              }}
              buttonColor={settings.buttonColor}
              settings={settings}
            />
            <LandingOptionButton
              label="Bullseye"
              points={20}
              isSelected={selectedLanding === 'Bullseye'}
              onPress={() => {
                setSelectedLanding('Bullseye');
                triggerHapticsIfEnabled();
              }}
              buttonColor={settings.buttonColor}
              settings={settings}
            />
            <LandingOptionButton
              label="Cube"
              points={25}
              isSelected={selectedLanding === 'Cube'}
              onPress={() => {
                setSelectedLanding('Cube');
                triggerHapticsIfEnabled();
              }}
              buttonColor={settings.buttonColor}
              settings={settings}
            />
          </View>
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
const CounterSection: React.FC<CounterSectionProps> = ({
  title,
  count,
  onIncrement,
  onDecrement,
  accentColor = '#000',
  settings,
}) => (
  <View style={[styles.counterSection, { backgroundColor: settings.backgroundColor }]}>
    <Text style={[styles.counterTitle, { color: accentColor }]}>{title}</Text>
    <View style={styles.counterControls}>
      <TouchableOpacity onPress={onDecrement} disabled={count <= 0}>
        <Ionicons name="remove-circle" size={32} color={count <= 0 ? settings.secondaryTextColor : '#FF4444'} />
      </TouchableOpacity>
      <Text style={[styles.counterValue, { color: settings.textColor }]}>{count}</Text>
      <TouchableOpacity onPress={onIncrement} disabled={count >= 999}>
        <Ionicons name="add-circle" size={32} color={count >= 999 ? settings.secondaryTextColor : '#44BB44'} />
      </TouchableOpacity>
    </View>
    <Text style={[styles.unlimitedText, { color: settings.secondaryTextColor }]}>unlimited</Text>
  </View>
);

// Landing Option Button Component
const LandingOptionButton: React.FC<LandingOptionButtonProps & { settings: any }> = ({
  label,
  points,
  isSelected,
  onPress,
  buttonColor,
  settings,
}) => (
  <TouchableOpacity
    style={[
      styles.landingButton,
      { backgroundColor: isSelected ? buttonColor : settings.cardBackgroundColor },
      { borderColor: isSelected ? buttonColor : settings.borderColor },
      { borderWidth: 2 },
    ]}
    onPress={onPress}
  >
    <Text style={[styles.landingButtonText, { color: isSelected ? '#fff' : settings.textColor }]}>
      {label}
    </Text>
    {points > 0 && (
      <Text style={[styles.landingButtonPoints, { color: isSelected ? '#fff' : settings.secondaryTextColor }]}>
        {points} pts
      </Text>
    )}
  </TouchableOpacity>
);

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
    paddingHorizontal: 12,
    paddingBottom: 24,
  },
  section: {
    borderRadius: 15,
    padding: 16,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  takeOffRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  takeOffLabel: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  takeOffPoints: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  phaseGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  counterSection: {
    width: '48%',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  counterTitle: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  counterControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 4,
  },
  counterValue: {
    fontSize: 24,
    fontWeight: 'bold',
    minWidth: 40,
    textAlign: 'center',
  },
  unlimitedText: {
    fontSize: 10,
    fontStyle: 'italic',
  },
  landingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  landingButton: {
    width: '48%',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  landingButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  landingButtonPoints: {
    fontSize: 12,
  },
});

export default PilotingSkillsCalculatorScreen;
