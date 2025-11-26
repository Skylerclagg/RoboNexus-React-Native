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

  // Phase 1 checkboxes
  const [phase1RedArch, setPhase1RedArch] = useState(false);
  const [phase1GreenKeyhole, setPhase1GreenKeyhole] = useState(false);

  // Phase 2 checkboxes
  const [phase2FlyThrough, setPhase2FlyThrough] = useState(false);
  const [phase2SmallHoleIn, setPhase2SmallHoleIn] = useState(false);
  const [phase2SmallHoleOut, setPhase2SmallHoleOut] = useState(false);

  // Phase 3 checkboxes
  const [phase3Tunnel, setPhase3Tunnel] = useState(false);
  const [phase3YellowKeyhole, setPhase3YellowKeyhole] = useState(false);
  const [phase3BlueArch, setPhase3BlueArch] = useState(false);

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

  // Auto-increment Phase 1 when all tasks are complete
  useEffect(() => {
    if (phase1RedArch && phase1GreenKeyhole) {
      setPhase1Count(prev => prev + 1);
      setPhase1RedArch(false);
      setPhase1GreenKeyhole(false);
      triggerHapticsIfEnabled();
    }
  }, [phase1RedArch, phase1GreenKeyhole]);

  // Auto-increment Phase 2 when main task is complete
  useEffect(() => {
    if (phase2FlyThrough) {
      setPhase2Count(prev => prev + 1);
      setPhase2FlyThrough(false);
      triggerHapticsIfEnabled();
    }
  }, [phase2FlyThrough]);

  // Auto-increment Small Hole Bonus when both tasks are complete
  useEffect(() => {
    if (phase2SmallHoleIn && phase2SmallHoleOut) {
      setSmallHoleBonusCount(prev => prev + 1);
      setPhase2SmallHoleIn(false);
      setPhase2SmallHoleOut(false);
      triggerHapticsIfEnabled();
    }
  }, [phase2SmallHoleIn, phase2SmallHoleOut]);

  // Auto-increment Phase 3 when all tasks are complete
  useEffect(() => {
    if (phase3Tunnel && phase3YellowKeyhole && phase3BlueArch) {
      setPhase3Count(prev => prev + 1);
      setPhase3Tunnel(false);
      setPhase3YellowKeyhole(false);
      setPhase3BlueArch(false);
      triggerHapticsIfEnabled();
    }
  }, [phase3Tunnel, phase3YellowKeyhole, phase3BlueArch]);

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
    setPhase1RedArch(false);
    setPhase1GreenKeyhole(false);
    setPhase2FlyThrough(false);
    setPhase2SmallHoleIn(false);
    setPhase2SmallHoleOut(false);
    setPhase3Tunnel(false);
    setPhase3YellowKeyhole(false);
    setPhase3BlueArch(false);
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
              trackColor={{ false: settings.secondaryTextColor, true: settings.buttonColor }}
              thumbColor={didTakeOff ? '#f5dd4b' : settings.cardBackgroundColor}
            />
          </View>
        </View>

        {/* Two Column Layout */}
        <View style={styles.twoColumnContainer}>
          {/* Left Column: Phase 1 and Phase 3 */}
          <View style={[styles.column, styles.leftColumn]}>
            {/* Phase 1 Section */}
            <View style={[styles.phaseCard, { backgroundColor: settings.cardBackgroundColor, borderColor: settings.borderColor }]}>
              <Text style={[styles.phaseTitleCentered, { color: settings.phase1Color }]}>Phase 1</Text>
              <Text style={[styles.phasePointsCentered, { color: settings.secondaryTextColor }]}>5 points per completion</Text>
              <View style={styles.phaseCounterRowCentered}>
                <Text style={[styles.phaseCountText, { color: settings.textColor }]}>{phase1Count}</Text>
                <TouchableOpacity
                  onPress={() => {
                    if (phase1Count > 0) {
                      setPhase1Count(phase1Count - 1);
                      triggerHapticsIfEnabled();
                    }
                  }}
                  disabled={phase1Count <= 0}
                >
                  <Ionicons name="remove-circle" size={24} color={phase1Count <= 0 ? settings.secondaryTextColor : settings.errorColor} />
                </TouchableOpacity>
              </View>
              <CheckboxItem
                label="Fly under Red Arch Gate"
                checked={phase1RedArch}
                onToggle={() => {
                  setPhase1RedArch(!phase1RedArch);
                  triggerHapticsIfEnabled();
                }}
                color={settings.phase1Color}
                settings={settings}
              />
              <CheckboxItem
                label="Fly through Green Keyhole"
                checked={phase1GreenKeyhole}
                onToggle={() => {
                  setPhase1GreenKeyhole(!phase1GreenKeyhole);
                  triggerHapticsIfEnabled();
                }}
                color={settings.phase1Color}
                settings={settings}
              />
            </View>

            {/* Phase 3 Section */}
            <View style={[styles.phaseCard, { backgroundColor: settings.cardBackgroundColor, borderColor: settings.borderColor }]}>
              <Text style={[styles.phaseTitleCentered, { color: settings.phase3Color }]}>Phase 3</Text>
              <Text style={[styles.phasePointsCentered, { color: settings.secondaryTextColor }]}>15 points per completion</Text>
              <View style={styles.phaseCounterRowCentered}>
                <Text style={[styles.phaseCountText, { color: settings.textColor }]}>{phase3Count}</Text>
                <TouchableOpacity
                  onPress={() => {
                    if (phase3Count > 0) {
                      setPhase3Count(phase3Count - 1);
                      triggerHapticsIfEnabled();
                    }
                  }}
                  disabled={phase3Count <= 0}
                >
                  <Ionicons name="remove-circle" size={24} color={phase3Count <= 0 ? settings.secondaryTextColor : settings.errorColor} />
                </TouchableOpacity>
              </View>
              <CheckboxItem
                label="Fly through Tunnel"
                checked={phase3Tunnel}
                onToggle={() => {
                  setPhase3Tunnel(!phase3Tunnel);
                  triggerHapticsIfEnabled();
                }}
                color={settings.phase3Color}
                settings={settings}
              />
              <CheckboxItem
                label="Fly through Yellow Keyhole Gate"
                checked={phase3YellowKeyhole}
                onToggle={() => {
                  setPhase3YellowKeyhole(!phase3YellowKeyhole);
                  triggerHapticsIfEnabled();
                }}
                color={settings.phase3Color}
                settings={settings}
              />
              <CheckboxItem
                label="Fly through Blue Arch Gate"
                checked={phase3BlueArch}
                onToggle={() => {
                  setPhase3BlueArch(!phase3BlueArch);
                  triggerHapticsIfEnabled();
                }}
                color={settings.phase3Color}
                settings={settings}
              />
            </View>
          </View>

          {/* Right Column: Phase 2 and Landing */}
          <View style={[styles.column, styles.rightColumn]}>
            {/* Phase 2 Section */}
            <View style={[styles.phaseCard, { backgroundColor: settings.cardBackgroundColor, borderColor: settings.borderColor }]}>
              <Text style={[styles.phaseTitleCentered, { color: settings.phase2Color }]}>Phase 2</Text>
              <Text style={[styles.phasePointsCentered, { color: settings.secondaryTextColor }]}>10 points per completion</Text>
              <View style={styles.phaseCounterRowCentered}>
                <Text style={[styles.phaseCountText, { color: settings.textColor }]}>{phase2Count}</Text>
                <TouchableOpacity
                  onPress={() => {
                    if (phase2Count > 0) {
                      setPhase2Count(phase2Count - 1);
                      triggerHapticsIfEnabled();
                    }
                  }}
                  disabled={phase2Count <= 0}
                >
                  <Ionicons name="remove-circle" size={24} color={phase2Count <= 0 ? settings.secondaryTextColor : settings.errorColor} />
                </TouchableOpacity>
              </View>
              <CheckboxItem
                label="Fly through the Fly Through Panel"
                checked={phase2FlyThrough}
                onToggle={() => {
                  setPhase2FlyThrough(!phase2FlyThrough);
                  triggerHapticsIfEnabled();
                }}
                color={settings.phase2Color}
                settings={settings}
              />

              {/* Small Hole Bonus nested under Phase 2 */}
              <View style={styles.bonusSection}>
                <Text style={[styles.bonusTitleCentered, { color: settings.bonusColor }]}>Small Hole Bonus</Text>
                <Text style={[styles.bonusPointsCentered, { color: settings.secondaryTextColor }]}>10 points per completion</Text>
                <View style={styles.bonusCounterRowCentered}>
                  <Text style={[styles.bonusCountText, { color: settings.textColor }]}>{smallHoleBonusCount}</Text>
                  <TouchableOpacity
                    onPress={() => {
                      if (smallHoleBonusCount > 0) {
                        setSmallHoleBonusCount(smallHoleBonusCount - 1);
                        triggerHapticsIfEnabled();
                      }
                    }}
                    disabled={smallHoleBonusCount <= 0}
                  >
                    <Ionicons name="remove-circle" size={20} color={smallHoleBonusCount <= 0 ? settings.secondaryTextColor : settings.errorColor} />
                  </TouchableOpacity>
                </View>
                <CheckboxItem
                  label="Enter through small hole (front)"
                  checked={phase2SmallHoleIn}
                  onToggle={() => {
                    setPhase2SmallHoleIn(!phase2SmallHoleIn);
                    triggerHapticsIfEnabled();
                  }}
                  color={settings.bonusColor}
                  settings={settings}
                />
                <CheckboxItem
                  label="Exit through small hole (side)"
                  checked={phase2SmallHoleOut}
                  onToggle={() => {
                    setPhase2SmallHoleOut(!phase2SmallHoleOut);
                    triggerHapticsIfEnabled();
                  }}
                  color={settings.bonusColor}
                  settings={settings}
                />
              </View>
            </View>

            {/* Landing Options Section */}
            <View style={[styles.phaseCard, { backgroundColor: settings.cardBackgroundColor, borderColor: settings.borderColor }]}>
              <Text style={[styles.landingTitleCentered, { color: settings.textColor }]}>Landing</Text>
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

// Checkbox Item Component
interface CheckboxItemProps {
  label: string;
  checked: boolean;
  onToggle: () => void;
  color: string;
  settings: any;
}

const CheckboxItem: React.FC<CheckboxItemProps> = ({ label, checked, onToggle, color, settings }) => (
  <TouchableOpacity
    style={styles.checkboxRow}
    onPress={onToggle}
    activeOpacity={0.7}
  >
    <View style={[styles.checkbox, { borderColor: color }]}>
      {checked && (
        <Ionicons name="checkmark" size={20} color={color} />
      )}
    </View>
    <Text style={[styles.checkboxLabel, { color: settings.textColor }]}>{label}</Text>
  </TouchableOpacity>
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
    padding: 10,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    padding: 12,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  scoreText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginHorizontal: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  section: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
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
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  takeOffPoints: {
    fontSize: 11,
    fontStyle: 'italic',
  },
  twoColumnContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  column: {
    flex: 1,
  },
  leftColumn: {
    marginRight: 5,
  },
  rightColumn: {
    marginLeft: 5,
  },
  phaseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  phaseCard: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    borderWidth: 1,
  },
  phaseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  phaseTitle: {
    fontSize: 17,
    fontWeight: 'bold',
  },
  phaseTitleCentered: {
    fontSize: 17,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 2,
  },
  phaseCounterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  phaseCounterRowCentered: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 8,
  },
  phaseCountText: {
    fontSize: 17,
    fontWeight: 'bold',
    minWidth: 25,
    textAlign: 'center',
  },
  phasePoints: {
    fontSize: 11,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  phasePointsCentered: {
    fontSize: 10,
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 6,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  checkboxLabel: {
    fontSize: 14,
    flex: 1,
  },
  bonusSection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128, 128, 128, 0.3)',
  },
  bonusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  bonusTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  bonusTitleCentered: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 2,
  },
  bonusCounterRowCentered: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 6,
  },
  bonusCountText: {
    fontSize: 14,
    fontWeight: 'bold',
    minWidth: 20,
    textAlign: 'center',
  },
  bonusPoints: {
    fontSize: 10,
    fontStyle: 'italic',
    marginBottom: 4,
  },
  bonusPointsCentered: {
    fontSize: 9,
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 4,
  },
  landingSection: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128, 128, 128, 0.3)',
  },
  landingTitleCentered: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  landingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  landingButton: {
    width: '48.5%',
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  landingButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  landingButtonPoints: {
    fontSize: 10,
  },
});

export default PilotingSkillsCalculatorScreen;
