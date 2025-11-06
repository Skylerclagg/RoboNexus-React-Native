/**
 * Game Manual Quick Reference Component
 *
 * Displays searchable, filterable game rules with favorites support.
 * Features:
 * - Search rules by text, Rule Content, Categories
 * - Heart/unheart favorite rules
 * - Filter by category or favorites only
 * - Expandable rule cards with full text
 * - Links to official VEX pages
 */

import React, { useState, useEffect, useMemo, useImperativeHandle, forwardRef, useRef } from 'react';
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
  Animated,
  PanResponder,
  Platform,
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
  const [enlargedImage, setEnlargedImage] = useState<string | number | null>(null);
  const [ruleReferenceModal, setRuleReferenceModal] = useState<Rule | null>(null);

  // Pan responder for swipe-to-close modal (only on header)
  const modalTranslateY = useRef(new Animated.Value(0)).current;

  const headerPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to vertical swipes
        return Math.abs(gestureState.dy) > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        // Only allow downward swipes
        if (gestureState.dy > 0) {
          modalTranslateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        // Close if swiped down more than 100 pixels or velocity is high enough
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          Animated.timing(modalTranslateY, {
            toValue: 600,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            setRuleReferenceModal(null);
            modalTranslateY.setValue(0);
          });
        } else {
          // Spring back to original position
          Animated.spring(modalTranslateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

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

  // Helper function to get field diagram image based on program
  const getFieldDiagramImage = (ruleId: string) => {
    const programFilter = program.toLowerCase();

    // VEX IQ uses different diagrams for teamwork and skills
    if (programFilter.includes('iq')) {
      if (ruleId === 'field-reset-main') {
        return require('../../assets/FieldLayoutDiagrams/IQMain.png');
      } else {
        return require('../../assets/FieldLayoutDiagrams/IQSkills.png');
      }
    }

    // VEX U uses the same diagram for both main and skills field
    if (programFilter.includes('vex u') || programFilter.includes('vurc')) {
      return require('../../assets/FieldLayoutDiagrams/VURS-2.png');
    }

    // V5RC uses different diagrams for main and skills
    if (ruleId === 'field-reset-main') {
      return require('../../assets/FieldLayoutDiagrams/FO-2.png');
    } else {
      return require('../../assets/FieldLayoutDiagrams/RSC3-2.png');
    }
  };

  // Parse formatted text and render with styles
  const renderFormattedText = (text: string, highlightQuery?: string) => {
    if (!text) return null;

    const elements = [];
    let key = 0;

    // Split by tables, callouts, and images
    const combinedRegex = /\{\{TABLE\}\}([\s\S]*?)\{\{\/TABLE\}\}|\{\{CALLOUT\}\}([\s\S]*?)\{\{\/CALLOUT\}\}|\{\{IMAGE:(.*?)\}\}/g;
    let lastIndex = 0;
    let match;

    while ((match = combinedRegex.exec(text)) !== null) {
      // Render text before table/callout/image
      if (match.index > lastIndex) {
        const textBefore = text.substring(lastIndex, match.index);
        elements.push(
          <View key={`text-${key++}`}>
            {renderTextContent(textBefore, highlightQuery)}
          </View>
        );
      }

      // Check if this is a table, callout, or image
      if (match[1]) {
        // It's a table
        elements.push(renderTable(match[1], key++));
      } else if (match[2]) {
        // It's a callout
        elements.push(renderCallout(match[2], key++, highlightQuery));
      } else if (match[3]) {
        // It's an image
        const imageUrl = match[3];
        elements.push(
          <TouchableOpacity
            key={`image-${key++}`}
            onPress={() => setEnlargedImage(imageUrl)}
            style={styles.inlineImageContainer}
          >
            <Image
              source={{ uri: imageUrl }}
              style={styles.inlineImage}
              resizeMode="contain"
            />
          </TouchableOpacity>
        );
      }

      lastIndex = match.index + match[0].length;
    }

    // Render remaining text
    if (lastIndex < text.length) {
      const textAfter = text.substring(lastIndex);
      elements.push(
        <View key={`text-${key++}`}>
          {renderTextContent(textAfter, highlightQuery)}
        </View>
      );
    }

    return <View>{elements}</View>;
  };

  // Render text content with formatting markers
  const renderTextContent = (text: string, highlightQuery?: string) => {
    if (!text || !text.trim()) return null;

    // Split text into lines - keep empty lines for spacing but track them
    const lines = text.split('\n');

    // Process lines and add spacing
    const renderedLines = [];
    let consecutiveEmptyLines = 0;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];

      // Track consecutive empty lines (but don't add more than one blank space)
      if (!line.trim()) {
        consecutiveEmptyLines++;
        // Only add spacing for the first empty line in a sequence
        if (consecutiveEmptyLines === 1) {
          renderedLines.push(
            <View key={`space-${lineIdx}`} style={{ height: 8 }} />
          );
        }
        continue;
      }

      // Reset empty line counter
      consecutiveEmptyLines = 0;

      const formattedParts = parseFormattedLine(line, highlightQuery);
      // Wrap in a Text component to maintain proper text flow
      // Nested Text components with onPress will still work as long as they're direct children
      renderedLines.push(
        <Text key={`line-${lineIdx}`} style={[styles.fullText, { color: settings.textColor, marginBottom: 2 }]}>
          {formattedParts}
        </Text>
      );
    }

    return renderedLines;
  };

  // Helper function to convert rule references to clickable buttons
  const parseRuleReferences = (text: string, formatStack: string[], partKey: number, highlightQuery?: string) => {
    const parts = [];
    // Match rule references like <SC1>, <VUR11>, etc.
    const ruleRefRegex = /<([A-Z]+\d+)>/g;
    let lastIndex = 0;
    let match;
    let localKey = partKey;

    while ((match = ruleRefRegex.exec(text)) !== null) {
      // Add text before the rule reference
      if (match.index > lastIndex) {
        const textBefore = text.substring(lastIndex, match.index);
        parts.push(renderStyledText(textBefore, formatStack, null, localKey++, highlightQuery));
      }

      // Add the rule reference as a clickable button-styled text
      const ruleCode = `<${match[1]}>`;

      parts.push(
        <Text
          key={localKey++}
          style={[
            styles.ruleRefButtonText,
            {
              backgroundColor: settings.cardBackgroundColor,
              borderColor: settings.borderColor,
              color: settings.buttonColor,
            }
          ]}
          onPress={() => {
            // Find the rule and show it in a modal
            const allRules = manual?.ruleGroups.flatMap(g => g.rules) || [];
            const targetRule = allRules.find(r => r.rule === ruleCode);
            if (targetRule) {
              setRuleReferenceModal(targetRule);
            }
          }}
        >
          {ruleCode}
        </Text>
      );

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      const remaining = text.substring(lastIndex);
      parts.push(renderStyledText(remaining, formatStack, null, localKey++, highlightQuery));
    }

    return parts.length > 0 ? parts : [renderStyledText(text, formatStack, null, partKey, highlightQuery)];
  };

  // Parse a single line of formatted text
  const parseFormattedLine = (line: string, highlightQuery?: string) => {
    const parts = [];
    let currentPos = 0;
    let partKey = 0;

    // First, extract all links with their positions
    const linkRegex = /\{\{LINK:([^}]+)\}\}(.*?)\{\{\/LINK\}\}/g;
    const links: Array<{ start: number; end: number; url: string; text: string }> = [];

    let linkMatch;
    while ((linkMatch = linkRegex.exec(line)) !== null) {
      links.push({
        start: linkMatch.index,
        end: linkMatch.index + linkMatch[0].length,
        url: linkMatch[1],
        text: linkMatch[2],
      });
    }

    // Process line, handling links separately
    const formatStack: string[] = [];
    const markerRegex = /\{\{(BOLD|ITALIC|RED|SMALL|\/BOLD|\/ITALIC|\/RED|\/SMALL|RED_ITALIC|RED_BOLD|ITALIC_BOLD|RED_ITALIC_BOLD|\/RED_ITALIC|\/RED_BOLD|\/ITALIC_BOLD|\/RED_ITALIC_BOLD)\}\}/g;

    let linkIndex = 0;

    while (currentPos < line.length) {
      // Check if we're at a link
      if (linkIndex < links.length && currentPos === links[linkIndex].start) {
        const link = links[linkIndex];

        // Render link as button
        parts.push(
          <Text
            key={partKey++}
            style={[
              styles.ruleRefButtonText,
              {
                backgroundColor: settings.cardBackgroundColor,
                borderColor: settings.borderColor,
                color: settings.buttonColor,
              }
            ]}
            onPress={() => {
              const url = link.url.startsWith('http') ? link.url : `https://www.robotevents.com${link.url}`;
              Linking.openURL(url);
            }}
          >
            {link.text}
          </Text>
        );

        currentPos = link.end;
        linkIndex++;
        continue;
      }

      // Find next marker or link
      markerRegex.lastIndex = currentPos;
      const nextMarker = markerRegex.exec(line);
      const nextLinkPos = linkIndex < links.length ? links[linkIndex].start : line.length;
      const nextPos = nextMarker && nextMarker.index < nextLinkPos ? nextMarker.index : nextLinkPos;

      // Add text before next special position
      if (nextPos > currentPos) {
        const textContent = line.substring(currentPos, nextPos);
        const parsedParts = parseRuleReferences(textContent, formatStack, partKey, highlightQuery);
        parts.push(...parsedParts);
        partKey += parsedParts.length;
      }

      // Handle marker if found
      if (nextMarker && nextMarker.index === nextPos) {
        const marker = nextMarker[1];
        if (marker.startsWith('/')) {
          formatStack.pop();
        } else {
          formatStack.push(marker);
        }
        currentPos = nextMarker.index + nextMarker[0].length;
      } else {
        currentPos = nextPos;
      }
    }

    return parts;
  };

  // Render text with accumulated styles
  const renderStyledText = (text: string, formatStack: string[], linkUrl: string | null, key: number, highlightQuery?: string) => {
    if (!text) return null;

    const style: any = { color: settings.textColor };

    // Apply formatting from stack
    for (const format of formatStack) {
      if (format.includes('RED')) style.color = '#FF0000';
      if (format.includes('BOLD')) style.fontWeight = 'bold';
      if (format.includes('ITALIC')) style.fontStyle = 'italic';
      if (format === 'SMALL') style.fontSize = 11;
    }

    // Handle links - render as button-styled text
    if (linkUrl) {
      return (
        <Text
          key={key}
          style={[
            styles.ruleRefButtonText,
            {
              backgroundColor: settings.cardBackgroundColor,
              borderColor: settings.borderColor,
              color: settings.buttonColor,
            }
          ]}
          onPress={() => {
            const url = linkUrl.startsWith('http') ? linkUrl : `https://www.robotevents.com${linkUrl}`;
            Linking.openURL(url);
          }}
        >
          {text}
        </Text>
      );
    }

    // Handle highlighting if query is provided
    if (highlightQuery && highlightQuery.trim()) {
      const query = highlightQuery.toLowerCase();
      const lowerText = text.toLowerCase();
      const index = lowerText.indexOf(query);

      if (index !== -1) {
        // Split text into before, match, and after
        const before = text.substring(0, index);
        const match = text.substring(index, index + query.length);
        const after = text.substring(index + query.length);

        return (
          <Text key={key} style={style}>
            {before}
            <Text style={[style, styles.highlightedText, { backgroundColor: settings.buttonColor, color: '#FFFFFF' }]}>
              {match}
            </Text>
            {after}
          </Text>
        );
      }
    }

    return (
      <Text key={key} style={style}>
        {text}
      </Text>
    );
  };


  // Helper function to strip formatting markers from text
  const stripFormatting = (text: string): string => {
    return text.replace(/\{\{[^}]+\}\}/g, '');
  };

  // Render a callout box (grey info box)
  const renderCallout = (calloutText: string, key: number, highlightQuery?: string) => {
    return (
      <View key={`callout-${key}`} style={[styles.calloutContainer, {
        backgroundColor: settings.colorScheme === 'dark' ? 'rgba(200, 200, 200, 0.15)' : 'rgba(206, 206, 206, 0.3)',
        borderColor: settings.borderColor
      }]}>
        <Text style={[styles.calloutText, { color: settings.textColor, fontStyle: 'italic' }]}>
          {renderTextContent(calloutText, highlightQuery)}
        </Text>
      </View>
    );
  };

  // Render a table from formatted table text
  const renderTable = (tableText: string, key: number) => {
    const lines = tableText.trim().split('\n');
    const rows = [];
    let headerRow: string[] | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Skip empty lines
      if (!line) continue;

      // Skip separator lines (lines with only dashes, pipes, and plus signs)
      if (/^[-+| ]+$/.test(line)) {
        continue;
      }

      // Split by pipe and trim each cell, then strip formatting markers
      const cells = line.split('|')
        .map(cell => stripFormatting(cell.trim()))
        .filter(cell => cell.length > 0);

      if (cells.length > 0) {
        if (!headerRow) {
          // First row is header
          headerRow = cells;
        } else {
          rows.push(cells);
        }
      }
    }

    // If no header or rows parsed, return null
    if (!headerRow || rows.length === 0) {
      return null;
    }

    return (
      <View key={`table-${key}`} style={[styles.tableContainer, { borderColor: settings.borderColor }]}>
        {/* Header Row */}
        <View style={[styles.tableRow, { borderBottomColor: settings.borderColor }]}>
          {headerRow.map((cell, idx) => (
            <View
              key={`header-${idx}`}
              style={[
                styles.tableCell,
                styles.tableHeaderCell,
                {
                  borderRightColor: settings.borderColor,
                  backgroundColor: settings.buttonColor
                },
                idx === headerRow.length - 1 && { borderRightWidth: 0 }
              ]}
            >
              <Text style={[styles.tableCellText, styles.tableHeaderText, { color: '#FFFFFF' }]}>
                {cell}
              </Text>
            </View>
          ))}
        </View>
        {/* Data Rows */}
        {rows.map((row, rowIdx) => (
          <View
            key={`row-${rowIdx}`}
            style={[
              styles.tableRow,
              { borderBottomColor: settings.borderColor },
              rowIdx === rows.length - 1 && { borderBottomWidth: 0 }
            ]}
          >
            {row.map((cell, cellIdx) => (
              <View
                key={`cell-${rowIdx}-${cellIdx}`}
                style={[
                  styles.tableCell,
                  { borderRightColor: settings.borderColor },
                  cellIdx === row.length - 1 && { borderRightWidth: 0 }
                ]}
              >
                <Text style={[styles.tableCellText, { color: settings.textColor }]}>
                  {cell}
                </Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    );
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

    // Filter by search query with prioritization
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();

      // Helper to strip formatting markers for search
      const stripMarkersForSearch = (text: string | undefined): string => {
        if (!text) return '';
        return text.replace(/\{\{[^}]+\}\}/g, '').toLowerCase();
      };

      // Filter rules and add priority score
      const rulesWithPriority: Array<{ rule: Rule; group: RuleGroup; priority: number }> = [];

      groups.forEach(group => {
        group.rules.forEach(rule => {
          let priority = 0;

          // Priority 1: Rule number match (highest priority)
          if (rule.rule.toLowerCase().includes(query)) {
            priority = 4;
          }
          // Priority 2: Title match
          else if (rule.title.toLowerCase().includes(query)) {
            priority = 3;
          }
          // Priority 3: Category match
          else if (rule.category.toLowerCase().includes(query)) {
            priority = 2;
          }
          // Priority 4: Full text or description match (lowest priority)
          else {
            const descriptionText = stripMarkersForSearch(rule.description);
            const fullTextStripped = stripMarkersForSearch(rule.fullText);
            const completeTextStripped = stripMarkersForSearch(rule.completeText);

            if (
              descriptionText.includes(query) ||
              fullTextStripped.includes(query) ||
              completeTextStripped.includes(query)
            ) {
              priority = 1;
            }
          }

          // If there's any match, add it
          if (priority > 0) {
            rulesWithPriority.push({ rule, group, priority });
          }
        });
      });

      // Sort by priority (highest first)
      rulesWithPriority.sort((a, b) => b.priority - a.priority);

      // Reconstruct groups maintaining priority order
      const groupMap = new Map<string, Rule[]>();
      rulesWithPriority.forEach(({ rule, group }) => {
        if (!groupMap.has(group.name)) {
          groupMap.set(group.name, []);
        }
        groupMap.get(group.name)!.push(rule);
      });

      // Build final groups array
      groups = Array.from(groupMap.entries()).map(([name, rules]) => {
        const originalGroup = groups.find(g => g.name === name)!;
        return { ...originalGroup, rules };
      });
    }

    // Add Field Reset group at the beginning (all programs except VAIRC)
    // VAIRC is excluded because we don't have field diagrams for it yet
    if (manual && !programFilter.includes('ai')) {
      // Determine field names based on program
      const isIQ = programFilter.includes('iq');
      const isVexU = programFilter.includes('vex u') || programFilter.includes('vurc');
      const mainFieldName = isIQ ? 'Teamwork Field' : 'Main Field';
      const mainFieldDescription = isIQ ? 'Teamwork Field Reset Diagram' : 'Main Field Reset Diagram';

      // VEX U uses the same diagram for both, so only show one
      const rules = isVexU ? [
        {
          id: 'field-reset-vexu',
          rule: 'Field Reset',
          title: 'Field Reset Diagram',
          description: 'Field Reset Diagram (same for Main and Skills)',
          category: 'Field Reset',
          vexLink: '',
          fullText: '',
          completeText: '',
        },
      ] : [
        {
          id: 'field-reset-main',
          rule: mainFieldName,
          title: 'Field Reset Diagram',
          description: mainFieldDescription,
          category: 'Field Reset',
          vexLink: '',
          fullText: '',
          completeText: '',
        },
        {
          id: 'field-reset-skills',
          rule: 'Skills Field',
          title: 'Field Reset Diagram',
          description: 'Skills Field Reset Diagram',
          category: 'Field Reset',
          vexLink: '',
          fullText: '',
          completeText: '',
        },
      ];

      const fieldResetGroup: RuleGroup = {
        name: 'Field Reset',
        programs: [program],
        rules,
      };

      // Insert at the beginning
      groups.unshift(fieldResetGroup);
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

    const groups = manual.ruleGroups
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

    // Add Field Reset at the beginning (all programs except AI)
    if (!programFilter.includes('ai')) {
      groups.unshift('Field Reset');
    }

    return groups;
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
      {/* Search Bar with Q&A Link */}
      <View style={styles.searchRow}>
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

        {/* Q&A Link Button */}
        {manual?.qnaUrl && (
          <TouchableOpacity
            style={[styles.qnaButton, { backgroundColor: settings.buttonColor }]}
            onPress={() => manual.qnaUrl && openVexLink(manual.qnaUrl)}
          >
            <Ionicons name="help-circle" size={20} color="#FFFFFF" />
            <Text style={styles.qnaButtonText}>Q&A</Text>
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
              name={showFavoritesOnly ? "heart" : "heart-outline"}
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
              .replace('VUT Rules', 'VURC Tournament')
              .replace('VURS Rules', 'VURC Robot Skills')
              .replace('VAISC Rules', 'VAIRC Scoring')
              .replace('VAIG Rules', 'VAIRC Game')
              .replace('VAIRS Rules', 'VAIRC Robot Skills')
              .replace('VAIT Rules', 'VAIRC Tournament')
              .replace('VAIRM Rules', 'VAIRC Robot');

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
                          name={isFavorited ? "heart" : "heart-outline"}
                          size={24}
                          color={isFavorited ? "#FF6B6B" : settings.iconColor}
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
                        {/* Check if this is a field diagram */}
                        {rule.id.startsWith('field-reset') ? (
                          <TouchableOpacity
                            onPress={() => setEnlargedImage(getFieldDiagramImage(rule.id))}
                            activeOpacity={0.8}
                          >
                            <Image
                              source={getFieldDiagramImage(rule.id)}
                              style={styles.fieldDiagramPreview}
                              resizeMode="contain"
                            />
                            <Text style={[styles.fieldDiagramHint, { color: settings.secondaryTextColor }]}>
                              Tap image to view full screen
                            </Text>
                          </TouchableOpacity>
                        ) : (
                          <>
                            {/* Display complete text with formatting, or fallback to description */}
                            {(rule.completeText || rule.fullText || rule.description) && (
                              renderFormattedText(rule.completeText || rule.fullText || rule.description, searchQuery)
                            )}

                            {/* Optional: Still show link but make it secondary */}
                            {rule.vexLink && (
                              <TouchableOpacity
                                style={[styles.linkButton, { backgroundColor: 'transparent', borderWidth: 1, borderColor: settings.buttonColor, marginTop: 16 }]}
                                onPress={() => openVexLink(rule.vexLink!)}
                              >
                                <Text style={[styles.linkButtonText, { color: settings.buttonColor }]}>View on VEX Website</Text>
                                <Ionicons name="open-outline" size={16} color={settings.buttonColor} />
                              </TouchableOpacity>
                            )}
                          </>
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

      {/* Image Enlargement Modal with Pinch-to-Zoom (iOS/Android) or Click-to-Close (Web) */}
      <Modal
        visible={enlargedImage !== null}
        transparent={true}
        onRequestClose={() => setEnlargedImage(null)}
        animationType="fade"
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.modalCloseButton}
            onPress={() => setEnlargedImage(null)}
          >
            <Ionicons name="close-circle" size={40} color="white" />
          </TouchableOpacity>
          {Platform.OS === 'web' ? (
            // Web version: Simple scrollable view with larger image
            <ScrollView
              contentContainerStyle={styles.modalScrollContent}
              showsHorizontalScrollIndicator={true}
              showsVerticalScrollIndicator={true}
              style={{ flex: 1 }}
            >
              <TouchableOpacity
                activeOpacity={1}
                onPress={() => setEnlargedImage(null)}
                style={styles.webImageContainer}
              >
                {enlargedImage && (
                  <Image
                    source={typeof enlargedImage === 'number' ? enlargedImage : { uri: enlargedImage }}
                    style={styles.enlargedImageWeb}
                    resizeMode="contain"
                  />
                )}
              </TouchableOpacity>
            </ScrollView>
          ) : (
            // iOS/Android version: Pinch-to-zoom ScrollView
            <ScrollView
              contentContainerStyle={styles.modalScrollContent}
              maximumZoomScale={3}
              minimumZoomScale={1}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
            >
              {enlargedImage && (
                <Image
                  source={typeof enlargedImage === 'number' ? enlargedImage : { uri: enlargedImage }}
                  style={styles.enlargedImage}
                  resizeMode="contain"
                />
              )}
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* Rule Reference Modal */}
      <Modal
        visible={ruleReferenceModal !== null}
        transparent={true}
        onRequestClose={() => setRuleReferenceModal(null)}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <Animated.View
          style={[
            styles.ruleRefModalContainer,
            {
              backgroundColor: settings.cardBackgroundColor,
              transform: [{ translateY: modalTranslateY }]
            }
          ]}
        >
          <View
            style={[styles.ruleRefModalHeader, { borderBottomColor: settings.borderColor }]}
            {...headerPanResponder.panHandlers}
          >
            <View style={styles.ruleRefModalDragIndicator} />
            <View style={styles.ruleRefModalHeaderContent}>
              <Text style={[styles.ruleRefModalTitle, { color: settings.buttonColor }]}>
                {ruleReferenceModal?.rule}
              </Text>
              <Text style={[styles.ruleRefModalSubtitle, { color: settings.textColor }]}>
                {ruleReferenceModal?.title}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setRuleReferenceModal(null)}
              style={styles.ruleRefModalClose}
            >
              <Ionicons name="close" size={28} color={settings.textColor} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.ruleRefModalContent} contentContainerStyle={styles.ruleRefModalContentContainer}>
            {ruleReferenceModal && (
              <>
                {ruleReferenceModal.category && (
                  <Text style={[styles.ruleRefModalCategory, { color: settings.secondaryTextColor }]}>
                    {getCategoryDisplayName(ruleReferenceModal.category)}
                  </Text>
                )}
                <View style={styles.ruleRefModalBody}>
                  {(ruleReferenceModal.completeText || ruleReferenceModal.fullText || ruleReferenceModal.description) && (
                    renderFormattedText(ruleReferenceModal.completeText || ruleReferenceModal.fullText || ruleReferenceModal.description, searchQuery)
                  )}
                </View>
              </>
            )}
          </ScrollView>
        </Animated.View>
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
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  qnaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  qnaButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
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
  inlineImageContainer: {
    marginVertical: 8,
    alignItems: 'center',
  },
  inlineImage: {
    width: '100%',
    height: 200,
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
  enlargedImageWeb: {
    width: '100%',
    maxWidth: 1200,
    height: 'auto',
    minHeight: 400,
    aspectRatio: 1,
  },
  webImageContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    cursor: Platform.OS === 'web' ? 'pointer' : undefined,
  },
  modalCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1,
    cursor: Platform.OS === 'web' ? 'pointer' : undefined,
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Table styles
  tableContainer: {
    marginVertical: 8,
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tableCell: {
    flex: 1,
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    minHeight: 40,
  },
  tableHeaderCell: {
    // backgroundColor applied dynamically
  },
  tableCellText: {
    fontSize: 11,
    textAlign: 'center',
  },
  tableHeaderText: {
    fontWeight: 'bold',
    fontSize: 11,
    textAlign: 'center',
  },
  linkText: {
    textDecorationLine: 'underline',
    // Color will be set dynamically based on theme
  },
  // Rule reference button styles
  ruleRefButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1.5,
    marginHorizontal: 2,
    alignSelf: 'flex-start',
  },
  ruleRefButtonText: {
    fontWeight: '600',
    fontSize: 13,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 1.5,
    overflow: 'hidden',
    textDecorationLine: 'none',
  },
  highlightedText: {
    fontWeight: '600',
    // backgroundColor and color set dynamically based on theme
  },
  // Rule reference modal styles
  ruleRefModalContainer: {
    flex: 1,
    marginTop: 60,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 5,
  },
  ruleRefModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    borderBottomWidth: 1,
  },
  ruleRefModalDragIndicator: {
    position: 'absolute',
    top: 8,
    left: '50%',
    marginLeft: -20,
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(128, 128, 128, 0.3)',
  },
  ruleRefModalHeaderContent: {
    flex: 1,
    marginRight: 10,
  },
  ruleRefModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  ruleRefModalSubtitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  ruleRefModalClose: {
    padding: 4,
  },
  ruleRefModalContent: {
    flex: 1,
  },
  ruleRefModalContentContainer: {
    padding: 20,
  },
  ruleRefModalCategory: {
    fontSize: 12,
    marginBottom: 12,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  ruleRefModalBody: {
    marginBottom: 20,
  },
  // Callout box styles (grey info boxes)
  calloutContainer: {
    borderRadius: 12,
    padding: 12,
    marginVertical: 8,
    borderWidth: 1,
  },
  calloutText: {
    fontSize: 14,
    lineHeight: 20,
  },
  // Field Reset Diagram styles
  fieldDiagramPreview: {
    width: '100%',
    height: 250,
    marginVertical: 8,
  },
  fieldDiagramHint: {
    fontSize: 13,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 4,
  },
});

export default GameManualQuickReference;
