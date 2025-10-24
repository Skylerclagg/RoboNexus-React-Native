/**
 * World Skills Ranking Card Skeleton Loader
 *
 * Shows animated skeleton placeholder while world skills ranking data is loading
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { useSettings } from '../contexts/SettingsContext';

const WorldSkillsRankingSkeleton: React.FC = () => {
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
      <View style={styles.rankingContent}>
        {/* Rank */}
        <View style={styles.rankContainer}>
          <View style={[styles.rankText, { backgroundColor: baseColor }]}>
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

        {/* Team info */}
        <View style={styles.teamInfo}>
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

          <View style={[styles.organization, { backgroundColor: baseColor }]}>
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

        {/* Scores */}
        <View style={styles.scoresContainer}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={styles.scoreItem}>
              <View style={[styles.scoreLabel, { backgroundColor: baseColor }]}>
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
              <View style={[styles.scoreValue, { backgroundColor: baseColor }]}>
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

        {/* Favorite button placeholder */}
        <View style={styles.favoriteButton}>
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
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 6,
    overflow: 'hidden',
  },
  rankingContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rankContainer: {
    width: 50,
    marginRight: 12,
  },
  rankText: {
    width: 40,
    height: 24,
    borderRadius: 4,
    overflow: 'hidden',
  },
  teamInfo: {
    flex: 1,
    marginRight: 12,
  },
  teamNumber: {
    width: 80,
    height: 20,
    borderRadius: 4,
    marginBottom: 6,
    overflow: 'hidden',
  },
  teamName: {
    width: '90%',
    height: 16,
    borderRadius: 4,
    marginBottom: 4,
    overflow: 'hidden',
  },
  organization: {
    width: '75%',
    height: 14,
    borderRadius: 4,
    marginBottom: 4,
    overflow: 'hidden',
  },
  location: {
    width: '60%',
    height: 14,
    borderRadius: 4,
    overflow: 'hidden',
  },
  scoresContainer: {
    alignItems: 'flex-end',
    marginRight: 8,
  },
  scoreItem: {
    alignItems: 'flex-end',
    marginBottom: 4,
  },
  scoreLabel: {
    width: 40,
    height: 12,
    borderRadius: 4,
    marginBottom: 2,
    overflow: 'hidden',
  },
  scoreValue: {
    width: 30,
    height: 18,
    borderRadius: 4,
    overflow: 'hidden',
  },
  favoriteButton: {
    padding: 4,
  },
  favoriteIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    overflow: 'hidden',
  },
  shimmer: {
    width: '100%',
    height: '100%',
    opacity: 0.3,
  },
});

export default WorldSkillsRankingSkeleton;
