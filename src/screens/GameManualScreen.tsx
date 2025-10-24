/**
 * Game Manual Screen
 *
 * Description:
 * Displays the official game manual for the selected VEX robotics competition program.
 * Uses WebView on native platforms and iframe on web to render HTML manuals or PDF documents.
 * Includes fallback URLs and error handling for reliable manual access.
 *
 * Navigation:
 * Accessible from the main app navigation or competition information sections.
 *
 * Key Features:
 * - Program-specific manual loading (V5, IQ, U, AI, Aerial Drone competitions)
 * - WebView integration with loading states and error handling
 * - External browser opening capability via header button
 * - Refresh functionality for manual reloading
 * - Fallback URL support for improved reliability
 * - Cross-platform compatibility (native and web)
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../contexts/SettingsContext';
import GameManualQuickReference, { GameManualQuickReferenceRef } from '../components/GameManualQuickReference';
import { WebView } from 'react-native-webview';

interface Props {
  navigation: any;
}

// Web-compatible component for displaying manuals
const WebManualViewer: React.FC<{ url: string; title: string }> = ({ url, title }) => {
  const settings = useSettings();

  if (Platform.OS === 'web') {
    return (
      <iframe
        src={url}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          backgroundColor: settings.backgroundColor,
        }}
        title={title}
        sandbox="allow-same-origin allow-scripts allow-forms allow-top-navigation"
      />
    );
  }

  // This will be handled by the native WebView below
  return null;
};

type TabType = 'quickref' | 'pdf';

const GameManualScreen: React.FC<Props> = ({ navigation }) => {
  const settings = useSettings();
  const { selectedProgram } = settings;
  // Use current season name for game manual (not the season ID from settings)
  const currentSeasonName = '2025-2026';
  const webViewRef = useRef<WebView>(null);
  const quickRefRef = useRef<GameManualQuickReferenceRef>(null);
  const [usesFallback, setUsesFallback] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('quickref');
  const isWeb = Platform.OS === 'web';

  const getManualData = () => {
    const manualLinks = {
      'VEX V5 Robotics Competition': {
        url: 'https://link.vex.com/docs/25-26/v5rc-pushback-manual',
        fallbackUrl: 'https://www.vexrobotics.com/push-back-manual',
        title: 'VEX V5 Robotics Competition Game Manual',
        type: 'html'
      },
      'VEX IQ Robotics Competition': {
        url: 'https://link.vex.com/docs/25-26/viqrc-mixandmatch-manual',
        fallbackUrl: 'https://www.vexrobotics.com/mix-and-match-manual',
        title: 'VEX IQ Robotics Competition Game Manual',
        type: 'html'
      },
      'VEX U Robotics Competition': {
        url: 'https://link.vex.com/docs/25-26/v5rc-pushback-manual',
        fallbackUrl: 'https://www.vexrobotics.com/push-back-manual',
        title: 'VEX U Robotics Competition Game Manual',
        type: 'html'
      },
      'VEX AI Robotics Competition': {
        url: 'https://link.vex.com/docs/25-26/v5rc-pushback-manual',
        fallbackUrl: 'https://www.vexrobotics.com/push-back-manual',
        title: 'VEX AI Robotics Competition Game Manual',
        type: 'html'
      },
      'Aerial Drone Competition': {
        url: 'https://online.flippingbook.com/view/332926579/',
        fallbackUrl: null,
        title: 'Aerial Drone Competition Game Manual',
        type: 'flipbook'
      },
    };

    const manual = manualLinks[selectedProgram as keyof typeof manualLinks] || manualLinks['VEX V5 Robotics Competition'];

    if (usesFallback && manual.fallbackUrl) {
      return {
        ...manual,
        url: manual.fallbackUrl,
        type: 'pdf' // Fallback URLs are typically PDFs
      };
    }

    return manual;
  };

  // Reset fallback state when program changes
  useEffect(() => {
    setUsesFallback(false);
  }, [selectedProgram]);

  // Set up navigation header with buttons
  useEffect(() => {
    navigation.setOptions({
      headerTitleAlign: 'center',
      headerLeft: activeTab === 'pdf' ? () => (
        <TouchableOpacity onPress={openInExternalBrowser} style={{ marginLeft: 16 }}>
          <Ionicons name="open-outline" size={24} color={settings.topBarContentColor || '#007AFF'} />
        </TouchableOpacity>
      ) : undefined,
      headerRight: () => (
        <TouchableOpacity onPress={handleRefresh} style={{ marginRight: 16 }}>
          <Ionicons name="refresh" size={24} color={settings.topBarContentColor || '#007AFF'} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, settings.topBarContentColor, activeTab]);


  const handleRefresh = () => {
    if (activeTab === 'quickref') {
      // Refresh the quick reference data
      quickRefRef.current?.refresh();
    } else if (activeTab === 'pdf') {
      // Refresh the PDF WebView
      if (isWeb) {
        // On web, reload the current page
        window.location.reload();
      } else if (webViewRef.current) {
        // On native, reload the WebView
        webViewRef.current.reload();
      }
    }
  };


  const openInExternalBrowser = () => {
    const manual = getManualData();
    Linking.openURL(manual.url).catch(err => {
      console.error('Failed to open manual:', err);
      Alert.alert('Error', 'Failed to open the game manual. Please check your internet connection.');
    });
  };


  const manual = getManualData();

  // Check if this program supports Quick Reference (flipbook type doesn't)
  const supportsQuickRef = manual.type !== 'flipbook';

  return (
    <View style={[styles.container, { backgroundColor: settings.backgroundColor }]}>
      {/* Tab Selector - only show for programs that support Quick Reference */}
      {supportsQuickRef && (
        <View style={[styles.tabContainer, { backgroundColor: settings.cardBackgroundColor, borderBottomColor: settings.borderColor }]}>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'quickref' && [styles.activeTab, { borderBottomColor: settings.buttonColor }]
            ]}
            onPress={() => setActiveTab('quickref')}
          >
            <Ionicons
              name="list"
              size={20}
              color={activeTab === 'quickref' ? settings.buttonColor : settings.iconColor}
            />
            <Text style={[
              styles.tabText,
              { color: activeTab === 'quickref' ? settings.buttonColor : settings.textColor }
            ]}>
              Quick Ref
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'pdf' && [styles.activeTab, { borderBottomColor: settings.buttonColor }]
            ]}
            onPress={() => setActiveTab('pdf')}
          >
            <Ionicons
              name="document-text"
              size={20}
              color={activeTab === 'pdf' ? settings.buttonColor : settings.iconColor}
            />
            <Text style={[
              styles.tabText,
              { color: activeTab === 'pdf' ? settings.buttonColor : settings.textColor }
            ]}>
              Full PDF
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Tab Content */}
      {supportsQuickRef && activeTab === 'quickref' ? (
        <GameManualQuickReference
          ref={quickRefRef}
          navigation={navigation}
          program={selectedProgram}
          season={currentSeasonName}
        />
      ) : null}

      {/* PDF/WebView - always render to preload, hide when Quick Ref is active */}
      <View style={[
        styles.webviewContainer,
        supportsQuickRef && activeTab === 'quickref' && styles.hidden
      ]}>
        {isWeb ? (
          // Web version using iframe
          <WebManualViewer url={manual.url} title={manual.title} />
        ) : (
          // Native version using WebView
          <WebView
            ref={webViewRef}
            source={{ uri: manual.url }}
            style={styles.webview}
            onError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              console.error('WebView error: ', nativeEvent);

              const manual = getManualData();
              // Try fallback URL if available and not already using it
              if (manual.fallbackUrl && !usesFallback) {
                console.log('Trying fallback URL for manual');
                setUsesFallback(true);
                return;
              }

              Alert.alert(
                'Loading Error',
                'Failed to load the game manual. Please check your internet connection or try opening in external browser.',
                [
                  { text: 'OK' },
                  { text: 'Open in Browser', onPress: openInExternalBrowser }
                ]
              );
            }}
            onHttpError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              console.error('WebView HTTP error: ', nativeEvent);
            }}
            allowsBackForwardNavigationGestures={true}
            scalesPageToFit={manual.type === 'html'}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            // Better configuration for HTML content
            javaScriptEnabled={true}
            domStorageEnabled={true}
            allowsInlineMediaPlayback={true}
            mediaPlaybackRequiresUserAction={false}
            // Add user agent for better compatibility
            userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1"
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  activeTab: {
    borderBottomWidth: 3,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
  },
  webviewContainer: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
  hidden: {
    display: 'none',
  },
});

export default GameManualScreen;