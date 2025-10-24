/**
 * Event Information Screen
 *
 * Description:
 * Displays comprehensive information about a VEX robotics event including location,
 * dates, contact information, and event details. Features interactive elements
 * for contacting organizers, viewing locations, and accessing event resources.
 *
 * Navigation:
 * Accessed from event detail screens or event listings when users want detailed
 * information about a specific VEX robotics competition.
 *
 * Key Features:
 * - Complete event details including dates, location, and organizer information
 * - Interactive contact options with email and phone integration
 * - Address and location information with mapping capabilities
 * - Event ID and registration information display
 * - Copy-to-clipboard functionality for contact details
 * - Integration with external apps for navigation and communication
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../contexts/SettingsContext';
import { robotEventsAPI } from '../services/apiRouter';
import { Event } from '../types';
import { clipboard } from '../utils/webCompatibility';

interface EventInformationScreenProps {
  route: {
    params: {
      event: Event;
    };
  };
  navigation: any;
}

interface InfoItem {
  id: string;
  label: string;
  value: string;
  onPress?: () => void;
  isMenu?: boolean;
  menuItems?: string[];
}

const EventInformationScreen = ({ route, navigation }: EventInformationScreenProps) => {
  const { selectedProgram, colorScheme, ...settings } = useSettings();
  const { event } = route.params;
  const [livestreamLink, setLivestreamLink] = useState<string>('');
  const [teamCount, setTeamCount] = useState<number>(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    navigation.setOptions({
      title: 'Event Info',
      headerStyle: {
        backgroundColor: settings.buttonColor,
      },
      headerTintColor: '#fff',
      headerTitleAlign: 'center',
      headerRight: () => (
        <View style={styles.headerButtons}>
          <TouchableOpacity
            onPress={openEventPage}
            style={styles.headerButton}
          >
            <Ionicons name="link" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={addToCalendar}
            style={styles.headerButton}
          >
            <Ionicons name="calendar" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      ),
    });

    fetchEventData();
  }, [navigation, settings.buttonColor]);

  const fetchEventData = async () => {
    try {
      setRefreshing(true);

      // Fetch team count from API
      const teams = await robotEventsAPI.getEventTeams(event.id);
      setTeamCount(teams.data.length);

      // Fetch webcast link using the same approach as Swift version
      await fetchLivestreamLink();
    } catch (error) {
      console.error('Failed to fetch event data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const fetchLivestreamLink = async () => {
    try {
      console.log(`Starting webcast detection for event: ${event.sku} (${event.name})`);
      console.log(`Selected program: ${selectedProgram}`);

      // Determine the correct URL based on the selected program
      const programUrls = {
        'VEX V5 Robotics Competition': 'https://www.robotevents.com/robot-competitions/vex-robotics-competition/',
        'VEX IQ Robotics Competition': 'https://www.robotevents.com/robot-competitions/vex-iq-challenge/',
        'VEX U Robotics Competition': 'https://www.robotevents.com/robot-competitions/college-competition/',
        'VEX AI Robotics Competition': 'https://www.robotevents.com/robot-competitions/vex-ai-competition/',
        'Aerial Drone Competition': 'https://www.robotevents.com/robot-competitions/adc/',
      };

      const baseUrl = programUrls[selectedProgram as keyof typeof programUrls] ||
                     programUrls['VEX V5 Robotics Competition'];
      const eventPageUrl = `${baseUrl}${event.sku}.html`;

      console.log(`Fetching event page: ${eventPageUrl}`);

      // Fetch the HTML content of the event page with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(eventPageUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
        }
      });
      clearTimeout(timeoutId);

      console.log(`Response status: ${response.status}`);

      if (!response.ok) {
        console.error(`Failed to fetch event page: ${response.status} ${response.statusText}`);
        setLivestreamLink('');
        return;
      }

      const html = await response.text();
      console.log(`HTML length: ${html.length} characters`);

      // Check if "Webcast" appears more than 3 times (same logic as Swift version)
      const webcastMatches = (html.match(/Webcast/gi) || []).length; // Case insensitive
      console.log(`Webcast mentions found: ${webcastMatches} for event ${event.sku}`);

      // Also check for other common streaming terms
      const streamingTerms = ['livestream', 'live stream', 'webcast', 'live broadcast', 'stream'];
      const allStreamingMatches = streamingTerms.reduce((total, term) => {
        const matches = (html.match(new RegExp(term, 'gi')) || []).length;
        console.log(`"${term}" mentions: ${matches}`);
        return total + matches;
      }, 0);

      console.log(`Total streaming term mentions: ${allStreamingMatches}`);

      if (webcastMatches >= 3 || allStreamingMatches >= 3) {
        console.log('Webcast detected! Attempting to find actual stream URL...');

        // First try to extract URL from the event page itself
        let actualWebcastUrl = extractWebcastUrl(html);

        if (!actualWebcastUrl) {
          console.log('No direct URL found on event page, checking robotevents.com webcast page...');
          actualWebcastUrl = await findEventOnWebcastPage();
        }

        if (actualWebcastUrl) {
          console.log('✅ Found actual webcast URL:', actualWebcastUrl);
          setLivestreamLink(actualWebcastUrl);
        } else {
          const webcastUrl = `${eventPageUrl}#webcast`;
          console.log('⚠️ Using fallback webcast URL:', webcastUrl);
          setLivestreamLink(webcastUrl);
        }
      } else {
        console.log('❌ No webcast detected');
        setLivestreamLink(''); // No webcast available
      }
    } catch (error) {
      console.error('❌ Failed to fetch webcast link:', error);

      // As a last resort, try the fallback URL anyway for testing
      const programUrls = {
        'VEX V5 Robotics Competition': 'https://www.robotevents.com/robot-competitions/vex-robotics-competition/',
        'VEX IQ Robotics Competition': 'https://www.robotevents.com/robot-competitions/vex-iq-challenge/',
        'VEX U Robotics Competition': 'https://www.robotevents.com/robot-competitions/college-competition/',
        'VEX AI Robotics Competition': 'https://www.robotevents.com/robot-competitions/vex-ai-competition/',
        'Aerial Drone Competition': 'https://www.robotevents.com/robot-competitions/adc/',
      };
      const baseUrl = programUrls[selectedProgram as keyof typeof programUrls] ||
                     programUrls['VEX V5 Robotics Competition'];
      const fallbackUrl = `${baseUrl}${event.sku}.html#webcast`;

      console.log('🔄 Setting fallback URL due to error:', fallbackUrl);
      setLivestreamLink(fallbackUrl);
    }
  };

  const findEventOnWebcastPage = async (): Promise<string | null> => {
    try {
      console.log(`Searching for event "${event.name}" on robotevents.com webcast page...`);

      // Check the main robotevents webcast page
      const webcastPageUrl = 'https://www.robotevents.com/webcasts';

      const response = await fetch(webcastPageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
        }
      });

      if (!response.ok) {
        console.log(`Webcast page fetch failed: ${response.status}`);
        return null;
      }

      const webcastHtml = await response.text();
      console.log(`Webcast page HTML length: ${webcastHtml.length} characters`);

      // Try to find the event by name or SKU
      const eventNameNormalized = event.name.toLowerCase().replace(/[^\w\s]/g, '').trim();
      const eventSkuNormalized = event.sku.toLowerCase();

      console.log(`Searching for event name: "${eventNameNormalized}" or SKU: "${eventSkuNormalized}"`);

      // Look for the event name in the HTML first
      const eventNameInPage = webcastHtml.toLowerCase().includes(eventNameNormalized.substring(0, Math.min(eventNameNormalized.length, 20)));
      const eventSkuInPage = webcastHtml.toLowerCase().includes(eventSkuNormalized);

      console.log(`Event name found in page: ${eventNameInPage}`);
      console.log(`Event SKU found in page: ${eventSkuInPage}`);

      if (eventNameInPage || eventSkuInPage) {
        console.log('Event found on webcast page! Looking for stream links...');

        // Look for patterns specific to the webcasts page format
        const eventPatterns = [
          // Look for the event name in a webcast card/section with stream links
          new RegExp(`<[^>]*(?:class|id)="[^"]*(?:webcast|stream|live)[^"]*"[^>]*>.*?${eventNameNormalized.replace(/\s+/g, '.*?')}.*?(?:href=["']([^"']*(?:youtube|twitch|vimeo|livestream)[^"']*)["']|src=["']([^"']*(?:youtube|twitch|vimeo|livestream)[^"']*)["'])`, 'is'),
          // Look for the event SKU in a webcast section
          new RegExp(`<[^>]*(?:class|id)="[^"]*(?:webcast|stream|live)[^"]*"[^>]*>.*?${eventSkuNormalized}.*?(?:href=["']([^"']*(?:youtube|twitch|vimeo|livestream)[^"']*)["']|src=["']([^"']*(?:youtube|twitch|vimeo|livestream)[^"']*)["'])`, 'is'),
          // Look for event name followed by streaming patterns (within reasonable distance)
          new RegExp(`${eventNameNormalized.replace(/\s+/g, '.*?')}(?:[\\s\\S]{0,500}?)(?:href=["']([^"']*(?:youtube|twitch|vimeo|livestream)[^"']*)["']|src=["']([^"']*(?:youtube|twitch|vimeo|livestream)[^"']*)["'])`, 'i'),
          // Look for event SKU followed by streaming patterns
          new RegExp(`${eventSkuNormalized}(?:[\\s\\S]{0,500}?)(?:href=["']([^"']*(?:youtube|twitch|vimeo|livestream)[^"']*)["']|src=["']([^"']*(?:youtube|twitch|vimeo|livestream)[^"']*)["'])`, 'i'),
          // Reverse pattern - look for stream links followed by event name/SKU
          new RegExp(`(?:href=["']([^"']*(?:youtube|twitch|vimeo|livestream)[^"']*)["']|src=["']([^"']*(?:youtube|twitch|vimeo|livestream)[^"']*)["'])(?:[\\s\\S]{0,500}?)${eventNameNormalized.replace(/\s+/g, '.*?')}`, 'i'),
          new RegExp(`(?:href=["']([^"']*(?:youtube|twitch|vimeo|livestream)[^"']*)["']|src=["']([^"']*(?:youtube|twitch|vimeo|livestream)[^"']*)["'])(?:[\\s\\S]{0,500}?)${eventSkuNormalized}`, 'i'),
        ];

        for (const pattern of eventPatterns) {
          const match = webcastHtml.match(pattern);
          if (match) {
            const streamUrl = match[1] || match[2];
            if (streamUrl) {
              console.log(`Found stream URL for event: ${streamUrl}`);
              return normalizeStreamUrl(streamUrl);
            }
          }
        }

        // Try to find any livestream links and check if they're related to our event
        const allStreamLinks = webcastHtml.match(/(?:href|src)=["']([^"']*(?:youtube|twitch|vimeo|stream|live)[^"']*)["']/gi) || [];
        console.log(`Found ${allStreamLinks.length} potential stream links on webcast page`);

        // Check each link to see if it might be related to our event
        for (const linkMatch of allStreamLinks) {
          const urlMatch = linkMatch.match(/(?:href|src)=["']([^"']*)["']/i);
          if (urlMatch) {
            const url = urlMatch[1];
            // Check if the URL or surrounding context might relate to our event
            if (url.includes(eventSkuNormalized) ||
                webcastHtml.toLowerCase().includes(`${eventNameNormalized.substring(0, 10)}`) &&
                webcastHtml.indexOf(linkMatch) > -1) {
              console.log(`Found potential match: ${url}`);
              return normalizeStreamUrl(url);
            }
          }
        }
      } else {
        console.log('Event not found on webcast page, looking for any current live streams...');
      }

      const liveStreamPattern = /(?:href|src)=["']([^"']*(?:youtube\.com\/watch\?v=|twitch\.tv\/|vimeo\.com\/)[^"']*)["']/gi;
      const liveStreams = webcastHtml.match(liveStreamPattern);

      if (liveStreams && liveStreams.length > 0) {
        // Take the first live stream as a potential match
        const firstStreamMatch = liveStreams[0].match(/(?:href|src)=["']([^"']*)["']/i);
        if (firstStreamMatch) {
          console.log(`Using first available live stream: ${firstStreamMatch[1]}`);
          return normalizeStreamUrl(firstStreamMatch[1]);
        }
      }

      console.log('No matching stream found on webcast page');
      return null;

    } catch (error) {
      console.error('Error searching webcast page:', error);
      return null;
    }
  };

  const normalizeStreamUrl = (url: string): string => {
    // Handle relative URLs
    if (url.startsWith('//')) {
      return `https:${url}`;
    } else if (url.startsWith('/')) {
      return `https://www.robotevents.com${url}`;
    }

    // Ensure URL starts with https
    if (!url.startsWith('http')) {
      return `https://${url}`;
    }

    return url;
  };

  const extractWebcastUrl = (html: string): string | null => {
    console.log('Extracting webcast URL from event page HTML...');

    // Try multiple patterns to find ACTUAL streaming URLs (not generic robotevents pages)
    const patterns = [
      // YouTube embeds and links
      /(?:youtube\.com\/embed\/|youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/i,
      // Twitch embeds and links
      /(?:twitch\.tv\/embed\/|twitch\.tv\/)([a-zA-Z0-9_-]+)/i,
      // Vimeo embeds and links
      /(?:vimeo\.com\/video\/|vimeo\.com\/)([0-9]+)/i,
      // Generic iframe src for external streams (not robotevents.com)
      /<iframe[^>]+src=["']([^"']*(?:youtube|twitch|vimeo|livestream|ustream)[^"']*)["']/i,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) {
        let url = match[1] || match[0];

        // Handle YouTube URLs
        if (match[0].includes('youtube') || match[0].includes('youtu.be')) {
          const videoId = match[1];
          if (videoId && videoId.length === 11) {
            console.log(`Found YouTube video ID: ${videoId}`);
            return `https://www.youtube.com/watch?v=${videoId}`;
          }
        }

        // Handle Twitch URLs
        if (match[0].includes('twitch.tv')) {
          const channel = match[1];
          if (channel) {
            console.log(`Found Twitch channel: ${channel}`);
            return `https://www.twitch.tv/${channel}`;
          }
        }

        // Handle Vimeo URLs
        if (match[0].includes('vimeo.com')) {
          const videoId = match[1];
          if (videoId) {
            console.log(`Found Vimeo video ID: ${videoId}`);
            return `https://vimeo.com/${videoId}`;
          }
        }

        if (url.startsWith('http') && !url.includes('robotevents.com')) {
          console.log(`Found external stream URL: ${url}`);
          return url;
        } else if (url.startsWith('//') && !url.includes('robotevents.com')) {
          console.log(`Found external stream URL (protocol relative): ${url}`);
          return `https:${url}`;
        }
      }
    }

    console.log('No direct streaming URLs found on event page');
    return null;
  };

  const onRefresh = () => {
    fetchEventData();
  };

  const openEventPage = () => {
    const programUrls = {
      'VEX V5 Robotics Competition': 'https://www.robotevents.com/robot-competitions/vex-robotics-competition/',
      'VEX IQ Robotics Competition': 'https://www.robotevents.com/robot-competitions/vex-iq-challenge/',
      'VEX U Robotics Competition': 'https://www.robotevents.com/robot-competitions/college-competition/',
      'VEX AI Robotics Competition': 'https://www.robotevents.com/robot-competitions/vex-ai-competition/',
      'Aerial Drone Competition': 'https://www.robotevents.com/robot-competitions/adc/',
    };

    const baseUrl = programUrls[selectedProgram as keyof typeof programUrls] ||
                   programUrls['Aerial Drone Competition'];
    const url = `${baseUrl}${event.sku}.html`;

    Linking.openURL(url);
  };

  const addToCalendar = () => {
    // This would add event to calendar
    Alert.alert('Added to calendar', 'Event has been added to your calendar.', [
      { text: 'OK' }
    ]);
  };

  const formatFullAddress = () => {
    const location = event.location;
    if (!location) return 'Address not available';

    const addressParts = [];

    if (location.venue) addressParts.push(location.venue);
    if (location.address_1) addressParts.push(location.address_1);
    if (location.address_2) addressParts.push(location.address_2);
    if (location.city) addressParts.push(location.city);
    if (location.region) addressParts.push(location.region);
    if (location.postcode) addressParts.push(location.postcode);
    if (location.country) addressParts.push(location.country);

    return addressParts.length > 0 ? addressParts.join(', ') : 'Address not available';
  };

  const copyToClipboard = async (text: string, label: string = 'Text') => {
    console.log(`Attempting to copy ${label.toLowerCase()}:`, text);

    try {
      const success = await clipboard.setString(text);
      console.log('Clipboard operation result:', success);

      if (success) {
        Alert.alert('Copied', `${label} copied to clipboard`);
      } else {
        Alert.alert(
          'Copy Failed',
          'Unable to copy to clipboard. Please check browser console for details.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error(`Failed to copy ${label.toLowerCase()}:`, error);
      Alert.alert(
        'Copy Error',
        'An error occurred while copying. Please check browser console for details.',
        [{ text: 'OK' }]
      );
    }
  };

  const copyAddress = () => copyToClipboard(formatFullAddress(), 'Address');

  const openLivestream = () => {
    if (livestreamLink) {
      Linking.openURL(livestreamLink);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatSeason = () => {
    // Use the actual season name from the event object, similar to Swift version
    return event.season?.name || 'Unknown Season';
  };

  const getEventRegion = () => {
    const state = event.location?.region?.trim() || '';
    const formattedState = state.charAt(0).toUpperCase() + state.slice(1).toLowerCase();

    // This would use StateRegionMapping logic from Swift
    const regionMapping: { [key: string]: string } = {
      'California': 'West',
      'Texas': 'South Central',
      'Florida': 'Southeast',
      'New York': 'Northeast',
      'Illinois': 'North Central',
    };

    return regionMapping[formattedState] || 'Unknown Region';
  };

  const openDivisionsInfo = () => {
    const divisionNames = event.divisions?.map(d => d.name) || [];
    if (divisionNames.length === 0) {
      Alert.alert('No Divisions', 'This event has no divisions.');
      return;
    }

    Alert.alert(
      'Divisions',
      divisionNames.join('\n'),
      [{ text: 'OK' }]
    );
  };

  const InfoCard = ({ title, children }: { title?: string; children: React.ReactNode }) => (
    <View style={[styles.card, {
      backgroundColor: settings.cardBackgroundColor,
      borderColor: settings.borderColor,
      shadowColor: colorScheme === 'dark' ? '#FFFFFF' : '#000000'
    }]}>
      {title && (
        <Text style={[styles.cardTitle, { color: settings.textColor }]}>{title}</Text>
      )}
      {children}
    </View>
  );

  const InfoRow = ({ label, value, onPress, showArrow = false }: {
    label: string;
    value: string;
    onPress?: () => void;
    showArrow?: boolean;
  }) => (
    <TouchableOpacity
      style={styles.infoRow}
      onPress={onPress}
      disabled={!onPress}
    >
      <Text style={[styles.infoLabel, { color: settings.textColor }]}>{label}</Text>
      <View style={styles.infoValueContainer}>
        <Text style={[styles.infoValue, { color: settings.textColor }]}>
          {value}
        </Text>
        {showArrow && (
          <Ionicons name="chevron-forward" size={16} color={settings.iconColor} style={styles.chevron} />
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: settings.backgroundColor }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={settings.buttonColor}
          colors={[settings.buttonColor]}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Event Title Header */}
      <View style={[styles.header, { backgroundColor: settings.cardBackgroundColor }]}>
        <Text style={[styles.eventTitle, { color: settings.textColor }]}>{event.name}</Text>

        {/* Livestream Link */}
        {livestreamLink ? (
          <TouchableOpacity
            style={[styles.livestreamButton, {
              borderColor: settings.buttonColor,
              backgroundColor: `${settings.buttonColor}15`
            }]}
            onPress={openLivestream}
          >
            <Ionicons name="play" size={16} color={settings.buttonColor} />
            <Text style={[styles.livestreamText, { color: settings.buttonColor }]}>
              Watch Livestream
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Event Details Card */}
      <InfoCard>
        <InfoRow
          label="Teams"
          value={teamCount.toString()}
          onPress={() => copyToClipboard(teamCount.toString(), 'Teams')}
        />
        <InfoRow
          label="Divisions"
          value={event.divisions?.length.toString() || '0'}
          onPress={openDivisionsInfo}
          showArrow={true}
        />
        <InfoRow
          label="City"
          value={event.location?.city || 'Unknown'}
          onPress={() => copyToClipboard(event.location?.city || 'Unknown', 'City')}
        />
        <InfoRow
          label={selectedProgram === 'Aerial Drone Competition' ? 'State' : 'Region'}
          value={selectedProgram === 'Aerial Drone Competition' ?
            event.location?.region || 'Unknown' :
            event.location?.region || 'Unknown'
          }
          onPress={() => copyToClipboard(event.location?.region || 'Unknown',
            selectedProgram === 'Aerial Drone Competition' ? 'State' : 'Region'
          )}
        />
        {selectedProgram === 'Aerial Drone Competition' && (
          <InfoRow
            label="Region"
            value={getEventRegion()}
            onPress={() => copyToClipboard(getEventRegion(), 'Region')}
          />
        )}
        <InfoRow
          label="Country"
          value={event.location?.country || 'Unknown'}
          onPress={() => copyToClipboard(event.location?.country || 'Unknown', 'Country')}
        />
        <InfoRow
          label="Address"
          value={formatFullAddress()}
          onPress={copyAddress}
        />
        <InfoRow
          label="Date"
          value={event.start ? formatDate(event.start) : 'Unknown'}
          onPress={() => copyToClipboard(event.start ? formatDate(event.start) : 'Unknown', 'Date')}
        />
        <InfoRow
          label="Season"
          value={formatSeason()}
          onPress={() => copyToClipboard(formatSeason(), 'Season')}
        />
      </InfoCard>

      {/* Developer Information Card */}
      <InfoCard title="Developer">
        <InfoRow
          label="Event ID"
          value={event.id.toString()}
          onPress={() => copyToClipboard(event.id.toString(), 'Event ID')}
        />
        <InfoRow
          label="SKU"
          value={event.sku}
          onPress={() => copyToClipboard(event.sku, 'SKU')}
        />
      </InfoCard>

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    padding: 8,
    marginLeft: 8,
  },
  header: {
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  eventTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
  },
  livestreamButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  livestreamText: {
    fontSize: 16,
    marginLeft: 8,
    fontWeight: '600',
  },
  card: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 48,
  },
  infoLabel: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
    paddingTop: 2,
  },
  infoValueContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 2,
    justifyContent: 'flex-end',
  },
  infoValue: {
    fontSize: 16,
    textAlign: 'right',
    flex: 1,
    flexWrap: 'wrap',
  },
  chevron: {
    marginLeft: 8,
  },
  bottomPadding: {
    height: 20,
  },
});

export default EventInformationScreen;