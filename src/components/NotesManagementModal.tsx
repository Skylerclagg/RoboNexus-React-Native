/**
 * NOTES MANAGEMENT MODAL
 *
 * Modal for managing all user notes, organized by teams and events.
 * Allows users to delete individual notes or all notes for a team/event.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
  SectionList,
  ActivityIndicator,
  TextInput,
  Image,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../contexts/SettingsContext';
import { useNotes } from '../contexts/NotesContext';

interface Props {
  visible: boolean;
  onClose: () => void;
}

interface Note {
  id: string;
  teamId: number;
  teamName: string;
  teamNumber: string;
  eventId: number;
  matchName: string;
  note: string;
  time: string;
  createdAt?: string;
  imageUri?: string;
}

interface NotesSection {
  title: string;
  type: 'team' | 'event';
  id: string;
  data: Note[];
}

const NotesManagementModal: React.FC<Props> = ({ visible, onClose }) => {
  const settings = useSettings();
  const { getAllNotes, deleteNote, deleteAllNotesForTeam, deleteAllNotesForEvent } = useNotes();

  const [selectedTab, setSelectedTab] = useState<'teams' | 'events'>('teams');
  const [notes, setNotes] = useState<Note[]>([]);
  const [sections, setSections] = useState<NotesSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (visible) {
      loadNotes();
    }
  }, [visible]);

  useEffect(() => {
    organizeSections();
  }, [notes, selectedTab, searchQuery]);

  const loadNotes = async () => {
    setLoading(true);
    try {
      const allNotes = await getAllNotes();
      setNotes(allNotes);
    } catch (error) {
      console.error('Failed to load notes:', error);
      Alert.alert('Error', 'Failed to load notes');
    } finally {
      setLoading(false);
    }
  };

  const organizeSections = () => {
    let filteredNotes = notes;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filteredNotes = notes.filter(note =>
        note.teamName.toLowerCase().includes(query) ||
        note.teamNumber.toLowerCase().includes(query) ||
        note.matchName.toLowerCase().includes(query) ||
        note.note.toLowerCase().includes(query)
      );
    }

    const sectionsMap: { [key: string]: NotesSection } = {};

    filteredNotes.forEach(note => {
      let sectionKey: string;
      let sectionTitle: string;
      let sectionType: 'team' | 'event';

      if (selectedTab === 'teams') {
        sectionKey = `team-${note.teamId}`;
        sectionTitle = `${note.teamNumber} - ${note.teamName}`;
        sectionType = 'team';
      } else {
        sectionKey = `event-${note.eventId}`;
        sectionTitle = note.eventId === 0 ? 'General Team Notes' : note.matchName;
        sectionType = 'event';
      }

      if (!sectionsMap[sectionKey]) {
        sectionsMap[sectionKey] = {
          title: sectionTitle,
          type: sectionType,
          id: sectionKey,
          data: []
        };
      }

      sectionsMap[sectionKey].data.push(note);
    });

    // Sort notes within sections by date (newest first)
    Object.values(sectionsMap).forEach(section => {
      section.data.sort((a, b) =>
        new Date(b.createdAt || b.time).getTime() - new Date(a.createdAt || a.time).getTime()
      );
    });

    // Sort sections by title
    const sortedSections = Object.values(sectionsMap).sort((a, b) =>
      a.title.localeCompare(b.title)
    );

    setSections(sortedSections);
  };

  const handleDeleteNote = async (noteId: string) => {
    Alert.alert(
      'Delete Note',
      'Are you sure you want to delete this note?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteNote(noteId);
              await loadNotes(); // Refresh notes
            } catch (error) {
              console.error('Failed to delete note:', error);
              Alert.alert('Error', 'Failed to delete note');
            }
          }
        }
      ]
    );
  };

  const handleDeleteAllForSection = async (section: NotesSection) => {
    const isTeamSection = section.type === 'team';
    const itemType = isTeamSection ? 'team' : 'event';
    const itemName = section.title;
    const noteCount = section.data.length;

    Alert.alert(
      `Delete All Notes`,
      `Are you sure you want to delete all ${noteCount} notes for this ${itemType}?\n\n${itemName}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            try {
              if (isTeamSection) {
                // Extract team ID from section key (team-123)
                const teamId = parseInt(section.id.replace('team-', ''));
                await deleteAllNotesForTeam(teamId);
              } else {
                // Extract event ID from section key (event-123)
                const eventId = parseInt(section.id.replace('event-', ''));
                await deleteAllNotesForEvent(eventId);
              }
              await loadNotes(); // Refresh notes
            } catch (error) {
              console.error('Failed to delete notes:', error);
              Alert.alert('Error', 'Failed to delete notes');
            }
          }
        }
      ]
    );
  };



  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderSectionHeader = ({ section }: { section: NotesSection }) => (
    <View style={[styles.sectionHeader, {
      backgroundColor: settings.cardBackgroundColor,
      borderBottomColor: settings.borderColor
    }]}>
      <View style={styles.sectionHeaderContent}>
        <Text style={[styles.sectionTitle, { color: settings.textColor }]}>
          {section.title}
        </Text>
        <Text style={[styles.sectionCount, { color: settings.secondaryTextColor }]}>
          {section.data.length} note{section.data.length !== 1 ? 's' : ''}
        </Text>
      </View>
      <TouchableOpacity
        style={[styles.deleteAllButton, { borderColor: '#ff4444' }]}
        onPress={() => handleDeleteAllForSection(section)}
      >
        <Ionicons name="trash" size={16} color="#ff4444" />
        <Text style={[styles.deleteAllText, { color: '#ff4444' }]}>Delete All</Text>
      </TouchableOpacity>
    </View>
  );

  const renderNoteItem = ({ item }: { item: Note }) => (
    <View style={[styles.noteItem, {
      backgroundColor: settings.backgroundColor,
      borderColor: settings.borderColor,
    }]}>
      <View style={styles.noteHeader}>
        <View style={styles.noteInfo}>
          <View style={styles.noteInfoRow}>
            <Text style={[styles.noteDate, { color: settings.textColor }]}>
              {formatDate(item.createdAt || item.time)}
            </Text>
            {item.imageUri && (
              <View style={styles.imageIndicator}>
                <Ionicons name="image" size={14} color={settings.buttonColor} />
              </View>
            )}
          </View>
          {selectedTab === 'teams' && item.eventId > 0 && (
            <Text style={[styles.noteEvent, { color: settings.secondaryTextColor }]}>
              Event: {item.matchName}
            </Text>
          )}
          {selectedTab === 'events' && (
            <Text style={[styles.noteTeam, { color: settings.secondaryTextColor }]}>
              Team: {item.teamNumber} - {item.teamName}
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeleteNote(item.id)}
        >
          <Ionicons name="trash" size={18} color="#ff4444" />
        </TouchableOpacity>
      </View>
      <Text style={[styles.noteText, { color: settings.textColor }]}>
        {item.note}
      </Text>
      {item.imageUri && (
        <Image
          source={{ uri: item.imageUri }}
          style={styles.noteImage}
          resizeMode="cover"
        />
      )}
    </View>
  );

  const renderEmptyState = () => {
    const message = searchQuery.trim()
      ? `No notes found matching "${searchQuery}"`
      : notes.length === 0
        ? "You haven't created any notes yet"
        : `No notes found in ${selectedTab}`;

    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="document-text-outline" size={64} color={settings.iconColor} />
        <Text style={[styles.emptyTitle, { color: settings.textColor }]}>
          {searchQuery.trim() ? 'No Results' : 'No Notes'}
        </Text>
        <Text style={[styles.emptyMessage, { color: settings.secondaryTextColor }]}>
          {message}
        </Text>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.container, { backgroundColor: settings.backgroundColor }]}>
        {/* Header */}
        <View style={[styles.header, {
          backgroundColor: settings.topBarColor,
          borderBottomColor: settings.borderColor
        }]}>
          <Text style={[styles.headerTitle, { color: settings.topBarContentColor }]}>
            Manage Notes
          </Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color={settings.topBarContentColor} />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={[styles.searchContainer, {
          backgroundColor: settings.cardBackgroundColor,
          borderBottomColor: settings.borderColor
        }]}>
          <View style={[styles.searchBar, {
            backgroundColor: settings.backgroundColor,
            borderColor: settings.borderColor
          }]}>
            <Ionicons name="search" size={20} color={settings.iconColor} />
            <TextInput
              style={[styles.searchInput, { color: settings.textColor }]}
              placeholder="Search notes..."
              placeholderTextColor={settings.secondaryTextColor}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color={settings.iconColor} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Tab Selector */}
        <View style={[styles.tabContainer, {
          backgroundColor: settings.cardBackgroundColor,
          borderBottomColor: settings.borderColor
        }]}>
          <TouchableOpacity
            style={[styles.tab, selectedTab === 'teams' && { borderBottomColor: settings.buttonColor }]}
            onPress={() => setSelectedTab('teams')}
          >
            <Ionicons
              name="people"
              size={20}
              color={selectedTab === 'teams' ? settings.buttonColor : settings.iconColor}
            />
            <Text style={[
              styles.tabText,
              { color: selectedTab === 'teams' ? settings.buttonColor : settings.textColor }
            ]}>
              Teams
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, selectedTab === 'events' && { borderBottomColor: settings.buttonColor }]}
            onPress={() => setSelectedTab('events')}
          >
            <Ionicons
              name="calendar"
              size={20}
              color={selectedTab === 'events' ? settings.buttonColor : settings.iconColor}
            />
            <Text style={[
              styles.tabText,
              { color: selectedTab === 'events' ? settings.buttonColor : settings.textColor }
            ]}>
              Events
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={settings.buttonColor} />
            <Text style={[styles.loadingText, { color: settings.textColor }]}>
              Loading notes...
            </Text>
          </View>
        ) : sections.length === 0 ? (
          renderEmptyState()
        ) : (
          <SectionList
            sections={sections}
            renderItem={renderNoteItem}
            renderSectionHeader={renderSectionHeader}
            keyExtractor={(item) => item.id}
            style={styles.list}
            showsVerticalScrollIndicator={false}
            stickySectionHeadersEnabled={true}
          />
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 60, // Account for status bar
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  searchContainer: {
    padding: 16,
    borderBottomWidth: 1,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  list: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  sectionHeaderContent: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  sectionCount: {
    fontSize: 14,
  },
  deleteAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    gap: 4,
  },
  deleteAllText: {
    fontSize: 12,
    fontWeight: '500',
  },
  noteItem: {
    margin: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  noteInfo: {
    flex: 1,
  },
  noteDate: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  noteEvent: {
    fontSize: 11,
  },
  noteTeam: {
    fontSize: 11,
  },
  deleteButton: {
    padding: 4,
  },
  noteText: {
    fontSize: 14,
    lineHeight: 20,
  },
  noteInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  imageIndicator: {
    marginLeft: 8,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  noteImage: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    marginTop: 8,
  },
});

export default NotesManagementModal;