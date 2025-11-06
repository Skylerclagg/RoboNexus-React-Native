import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { useSettings } from '../contexts/SettingsContext';

interface RankingCardSkeletonProps {
  compact?: boolean;
}

const RankingCardSkeleton: React.FC<RankingCardSkeletonProps> = ({ compact = false }) => {
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
      <View style={[styles.compactRankingItem, { backgroundColor: settings.cardBackgroundColor, borderColor: settings.borderColor }]}>
        {/* First row: Rank, Team Number, Team Name */}
        <View style={styles.compactRankingRow}>
          <SkeletonBox width={35} height={14} />
          <SkeletonBox width={60} height={14} />
          <SkeletonBox width={120} height={14} style={{ flex: 1, maxWidth: 200 }} />
        </View>
        {/* Second row: Stats */}
        <View style={styles.compactStatsRow}>
          <SkeletonBox width={60} height={12} />
          <SkeletonBox width={45} height={12} />
          <SkeletonBox width={45} height={12} />
          <SkeletonBox width={45} height={12} />
        </View>
      </View>
    );
  }

  // Normal View Layout
  return (
    <View style={[styles.rankingItem, { backgroundColor: settings.cardBackgroundColor, borderColor: settings.borderColor }]}>
      {/* Team Header */}
      <View style={styles.teamHeader}>
        <View style={styles.teamInfo}>
          <SkeletonBox width={100} height={22} />
          <SkeletonBox width={180} height={15} style={{ marginTop: 8 }} />
        </View>
        <View style={[styles.rankBadge, { backgroundColor: settings.buttonColor + '30' }]}>
          <SkeletonBox width={35} height={16} />
        </View>
      </View>

      {/* Stats Section */}
      <View style={[styles.statsContainer, { borderTopColor: settings.borderColor }]}>
        <View style={styles.statCard}>
          <SkeletonBox width={50} height={10} style={{ marginBottom: 4 }} />
          <SkeletonBox width={60} height={16} />
        </View>
        <View style={[styles.statCard, styles.statCardWithBorder, { borderLeftColor: settings.borderColor }]}>
          <SkeletonBox width={70} height={10} style={{ marginBottom: 4 }} />
          <SkeletonBox width={80} height={16} />
        </View>
        <View style={[styles.statCard, styles.statCardWithBorder, { borderLeftColor: settings.borderColor }]}>
          <SkeletonBox width={60} height={10} style={{ marginBottom: 4 }} />
          <SkeletonBox width={70} height={16} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // Normal Ranking Card Styles
  rankingItem: {
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
  },
  teamHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  teamInfo: {
    flex: 1,
    flexDirection: 'column',
  },
  rankBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    minWidth: 50,
    alignItems: 'center',
    marginLeft: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderTopWidth: 1,
    paddingTop: 14,
    marginTop: 2,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  statCardWithBorder: {
    borderLeftWidth: 1,
  },

  // Compact Ranking Card Styles
  compactRankingItem: {
    borderRadius: 8,
    padding: 10,
    marginHorizontal: 16,
    marginVertical: 4,
    borderWidth: 1,
  },
  compactRankingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  compactStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },

  // Shimmer Effect
  shimmer: {
    width: '100%',
    height: '100%',
    opacity: 0.3,
  },
});

export default RankingCardSkeleton;
