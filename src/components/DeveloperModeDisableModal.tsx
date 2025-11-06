import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../contexts/SettingsContext';

interface DeveloperModeDisableModalProps {
  visible: boolean;
  onClose: () => void;
  onDisableTemporarily: () => void;
  onDisablePermanently: () => void;
}

const DeveloperModeDisableModal: React.FC<DeveloperModeDisableModalProps> = ({
  visible,
  onClose,
  onDisableTemporarily,
  onDisablePermanently,
}) => {
  const settings = useSettings();

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modalContainer, { backgroundColor: settings.cardBackgroundColor }]}>
          {/* Header */}
          <View style={styles.header}>
            <Ionicons name="warning-outline" size={32} color="#FF9500" />
            <Text style={[styles.title, { color: settings.textColor }]}>
              Disable Developer Mode?
            </Text>
          </View>

          {/* Message */}
          <Text style={[styles.message, { color: settings.secondaryTextColor }]}>
            Choose how you want to disable Developer Mode. This will also disable dev-only programs and scoring calculators if enabled.
          </Text>

          {/* Options */}
          <View style={styles.optionsContainer}>
            {/* Disable Temporarily */}
            <TouchableOpacity
              style={[styles.optionButton, { backgroundColor: settings.backgroundColor, borderColor: settings.borderColor }]}
              onPress={() => {
                onDisableTemporarily();
                onClose();
              }}
              activeOpacity={0.7}
            >
              <View style={styles.optionContent}>
                <Ionicons name="time-outline" size={24} color={settings.buttonColor} />
                <View style={styles.optionText}>
                  <Text style={[styles.optionTitle, { color: settings.textColor }]}>
                    Disable Temporarily
                  </Text>
                  <Text style={[styles.optionDescription, { color: settings.secondaryTextColor }]}>
                    You can re-enable without entering the code again
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={settings.secondaryTextColor} />
            </TouchableOpacity>

            {/* Disable & Require Code */}
            <TouchableOpacity
              style={[styles.optionButton, { backgroundColor: settings.backgroundColor, borderColor: '#FF3B30' }]}
              onPress={() => {
                onDisablePermanently();
                onClose();
              }}
              activeOpacity={0.7}
            >
              <View style={styles.optionContent}>
                <Ionicons name="lock-closed-outline" size={24} color="#FF3B30" />
                <View style={styles.optionText}>
                  <Text style={[styles.optionTitle, { color: '#FF3B30' }]}>
                    Disable & Require Code
                  </Text>
                  <Text style={[styles.optionDescription, { color: settings.secondaryTextColor }]}>
                    You'll need to enter the code again to re-enable
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={settings.secondaryTextColor} />
            </TouchableOpacity>
          </View>

          {/* Cancel Button */}
          <TouchableOpacity
            style={[styles.cancelButton, { borderColor: settings.borderColor }]}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={[styles.cancelButtonText, { color: settings.textColor }]}>
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      </View>
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
  modalContainer: {
    width: '100%',
    maxWidth: 500,
    borderRadius: 16,
    padding: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      },
    }),
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
  optionsContainer: {
    gap: 12,
    marginBottom: 20,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  optionText: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  cancelButton: {
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default DeveloperModeDisableModal;
