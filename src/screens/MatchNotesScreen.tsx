/**
 * Match Notes Screen
 *
 * Description:
 * Allows users to take and view notes on teams during specific matches. Features
 * alliance-colored interfaces for red and blue teams with integrated note-taking
 * capabilities, photo attachments, and quick access to team statistics and historical notes.
 *
 * Navigation:
 * Accessed from match details screens or match lists when users want to take
 * notes on participating teams during competitions.
 *
 * Key Features:
 * - Alliance-colored note interface (red/blue team distinction)
 * - Photo attachment support with camera and gallery options
 * - Real-time note saving with auto-save indicator
 * - Character counter for note input
 * - Quick access to team stats and historical match notes
 * - Team information display with action buttons
 * - Enhanced modal view with photos, date/time, and delete functionality
 * - Filter options for won/lost matches
 * - Win/loss indicators and score display
 * - Multi-line text input with proper keyboard handling
 */
import React, { useState, useEffect, useRef } from 'react';
import { createLogger } from '../utils/logger';

const logger = createLogger('MatchNotesScreen');
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActionSheetIOS,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useSettings } from '../contexts/SettingsContext';
import { useNotes, TeamMatchNote } from '../contexts/NotesContext';
import { robotEventsAPI } from '../services/apiRouter';
import { Event, Team } from '../types';

interface Props {
  route: {
    params: {
      event: Event;
      match: any; // Match object
      teamsMap: { [key: string]: string };
    };
  };
  navigation: any;
}

interface TeamNotesProps {
  event: Event;
  match: any;
  team: Team;
  teamAlliance: 'red' | 'blue';
  onShowStats: () => void;
  onShowTeamNotes: () => void;
}

const MAX_NOTE_LENGTH = 500;

const TeamNotes: React.FC<TeamNotesProps> = ({
  event,
  match,
  team,
  teamAlliance,
  onShowStats,
  onShowTeamNotes,
}) => {
  const settings = useSettings();
  const styles = createStyles(settings);
  const { getNote, createOrUpdateNote, deleteEmptyNotes, deleteNote } = useNotes();
  const [noteText, setNoteText] = useState('');
  const [currentNote, setCurrentNote] = useState<TeamMatchNote | null>(null);
  const [imageUri, setImageUri] = useState<string | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    loadNote();

    // Cleanup on unmount
    return () => {
      isMountedRef.current = false;
      if (saveTimeout) {
        clearTimeout(saveTimeout);
        setSaveTimeout(null);
      }
      setIsSaving(false);
    };
  }, [event.id, match.id, team.id]);

  const loadNote = async () => {
    // Clear any pending save operations
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      setSaveTimeout(null);
    }
    setIsSaving(false);

    const existingNote = getNote(event.id, match.id, team.id);
    if (existingNote) {
      setCurrentNote(existingNote);
      setNoteText(existingNote.note);
      setImageUri(existingNote.imageUri);
    } else {
      // Create new note structure
      const newNoteData = {
        eventId: event.id,
        matchId: match.id,
        matchName: match.name,
        note: '',
        played: match.scored || false,
        teamAlliance: teamAlliance === 'red' ? 1 : 2,
        teamId: team.id,
        teamName: team.team_name || team.number,
        teamNumber: team.number,
        time: match.started || match.scheduled || new Date().toISOString(),
        winningAlliance: getWinningAlliance(),
      };

      setCurrentNote(newNoteData as TeamMatchNote);
      setNoteText('');
      setImageUri(undefined);
    }
  };

  const getWinningAlliance = (): number => {
    if (!match.scored || !match.alliances) return 0;

    const redScore = match.alliances.find((a: any) => a.color === 'red')?.score || 0;
    const blueScore = match.alliances.find((a: any) => a.color === 'blue')?.score || 0;

    if (redScore > blueScore) return 1; // Red wins
    if (blueScore > redScore) return 2; // Blue wins
    return 0; // Tie or unknown
  };

  const getMatchScore = (): { red: number; blue: number } | null => {
    if (!match.scored || !match.alliances) return null;

    const redScore = match.alliances.find((a: any) => a.color === 'red')?.score || 0;
    const blueScore = match.alliances.find((a: any) => a.color === 'blue')?.score || 0;

    return { red: redScore, blue: blueScore };
  };

  const handleNoteChange = async (text: string) => {
    if (text.length > MAX_NOTE_LENGTH) return;

    setNoteText(text);

    // Clear existing timeout
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }

    // Show saving indicator
    setIsSaving(true);

    // Debounce save
    const timeout = setTimeout(async () => {
      if (!isMountedRef.current) return;

      if (currentNote) {
        try {
          const updatedNote = await createOrUpdateNote({
            ...currentNote,
            note: text,
            imageUri: imageUri,
          });
          if (isMountedRef.current) {
            setCurrentNote(updatedNote);
            setIsSaving(false);
          }
        } catch (error) {
          logger.error('Failed to save note:', error);
          if (isMountedRef.current) {
            setIsSaving(false);
          }
        }
      } else if (isMountedRef.current) {
        setIsSaving(false);
      }
    }, 500);

    setSaveTimeout(timeout);
  };

  const handleBlur = async () => {
    // Clean up empty notes when user finishes editing
    if (noteText.trim() === '' && !imageUri) {
      await deleteEmptyNotes();
    }
  };

  const handleImagePicker = async () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo', 'Choose from Library', imageUri ? 'Remove Photo' : ''],
          cancelButtonIndex: 0,
          destructiveButtonIndex: imageUri ? 3 : undefined,
        },
        async (buttonIndex) => {
          if (buttonIndex === 1) {
            await takePhoto();
          } else if (buttonIndex === 2) {
            await pickImage();
          } else if (buttonIndex === 3 && imageUri) {
            await removePhoto();
          }
        }
      );
    } else {
      Alert.alert(
        'Add Photo',
        'Choose an option',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Take Photo', onPress: takePhoto },
          { text: 'Choose from Library', onPress: pickImage },
          ...(imageUri ? [{ text: 'Remove Photo', onPress: removePhoto, style: 'destructive' as const }] : []),
        ]
      );
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Camera permission is required to take photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        setImageUri(uri);
        await saveWithImage(uri);
      }
    } catch (error) {
      logger.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Photo library permission is required to select photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        setImageUri(uri);
        await saveWithImage(uri);
      }
    } catch (error) {
      logger.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select photo');
    }
  };

  const removePhoto = async () => {
    setImageUri(undefined);
    if (currentNote) {
      try {
        const updatedNote = await createOrUpdateNote({
          ...currentNote,
          imageUri: undefined,
        });
        setCurrentNote(updatedNote);
      } catch (error) {
        logger.error('Failed to remove photo:', error);
      }
    }
  };

  const saveWithImage = async (uri: string) => {
    if (currentNote) {
      try {
        const updatedNote = await createOrUpdateNote({
          ...currentNote,
          note: noteText,
          imageUri: uri,
        });
        setCurrentNote(updatedNote);
      } catch (error) {
        logger.error('Failed to save note with image:', error);
      }
    }
  };

  const allianceColor = teamAlliance === 'red' ? '#FF6B6B' : '#4ECDC4';
  const allianceBackgroundColor = teamAlliance === 'red' ? 'rgba(255, 107, 107, 0.5)' : 'rgba(78, 205, 196, 0.5)';
  const matchScore = getMatchScore();
  const winningAlliance = getWinningAlliance();
  const didWin = winningAlliance !== 0 && winningAlliance === (teamAlliance === 'red' ? 1 : 2);
  const didLose = winningAlliance !== 0 && winningAlliance !== (teamAlliance === 'red' ? 1 : 2);

  return (
    <View style={[styles.teamNoteContainer, { backgroundColor: allianceBackgroundColor }]}>
      {/* Header with team info, score, and action buttons */}
      <View style={styles.teamHeader}>
        <View style={styles.teamInfo}>
          <View style={styles.teamNumberRow}>
            <Text style={styles.teamNumber}>{team.number}</Text>
            {winningAlliance !== 0 && (
              <View style={[
                styles.winIndicator,
                { backgroundColor: didWin ? '#28A745' : '#DC3545' }
              ]}>
                <Ionicons
                  name={didWin ? 'trophy' : 'close-circle'}
                  size={14}
                  color="#fff"
                />
              </View>
            )}
          </View>
          <Text style={styles.teamName}>
            {team.team_name || 'Unknown Team'}
          </Text>
          {matchScore && (
            <Text style={styles.scoreText}>
              Score: {teamAlliance === 'red' ? matchScore.red : matchScore.blue}
            </Text>
          )}
        </View>

        <View style={styles.actionButtons}>
          {/* Photo Button */}
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: allianceColor + '4D' }]}
            onPress={handleImagePicker}
          >
            <Ionicons
              name={imageUri ? 'image' : 'camera-outline'}
              size={16}
              color={settings.textColor}
            />
            <Text style={styles.actionButtonText}>Photo</Text>
          </TouchableOpacity>

          {/* Stats Button */}
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: allianceColor + '4D' }]}
            onPress={onShowStats}
          >
            <Ionicons name="analytics" size={16} color={settings.textColor} />
            <Text style={styles.actionButtonText}>Stats</Text>
          </TouchableOpacity>

          {/* Notes Button */}
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: allianceColor + '4D' }]}
            onPress={onShowTeamNotes}
          >
            <Ionicons name="document-text" size={16} color={settings.textColor} />
            <Text style={styles.actionButtonText}>Notes</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Photo preview */}
      {imageUri && (
        <View style={styles.photoPreview}>
          <Image source={{ uri: imageUri }} style={styles.photoImage} />
          <TouchableOpacity
            style={styles.removePhotoButton}
            onPress={removePhoto}
          >
            <Ionicons name="close-circle" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {/* Note input field */}
      <View style={styles.noteInputContainer}>
        <TextInput
          style={[
            styles.noteInput,
            { backgroundColor: settings.colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.9)' }
          ]}
          placeholder={`Write a match note for team ${team.number}...`}
          placeholderTextColor={settings.colorScheme === 'dark' ? '#8E8E93' : '#999'}
          value={noteText}
          onChangeText={handleNoteChange}
          onBlur={handleBlur}
          multiline
          textAlignVertical="top"
          numberOfLines={3}
        />
        <View style={styles.noteFooter}>
          <Text style={[styles.charCounter, {
            color: noteText.length > MAX_NOTE_LENGTH * 0.9 ? '#DC3545' : settings.secondaryTextColor
          }]}>
            {noteText.length}/{MAX_NOTE_LENGTH}
          </Text>
          {isSaving && (
            <View style={styles.savingIndicator}>
              <ActivityIndicator size="small" color={settings.buttonColor} />
              <Text style={[styles.savingText, { color: settings.secondaryTextColor }]}>Saving...</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

const MatchNotesScreen = ({ route, navigation }: Props) => {
  const { event, match, teamsMap } = route.params;
  const settings = useSettings();
  const { getNotesByEvent, getNotesByTeam, deleteNote } = useNotes();
  const [showTeamNotesModal, setShowTeamNotesModal] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'won' | 'lost'>('all');

  useEffect(() => {
    navigation.setOptions({
      title: `${match.name} Notes`,
      headerStyle: {
        backgroundColor: settings.buttonColor,
      },
      headerTintColor: '#fff',
      headerTitleAlign: 'center',
      headerTitleStyle: {
        fontWeight: '500',
        fontSize: 19,
      },
    });
  }, [navigation, settings.buttonColor, match.name]);

  const getTeamsFromMatch = (): { redTeams: Team[]; blueTeams: Team[] } => {
    const redTeams: Team[] = [];
    const blueTeams: Team[] = [];

    // Handle new format with red_teams and blue_teams arrays
    if (match.red_teams && match.blue_teams) {
      // Process red teams
      match.red_teams.forEach((teamNumber: string, index: number) => {
        const teamId = parseInt(teamNumber) || index + 1000;
        const teamName = teamsMap[teamNumber] || teamNumber;
        const team: Team = {
          id: teamId,
          number: teamNumber,
          team_name: teamName,
          robot_name: '',
          organization: '',
          location: { city: '', region: '', country: '' },
          registered: true,
          program: { id: 1, name: 'VEX V5 Robotics Competition', code: 'V5RC' },
          grade: 'High School',
        };
        redTeams.push(team);
      });

      // Process blue teams
      match.blue_teams.forEach((teamNumber: string, index: number) => {
        const teamId = parseInt(teamNumber) || index + 2000;
        const teamName = teamsMap[teamNumber] || teamNumber;
        const team: Team = {
          id: teamId,
          number: teamNumber,
          team_name: teamName,
          robot_name: '',
          organization: '',
          location: { city: '', region: '', country: '' },
          registered: true,
          program: { id: 1, name: 'VEX V5 Robotics Competition', code: 'V5RC' },
          grade: 'High School',
        };
        blueTeams.push(team);
      });
    }
    // Handle legacy format with alliances
    else if (match.alliances) {
      match.alliances.forEach((alliance: any) => {
        alliance.teams.forEach((teamData: any) => {
          // teamData.team is an IdInfo where 'name' is actually the team number
          const teamNumber = teamsMap[teamData.team.id.toString()] || teamData.team.name || teamData.team.id.toString();
          const teamName = teamsMap[teamNumber] || teamNumber;
          const team: Team = {
            id: teamData.team.id,
            number: teamNumber,
            team_name: teamName,
            robot_name: '',
            organization: '',
            location: { city: '', region: '', country: '' },
            registered: true,
            program: { id: 1, name: 'VEX V5 Robotics Competition', code: 'V5RC' },
            grade: 'High School',
          };

          if (alliance.color === 'red') {
            redTeams.push(team);
          } else if (alliance.color === 'blue') {
            blueTeams.push(team);
          }
        });
      });
    }

    return { redTeams, blueTeams };
  };

  const { redTeams, blueTeams } = getTeamsFromMatch();

  const handleShowStats = (team: Team) => {
    navigation.navigate('EventTeamInfo', {
      event: event,
      teamNumber: team.number,
      teamData: null,
      division: null,
      defaultPage: 'information'
    });
  };

  const handleShowTeamNotes = (team: Team) => {
    setSelectedTeam(team);
    setShowTeamNotesModal(true);
  };

  const handleDeleteNote = (noteId: string) => {
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
            } catch (error) {
              logger.error('Failed to delete note:', error);
              Alert.alert('Error', 'Failed to delete note');
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const renderTeamNotesModal = () => {
    if (!selectedTeam) return null;

    const teamNotes = getNotesByTeam(selectedTeam.id, event.id);
    let filteredNotes = teamNotes.filter(note => note.note.trim() !== '' || note.imageUri);

    // Apply filter
    if (filterType === 'won') {
      filteredNotes = filteredNotes.filter(note =>
        note.winningAlliance !== 0 && note.winningAlliance === note.teamAlliance
      );
    } else if (filterType === 'lost') {
      filteredNotes = filteredNotes.filter(note =>
        note.winningAlliance !== 0 && note.winningAlliance !== note.teamAlliance
      );
    }

    return (
      <Modal
        visible={showTeamNotesModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowTeamNotesModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: settings.backgroundColor }]}>
          <View style={[styles.modalHeader, { borderBottomColor: settings.borderColor }]}>
            <Text style={[styles.modalTitle, { color: settings.textColor }]}>
              {selectedTeam.number} Match Notes
            </Text>
            <TouchableOpacity
              onPress={() => setShowTeamNotesModal(false)}
              style={styles.modalCloseButton}
            >
              <Ionicons name="close" size={24} color={settings.textColor} />
            </TouchableOpacity>
          </View>

          {/* Filter buttons */}
          <View style={styles.filterContainer}>
            <TouchableOpacity
              style={[
                styles.filterButton,
                { backgroundColor: settings.cardBackgroundColor, borderColor: settings.borderColor },
                filterType === 'all' && { backgroundColor: settings.buttonColor }
              ]}
              onPress={() => setFilterType('all')}
            >
              <Text style={[
                styles.filterButtonText,
                { color: filterType === 'all' ? '#fff' : settings.textColor }
              ]}>
                All
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterButton,
                { backgroundColor: settings.cardBackgroundColor, borderColor: settings.borderColor },
                filterType === 'won' && { backgroundColor: '#28A745' }
              ]}
              onPress={() => setFilterType('won')}
            >
              <Text style={[
                styles.filterButtonText,
                { color: filterType === 'won' ? '#fff' : settings.textColor }
              ]}>
                Won
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterButton,
                { backgroundColor: settings.cardBackgroundColor, borderColor: settings.borderColor },
                filterType === 'lost' && { backgroundColor: '#DC3545' }
              ]}
              onPress={() => setFilterType('lost')}
            >
              <Text style={[
                styles.filterButtonText,
                { color: filterType === 'lost' ? '#fff' : settings.textColor }
              ]}>
                Lost
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {filteredNotes.length === 0 ? (
              <Text style={[styles.noNotesText, { color: settings.secondaryTextColor }]}>
                {filterType === 'all' ? 'No notes for this team.' : `No ${filterType} matches with notes.`}
              </Text>
            ) : (
              filteredNotes.map((note) => (
                <View
                  key={note.id}
                  style={[styles.noteItem, { backgroundColor: settings.cardBackgroundColor, borderColor: settings.borderColor }]}
                >
                  <View style={styles.noteHeader}>
                    <View style={styles.noteHeaderLeft}>
                      <Text
                        style={[
                          styles.noteMatchName,
                          {
                            color: note.winningAlliance === 0
                              ? (note.played ? '#FFA500' : settings.textColor)
                              : (note.winningAlliance === note.teamAlliance ? '#28A745' : '#DC3545')
                          }
                        ]}
                      >
                        {note.matchName}
                      </Text>
                      <Text style={[styles.noteDate, { color: settings.secondaryTextColor }]}>
                        {formatDate(note.time)}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleDeleteNote(note.id)}
                      style={styles.deleteButton}
                    >
                      <Ionicons name="trash-outline" size={20} color="#DC3545" />
                    </TouchableOpacity>
                  </View>

                  {note.imageUri && (
                    <Image
                      source={{ uri: note.imageUri }}
                      style={styles.noteImage}
                      resizeMode="cover"
                    />
                  )}

                  {note.note && (
                    <Text style={[styles.noteText, { color: settings.textColor }]}>
                      {note.note}
                    </Text>
                  )}
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </Modal>
    );
  };

  const styles = createStyles(settings);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: settings.backgroundColor }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={[styles.scrollView, { backgroundColor: settings.backgroundColor }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.teamsContainer}>
          {/* Red alliance teams */}
          {redTeams.map((team, index) => (
            <TeamNotes
              key={`red-${team.id}-${index}`}
              event={event}
              match={match}
              team={team}
              teamAlliance="red"
              onShowStats={() => handleShowStats(team)}
              onShowTeamNotes={() => handleShowTeamNotes(team)}
            />
          ))}

          {/* Blue alliance teams */}
          {blueTeams.map((team, index) => (
            <TeamNotes
              key={`blue-${team.id}-${index}`}
              event={event}
              match={match}
              team={team}
              teamAlliance="blue"
              onShowStats={() => handleShowStats(team)}
              onShowTeamNotes={() => handleShowTeamNotes(team)}
            />
          ))}
        </View>
      </ScrollView>

      {renderTeamNotesModal()}
    </KeyboardAvoidingView>
  );
};

const createStyles = (settings: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  teamsContainer: {
    padding: 16,
    gap: 12,
  },
  teamNoteContainer: {
    borderRadius: 20,
    padding: 16,
    marginVertical: 2,
  },
  teamHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  teamInfo: {
    flex: 1,
  },
  teamNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  teamNumber: {
    fontSize: 26,
    fontWeight: 'bold',
    color: settings.textColor,
  },
  winIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  teamName: {
    fontSize: 15,
    color: settings.colorScheme === 'dark' ? '#8E8E93' : '#666',
    marginTop: 2,
  },
  scoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: settings.textColor,
    marginTop: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 56,
    height: 56,
    borderRadius: 13,
    gap: 4,
  },
  actionButtonText: {
    fontSize: 9,
    color: settings.textColor,
    textAlign: 'center',
    fontWeight: '500',
  },
  photoPreview: {
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  photoImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  removePhotoButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 12,
  },
  noteInputContainer: {
    gap: 8,
  },
  noteInput: {
    borderRadius: 13,
    padding: 12,
    fontSize: 15,
    minHeight: 90,
    textAlignVertical: 'top',
    color: settings.textColor,
  },
  noteFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  charCounter: {
    fontSize: 12,
    fontWeight: '500',
  },
  savingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  savingText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  modalCloseButton: {
    padding: 8,
  },
  filterContainer: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  noNotesText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 40,
  },
  noteItem: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  noteHeaderLeft: {
    flex: 1,
  },
  noteMatchName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  noteDate: {
    fontSize: 13,
  },
  deleteButton: {
    padding: 4,
  },
  noteImage: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    marginBottom: 12,
  },
  noteText: {
    fontSize: 15,
    lineHeight: 21,
  },
});

export default MatchNotesScreen;
