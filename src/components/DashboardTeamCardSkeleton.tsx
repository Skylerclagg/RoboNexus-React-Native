/**
 * Dashboard Team Card Skeleton Loader
 *
 * Shows animated skeleton placeholder while team data is loading on Dashboard
 * Matches the exact structure of dashboard team cards with stats
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { useSettings } from '../contexts/SettingsContext';

const DashboardTeamCardSkeleton: React.FC = () => {
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

  return (
    <View style={[styles.teamCard, {
      backgroundColor: settings.cardBackgroundColor,
      borderColor: settings.borderColor
    }]}>
      {/* Team Card Header */}
      <View style={styles.teamCardHeader}>
        {/* Left side: Team info */}
        <View style={styles.teamInfo}>
          {/* Team Number and Name Row */}
          <View style={styles.teamNameRow}>
            <SkeletonBox width={80} height={22} style={{ marginRight: 8 }} />
            <SkeletonBox width={16} height={16} style={{ borderRadius: 8, marginRight: 4 }} />
          </View>
          {/* Team Name */}
          <SkeletonBox width="70%" height={18} style={{ marginTop: 6 }} />
          {/* Location */}
          <SkeletonBox width="85%" height={14} style={{ marginTop: 6 }} />
        </View>

        {/* Right side: Status indicator */}
        <View style={styles.statusIndicator}>
          <SkeletonBox width={50} height={24} style={{ borderRadius: 12 }} />
        </View>
      </View>

      {/* Team Card Stats - 3 columns */}
      <View style={styles.teamCardStats}>
        {/* Stat 1 */}
        <View style={styles.statItem}>
          <SkeletonBox width={60} height={12} style={{ marginBottom: 4 }} />
          <SkeletonBox width={40} height={20} />
        </View>

        {/* Stat 2 */}
        <View style={styles.statItem}>
          <SkeletonBox width={50} height={12} style={{ marginBottom: 4 }} />
          <SkeletonBox width={35} height={20} />
        </View>

        {/* Stat 3 */}
        <View style={styles.statItem}>
          <SkeletonBox width={70} height={12} style={{ marginBottom: 4 }} />
          <SkeletonBox width={45} height={20} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  teamCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  teamCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  teamInfo: {
    flex: 1,
  },
  teamNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    marginLeft: 8,
  },
  teamCardStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  shimmer: {
    width: '100%',
    height: '100%',
    opacity: 0.3,
  },
});

export default DashboardTeamCardSkeleton;
