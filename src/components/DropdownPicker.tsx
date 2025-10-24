import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../contexts/SettingsContext';

interface DropdownOption {
  label: string;
  value: string;
}

interface DropdownPickerProps {
  options: DropdownOption[];
  selectedValue: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  textAlign?: 'left' | 'center' | 'right';
}

const DropdownPicker: React.FC<DropdownPickerProps> = ({
  options,
  selectedValue,
  onValueChange,
  placeholder = 'Select an option',
  textAlign = 'left',
}) => {
  const {
    buttonColor,
    textColor,
    cardBackgroundColor,
    borderColor
  } = useSettings();
  const [isOpen, setIsOpen] = useState(false);

  const selectedOption = options.find(option => option.value === selectedValue);

  const renderOption = ({ item }: { item: DropdownOption }) => (
    <TouchableOpacity
      style={[styles.option, { backgroundColor: cardBackgroundColor }]}
      onPress={() => {
        onValueChange(item.value);
        setIsOpen(false);
      }}
    >
      <Text style={[styles.optionText, { color: textColor, textAlign }]}>{item.label}</Text>
      <View style={styles.checkmarkContainer}>
        {selectedValue === item.value && (
          <Ionicons name="checkmark" size={20} color={buttonColor} />
        )}
      </View>
    </TouchableOpacity>
  );

  const styles = StyleSheet.create({
    container: {
      flex: 1,
    },
    selector: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 11,
      paddingHorizontal: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    selectorText: {
      fontSize: 17,
      flex: 1,
    },
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    modal: {
      borderTopLeftRadius: 12,
      borderTopRightRadius: 12,
      maxHeight: '60%',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: borderColor,
    },
    doneButton: {
      fontSize: 17,
      fontWeight: '600',
    },
    optionsList: {
      maxHeight: 300,
    },
    option: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: borderColor,
    },
    optionText: {
      fontSize: 17,
      flex: 1,
    },
    checkmarkContainer: {
      width: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.selector, { backgroundColor: cardBackgroundColor, borderBottomColor: borderColor }]}
        onPress={() => setIsOpen(true)}
      >
        <Text style={[styles.selectorText, { color: textColor, textAlign }]}>
          {selectedOption ? selectedOption.label : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={20} color={textColor} />
      </TouchableOpacity>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setIsOpen(false)}
        >
          <View style={[styles.modal, { backgroundColor: cardBackgroundColor }]}>
            <View style={styles.header}>
              <TouchableOpacity onPress={() => setIsOpen(false)}>
                <Text style={[styles.doneButton, { color: buttonColor }]}>Done</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={options}
              renderItem={renderOption}
              keyExtractor={(item) => item.value}
              style={styles.optionsList}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

export default DropdownPicker;