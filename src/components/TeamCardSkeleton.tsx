/**
 * Team Card Skeleton Loader
 *
 * Shows animated skeleton placeholder while team data is loading
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { useSettings } from '../contexts/SettingsContext';

const TeamCardSkeleton: React.FC = () => {
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

  return (
    <View style={[styles.card, { backgroundColor: settings.cardBackgroundColor, borderColor: settings.borderColor }]}>
      <View style={styles.header}>
        <View style={styles.leftSection}>
          {/* Team number skeleton */}
          <View style={[styles.teamNumber, { backgroundColor: baseColor }]}>
            <Animated.View
              style={[
                styles.shimmer,
                {
                  backgroundColor: shimmerColor,
                  transform: [{ translateX: shimmerTranslate }],
                },
              ]}
            />
          </View>

          {/* Team name skeleton */}
          <View style={[styles.teamName, { backgroundColor: baseColor }]}>
            <Animated.View
              style={[
                styles.shimmer,
                {
                  backgroundColor: shimmerColor,
                  transform: [{ translateX: shimmerTranslate }],
                },
              ]}
            />
          </View>

          {/* Location skeleton */}
          <View style={[styles.location, { backgroundColor: baseColor }]}>
            <Animated.View
              style={[
                styles.shimmer,
                {
                  backgroundColor: shimmerColor,
                  transform: [{ translateX: shimmerTranslate }],
                },
              ]}
            />
          </View>
        </View>
      </View>

      {/* Stats skeleton */}
      <View style={styles.stats}>
        {[1, 2, 3].map((i) => (
          <View key={i} style={styles.statItem}>
            <View style={[styles.statLabel, { backgroundColor: baseColor }]}>
              <Animated.View
                style={[
                  styles.shimmer,
                  {
                    backgroundColor: shimmerColor,
                    transform: [{ translateX: shimmerTranslate }],
                  },
                ]}
              />
            </View>
            <View style={[styles.statValue, { backgroundColor: baseColor }]}>
              <Animated.View
                style={[
                  styles.shimmer,
                  {
                    backgroundColor: shimmerColor,
                    transform: [{ translateX: shimmerTranslate }],
                  },
                ]}
              />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  leftSection: {
    flex: 1,
  },
  teamNumber: {
    width: 100,
    height: 24,
    borderRadius: 4,
    marginBottom: 8,
    overflow: 'hidden',
  },
  teamName: {
    width: '80%',
    height: 20,
    borderRadius: 4,
    marginBottom: 6,
    overflow: 'hidden',
  },
  location: {
    width: '60%',
    height: 16,
    borderRadius: 4,
    overflow: 'hidden',
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    width: '80%',
    height: 14,
    borderRadius: 4,
    marginBottom: 6,
    overflow: 'hidden',
  },
  statValue: {
    width: '60%',
    height: 18,
    borderRadius: 4,
    overflow: 'hidden',
  },
  shimmer: {
    width: '100%',
    height: '100%',
    opacity: 0.3,
  },
});

export default TeamCardSkeleton;
