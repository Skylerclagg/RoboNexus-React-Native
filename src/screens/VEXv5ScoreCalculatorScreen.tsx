/**
 * VEX V5 Score Calculator Screen
 *
 * Description:
 * Comprehensive score calculator for VEX V5 Robotics Competition matches.
 * Allows users to input match actions and automatically calculates total scores
 * based on current season rules with separate autonomous and driver control periods.
 *
 * Navigation:
 * Accessed from the Score Calculators home screen when VEX V5 Robotics Competition
 * is selected as the active program.
 *
 * Key Features:
 * - Match period separation (autonomous vs driver control)
 * - Interactive scoring counters with increment/decrement controls
 * - Real-time score calculation with visual feedback
 * - Reset functionality with haptic feedback support
 * - Maximum value validation and warning indicators
 * - Tab-based interface for different match periods
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

interface VEXv5ScoreCalculatorScreenProps {
  navigation: any;
}

interface CounterSectionProps {
  title: string;
  count: number;
  maxCount?: number;
  onIncrement: () => void;
  onDecrement: () => void;
  showWarning?: boolean;
  accentColor?: string;
}

const VEXv5ScoreCalculatorScreen: React.FC<VEXv5ScoreCalculatorScreenProps> = ({ navigation }) => {
  const settings = useSettings();

  // Tab state
  const [activeTab, setActiveTab] = useState('match');

  // Match Scoring State
  const [autonomousBonus, setAutonomousBonus] = useState(false);
  const [blocksScored, setBlocksScored] = useState(0);
  const [longGoalZones, setLongGoalZones] = useState(0);
  const [centerGoalUpper, setCenterGoalUpper] = useState(false);
  const [centerGoalLower, setCenterGoalLower] = useState(false);
  const [parkedRobots, setParkedRobots] = useState(0);

  // Skills Scoring State
  const [skillsBlocksScored, setSkillsBlocksScored] = useState(0);
  const [skillsLongGoalZones, setSkillsLongGoalZones] = useState(0);
  const [skillsCenterGoalZones, setSkillsCenterGoalZones] = useState(0);
  const [clearedParkZones, setClearedParkZones] = useState(0);
  const [clearedLoaders, setClearedLoaders] = useState(0);
  const [skillsParkedRobot, setSkillsParkedRobot] = useState(false);

  useEffect(() => {
    navigation.setOptions({
      title: 'VEX V5 Score Calculator',
      headerStyle: {
        backgroundColor: settings.buttonColor,
      },
      headerTintColor: '#fff',
      headerTitleAlign: 'center',
    });
  }, [navigation, settings.buttonColor]);

  const CounterSection: React.FC<CounterSectionProps> = ({
    title,
    count,
    maxCount,
    onIncrement,
    onDecrement,
    showWarning = false,
    accentColor
  }) => {
    const handleIncrement = () => {
      if (maxCount && count >= maxCount) return;
      Vibration.vibrate(50);
      onIncrement();
    };

    const handleDecrement = () => {
      if (count <= 0) return;
      Vibration.vibrate(50);
      onDecrement();
    };

    return (
      <View style={[styles.counterSection, { backgroundColor: settings.cardBackgroundColor, borderColor: settings.borderColor }]}>
        <Text style={[styles.counterTitle, { color: settings.textColor }]}>{title}</Text>
        <View style={styles.counterRow}>
          <TouchableOpacity
            style={[
              styles.counterButton,
              { borderColor: settings.buttonColor },
              count <= 0 && { opacity: 0.5 }
            ]}
            onPress={handleDecrement}
            disabled={count <= 0}
          >
            <Ionicons name="remove" size={24} color={settings.buttonColor} />
          </TouchableOpacity>

          <View style={[styles.countDisplay, { backgroundColor: accentColor || settings.buttonColor }]}>
            <Text style={styles.countText}>{count}</Text>
            {maxCount && <Text style={styles.maxCountText}>/ {maxCount}</Text>}
          </View>

          <TouchableOpacity
            style={[
              styles.counterButton,
              { borderColor: settings.buttonColor },
              maxCount && count >= maxCount ? { opacity: 0.5 } : undefined
            ]}
            onPress={handleIncrement}
            disabled={maxCount ? count >= maxCount : false}
          >
            <Ionicons name="add" size={24} color={settings.buttonColor} />
          </TouchableOpacity>
        </View>
        {showWarning && maxCount && count >= maxCount && (
          <Text style={styles.warningText}>Maximum reached</Text>
        )}
      </View>
    );
  };

  const ToggleSection: React.FC<{
    title: string;
    isSelected: boolean;
    onToggle: () => void;
    points: number;
  }> = ({ title, isSelected, onToggle, points }) => (
    <TouchableOpacity
      style={[
        styles.toggleSection,
        {
          backgroundColor: isSelected ? settings.buttonColor : settings.cardBackgroundColor,
          borderColor: settings.borderColor
        }
      ]}
      onPress={() => {
        Vibration.vibrate(50);
        onToggle();
      }}
    >
      <View style={styles.toggleContent}>
        <Text style={[
          styles.toggleTitle,
          { color: isSelected ? '#fff' : settings.textColor }
        ]}>
          {title}
        </Text>
        <Text style={[
          styles.togglePoints,
          { color: isSelected ? '#fff' : settings.secondaryTextColor }
        ]}>
          {points} points
        </Text>
      </View>
      <Ionicons
        name={isSelected ? "checkmark-circle" : "radio-button-off"}
        size={24}
        color={isSelected ? '#fff' : settings.iconColor}
      />
    </TouchableOpacity>
  );

  const calculateMatchScore = () => {
    let score = 0;

    if (autonomousBonus) score += 10;
    score += blocksScored * 3;
    score += longGoalZones * 10;
    if (centerGoalUpper) score += 8;
    if (centerGoalLower) score += 6;

    // Parking scoring
    if (parkedRobots === 1) score += 8;
    else if (parkedRobots >= 2) score += 30;

    return score;
  };

  const calculateSkillsScore = () => {
    let score = 0;

    score += skillsBlocksScored * 1; // Each Block Scored in a Goal: 1 Point
    score += skillsLongGoalZones * 5; // Each filled Control Zone in a Long Goal: 5 Points
    score += skillsCenterGoalZones * 10; // Each filled Control Zone in a Center Goal: 10 Points
    score += clearedParkZones * 5; // Each Cleared Park Zone: 5 Points
    score += clearedLoaders * 5; // Each Cleared Loader: 5 Points
    if (skillsParkedRobot) score += 15; // Parked Robot: 15 Points

    return score;
  };

  const resetCalculator = () => {
    if (activeTab === 'match') {
      setAutonomousBonus(false);
      setBlocksScored(0);
      setLongGoalZones(0);
      setCenterGoalUpper(false);
      setCenterGoalLower(false);
      setParkedRobots(0);
    } else {
      setSkillsBlocksScored(0);
      setSkillsLongGoalZones(0);
      setSkillsCenterGoalZones(0);
      setClearedParkZones(0);
      setClearedLoaders(0);
      setSkillsParkedRobot(false);
    }
    Vibration.vibrate(100);
  };

  const renderMatchTab = () => (
    <>
      <ToggleSection
        title="Autonomous Bonus"
        isSelected={autonomousBonus}
        onToggle={() => setAutonomousBonus(!autonomousBonus)}
        points={10}
      />

      <CounterSection
        title="Blocks Scored"
        count={blocksScored}
        onIncrement={() => setBlocksScored(blocksScored + 1)}
        onDecrement={() => setBlocksScored(blocksScored - 1)}
      />

      <CounterSection
        title="Controlled Zones in Long Goal"
        count={longGoalZones}
        maxCount={4}
        onIncrement={() => setLongGoalZones(longGoalZones + 1)}
        onDecrement={() => setLongGoalZones(longGoalZones - 1)}
        showWarning={true}
      />

      <ToggleSection
        title="Controlled Center Goal - Upper"
        isSelected={centerGoalUpper}
        onToggle={() => setCenterGoalUpper(!centerGoalUpper)}
        points={8}
      />

      <ToggleSection
        title="Controlled Center Goal - Lower"
        isSelected={centerGoalLower}
        onToggle={() => setCenterGoalLower(!centerGoalLower)}
        points={6}
      />

      <CounterSection
        title="Parked Alliance Robots"
        count={parkedRobots}
        maxCount={2}
        onIncrement={() => setParkedRobots(parkedRobots + 1)}
        onDecrement={() => setParkedRobots(parkedRobots - 1)}
        showWarning={true}
      />
    </>
  );

  const renderSkillsTab = () => (
    <>
      <CounterSection
        title="Blocks Scored in Goals"
        count={skillsBlocksScored}
        onIncrement={() => setSkillsBlocksScored(skillsBlocksScored + 1)}
        onDecrement={() => setSkillsBlocksScored(skillsBlocksScored - 1)}
      />

      <CounterSection
        title="Filled Control Zones in Long Goals"
        count={skillsLongGoalZones}
        onIncrement={() => setSkillsLongGoalZones(skillsLongGoalZones + 1)}
        onDecrement={() => setSkillsLongGoalZones(skillsLongGoalZones - 1)}
      />

      <CounterSection
        title="Filled Control Zones in Center Goals"
        count={skillsCenterGoalZones}
        onIncrement={() => setSkillsCenterGoalZones(skillsCenterGoalZones + 1)}
        onDecrement={() => setSkillsCenterGoalZones(skillsCenterGoalZones - 1)}
      />

      <CounterSection
        title="Cleared Park Zones"
        count={clearedParkZones}
        maxCount={4}
        onIncrement={() => setClearedParkZones(clearedParkZones + 1)}
        onDecrement={() => setClearedParkZones(clearedParkZones - 1)}
        showWarning={true}
      />

      <CounterSection
        title="Cleared Loaders"
        count={clearedLoaders}
        maxCount={4}
        onIncrement={() => setClearedLoaders(clearedLoaders + 1)}
        onDecrement={() => setClearedLoaders(clearedLoaders - 1)}
        showWarning={true}
      />

      <ToggleSection
        title="Parked Robot"
        isSelected={skillsParkedRobot}
        onToggle={() => setSkillsParkedRobot(!skillsParkedRobot)}
        points={15}
      />
    </>
  );

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: settings.backgroundColor,
    },
    scrollView: {
      flex: 1,
      padding: 16,
    },
    counterSection: {
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    counterTitle: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 12,
      textAlign: 'center',
    },
    counterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    counterButton: {
      width: 50,
      height: 50,
      borderRadius: 25,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
    countDisplay: {
      marginHorizontal: 20,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: 'center',
      minWidth: 80,
    },
    countText: {
      fontSize: 24,
      fontWeight: 'bold',
      color: '#fff',
    },
    maxCountText: {
      fontSize: 12,
      color: '#fff',
      opacity: 0.8,
    },
    warningText: {
      color: '#ff6b6b',
      fontSize: 12,
      textAlign: 'center',
      marginTop: 8,
    },
    toggleSection: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    toggleContent: {
      flex: 1,
    },
    toggleTitle: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 4,
    },
    togglePoints: {
      fontSize: 14,
    },
    tabBar: {
      flexDirection: 'row',
      backgroundColor: settings.cardBackgroundColor,
      borderBottomWidth: 1,
      borderBottomColor: settings.borderColor,
    },
    tabButton: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 8,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
    },
    activeTabButton: {
      borderBottomWidth: 2,
      borderBottomColor: settings.buttonColor,
    },
    tabIcon: {
      marginRight: 6,
    },
    tabText: {
      fontSize: 14,
      fontWeight: '600',
      textAlign: 'center',
    },
    activeTabText: {
      color: settings.buttonColor,
    },
    inactiveTabText: {
      color: settings.secondaryTextColor,
    },
    scoreContainer: {
      backgroundColor: settings.buttonColor,
      borderRadius: 16,
      padding: 20,
      margin: 16,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 5,
    },
    totalScore: {
      alignItems: 'center',
      width: '100%',
    },
    totalLabel: {
      color: '#fff',
      fontSize: 16,
      marginBottom: 8,
    },
    totalValue: {
      color: '#fff',
      fontSize: 36,
      fontWeight: 'bold',
    },
    resetButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: settings.cardBackgroundColor,
      borderColor: settings.buttonColor,
      borderWidth: 1,
      borderRadius: 12,
      padding: 16,
      margin: 16,
    },
    resetButtonText: {
      color: settings.buttonColor,
      fontSize: 16,
      fontWeight: '600',
      marginLeft: 8,
    },
  });

  return (
    <View style={styles.container}>
      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'match' && styles.activeTabButton,
          ]}
          onPress={() => setActiveTab('match')}
        >
          <Ionicons
            name="trophy"
            size={20}
            color={activeTab === 'match' ? settings.buttonColor : settings.secondaryTextColor}
            style={styles.tabIcon}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === 'match' ? styles.activeTabText : styles.inactiveTabText,
            ]}
          >
            Match
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'skills' && styles.activeTabButton,
          ]}
          onPress={() => setActiveTab('skills')}
        >
          <Ionicons
            name="code"
            size={20}
            color={activeTab === 'skills' ? settings.buttonColor : settings.secondaryTextColor}
            style={styles.tabIcon}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === 'skills' ? styles.activeTabText : styles.inactiveTabText,
            ]}
          >
            Skills
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {activeTab === 'match' ? renderMatchTab() : renderSkillsTab()}
      </ScrollView>

      {/* Score Display */}
      <View style={styles.scoreContainer}>
        <View style={styles.totalScore}>
          <Text style={styles.totalLabel}>TOTAL SCORE</Text>
          <Text style={styles.totalValue}>
            {activeTab === 'match' ? calculateMatchScore() : calculateSkillsScore()}
          </Text>
        </View>
      </View>

      {/* Reset Button */}
      <TouchableOpacity style={styles.resetButton} onPress={resetCalculator}>
        <Ionicons name="refresh" size={20} color={settings.buttonColor} />
        <Text style={styles.resetButtonText}>Reset Calculator</Text>
      </TouchableOpacity>
    </View>
  );
};

export default VEXv5ScoreCalculatorScreen;