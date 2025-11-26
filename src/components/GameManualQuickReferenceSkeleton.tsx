/**
 * Game Manual Quick Reference Skeleton Loader
 *
 * Shows animated skeleton placeholder while game manual data is loading
 * Displays actual search bar and Q&A button with skeleton loaders for content
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, ScrollView, TextInput, TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../contexts/SettingsContext';

interface GameManualQuickReferenceSkeletonProps {
  qnaUrl?: string;
  onOpenQnA?: () => void;
}

const GameManualQuickReferenceSkeleton: React.FC<GameManualQuickReferenceSkeletonProps> = ({ qnaUrl, onOpenQnA }) => {
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
    <View style={[styles.container, { backgroundColor: settings.backgroundColor }]}>
      {/* Real Search Bar with Q&A Button */}
      <View style={styles.searchRow}>
        <View style={[styles.searchContainer, { backgroundColor: settings.cardBackgroundColor, borderColor: settings.borderColor }]}>
          <Ionicons name="search" size={20} color={settings.iconColor} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: settings.textColor }]}
            placeholder="Search rules, rule content, categories..."
            placeholderTextColor={settings.secondaryTextColor}
            editable={false}
            value=""
          />
        </View>

        {/* Q&A Link Button - only show if URL is provided */}
        {qnaUrl && (
          <TouchableOpacity
            style={[styles.qnaButton, { backgroundColor: settings.buttonColor }]}
            onPress={onOpenQnA}
          >
            <Ionicons name="help-circle" size={20} color="#FFFFFF" />
            <Text style={styles.qnaButtonText}>Q&A</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Chips */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          <View style={styles.filterChipsRow}>
            <View style={[styles.filterChip, { backgroundColor: settings.cardBackgroundColor, borderColor: settings.borderColor }]}>
              <SkeletonBox width={70} height={16} />
            </View>
            <View style={[styles.filterChip, { backgroundColor: settings.cardBackgroundColor, borderColor: settings.borderColor }]}>
              <SkeletonBox width={60} height={16} />
            </View>
            <View style={[styles.filterChip, { backgroundColor: settings.cardBackgroundColor, borderColor: settings.borderColor }]}>
              <SkeletonBox width={80} height={16} />
            </View>
            <View style={[styles.filterChip, { backgroundColor: settings.cardBackgroundColor, borderColor: settings.borderColor }]}>
              <SkeletonBox width={55} height={16} />
            </View>
            <View style={[styles.filterChip, { backgroundColor: settings.cardBackgroundColor, borderColor: settings.borderColor }]}>
              <SkeletonBox width={75} height={16} />
            </View>
          </View>
        </ScrollView>
      </View>

      {/* Rules List */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Group Title */}
        <View style={styles.ruleGroup}>
          <SkeletonBox width={150} height={22} style={{ marginBottom: 12 }} />

          {/* Rule Cards */}
          {[1, 2, 3, 4, 5].map((index) => (
            <View
              key={index}
              style={[
                styles.ruleCard,
                { backgroundColor: settings.cardBackgroundColor, borderColor: settings.borderColor }
              ]}
            >
              {/* Rule Header */}
              <View style={styles.ruleHeader}>
                <View style={styles.ruleHeaderLeft}>
                  {/* Rule Code */}
                  <SkeletonBox width={40} height={18} style={{ marginRight: 8 }} />
                  {/* Rule Title */}
                  <SkeletonBox width={200} height={18} style={{ flex: 1, maxWidth: 220 }} />
                </View>
                {/* Favorite Icon */}
                <SkeletonBox width={24} height={24} style={{ borderRadius: 12 }} />
              </View>

              {/* Category */}
              <SkeletonBox width={120} height={14} style={{ marginTop: 8 }} />
            </View>
          ))}
        </View>

        {/* Second Group */}
        <View style={styles.ruleGroup}>
          <SkeletonBox width={180} height={22} style={{ marginBottom: 12 }} />

          {/* Rule Cards */}
          {[1, 2, 3].map((index) => (
            <View
              key={index}
              style={[
                styles.ruleCard,
                { backgroundColor: settings.cardBackgroundColor, borderColor: settings.borderColor }
              ]}
            >
              {/* Rule Header */}
              <View style={styles.ruleHeader}>
                <View style={styles.ruleHeaderLeft}>
                  {/* Rule Code */}
                  <SkeletonBox width={45} height={18} style={{ marginRight: 8 }} />
                  {/* Rule Title */}
                  <SkeletonBox width={180} height={18} style={{ flex: 1, maxWidth: 200 }} />
                </View>
                {/* Favorite Icon */}
                <SkeletonBox width={24} height={24} style={{ borderRadius: 12 }} />
              </View>

              {/* Category */}
              <SkeletonBox width={100} height={14} style={{ marginTop: 8 }} />
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 8,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  qnaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 6,
  },
  qnaButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  filterContainer: {
    paddingBottom: 8,
  },
  filterScroll: {
    paddingHorizontal: 16,
  },
  filterChipsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  ruleGroup: {
    marginBottom: 24,
  },
  ruleCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  ruleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ruleHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  shimmer: {
    width: '100%',
    height: '100%',
    opacity: 0.3,
  },
});

export default GameManualQuickReferenceSkeleton;
