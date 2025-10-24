/**
 * Web Compatibility Utilities
 *
 * This file contains utilities to handle platform differences between
 * web and native platforms, ensuring features work consistently across all platforms.
 */

import { Platform } from 'react-native';

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
      console.log('Native file download not implemented in this utility');
    }
  }
};

/**
 * Clipboard - Copy text to clipboard
 * Uses native Expo clipboard on mobile, web clipboard API on web
 */
export const clipboard = {
  setString: async (text: string): Promise<boolean> => {
    console.log('clipboard.setString called with:', text);
    console.log('isWeb:', isWeb);

    try {
      if (isWeb) {
        // Check if we have a secure context (HTTPS or localhost)
        const isSecureContext = window.isSecureContext;
        console.log('Secure context:', isSecureContext);

        if (navigator.clipboard && navigator.clipboard.writeText) {
          console.log('Using modern clipboard API');
          try {
            await navigator.clipboard.writeText(text);
            console.log('Clipboard write successful');
            return true;
          } catch (clipboardError) {
            console.error('Modern clipboard API failed:', clipboardError);
            // Fall through to fallback method
          }
        }

        console.log('Using fallback clipboard method');
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
          console.log('execCommand copy result:', success);
        } catch (execError) {
          console.error('execCommand failed:', execError);
        }

        document.body.removeChild(textArea);
        return success;
      } else {
        // Native platform implementation using expo-clipboard
        try {
          const ExpoClipboard = require('expo-clipboard');
          await ExpoClipboard.setStringAsync(text);
          console.log('Native clipboard write successful');
          return true;
        } catch (e) {
          console.error('Native clipboard error:', e);
          return false;
        }
      }
    } catch (error) {
      console.error('General clipboard error:', error);
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
          console.error('Linking error:', e);
          return false;
        }
      }
    } catch (error) {
      console.error('Failed to open URL:', error);
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