/**
 * Team Card Skeleton Loader
 *
 * Shows animated skeleton placeholder while team data is loading
 * Used in team lists throughout the app (not dashboard)
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { useSettings } from '../contexts/SettingsContext';

interface TeamCardSkeletonProps {
  compact?: boolean;
}

const TeamCardSkeleton: React.FC<TeamCardSkeletonProps> = ({ compact = false }) => {
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
      <View style={[styles.compactTeamItem, { backgroundColor: settings.cardBackgroundColor, borderColor: settings.borderColor }]}>
        {/* First row: Team Number, Dash, Team Name */}
        <View style={styles.compactTeamRow}>
          <SkeletonBox width={60} height={16} />
          <SkeletonBox width={8} height={14} />
          <SkeletonBox width={150} height={16} style={{ flex: 1, maxWidth: 200 }} />
        </View>
        {/* Second row: Location */}
        <View style={styles.compactTeamInfoRow}>
          <SkeletonBox width={12} height={12} style={{ borderRadius: 6 }} />
          <SkeletonBox width={180} height={12} />
        </View>
      </View>
    );
  }

  // Normal View Layout
  return (
    <View style={[styles.teamItem, { backgroundColor: settings.cardBackgroundColor, borderColor: settings.borderColor }]}>
      {/* Team Header */}
      <View style={styles.teamHeader}>
        <View style={styles.teamHeaderLeft}>
          {/* Team Number Badge */}
          <View style={[styles.teamNumberBadge, { backgroundColor: settings.buttonColor + '15', borderColor: settings.buttonColor + '30' }]}>
            <SkeletonBox width={60} height={20} />
          </View>
          {/* Team Name */}
          <SkeletonBox width={150} height={18} style={{ marginLeft: 12 }} />
        </View>
        {/* Actions (heart icon + chevron) */}
        <View style={styles.teamActions}>
          <SkeletonBox width={22} height={22} style={{ borderRadius: 11, marginRight: 12 }} />
          <SkeletonBox width={20} height={20} style={{ borderRadius: 10 }} />
        </View>
      </View>

      {/* Location Row */}
      <View style={styles.locationRow}>
        <SkeletonBox width={14} height={14} style={{ borderRadius: 7, marginRight: 8 }} />
        <SkeletonBox width={200} height={14} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // Normal Team Card Styles
  teamItem: {
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
    marginBottom: 12,
  },
  teamHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  teamNumberBadge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  teamActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Compact Team Card Styles
  compactTeamItem: {
    borderRadius: 8,
    padding: 10,
    marginHorizontal: 16,
    marginVertical: 4,
    borderWidth: 1,
  },
  compactTeamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  compactTeamInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  // Shimmer Effect
  shimmer: {
    width: '100%',
    height: '100%',
    opacity: 0.3,
  },
});

export default TeamCardSkeleton;
