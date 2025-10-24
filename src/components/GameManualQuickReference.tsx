/**
 * Game Manual Quick Reference Component
 *
 * Displays searchable, filterable game rules with favorites support.
 * Features:
 * - Search rules by text, Rule Content, Categories
 * - Star/unstar favorite rules
 * - Filter by category or favorites only
 * - Expandable rule cards with full text
 * - Links to official VEX pages
 */

import React, { useState, useEffect, useMemo, useImperativeHandle, forwardRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Linking,
  Image,
  Modal,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../contexts/SettingsContext';
import { GameManual, Rule, RuleGroup } from '../types/gameManual';
import { gameManualService } from '../services/gameManualService';

interface Props {
  navigation?: any;
  program: string;
  season: string;
}

export interface GameManualQuickReferenceRef {
  refresh: () => Promise<void>;
}

const GameManualQuickReference = forwardRef<GameManualQuickReferenceRef, Props>(({ navigation, program, season }, ref) => {
  const settings = useSettings();

  const [manual, setManual] = useState<GameManual | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState<{ current: number; total: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [expandedRules, setExpandedRules] = useState<Set<string>>(new Set());
  const [filterRuleGroup, setFilterRuleGroup] = useState<string | null>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);

  // Load manual and favorites
  useEffect(() => {
    loadManual();
  }, [program, season]);

  const loadManual = async (forceRefresh: boolean = false) => {
    setLoading(true);
    setLoadingProgress(null);

    try {
      let manual: GameManual | null;

      if (forceRefresh) {
        manual = await gameManualService.refreshManual(
          program,
          season,
          (current, total) => setLoadingProgress({ current, total })
        );
      } else {
        manual = await gameManualService.getManual(
          program,
          season,
          (current, total) => setLoadingProgress({ current, total })
        );
      }

      setManual(manual);

      if (manual) {
        const favIds = await gameManualService.getFavoriteRuleIds(manual.program, manual.season);
        setFavorites(favIds);
      }
    } catch (error) {
      console.error('[QuickReference] Error loading manual:', error);
    } finally {
      setLoading(false);
      setLoadingProgress(null);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadManual(true);
  };

  // Expose refresh function to parent via ref
  useImperativeHandle(ref, () => ({
    refresh: handleRefresh,
  }));

  // Parse formatted text and render with styles
  const renderFormattedText = (text: string) => {
    if (!text) return null;

    const parts = [];
    let currentIndex = 0;
    let key = 0;

    // Regular expression to match our formatting markers
    const markerRegex = /\{\{(RED_ITALIC|RED|ITALIC|\/RED_ITALIC|\/RED|\/ITALIC)\}\}/g;
    let match;

    const stack: string[] = [];

    while ((match = markerRegex.exec(text)) !== null) {
      // Add text before the marker
      if (match.index > currentIndex) {
        const textBefore = text.substring(currentIndex, match.index);
        const style = getStyleForStack(stack);
        parts.push(
          <Text key={`text-${key++}`} style={style}>
            {textBefore}
          </Text>
        );
      }

      // Handle the marker
      const marker = match[1];
      if (marker.startsWith('/')) {
        // Closing tag
        stack.pop();
      } else {
        // Opening tag
        stack.push(marker);
      }

      currentIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (currentIndex < text.length) {
      const textAfter = text.substring(currentIndex);
      const style = getStyleForStack(stack);
      parts.push(
        <Text key={`text-${key++}`} style={style}>
          {textAfter}
        </Text>
      );
    }

    return <Text style={[styles.fullText, { color: settings.textColor }]}>{parts}</Text>;
  };

  // Get style based on formatting stack
  const getStyleForStack = (stack: string[]) => {
    const style: any = {};

    for (const format of stack) {
      if (format === 'RED' || format === 'RED_ITALIC') {
        style.color = '#FF0000';
      }
      if (format === 'ITALIC' || format === 'RED_ITALIC') {
        style.fontStyle = 'italic';
      }
    }

    return style;
  };

  // Custom rule group ordering - exact order specified
  // SC, S, G, GG, SG, R, RSC, T, VUG, VUR, VUT, VURS, VAISC, VAIG, VAIRS, VAIT, VAIRM
  const RULE_GROUP_ORDER = [
    'Scoring Rules',             // SC - 1
    'Safety Rules',              // S - 2
    'General Rules',             // G - 3
    'GG Rules',                  // GG - 4
    'Specific Game Rules',       // SG - 5
    'Robot Rules',               // R - 6
    'Robot Skills Challenge Rules', // RSC - 7
    'Tournament Rules',          // T - 8
    'VURC General Rules',        // VUG - 9
    'VURC Robot Rules',          // VUR - 10
    'VUT Rules',                 // VUT - 11
    'VURS Rules',                // VURS - 12
    'VAISC Rules',               // VAISC - 13
    'VAIG Rules',                // VAIG - 14
    'VAIRS Rules',               // VAIRS - 15
    'VAIT Rules',                // VAIT - 16
    'VAIRM Rules',               // VAIRM - 17
  ];

  // Get display name for rule group section titles
  const getGroupDisplayName = (groupName: string): string => {
    const nameMap: { [key: string]: string } = {
      'Skills Challenge Rules': 'Scoring Rules',
      'Scoring Rules': 'Scoring Rules',
      'Safety Rules': 'Safety Rules',
      'General Rules': 'General Rules',
      'GG Rules': 'General Game Rules',
      'Specific Game Rules': 'Specific Game Rules',
      'Robot Rules': 'Robot Rules',
      'Tournament Rules': 'Tournament Rules',
      'RSC Rules': 'Robot Skills Challenge Rules',
      'Robot Skills Challenge Rules': 'Robot Skills Challenge Rules',
      'VURC General Rules': 'VEX U General Rules',
      'VURC Robot Rules': 'VEX U Robot Rules',
      'VUT Rules': 'VEX U Tournament Rules',
      'VURS Rules': 'VEX U Robot Skills Challenge Rules',
      'VAISC Rules': 'VEX AI Rule Modifications: Scoring',
      'VAIG Rules': 'VEX AI Rule Modifications: Game',
      'VAIRS Rules': 'VEX AI Rule Modifications: Robot Skills Challenge',
      'VAIT Rules': 'VEX AI Rule Modifications: Tournament',
      'VAIRM Rules': 'VEX AI Rule Modifications: Robot',
    };
    return nameMap[groupName] || groupName;
  };

  // Get display name for rule category (shown at bottom of each rule card)
  // Categories are already accurate abbreviations, no mapping needed
  const getCategoryDisplayName = (category: string): string => {
    return category;
  };

  // Get filtered rules
  const filteredGroups = useMemo(() => {
    if (!manual) return [];

    let groups = manual.ruleGroups;

    // Filter out program-specific rules based on selected program
    // V5RC: Show only V5RC base rules (exclude VU and VAI)
    // VURC: Show V5RC + VU + VAI rules (all rules)
    // VAIRC: Show V5RC + VU + VAI rules (all rules)
    const programFilter = program.toLowerCase();
    if (programFilter.includes('v5') && !programFilter.includes('vex u') && !programFilter.includes('ai')) {
      // V5RC - exclude VU and VAI groups
      const excludeGroups = [
        'VURC General Rules',
        'VURC Robot Rules',
        'VUT Rules',
        'VURS Rules',
        'VAISC Rules',
        'VAIG Rules',
        'VAIRS Rules',
        'VAIT Rules',
        'VAIRM Rules',
      ];
      groups = groups.filter(group => !excludeGroups.includes(group.name));
    }
    // VURC and VAIRC show all rules - no filtering needed

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      groups = groups.map(group => ({
        ...group,
        rules: group.rules.filter(rule =>
          rule.rule.toLowerCase().includes(query) ||
          rule.title.toLowerCase().includes(query) ||
          rule.description.toLowerCase().includes(query) ||
          rule.category.toLowerCase().includes(query) ||
          (rule.fullText && rule.fullText.toLowerCase().includes(query))
        ),
      })).filter(group => group.rules.length > 0);
    }

    // Filter by rule group
    if (filterRuleGroup) {
      groups = groups.filter(group => group.name === filterRuleGroup);
    }

    // Filter by favorites
    if (showFavoritesOnly) {
      groups = groups.map(group => ({
        ...group,
        rules: group.rules.filter(rule => favorites.includes(rule.id)),
      })).filter(group => group.rules.length > 0);
    }

    // Sort groups by custom order
    const sortedGroups = [...groups].sort((a, b) => {
      const indexA = RULE_GROUP_ORDER.indexOf(a.name);
      const indexB = RULE_GROUP_ORDER.indexOf(b.name);

      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      // Neither in list, maintain original order (alphabetical)
      return a.name.localeCompare(b.name);
    });

    return sortedGroups;
  }, [manual, program, searchQuery, filterRuleGroup, showFavoritesOnly, favorites]);

  // Get available rule groups for filtering based on program
  const availableRuleGroups = useMemo(() => {
    if (!manual) return [];

    const programFilter = program.toLowerCase();
    let excludeGroups: string[] = [];

    if (programFilter.includes('v5') && !programFilter.includes('vex u') && !programFilter.includes('ai')) {
      // V5RC - exclude VU and VAI groups
      excludeGroups = [
        'VURC General Rules',
        'VURC Robot Rules',
        'VUT Rules',
        'VURS Rules',
        'VAISC Rules',
        'VAIG Rules',
        'VAIRS Rules',
        'VAIT Rules',
        'VAIRM Rules',
      ];
    }
    // VURC and VAIRC show all rule groups - no filtering needed

    return manual.ruleGroups
      .map(group => group.name)
      .filter(name => !excludeGroups.includes(name))
      .sort((a, b) => {
        // Sort by custom order
        const indexA = RULE_GROUP_ORDER.indexOf(a);
        const indexB = RULE_GROUP_ORDER.indexOf(b);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return a.localeCompare(b);
      });
  }, [manual, program]);

  // Toggle favorite
  const handleToggleFavorite = async (ruleId: string) => {
    if (!manual) return;

    try {
      const newState = await gameManualService.toggleFavorite(manual.program, manual.season, ruleId);

      if (newState) {
        setFavorites([...favorites, ruleId]);
      } else {
        setFavorites(favorites.filter(id => id !== ruleId));
      }
    } catch (error) {
      console.error('[QuickReference] Error toggling favorite:', error);
    }
  };

  // Toggle rule expansion
  const toggleExpanded = (ruleId: string) => {
    const newExpanded = new Set(expandedRules);
    if (newExpanded.has(ruleId)) {
      newExpanded.delete(ruleId);
    } else {
      newExpanded.add(ruleId);
    }
    setExpandedRules(newExpanded);
  };

  // Open VEX link
  const openVexLink = (url: string) => {
    Linking.openURL(url).catch(err => {
      console.error('[QuickReference] Failed to open link:', err);
    });
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: settings.backgroundColor }]}>
        <ActivityIndicator size="large" color={settings.buttonColor} style={styles.loader} />
        {loadingProgress && (
          <Text style={[styles.progressText, { color: settings.textColor }]}>
            Loading rules... {loadingProgress.current}/{loadingProgress.total}
          </Text>
        )}
      </View>
    );
  }

  if (!manual) {
    return (
      <View style={[styles.container, { backgroundColor: settings.backgroundColor }]}>
        <Text style={[styles.errorText, { color: settings.textColor }]}>
          No game manual available for {program} {season}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: settings.backgroundColor }]}>
      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: settings.cardBackgroundColor, borderColor: settings.borderColor }]}>
        <Ionicons name="search" size={20} color={settings.iconColor} style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { color: settings.textColor }]}
          placeholder="Search rules, rule content, categories..."
          placeholderTextColor={settings.secondaryTextColor}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color={settings.iconColor} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filters */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {/* Favorites Filter */}
          <TouchableOpacity
            style={[
              styles.filterChip,
              { backgroundColor: showFavoritesOnly ? settings.buttonColor : settings.cardBackgroundColor },
              { borderColor: settings.borderColor }
            ]}
            onPress={() => setShowFavoritesOnly(!showFavoritesOnly)}
          >
            <Ionicons
              name={showFavoritesOnly ? "star" : "star-outline"}
              size={16}
              color={showFavoritesOnly ? '#FFFFFF' : settings.iconColor}
            />
            <Text style={[styles.filterChipText, { color: showFavoritesOnly ? '#FFFFFF' : settings.textColor }]}>
              Favorites
            </Text>
          </TouchableOpacity>

          {/* Rule Group Filters */}
          {availableRuleGroups.map(groupName => {
            // Shorten display names for better UI
            // Note: SC = Scoring, RSC = Robot Skills Challenge (Skills)
            const displayName = groupName
              .replace('Skills Challenge Rules', 'Scoring')
              .replace('Scoring Rules', 'Scoring')
              .replace('Safety Rules', 'Safety')
              .replace('General Game Rules', 'General Game')
              .replace('GG Rules', 'General Game')
              .replace('General Rules', 'General')
              .replace('Specific Game Rules', 'Specific Game')
              .replace('Robot Rules', 'Robot')
              .replace('Tournament Rules', 'Tournament')
              .replace('Robot Skills Challenge Rules', 'Skills')
              .replace('RSC Rules', 'Skills')
              .replace('VURC General Rules', 'VU General')
              .replace('VURC Robot Rules', 'VU Robot')
              .replace('VUT Rules', 'VU Tournament')
              .replace('VURS Rules', 'VU Robot Skills')
              .replace('VAISC Rules', 'VAI Scoring')
              .replace('VAIG Rules', 'VAI Game')
              .replace('VAIRS Rules', 'VAI Robot Skills')
              .replace('VAIT Rules', 'VAI Tournament')
              .replace('VAIRM Rules', 'VAI Robot');

            return (
              <TouchableOpacity
                key={groupName}
                style={[
                  styles.filterChip,
                  { backgroundColor: filterRuleGroup === groupName ? settings.buttonColor : settings.cardBackgroundColor },
                  { borderColor: settings.borderColor }
                ]}
                onPress={() => setFilterRuleGroup(filterRuleGroup === groupName ? null : groupName)}
              >
                <Text style={[styles.filterChipText, { color: filterRuleGroup === groupName ? '#FFFFFF' : settings.textColor }]}>
                  {displayName}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Rules List */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {filteredGroups.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={48} color={settings.secondaryTextColor} />
            <Text style={[styles.emptyText, { color: settings.secondaryTextColor }]}>
              {showFavoritesOnly ? 'No favorite rules yet' : 'No rules found'}
            </Text>
          </View>
        ) : (
          filteredGroups.map(group => (
            <View key={group.name} style={styles.ruleGroup}>
              <Text style={[styles.groupTitle, { color: settings.textColor }]}>{getGroupDisplayName(group.name)}</Text>

              {group.rules.map(rule => {
                const isExpanded = expandedRules.has(rule.id);
                const isFavorited = favorites.includes(rule.id);

                return (
                  <TouchableOpacity
                    key={rule.id}
                    style={[styles.ruleCard, { backgroundColor: settings.cardBackgroundColor, borderColor: settings.borderColor }]}
                    onPress={() => toggleExpanded(rule.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.ruleHeader}>
                      <View style={styles.ruleHeaderLeft}>
                        <Text style={[styles.ruleCode, { color: settings.buttonColor }]}>{rule.rule}</Text>
                        <Text style={[styles.ruleTitle, { color: settings.textColor }]}>{rule.title}</Text>
                      </View>
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation();
                          handleToggleFavorite(rule.id);
                        }}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Ionicons
                          name={isFavorited ? "star" : "star-outline"}
                          size={24}
                          color={isFavorited ? "#FFD700" : settings.iconColor}
                        />
                      </TouchableOpacity>
                    </View>

                    {rule.category && (
                      <Text style={[styles.category, { color: settings.secondaryTextColor }]}>
                        {getCategoryDisplayName(rule.category)}
                      </Text>
                    )}

                    {isExpanded && (
                      <View style={styles.expandedContent}>
                        {/* Display complete text with formatting, or fallback to description */}
                        {(rule.completeText || rule.fullText || rule.description) && (
                          renderFormattedText(rule.completeText || rule.fullText || rule.description)
                        )}

                        {/* Display images if available - tap to enlarge */}
                        {rule.imageUrls && rule.imageUrls.length > 0 && (
                          <View style={styles.imagesContainer}>
                            {rule.imageUrls.map((imageUrl, index) => (
                              <TouchableOpacity
                                key={index}
                                onPress={() => setEnlargedImage(imageUrl)}
                              >
                                <Image
                                  source={{ uri: imageUrl }}
                                  style={styles.ruleImage}
                                  resizeMode="contain"
                                />
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}

                        {/* Optional: Still show link but make it secondary */}
                        {rule.vexLink && (
                          <TouchableOpacity
                            style={[styles.linkButton, { backgroundColor: 'transparent', borderWidth: 1, borderColor: settings.buttonColor }]}
                            onPress={() => openVexLink(rule.vexLink!)}
                          >
                            <Text style={[styles.linkButtonText, { color: settings.buttonColor }]}>View on VEX Website</Text>
                            <Ionicons name="open-outline" size={16} color={settings.buttonColor} />
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))
        )}
      </ScrollView>

      {/* Image Enlargement Modal */}
      <Modal
        visible={enlargedImage !== null}
        transparent={true}
        onRequestClose={() => setEnlargedImage(null)}
        animationType="fade"
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.modalOverlay}
            onPress={() => setEnlargedImage(null)}
            activeOpacity={1}
          >
            <View style={styles.modalContent}>
              {enlargedImage && (
                <Image
                  source={{ uri: enlargedImage }}
                  style={styles.enlargedImage}
                  resizeMode="contain"
                />
              )}
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setEnlargedImage(null)}
              >
                <Ionicons name="close-circle" size={40} color="white" />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loader: {
    marginTop: 50,
  },
  progressText: {
    textAlign: 'center',
    marginTop: 16,
    fontSize: 14,
  },
  errorText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginHorizontal: 12,
    marginTop: 12,
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  filterContainer: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
  },
  filterScroll: {
    flexDirection: 'row',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
  },
  filterChipText: {
    fontSize: 14,
    marginLeft: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
  },
  ruleGroup: {
    marginBottom: 24,
  },
  groupTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  ruleCard: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  ruleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  ruleHeaderLeft: {
    flex: 1,
    marginRight: 12,
  },
  ruleCode: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  ruleTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  severityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  severityBadge: {
    fontSize: 10,
    fontWeight: 'bold',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    color: '#FFFFFF',
    overflow: 'hidden',
  },
  severityMajor: {
    backgroundColor: '#FF3B30',
  },
  severityMinor: {
    backgroundColor: '#FF9500',
  },
  category: {
    fontSize: 12,
  },
  expandedContent: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128, 128, 128, 0.2)',
  },
  fullText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  imagesContainer: {
    marginVertical: 12,
  },
  ruleImage: {
    width: '100%',
    height: 200,
    marginBottom: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
    gap: 6,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
  },
  tagText: {
    fontSize: 12,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    gap: 6,
  },
  linkButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
    justifyContent: 'center',
    alignItems: 'center',
  },
  enlargedImage: {
    width: '100%',
    height: '100%',
  },
  modalCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1,
  },
});

export default GameManualQuickReference;
