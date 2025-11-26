/**
 * Web Compatibility Utilities
 *
 * This file contains utilities to handle platform differences between
 * web and native platforms, ensuring features work consistently across all platforms.
 */

import { createLogger } from './logger';
import { Platform } from 'react-native';

const logger = createLogger('webCompatibility');

export const isWeb = Platform.OS === 'web';
export const isNative = Platform.OS !== 'web';

/**
 * Haptics - Provides vibration feedback on supported platforms
 * Uses native expo-haptics on mobile, web vibration API on web (if supported)
 */
export const haptics = {
  light: () => {
    if (isNative) {
      // Try to use haptics, silently fail if not available
      try {
        // We'll just skip haptics on platforms where it's not available
        // This is a safe fallback approach
      } catch (e) {
        // Silent failure
      }
    } else if (isWeb && typeof navigator !== 'undefined' && navigator.vibrate) {
      // Provide subtle vibration on web if supported
      navigator.vibrate(50);
    }
    // Silent fallback if neither is available
  },

  medium: () => {
    if (isNative) {
      try {
        const { Vibration } = require('react-native');
        Vibration.vibrate(100);
      } catch (e) {
        // Silent failure
      }
    } else if (isWeb && typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(100);
    }
  },

  heavy: () => {
    if (isNative) {
      try {
        const { Vibration } = require('react-native');
        Vibration.vibrate(200);
      } catch (e) {
        // Silent failure
      }
    } else if (isWeb && typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(200);
    }
  },

  selection: () => {
    if (isNative) {
      try {
        const { Vibration } = require('react-native');
        Vibration.vibrate(30);
      } catch (e) {
        // Silent failure
      }
    } else if (isWeb && typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(30);
    }
  },

  /**
   * Legacy vibration support for existing Vibration.vibrate() calls
   */
  vibrate: (duration: number = 100) => {
    if (isNative) {
      try {
        const { Vibration } = require('react-native');
        Vibration.vibrate(duration);
      } catch (e) {
        // Silent failure
      }
    } else if (isWeb && typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(duration);
    }
  }
};

/**
 * File Downloads - Handle file downloads for both web and native
 */
export const fileDownload = {
  /**
   * Download a text file (CSV, JSON, etc.)
   */
  downloadText: (content: string, filename: string, mimeType: string = 'text/plain') => {
    if (isWeb) {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = url;
      link.download = filename;
      link.style.display = 'none';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);
    } else {
      // Native file handling would go here
      logger.debug('Native file download not implemented in this utility');
    }
  }
};

/**
 * Clipboard - Copy text to clipboard
 * Uses native Expo clipboard on mobile, web clipboard API on web
 */
export const clipboard = {
  setString: async (text: string): Promise<boolean> => {
    logger.debug('clipboard.setString called with:', text);
    logger.debug('isWeb:', isWeb);

    try {
      if (isWeb) {
        // Check if we have a secure context (HTTPS or localhost)
        const isSecureContext = window.isSecureContext;
        logger.debug('Secure context:', isSecureContext);

        if (navigator.clipboard && navigator.clipboard.writeText) {
          logger.debug('Using modern clipboard API');
          try {
            await navigator.clipboard.writeText(text);
            logger.debug('Clipboard write successful');
            return true;
          } catch (clipboardError) {
            logger.error('Modern clipboard API failed:', clipboardError);
            // Fall through to fallback method
          }
        }

        logger.debug('Using fallback clipboard method');
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.top = '0';
        textArea.style.left = '0';
        textArea.style.width = '2em';
        textArea.style.height = '2em';
        textArea.style.padding = '0';
        textArea.style.border = 'none';
        textArea.style.outline = 'none';
        textArea.style.boxShadow = 'none';
        textArea.style.background = 'transparent';

        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        let success = false;
        try {
          success = document.execCommand('copy');
          logger.debug('execCommand copy result:', success);
        } catch (execError) {
          logger.error('execCommand failed:', execError);
        }

        document.body.removeChild(textArea);
        return success;
      } else {
        // Native platform implementation using expo-clipboard
        try {
          const ExpoClipboard = require('expo-clipboard');
          await ExpoClipboard.setStringAsync(text);
          logger.debug('Native clipboard write successful');
          return true;
        } catch (e) {
          logger.error('Native clipboard error:', e);
          return false;
        }
      }
    } catch (error) {
      logger.error('General clipboard error:', error);
      return false;
    }
  }
};

/**
 * Storage - Cross-platform storage utilities
 * Uses native AsyncStorage on mobile, localStorage on web
 */
export const storage = {
  /**
   * Get item from storage
   */
  getItem: async (key: string): Promise<string | null> => {
    if (isWeb) {
      return localStorage.getItem(key);
    } else {
      // On native platforms, just import AsyncStorage directly
      // The web bundler won't include this since it's in the else branch
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      return AsyncStorage.getItem(key);
    }
  },

  /**
   * Set item in storage
   */
  setItem: async (key: string, value: string): Promise<void> => {
    if (isWeb) {
      localStorage.setItem(key, value);
    } else {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      await AsyncStorage.setItem(key, value);
    }
  },

  /**
   * Remove item from storage
   */
  removeItem: async (key: string): Promise<void> => {
    if (isWeb) {
      localStorage.removeItem(key);
    } else {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      await AsyncStorage.removeItem(key);
    }
  }
};

/**
 * Navigation - Platform-specific navigation helpers
 */
export const navigation = {
  /**
   * Open URL in external browser/app
   */
  openURL: async (url: string): Promise<boolean> => {
    try {
      if (isWeb) {
        window.open(url, '_blank', 'noopener,noreferrer');
        return true;
      } else {
        try {
          // On native, just return false for now (can be extended later)
          return false;
        } catch (e) {
          logger.error('Linking error:', e);
          return false;
        }
      }
    } catch (error) {
      logger.error('Failed to open URL:', error);
      return false;
    }
  }
};

/**
 * Device - Platform and device information
 */
export const device = {
  /**
   * Check if device supports certain features
   */
  supportsHaptics: isNative,
  supportsFileSystem: isNative,
  supportsNotifications: isNative,

  /**
   * Get platform-specific information
   */
  getPlatform: () => Platform.OS,
  isWeb,
  isNative,

  /**
   * Check if running on a large screen (tablet/desktop)
   */
  isLargeScreen: () => {
    if (isWeb) {
      return window.innerWidth >= 768;
    }
    return false;
  }
};

/**
 * Responsive - Utilities for responsive design
 */
export const responsive: {
  breakpoints: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
  isMinWidth: (breakpoint: 'xs' | 'sm' | 'md' | 'lg' | 'xl') => boolean;
  isSmallScreen: () => boolean;
  isMediumScreen: () => boolean;
  isLargeScreen: () => boolean;
} = {
  /**
   * Get breakpoints for responsive design
   */
  breakpoints: {
    xs: 480,
    sm: 640,
    md: 768,
    lg: 1024,
    xl: 1280,
  },

  /**
   * Check if current screen size matches breakpoint
   */
  isMinWidth: (breakpoint: 'xs' | 'sm' | 'md' | 'lg' | 'xl') => {
    const breakpoints = {
      xs: 480,
      sm: 640,
      md: 768,
      lg: 1024,
      xl: 1280,
    };
    if (isWeb) {
      return window.innerWidth >= breakpoints[breakpoint];
    }
    return false;
  },

  /**
   * Check if current screen is small
   */
  isSmallScreen: () => {
    if (isWeb) {
      return window.innerWidth < 768;
    }
    return true; // Assume small screen on native
  },

  /**
   * Check if current screen is medium
   */
  isMediumScreen: () => {
    if (isWeb) {
      return window.innerWidth >= 768 && window.innerWidth < 1024;
    }
    return false;
  },

  /**
   * Check if current screen is large
   */
  isLargeScreen: () => {
    if (isWeb) {
      return window.innerWidth >= 1024;
    }
    return false;
  }
};

/**
 * Location - Cross-platform location utilities
 * Uses native expo-location on mobile, web geolocation API on web
 */
export const location = {
  /**
   * Request location permission
   */
  requestForegroundPermissionsAsync: async (): Promise<{ status: string }> => {
    if (isWeb) {
      // On web, we can't really "request" permission separately
      // Permission is requested when we actually call getCurrentPosition
      // So we just check if geolocation is supported
      if (!navigator.geolocation) {
        return { status: 'denied' };
      }
      return { status: 'granted' };
    } else {
      // Native implementation using expo-location
      try {
        const ExpoLocation = require('expo-location');
        return await ExpoLocation.requestForegroundPermissionsAsync();
      } catch (e) {
        return { status: 'denied' };
      }
    }
  },

  /**
   * Get current position
   */
  getCurrentPositionAsync: async (options?: { accuracy?: any }): Promise<any> => {
    if (isWeb) {
      // Web implementation using geolocation API
      return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('Geolocation not supported'));
          return;
        }

        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              coords: {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                altitude: position.coords.altitude,
                altitudeAccuracy: position.coords.altitudeAccuracy,
                heading: position.coords.heading,
                speed: position.coords.speed,
              },
              timestamp: position.timestamp,
            });
          },
          (error) => reject(error),
          {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 10000,
          }
        );
      });
    } else {
      // Native implementation using expo-location
      try {
        const ExpoLocation = require('expo-location');
        return await ExpoLocation.getCurrentPositionAsync(options || {
          accuracy: ExpoLocation.Accuracy.Balanced,
        });
      } catch (e) {
        throw e;
      }
    }
  },

  /**
   * Reverse geocode coordinates to get address information
   */
  reverseGeocodeAsync: async (location: { latitude: number; longitude: number }): Promise<Array<{
    country?: string;
    region?: string;
    city?: string;
    street?: string;
    postalCode?: string;
  }>> => {
    if (isWeb) {
      // On web, use a free geocoding API (Nominatim from OpenStreetMap)
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${location.latitude}&lon=${location.longitude}&format=json`,
          { headers: { 'User-Agent': 'RoboNexus App' } }
        );
        const data = await response.json();
        if (data.address) {
          return [{
            country: data.address.country,
            region: data.address.state || data.address.province,
            city: data.address.city || data.address.town || data.address.village,
            street: data.address.road,
            postalCode: data.address.postcode,
          }];
        }
        return [];
      } catch (e) {
        logger.error('Web reverse geocode failed:', e);
        return [];
      }
    } else {
      // Native implementation using expo-location
      try {
        const ExpoLocation = require('expo-location');
        return await ExpoLocation.reverseGeocodeAsync(location);
      } catch (e) {
        logger.error('Native reverse geocode failed:', e);
        return [];
      }
    }
  },

  /**
   * Accuracy constants for compatibility
   */
  Accuracy: {
    Lowest: 1,
    Low: 2,
    Balanced: 3,
    High: 4,
    Highest: 5,
    BestForNavigation: 6,
  },
};

/**
 * Map Components - Cross-platform map utilities
 */
export const mapComponents = {
  /**
   * Check if native maps are supported
   */
  supportsNativeMaps: isNative,

  /**
   * Get appropriate map component for platform
   */
  getMapComponent: () => {
    if (isNative) {
      // Return the native MapView component dynamically
      return import('react-native-maps').then(maps => maps.default);
    } else {
      // Return a web-compatible map component
      return Promise.resolve(null); // We'll implement a web map fallback
    }
  }
};

/**
 * Alerts - Cross-platform alert/dialog utilities
 * Uses window.alert/confirm on web, Alert.alert on mobile
 */
export const alerts = {
  /**
   * Show a simple alert message
   * Uses window.alert on web, Alert.alert on mobile
   */
  showAlert: (title: string, message?: string): void => {
    if (isWeb) {
      // Web: Use native browser alert
      const displayMessage = message ? `${title}\n\n${message}` : title;
      window.alert(displayMessage);
    } else {
      // Mobile: Use Alert.alert
      const { Alert } = require('react-native');
      Alert.alert(title, message);
    }
  },

  /**
   * Show a confirmation dialog
   * Uses window.confirm on web, Alert.alert on mobile
   */
  showConfirm: (
    title: string,
    message: string,
    confirmText: string = 'OK',
    cancelText: string = 'Cancel'
  ): Promise<boolean> => {
    if (isWeb) {
      // Web: Use native browser confirm
      return Promise.resolve(window.confirm(`${title}\n\n${message}`));
    } else {
      // Mobile: Use Alert.alert with buttons
      return new Promise((resolve) => {
        const { Alert } = require('react-native');
        Alert.alert(
          title,
          message,
          [
            {
              text: cancelText,
              style: 'cancel',
              onPress: () => resolve(false),
            },
            {
              text: confirmText,
              style: 'default',
              onPress: () => resolve(true),
            },
          ]
        );
      });
    }
  },

  /**
   * Show a destructive confirmation dialog (for delete operations)
   * Uses window.confirm on web, Alert.alert with destructive button on mobile
   */
  showDestructiveConfirm: (
    title: string,
    message: string,
    confirmText: string = 'Delete',
    cancelText: string = 'Cancel'
  ): Promise<boolean> => {
    if (isWeb) {
      // Web: Use native browser confirm
      return Promise.resolve(window.confirm(`${title}\n\n${message}`));
    } else {
      // Mobile: Use Alert.alert with destructive style
      return new Promise((resolve) => {
        const { Alert } = require('react-native');
        Alert.alert(
          title,
          message,
          [
            {
              text: cancelText,
              style: 'cancel',
              onPress: () => resolve(false),
            },
            {
              text: confirmText,
              style: 'destructive',
              onPress: () => resolve(true),
            },
          ]
        );
      });
    }
  },

  /**
   * Show alert with custom buttons
   * Uses window.confirm on web (limited to OK/Cancel), Alert.alert on mobile
   *
   * @param title - Alert title
   * @param message - Alert message
   * @param buttons - Array of button configurations
   * @returns Promise that resolves to the index of the pressed button
   */
  showAlertWithButtons: (
    title: string,
    message: string,
    buttons: Array<{ text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }>
  ): Promise<number> => {
    if (isWeb) {
      // Web: Limited to confirm dialog
      // If there are only 2 buttons, use confirm
      if (buttons.length <= 2) {
        const result = window.confirm(`${title}\n\n${message}`);
        const pressedIndex = result ? (buttons.length - 1) : 0;
        if (buttons[pressedIndex]?.onPress) {
          buttons[pressedIndex].onPress!();
        }
        return Promise.resolve(pressedIndex);
      } else {
        // For more than 2 buttons, show alert and return -1
        window.alert(`${title}\n\n${message}`);
        return Promise.resolve(-1);
      }
    } else {
      // Mobile: Use Alert.alert with all buttons
      return new Promise((resolve) => {
        const { Alert } = require('react-native');
        Alert.alert(
          title,
          message,
          buttons.map((button, index) => ({
            text: button.text,
            style: button.style || 'default',
            onPress: () => {
              if (button.onPress) button.onPress();
              resolve(index);
            },
          }))
        );
      });
    }
  },

  /**
   * Show a text input prompt dialog
   * Uses window.prompt on web, Alert.prompt on iOS, custom dialog on Android/web
   *
   * @param title - Prompt title
   * @param message - Prompt message
   * @param defaultValue - Default input value
   * @param placeholder - Input placeholder text
   * @param type - Input type ('default', 'plain-text', 'secure-text', 'numeric', 'email', 'phone-pad')
   * @returns Promise that resolves to the entered text, or null if cancelled
   */
  showPrompt: (
    title: string,
    message?: string,
    defaultValue?: string,
    placeholder?: string,
    type: 'default' | 'plain-text' | 'secure-text' | 'numeric' | 'email-address' | 'phone-pad' = 'default'
  ): Promise<string | null> => {
    if (isWeb) {
      // Web: Use native browser prompt
      const promptMessage = message ? `${title}\n\n${message}` : title;
      const result = window.prompt(promptMessage, defaultValue || '');
      return Promise.resolve(result);
    } else {
      // Mobile: Use Alert.prompt (iOS) or fallback
      return new Promise((resolve) => {
        const { Alert, Platform } = require('react-native');

        if (Platform.OS === 'ios') {
          // iOS: Use Alert.prompt
          Alert.prompt(
            title,
            message,
            [
              {
                text: 'Cancel',
                style: 'cancel',
                onPress: () => resolve(null),
              },
              {
                text: 'OK',
                onPress: (text?: string) => resolve(text || null),
              },
            ],
            type,
            defaultValue,
            placeholder ? undefined : undefined // Alert.prompt doesn't support placeholder directly
          );
        } else {
          // Android: Alert.prompt doesn't exist, so we need a fallback
          // For now, just show an alert explaining that text input is not supported
          // In a real app, you'd want to create a custom modal for this
          Alert.alert(
            'Not Supported',
            'Text input prompts are not supported on Android. Please use iOS or web.',
            [{ text: 'OK', onPress: () => resolve(null) }]
          );
        }
      });
    }
  },

  /**
   * Show a secure text input prompt (for passwords)
   * Convenience wrapper around showPrompt with secure-text type
   */
  showSecurePrompt: (
    title: string,
    message?: string,
    defaultValue?: string
  ): Promise<string | null> => {
    return alerts.showPrompt(title, message, defaultValue, undefined, 'secure-text');
  },

  /**
   * Show a numeric input prompt
   * Convenience wrapper around showPrompt with numeric type
   */
  showNumericPrompt: (
    title: string,
    message?: string,
    defaultValue?: string
  ): Promise<string | null> => {
    return alerts.showPrompt(title, message, defaultValue, undefined, 'numeric');
  }
};