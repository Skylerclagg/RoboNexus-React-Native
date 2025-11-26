/**
 * TrueSkill Ranking Card Skeleton Loader
 *
 * Shows animated skeleton placeholder while TrueSkill ranking data is loading
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { useSettings } from '../contexts/SettingsContext';

const TrueSkillRankingSkeleton: React.FC = () => {
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
    <View style={[styles.card, {
      backgroundColor: settings.cardBackgroundColor,
      borderColor: settings.borderColor,
      shadowColor: settings.colorScheme === 'dark' ? '#FFFFFF' : '#000000'
    }]}>
      <View style={styles.rankingContent}>
        {/* Rank with change indicator */}
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
          <View style={[styles.rankChangeText, { backgroundColor: baseColor }]}>
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

        {/* TrueSkill Score and Expand Button */}
        <View style={styles.scoresContainer}>
          <View style={styles.scoreItem}>
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
          <View style={[styles.expandButton, { backgroundColor: baseColor }]}>
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
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  rankingContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rankContainer: {
    width: 60,
    marginRight: 12,
    alignItems: 'flex-start',
  },
  rankText: {
    width: 45,
    height: 24,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
  },
  rankChangeText: {
    width: 35,
    height: 16,
    borderRadius: 4,
    overflow: 'hidden',
  },
  teamInfo: {
    flex: 1,
    marginRight: 12,
  },
  teamNumber: {
    width: 90,
    height: 20,
    borderRadius: 4,
    marginBottom: 6,
    overflow: 'hidden',
  },
  teamName: {
    width: '85%',
    height: 16,
    borderRadius: 4,
    marginBottom: 4,
    overflow: 'hidden',
  },
  location: {
    width: '70%',
    height: 14,
    borderRadius: 4,
    overflow: 'hidden',
  },
  scoresContainer: {
    alignItems: 'center',
    marginRight: 8,
  },
  scoreItem: {
    alignItems: 'center',
    marginBottom: 6,
  },
  scoreLabel: {
    width: 55,
    height: 12,
    borderRadius: 4,
    marginBottom: 4,
    overflow: 'hidden',
  },
  scoreValue: {
    width: 40,
    height: 22,
    borderRadius: 4,
    overflow: 'hidden',
  },
  expandButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
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

export default TrueSkillRankingSkeleton;
