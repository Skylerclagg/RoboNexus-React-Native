import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../contexts/SettingsContext';
import { isWeb } from '../utils/webCompatibility';

interface PickerItem {
  label: string;
  value: any;
}

interface CrossPlatformPickerProps {
  selectedValue: any;
  onValueChange: (value: any) => void;
  style?: any;
  children?: React.ReactNode;
  items?: PickerItem[];
}

/**
 * Cross-platform picker component that works on both web and native
 */
const CrossPlatformPicker: React.FC<CrossPlatformPickerProps> = ({
  selectedValue,
  onValueChange,
  style,
  children,
  items = [],
}) => {
  const settings = useSettings();

  // Extract items from children if not provided directly
  const pickerItems = items.length > 0 ? items : (
    React.Children.map(children, (child) => {
      if (React.isValidElement(child)) {
        return {
          label: (child.props as any).label,
          value: (child.props as any).value,
        };
      }
      return null;
    })?.filter(Boolean) || []
  );

  const selectedItem = pickerItems.find((item: PickerItem) => item.value === selectedValue);

  if (isWeb) {
    // Web implementation using custom dropdown (React Native compatible)
    const [isOpen, setIsOpen] = React.useState(false);

    return (
      <View style={[styles.webContainer, { backgroundColor: settings.cardBackgroundColor, borderColor: settings.borderColor }, style]}>
        <TouchableOpacity
          style={[styles.webButton, { backgroundColor: settings.cardBackgroundColor, borderColor: settings.borderColor }]}
          onPress={() => setIsOpen(!isOpen)}
        >
          <Text style={[styles.webButtonText, { color: settings.textColor }]}>
            {selectedItem?.label || 'Select...'}
          </Text>
          <Ionicons
            name={isOpen ? "chevron-up" : "chevron-down"}
            size={16}
            color={settings.secondaryTextColor}
          />
        </TouchableOpacity>

        {isOpen && (
          <View style={[styles.dropdown, { backgroundColor: settings.cardBackgroundColor, borderColor: settings.borderColor }]}>
            {pickerItems.map((item) => (
              <TouchableOpacity
                key={item.value.toString()}
                style={[
                  styles.dropdownItem,
                  selectedValue === item.value && { backgroundColor: settings.buttonColor + '20' }
                ]}
                onPress={() => {
                  onValueChange(item.value);
                  setIsOpen(false);
                }}
              >
                <Text style={[styles.dropdownItemText, { color: settings.textColor }]}>
                  {item.label}
                </Text>
                {selectedValue === item.value && (
                  <Ionicons name="checkmark" size={16} color={settings.buttonColor} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  }

  // Native implementation - use dropdown-style picker
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <View style={[styles.nativeContainer, style]}>
      <TouchableOpacity
        style={[styles.nativeButton, { backgroundColor: settings.cardBackgroundColor, borderColor: settings.borderColor }]}
        onPress={() => setIsOpen(!isOpen)}
      >
        <Text style={[styles.nativeButtonText, { color: settings.textColor }]}>
          {selectedItem?.label || 'Select...'}
        </Text>
        <Ionicons
          name={isOpen ? "chevron-up" : "chevron-down"}
          size={16}
          color={settings.secondaryTextColor}
        />
      </TouchableOpacity>

      {isOpen && (
        <View style={[styles.dropdown, { backgroundColor: settings.cardBackgroundColor, borderColor: settings.borderColor }]}>
          {pickerItems.map((item: PickerItem) => (
            <TouchableOpacity
              key={item.value.toString()}
              style={[
                styles.dropdownItem,
                selectedValue === item.value && { backgroundColor: settings.buttonColor + '20' }
              ]}
              onPress={() => {
                onValueChange(item.value);
                setIsOpen(false);
              }}
            >
              <Text style={[styles.dropdownItemText, { color: settings.textColor }]}>
                {item.label}
              </Text>
              {selectedValue === item.value && (
                <Ionicons name="checkmark" size={16} color={settings.buttonColor} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

// Create a PickerItem component for compatibility
const PickerItem: React.FC<{ label: string; value: any }> = () => null;

// Define the CrossPlatformPicker with Item property type
type CrossPlatformPickerType = React.FC<CrossPlatformPickerProps> & {
  Item: typeof PickerItem;
};

// Attach Item as a static property to maintain API compatibility
(CrossPlatformPicker as CrossPlatformPickerType).Item = PickerItem;

const styles = StyleSheet.create({
  webContainer: {
    position: 'relative',
    zIndex: 1000,
  },
  webButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
  },
  webButtonText: {
    fontSize: 16,
    flex: 1,
  },
  nativeContainer: {
    position: 'relative',
    zIndex: 1000,
  },
  nativeButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
  },
  nativeButtonText: {
    fontSize: 16,
    flex: 1,
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    borderWidth: 1,
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    maxHeight: 200,
    zIndex: 1001,
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E0E0E0',
  },
  dropdownItemText: {
    fontSize: 16,
    flex: 1,
  },
});

export default CrossPlatformPicker as CrossPlatformPickerType;