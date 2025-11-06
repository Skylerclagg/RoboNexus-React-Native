import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { useSettings } from '../contexts/SettingsContext';

interface MatchCardSkeletonProps {
  compact?: boolean;
}

const MatchCardSkeleton: React.FC<MatchCardSkeletonProps> = ({ compact = false }) => {
  const settings = useSettings();
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const shimmer = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );
    shimmer.start();

    return () => shimmer.stop();
  }, [shimmerAnim]);

  const shimmerTranslate = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-300, 300],
  });

  const baseColor = settings.colorScheme === 'dark' ? '#2C2C2E' : '#E5E5E7';
  const shimmerColor = settings.colorScheme === 'dark' ? '#3A3A3C' : '#F2F2F7';

  const SkeletonBox = ({ width, height, style }: { width: number | string; height: number; style?: any }) => (
    <Animated.View
      style={[
        {
          width,
          height,
          backgroundColor: baseColor,
          borderRadius: 4,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.shimmer,
          {
            backgroundColor: shimmerColor,
            transform: [{ translateX: shimmerTranslate }],
          },
        ]}
      />
    </Animated.View>
  );

  if (compact) {
    // Compact View Layout
    return (
      <View style={[styles.compactMatchItem, { backgroundColor: settings.cardBackgroundColor, borderColor: settings.borderColor }]}>
        {/* Header: Match name and time */}
        <View style={styles.compactMatchHeader}>
          <SkeletonBox width={60} height={14} />
          <SkeletonBox width={50} height={12} />
        </View>

        {/* Content: Red teams, scores, blue teams in a row */}
        <View style={styles.compactMatchContent}>
          {/* Red Alliance */}
          <View style={styles.compactRedAlliance}>
            <SkeletonBox width={50} height={28} style={{ borderRadius: 6 }} />
            <SkeletonBox width={50} height={28} style={{ borderRadius: 6 }} />
          </View>

          {/* Scores */}
          <View style={styles.compactScoresCenter}>
            <SkeletonBox width={30} height={18} />
            <SkeletonBox width={8} height={14} style={{ marginHorizontal: 4 }} />
            <SkeletonBox width={30} height={18} />
          </View>

          {/* Blue Alliance */}
          <View style={styles.compactBlueAlliance}>
            <SkeletonBox width={50} height={28} style={{ borderRadius: 6 }} />
            <SkeletonBox width={50} height={28} style={{ borderRadius: 6 }} />
          </View>
        </View>
      </View>
    );
  }

  // Normal View Layout
  return (
    <View style={[styles.matchItem, { backgroundColor: settings.cardBackgroundColor, borderColor: settings.borderColor }]}>
      {/* Match Header */}
      <View style={styles.matchHeader}>
        <View style={styles.matchHeaderLeft}>
          <SkeletonBox width={80} height={20} />
        </View>
        <SkeletonBox width={60} height={16} />
      </View>

      {/* Alliance Section - Red */}
      <View style={styles.allianceSection}>
        <View style={[styles.allianceIndicator, styles.redIndicator]} />
        <View style={styles.teamsContainer}>
          <SkeletonBox width={65} height={28} style={{ borderRadius: 8 }} />
          <SkeletonBox width={65} height={28} style={{ borderRadius: 8 }} />
        </View>
        <View style={styles.scoreContainer}>
          <SkeletonBox width={30} height={24} />
        </View>
      </View>

      {/* Alliance Section - Blue */}
      <View style={styles.allianceSection}>
        <View style={[styles.allianceIndicator, styles.blueIndicator]} />
        <View style={styles.teamsContainer}>
          <SkeletonBox width={65} height={28} style={{ borderRadius: 8 }} />
          <SkeletonBox width={65} height={28} style={{ borderRadius: 8 }} />
        </View>
        <View style={styles.scoreContainer}>
          <SkeletonBox width={30} height={24} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // Normal Match Card Styles
  matchItem: {
    padding: 10,
    marginHorizontal: 16,
    marginVertical: 3,
    borderRadius: 12,
    borderWidth: 2,
  },
  matchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  matchHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  allianceSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  allianceIndicator: {
    width: 4,
    height: 20,
    marginRight: 12,
    borderRadius: 2,
  },
  redIndicator: {
    backgroundColor: '#FF3B30',
  },
  blueIndicator: {
    backgroundColor: '#007AFF',
  },
  teamsContainer: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  scoreContainer: {
    minWidth: 40,
    alignItems: 'center',
  },

  // Compact Match Card Styles
  compactMatchItem: {
    borderRadius: 8,
    padding: 10,
    marginHorizontal: 16,
    marginVertical: 4,
    borderWidth: 1,
  },
  compactMatchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  compactMatchContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  compactRedAlliance: {
    flex: 1,
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 4,
  },
  compactBlueAlliance: {
    flex: 1,
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'flex-end',
  },
  compactScoresCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
  },

  // Shimmer Effect
  shimmer: {
    width: '100%',
    height: '100%',
    opacity: 0.3,
  },
});

export default MatchCardSkeleton;
