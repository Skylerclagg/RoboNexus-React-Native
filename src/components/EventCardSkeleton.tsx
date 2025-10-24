/**
 * Event Card Skeleton Loader
 *
 * Shows animated skeleton placeholder while event data is loading
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { useSettings } from '../contexts/SettingsContext';

const EventCardSkeleton: React.FC = () => {
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
        <View style={styles.headerLeft}>
          {/* Status indicator */}
          <View style={[styles.statusIndicator, { backgroundColor: baseColor }]}>
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

          <View style={styles.eventInfo}>
            {/* Event name */}
            <View style={[styles.eventName, { backgroundColor: baseColor }]}>
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

            {/* Event code */}
            <View style={[styles.eventCode, { backgroundColor: baseColor }]}>
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

        <View style={styles.headerRight}>
          {/* Favorite button */}
          <View style={[styles.favoriteIcon, { backgroundColor: baseColor }]}>
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

      <View style={styles.details}>
        {/* Location row */}
        <View style={styles.detailRow}>
          <View style={[styles.detailIcon, { backgroundColor: baseColor }]}>
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
          <View style={[styles.detailText, { backgroundColor: baseColor }]}>
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

        {/* Date row */}
        <View style={styles.detailRow}>
          <View style={[styles.detailIcon, { backgroundColor: baseColor }]}>
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
          <View style={[styles.detailText, { backgroundColor: baseColor, width: 120 }]}>
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
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
    padding: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    flex: 1,
  },
  statusIndicator: {
    width: 4,
    height: 40,
    borderRadius: 2,
    marginRight: 12,
    overflow: 'hidden',
  },
  eventInfo: {
    flex: 1,
  },
  eventName: {
    width: '85%',
    height: 20,
    borderRadius: 4,
    marginBottom: 6,
    overflow: 'hidden',
  },
  eventCode: {
    width: '40%',
    height: 14,
    borderRadius: 4,
    overflow: 'hidden',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  favoriteIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    overflow: 'hidden',
  },
  details: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailIcon: {
    width: 16,
    height: 16,
    borderRadius: 8,
    overflow: 'hidden',
  },
  detailText: {
    width: 180,
    height: 14,
    borderRadius: 4,
    overflow: 'hidden',
  },
  shimmer: {
    width: '100%',
    height: '100%',
    opacity: 0.3,
  },
});

export default EventCardSkeleton;
