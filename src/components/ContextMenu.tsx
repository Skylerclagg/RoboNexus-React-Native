import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../contexts/SettingsContext';

export interface ContextMenuOption {
  id: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  color?: string;
  onPress: () => void;
}

interface ContextMenuProps {
  visible: boolean;
  onClose: () => void;
  options: ContextMenuOption[];
  title?: string;
}

const ContextMenu: React.FC<ContextMenuProps> = ({
  visible,
  onClose,
  options,
  title,
}) => {
  const { backgroundColor, textColor, cardBackgroundColor, borderColor, colorScheme } = useSettings();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={[styles.menuContainer, { backgroundColor: cardBackgroundColor, borderColor }]}>
              {title && (
                <View style={[styles.titleContainer, { borderBottomColor: borderColor }]}>
                  <Text style={[styles.title, { color: textColor }]}>{title}</Text>
                </View>
              )}

              {options.map((option) => (
                <TouchableOpacity
                  key={option.id}
                  style={[styles.option, { borderBottomColor: borderColor }]}
                  onPress={() => {
                    option.onPress();
                    onClose();
                  }}
                >
                  <Ionicons
                    name={option.icon}
                    size={20}
                    color={option.color || '#007AFF'}
                    style={styles.optionIcon}
                  />
                  <Text style={[styles.optionText, { color: option.color || '#007AFF' }]}>
                    {option.title}
                  </Text>
                </TouchableOpacity>
              ))}

              <View style={[styles.separator, { backgroundColor: colorScheme === 'dark' ? '#3C3C3E' : '#F5F5F5' }]} />

              <TouchableOpacity style={styles.cancelOption} onPress={onClose}>
                <Text style={[styles.cancelText, { color: textColor }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  menuContainer: {
    borderRadius: 12,
    minWidth: 200,
    maxWidth: 300,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
  },
  titleContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  optionIcon: {
    marginRight: 12,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  separator: {
    height: 8,
  },
  cancelOption: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ContextMenu;