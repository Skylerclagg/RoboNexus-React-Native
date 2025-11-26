import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { createLogger } from '../utils/logger';
import { storage } from '../utils/webCompatibility';

const logger = createLogger('NotesContext');

export interface TeamMatchNote {
  id: string; // Generated unique ID for React Native
  eventId: number;
  eventName?: string; // Optional event name for displaying context
  matchId: number;
  matchName: string;
  note: string;
  played: boolean;
  teamAlliance: number; // 0 = unknown, 1 = red, 2 = blue
  teamId: number;
  teamName: string;
  teamNumber: string;
  time: string; // ISO date string
  winningAlliance: number; // 0 = tie/unknown, 1 = red, 2 = blue
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
  imageUri?: string; // Optional image attachment
}

interface NotesContextType {
  notes: TeamMatchNote[];
  loadNotes: () => Promise<void>;
  getNotesByEvent: (eventId: number) => TeamMatchNote[];
  getNotesByTeam: (teamId: number, eventId?: number) => TeamMatchNote[];
  getNotesByMatch: (eventId: number, matchId: number) => TeamMatchNote[];
  getNote: (eventId: number, matchId: number, teamId: number) => TeamMatchNote | null;
  createOrUpdateNote: (noteData: Partial<TeamMatchNote>) => Promise<TeamMatchNote>;
  createNote: (noteData: Partial<TeamMatchNote>) => Promise<TeamMatchNote>;
  updateNote: (noteId: string, noteData: Partial<TeamMatchNote>) => Promise<TeamMatchNote>;
  deleteNote: (noteId: string) => Promise<void>;
  deleteAllNotesForTeam: (teamId: number) => Promise<void>;
  deleteAllNotesForEvent: (eventId: number) => Promise<void>;
  deleteEmptyNotes: () => Promise<void>;
  clearAllNotes: () => Promise<void>;
  getAllNotes: () => TeamMatchNote[];
}

const NotesContext = createContext<NotesContextType | undefined>(undefined);

export const useNotes = () => {
  const context = useContext(NotesContext);
  if (!context) {
    throw new Error('useNotes must be used within a NotesProvider');
  }
  return context;
};

interface NotesProviderProps {
  children: ReactNode;
}

const NOTES_STORAGE_KEY = 'team_match_notes';

export const NotesProvider: React.FC<NotesProviderProps> = ({ children }) => {
  const [notes, setNotes] = useState<TeamMatchNote[]>([]);

  useEffect(() => {
    loadNotes();
  }, []);

  const loadNotes = async (): Promise<void> => {
    try {
      const savedNotes = await storage.getItem(NOTES_STORAGE_KEY);
      if (savedNotes) {
        const parsedNotes: TeamMatchNote[] = JSON.parse(savedNotes);
        setNotes(parsedNotes);
        logger.debug('Loaded', parsedNotes.length, 'notes from storage');
      }
    } catch (error) {
      logger.error('Failed to load notes:', error);
    }
  };

  const saveNotes = async (newNotes: TeamMatchNote[]): Promise<void> => {
    try {
      await storage.setItem(NOTES_STORAGE_KEY, JSON.stringify(newNotes));
      setNotes(newNotes);
      logger.debug('Saved', newNotes.length, 'notes to storage');
    } catch (error) {
      logger.error('Failed to save notes:', error);
      throw error;
    }
  };

  const generateNoteId = (): string => {
    return 'note_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  };

  const getNotesByEvent = (eventId: number): TeamMatchNote[] => {
    return notes.filter(note => note.eventId === eventId);
  };

  const getNotesByTeam = (teamId: number, eventId?: number): TeamMatchNote[] => {
    return notes.filter(note => {
      const matchesTeam = note.teamId === teamId;
      const matchesEvent = eventId ? note.eventId === eventId : true;
      return matchesTeam && matchesEvent && note.note.trim() !== '';
    });
  };

  const getNotesByMatch = (eventId: number, matchId: number): TeamMatchNote[] => {
    return notes.filter(note =>
      note.eventId === eventId &&
      note.matchId === matchId &&
      (note.note.trim() !== '' || note.imageUri)
    );
  };

  const getNote = (eventId: number, matchId: number, teamId: number): TeamMatchNote | null => {
    return notes.find(note =>
      note.eventId === eventId &&
      note.matchId === matchId &&
      note.teamId === teamId
    ) || null;
  };

  const createNote = async (noteData: Partial<TeamMatchNote>): Promise<TeamMatchNote> => {
    try {
      const now = new Date().toISOString();

      const newNote: TeamMatchNote = {
        id: generateNoteId(),
        eventId: noteData.eventId || 0,
        eventName: noteData.eventName,
        matchId: noteData.matchId || 0,
        matchName: noteData.matchName || '',
        note: noteData.note || '',
        played: noteData.played || false,
        teamAlliance: noteData.teamAlliance || 0,
        teamId: noteData.teamId || 0,
        teamName: noteData.teamName || '',
        teamNumber: noteData.teamNumber || '',
        time: noteData.time || now,
        winningAlliance: noteData.winningAlliance || 0,
        createdAt: now,
        updatedAt: now,
        imageUri: noteData.imageUri,
      };

      const newNotes = [...notes, newNote];
      await saveNotes(newNotes);

      logger.debug('Created new note for team', newNote.teamNumber, 'in match', newNote.matchName || 'General');
      return newNote;
    } catch (error) {
      logger.error('Failed to create note:', error);
      throw error;
    }
  };

  const updateNote = async (noteId: string, noteData: Partial<TeamMatchNote>): Promise<TeamMatchNote> => {
    try {
      const now = new Date().toISOString();

      const existingNoteIndex = notes.findIndex(note => note.id === noteId);
      if (existingNoteIndex === -1) {
        throw new Error('Note not found');
      }

      const updatedNote: TeamMatchNote = {
        ...notes[existingNoteIndex],
        ...noteData,
        updatedAt: now,
      };

      const newNotes = [...notes];
      newNotes[existingNoteIndex] = updatedNote;
      await saveNotes(newNotes);

      logger.debug('Updated note', noteId, 'for team', updatedNote.teamNumber);
      return updatedNote;
    } catch (error) {
      logger.error('Failed to update note:', error);
      throw error;
    }
  };

  const createOrUpdateNote = async (noteData: Partial<TeamMatchNote>): Promise<TeamMatchNote> => {
    try {
      // Check if a note already exists for this team, match, and event
      const existingNote = notes.find(note =>
        note.eventId === noteData.eventId &&
        note.matchId === noteData.matchId &&
        note.teamId === noteData.teamId
      );

      if (existingNote) {
        // Update the existing note
        return await updateNote(existingNote.id, noteData);
      } else {
        // Create a new note
        return await createNote(noteData);
      }
    } catch (error) {
      logger.error('Failed to create or update note:', error);
      throw error;
    }
  };

  const deleteNote = async (noteId: string): Promise<void> => {
    try {
      const newNotes = notes.filter(note => note.id !== noteId);
      await saveNotes(newNotes);
      logger.debug('Deleted note', noteId);
    } catch (error) {
      logger.error('Failed to delete note:', error);
      throw error;
    }
  };

  const deleteAllNotesForTeam = async (teamId: number): Promise<void> => {
    try {
      const filteredNotes = notes.filter(note => note.teamId !== teamId);
      const deletedCount = notes.length - filteredNotes.length;

      if (deletedCount > 0) {
        await saveNotes(filteredNotes);
        logger.debug('Deleted', deletedCount, 'notes for team', teamId);
      }
    } catch (error) {
      logger.error('Failed to delete notes for team:', error);
      throw error;
    }
  };

  const deleteAllNotesForEvent = async (eventId: number): Promise<void> => {
    try {
      const filteredNotes = notes.filter(note => note.eventId !== eventId);
      const deletedCount = notes.length - filteredNotes.length;

      if (deletedCount > 0) {
        await saveNotes(filteredNotes);
        logger.debug('Deleted', deletedCount, 'notes for event', eventId);
      }
    } catch (error) {
      logger.error('Failed to delete notes for event:', error);
      throw error;
    }
  };

  const deleteEmptyNotes = async (): Promise<void> => {
    try {
      const nonEmptyNotes = notes.filter(note => note.note.trim() !== '');
      const deletedCount = notes.length - nonEmptyNotes.length;

      if (deletedCount > 0) {
        await saveNotes(nonEmptyNotes);
        logger.debug('Deleted', deletedCount, 'empty notes');
      }
    } catch (error) {
      logger.error('Failed to delete empty notes:', error);
      throw error;
    }
  };

  const clearAllNotes = async (): Promise<void> => {
    try {
      await saveNotes([]);
      logger.debug('Cleared all notes');
    } catch (error) {
      logger.error('Failed to clear all notes:', error);
      throw error;
    }
  };

  const getAllNotes = (): TeamMatchNote[] => {
    return notes;
  };

  const value: NotesContextType = {
    notes,
    loadNotes,
    getNotesByEvent,
    getNotesByTeam,
    getNotesByMatch,
    getNote,
    createOrUpdateNote,
    createNote,
    updateNote,
    deleteNote,
    deleteAllNotesForTeam,
    deleteAllNotesForEvent,
    deleteEmptyNotes,
    clearAllNotes,
    getAllNotes,
  };

  return (
    <NotesContext.Provider value={value}>
      {children}
    </NotesContext.Provider>
  );
};