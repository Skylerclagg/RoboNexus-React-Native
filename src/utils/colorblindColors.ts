/**
 * Colorblind-Friendly Alliance Color Utilities
 *
 * Provides adjusted colors for red and blue alliances based on colorblind mode.
 * Uses research-backed color palettes that are distinguishable for users with
 * color vision deficiencies.
 *
 * These utilities work alongside the existing color override system in SettingsContext.
 */

import { ColorblindMode } from '../contexts/SettingsContext';

export interface AllianceColors {
  red: string;
  blue: string;
}

/**
 * Get colorblind-friendly alliance colors based on the selected mode
 *
 * Color choices based on research:
 * - Red-Green (Protanopia/Deuteranopia): Use orange vs blue
 *   Red and green appear similar to these users, so we use orange which
 *   contains yellow tones they can see, paired with strong blue
 * - Blue-Yellow (Tritanopia): Use red vs cyan/teal
 *   Blue and yellow appear similar to these users, so we use red paired
 *   with cyan which has green tones they can distinguish
 * - None: Standard red vs blue (VEX official colors)
 */
export const getAllianceColors = (mode: ColorblindMode): AllianceColors => {
  switch (mode) {
    case 'redgreen':
      // For red-green colorblindness, use orange and blue
      // These are distinguishable for protanopia and deuteranopia
      return {
        red: '#FF8C00',  // Dark orange (replaces red)
        blue: '#0066CC', // Strong blue (more saturated than default)
      };

    case 'blueyellow':
      // For blue-yellow colorblindness (tritanopia), use red and cyan
      // Avoid yellow and blue which are hard to distinguish
      return {
        red: '#CC0000',  // Strong red (more saturated)
        blue: '#00CED1', // Dark turquoise/cyan (replaces blue)
      };

    case 'none':
    default:
      // Standard VEX red and blue alliance colors
      return {
        red: '#DC3545',   // Standard red
        blue: '#007AFF',  // Standard blue
      };
  }
};

/**
 * Get a lighter/background version of alliance colors for cards and backgrounds
 */
export const getAllianceBackgroundColors = (mode: ColorblindMode): AllianceColors => {
  switch (mode) {
    case 'redgreen':
      return {
        red: '#FFE4CC',   // Light orange
        blue: '#CCE5FF',  // Light blue
      };

    case 'blueyellow':
      return {
        red: '#FFCCCC',   // Light red
        blue: '#CCFFF5',  // Light cyan
      };

    case 'none':
    default:
      return {
        red: '#FFEBEE',   // Light red
        blue: '#E3F2FD',  // Light blue
      };
  }
};

/**
 * Get darker/border version of alliance colors for borders and emphasis
 */
export const getAllianceBorderColors = (mode: ColorblindMode): AllianceColors => {
  switch (mode) {
    case 'redgreen':
      return {
        red: '#CC7000',   // Darker orange
        blue: '#0052A3',  // Darker blue
      };

    case 'blueyellow':
      return {
        red: '#A30000',   // Darker red
        blue: '#00A3A8',  // Darker cyan
      };

    case 'none':
    default:
      return {
        red: '#C82333',   // Darker red
        blue: '#0056B3',  // Darker blue
      };
  }
};
