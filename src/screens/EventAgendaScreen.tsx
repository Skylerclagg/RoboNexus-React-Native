/**
 * Event Agenda Screen
 *
 * Description:
 * Displays the schedule and agenda for a VEX robotics event, showing time-based
 * activities, competition phases, and important event information. Provides a
 * chronological view of event activities and milestones.
 *
 * Navigation:
 * Accessed from event detail screens when users want to view the schedule
 * and agenda for a specific VEX robotics competition.
 *
 * Key Features:
 * - Complete event schedule with time-based activity listings
 * - Competition phase breakdown and timing information
 * - Event milestone tracking and important announcements
 * - Theme-aware interface with proper time display formatting
 * - Integration with event details and related information
 * - Real-time schedule updates and notifications
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSettings } from '../contexts/SettingsContext';
import { Event } from '../types';

interface EventAgendaScreenProps {
  route: {
    params: {
      event: Event;
    };
  };
  navigation: any;
}

const EventAgendaScreen = ({ route, navigation }: EventAgendaScreenProps) => {
  const {
    buttonColor,
    backgroundColor,
    textColor,
    cardBackgroundColor,
    secondaryTextColor,
    borderColor
  } = useSettings();
  const { event } = route.params;

  const [agendaLines, setAgendaLines] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Adjustable text size
  const textSize = 17;

  useEffect(() => {
    navigation.setOptions({
      title: 'Event Agenda',
      headerStyle: {
        backgroundColor: buttonColor,
      },
      headerTintColor: '#fff',
      headerTitleAlign: 'center',
    });

    fetchAgenda();
  }, [navigation, buttonColor, event.sku]);

  // Build the URL from the event's SKU
  const getAgendaURL = (): string => {
    return `https://www.robotevents.com/robot-competitions/adc/${event.sku}.html#agenda`;
  };

  const fetchAgenda = async () => {
    const url = getAgendaURL();

    // Validate URL like Swift implementation
    if (!url || !event.sku) {
      setErrorMessage('Invalid URL.');
      setIsLoading(false);
      return;
    }

    console.log('DEBUG: Fetching agenda from URL:', url);

    try {
      setIsLoading(true);
      setErrorMessage(null);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'User-Agent': 'Mozilla/5.0 (compatible; RoboNexus Mobile App)',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const html = await response.text();

      if (!html) {
        throw new Error('Failed to load data.');
      }

      console.log('DEBUG: Full HTML length:', html.length);

      // Parse the HTML to extract agenda content
      // Since we don't have SwiftSoup in React Native, we'll use regex or simple string parsing
      const agendaContent = parseAgendaFromHTML(html);

      if (agendaContent.length > 0) {
        console.log('DEBUG: Joined agenda text:\n', agendaContent.join('\n\n'));
        setAgendaLines(agendaContent);
      } else {
        console.log('DEBUG: No agenda content found, setting fallback message');
        setAgendaLines(['No agenda found.']);
      }
    } catch (error) {
      console.error('DEBUG: Error fetching data:', error);

      // Check for common error types and provide appropriate fallbacks
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (error instanceof TypeError && (
        errorMessage.includes('Network request failed') ||
        errorMessage.includes('Failed to fetch') ||
        errorMessage.includes('CORS')
      )) {
        console.log('DEBUG: Network/CORS error detected');
        setAgendaLines([
          'Unable to load agenda directly from the website.',
          '',
          'This may be due to network restrictions in the mobile app.',
          '',
          `Please visit the event page directly at:`,
          `robotevents.com/robot-competitions/adc/${event.sku}.html`,
          '',
          'Then navigate to the Agenda tab for event details.'
        ]);
        setErrorMessage(null);
      } else if (errorMessage.includes('HTTP error! status: 404')) {
        console.log('DEBUG: 404 error - event page not found');
        setAgendaLines([
          'Event page not found.',
          '',
          'This event may not have an agenda published yet,',
          'or the event SKU may be incorrect.',
          '',
          'Please check the event details and try again later.'
        ]);
        setErrorMessage(null);
      } else {
        setErrorMessage(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const parseAgendaFromHTML = (html: string): string[] => {
    try {
      console.log('DEBUG: Parsing HTML for agenda content');

      // Use the same selector as Swift: tab[name='Agenda']
      const agendaTabPattern = /<tab[^>]*name=['"]Agenda['"][^>]*>([\s\S]*?)<\/tab>/i;
      const agendaTabMatch = html.match(agendaTabPattern);

      if (agendaTabMatch) {
        console.log('DEBUG: Found agenda tab element');
        const agendaHTML = agendaTabMatch[1]; // Get content inside the tab

        // First try to extract paragraphs (like Swift implementation)
        const paragraphs = extractParagraphs(agendaHTML);
        if (paragraphs.length > 0) {
          console.log('DEBUG: Extracted paragraphs from agenda:', paragraphs);
          return paragraphs;
        }

        const rawText = stripHtmlTags(agendaHTML);
        const lines = rawText
          .split(/\n+/)
          .map(line => line.trim())
          .filter(line => line.length > 0);

        if (lines.length > 0) {
          console.log('DEBUG: Fallback - extracted lines from raw text:', lines);
          return lines;
        }
      } else {
        console.log('DEBUG: No agenda element found with selector "tab[name=\'Agenda\']"');
      }

      // Try alternative selectors as fallback
      const alternativeSelectors = [
        /<div[^>]*class=['"][^'"]*agenda[^'"]*['"][^>]*>([\s\S]*?)<\/div>/i,
        /<section[^>]*agenda[^>]*>([\s\S]*?)<\/section>/i,
        /<div[^>]*id=['"][^'"]*agenda[^'"]*['"][^>]*>([\s\S]*?)<\/div>/i
      ];

      for (const selector of alternativeSelectors) {
        const match = html.match(selector);
        if (match) {
          console.log('DEBUG: Found agenda content with alternative selector');
          const agendaHTML = match[1];
          const paragraphs = extractParagraphs(agendaHTML);
          if (paragraphs.length > 0) {
            return paragraphs;
          }
        }
      }

      console.log('DEBUG: No agenda content found');
      return [];
    } catch (error) {
      console.error('DEBUG: Error parsing HTML:', error);
      return [];
    }
  };

  // Extract paragraphs from HTML (mimics Swift's paragraph extraction)
  const extractParagraphs = (html: string): string[] => {
    const paragraphPattern = /<p[^>]*>([\s\S]*?)<\/p>/gi;
    const paragraphs: string[] = [];
    let match;

    while ((match = paragraphPattern.exec(html)) !== null) {
      const text = stripHtmlTags(match[1]).trim();
      if (text.length > 0) {
        paragraphs.push(text);
      }
    }

    return paragraphs;
  };

  // Strip HTML tags from text
  const stripHtmlTags = (html: string): string => {
    return html.replace(/<[^>]*>/g, '');
  };

  const extractTextFromAgenda = (agendaHTML: string): string[] => {
    // This function is now deprecated in favor of the new parsing logic
    // but keeping it for backward compatibility
    let text = stripHtmlTags(agendaHTML);

    // Clean up whitespace and split into lines
    const lines = text
      .split(/\n+/)
      .map(line => line.trim())
      .filter(line => line.length > 0 && line !== 'Agenda');

    if (lines.length === 0) {
      return ['No agenda content available.'];
    }

    return lines;
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <View style={[styles.centerContainer, { backgroundColor }]}>
          <ActivityIndicator size="large" color={buttonColor} />
          <Text style={[styles.loadingText, { color: textColor }]}>Loading Agenda…</Text>
        </View>
      );
    }

    if (errorMessage) {
      return (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Error: {errorMessage}</Text>
        </View>
      );
    }

    if (agendaLines.length === 0) {
      return (
        <View style={styles.centerContainer}>
          <Text style={styles.noDataText}>No agenda available.</Text>
        </View>
      );
    }

    return (
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.agendaContainer}>
          {agendaLines.map((line, index) => (
            <Text key={index} style={[styles.agendaLine, { fontSize: textSize }]}>
              {line}
            </Text>
          ))}
        </View>
      </ScrollView>
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
    },
    centerContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    loadingText: {
      marginTop: 12,
      fontSize: 16,
      color: secondaryTextColor,
    },
    errorText: {
      fontSize: 16,
      color: '#FF4444',
      textAlign: 'center',
    },
    noDataText: {
      fontSize: 16,
      color: secondaryTextColor,
      textAlign: 'center',
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
    },
    agendaContainer: {
      backgroundColor: cardBackgroundColor,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: borderColor,
      padding: 16,
      elevation: 3,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 3.84,
    },
    agendaLine: {
      color: textColor,
      lineHeight: 24,
      marginBottom: 8,
      textAlign: 'left',
    },
  });

  return (
    <View style={[styles.container, { backgroundColor }]}>
      {renderContent()}
    </View>
  );
};

export default EventAgendaScreen; 