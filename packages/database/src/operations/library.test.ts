import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initDatabase, migrate, closeDatabase } from '../db.js';
import {
  addToLibrary,
  getLibrary,
  getLibraryEntry,
  getLibraryEntryById,
  updateProgress,
  updateStatus,
  updateScore,
  toggleFavorite,
  updateNotes,
  removeFromLibrary,
  getRecentlyRead,
  getFavorites,
  getLibraryStats,
  searchLibrary,
} from './library.js';
import { saveProviderManga } from './provider.js';
import type { UserLibraryInput } from '../types.js';
import { unlinkSync } from 'node:fs';

const TEST_DB_PATH = './test-library-ops.sqlite';

describe('Library Operations', () => {
  // Setup provider manga for foreign key constraints
  let providerMangaId: number;

  beforeEach(() => {
    try {
      unlinkSync(TEST_DB_PATH);
    } catch {
      // File doesn't exist
    }
    initDatabase(TEST_DB_PATH);
    migrate();

    // Create test provider manga
    providerMangaId = saveProviderManga({
      provider: 'asura',
      provider_id: 'solo-leveling-1',
      provider_url: 'https://asura.com/solo-leveling',
      title: 'Solo Leveling',
      last_scraped: Date.now(),
    });
  });

  afterEach(() => {
    closeDatabase();
    try {
      unlinkSync(TEST_DB_PATH);
    } catch {
      // Cleanup
    }
  });

  describe('addToLibrary', () => {
    it('should add new manga to library', () => {
      const entry: UserLibraryInput = {
        provider: 'asura',
        provider_manga_id: providerMangaId,
        added_at: Date.now(),
      };

      const id = addToLibrary(entry);
      expect(id).toBeGreaterThan(0);

      const retrieved = getLibraryEntryById(id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.provider).toBe('asura');
      expect(retrieved?.status).toBe('reading'); // Default value
    });

    it('should upsert existing library entry', () => {
      const entry: UserLibraryInput = {
        provider: 'asura',
        provider_manga_id: providerMangaId,
        progress: 10,
        added_at: Date.now(),
      };

      addToLibrary(entry);

      // Update with new progress
      addToLibrary({
        ...entry,
        progress: 25,
      });

      const retrieved = getLibraryEntry('asura', providerMangaId);
      expect(retrieved?.progress).toBe(25);
    });

    it('should set default values correctly', () => {
      const id = addToLibrary({
        provider: 'asura',
        provider_manga_id: providerMangaId,
        added_at: Date.now(),
      });

      const entry = getLibraryEntryById(id);
      expect(entry?.status).toBe('reading');
      expect(entry?.progress).toBe(0);
      expect(entry?.is_favorite).toBe(0);
    });
  });

  describe('getLibrary', () => {
    beforeEach(() => {
      // Add multiple entries with different statuses
      const now = Date.now();

      addToLibrary({
        provider: 'asura',
        provider_manga_id: providerMangaId,
        status: 'reading',
        added_at: now,
      });

      const id2 = saveProviderManga({
        provider: 'asura',
        provider_id: 'test-2',
        provider_url: 'https://asura.com/test-2',
        title: 'Test Manga 2',
        last_scraped: now,
      });

      addToLibrary({
        provider: 'asura',
        provider_manga_id: id2,
        status: 'completed',
        added_at: now,
      });
    });

    it('should get all library entries', () => {
      const library = getLibrary();
      expect(library.length).toBe(2);
    });

    it('should filter by status', () => {
      const reading = getLibrary('reading');
      expect(reading.length).toBe(1);
      expect(reading[0].status).toBe('reading');

      const completed = getLibrary('completed');
      expect(completed.length).toBe(1);
      expect(completed[0].status).toBe('completed');
    });
  });

  describe('updateProgress', () => {
    it('should update reading progress and last_read timestamp', () => {
      const id = addToLibrary({
        provider: 'asura',
        provider_manga_id: providerMangaId,
        progress: 0,
        added_at: Date.now(),
      });

      const before = getLibraryEntryById(id);
      const beforeTime = before?.last_read;

      // Wait a bit to ensure timestamp changes
      updateProgress(id, 25);

      const after = getLibraryEntryById(id);
      expect(after?.progress).toBe(25);
      expect(after?.last_read).toBeGreaterThan(beforeTime || 0);
    });
  });

  describe('updateStatus', () => {
    it('should update status', () => {
      const id = addToLibrary({
        provider: 'asura',
        provider_manga_id: providerMangaId,
        status: 'reading',
        added_at: Date.now(),
      });

      updateStatus(id, 'paused');

      const entry = getLibraryEntryById(id);
      expect(entry?.status).toBe('paused');
    });

    it('should set started_at when changing to reading', () => {
      const id = addToLibrary({
        provider: 'asura',
        provider_manga_id: providerMangaId,
        status: 'plan_to_read',
        added_at: Date.now(),
      });

      const before = getLibraryEntryById(id);
      expect(before?.started_at).toBeNull();

      updateStatus(id, 'reading');

      const after = getLibraryEntryById(id);
      expect(after?.started_at).not.toBeNull();
    });

    it('should set completed_at when changing to completed', () => {
      const id = addToLibrary({
        provider: 'asura',
        provider_manga_id: providerMangaId,
        status: 'reading',
        added_at: Date.now(),
      });

      updateStatus(id, 'completed');

      const entry = getLibraryEntryById(id);
      expect(entry?.completed_at).not.toBeNull();
      expect(entry?.status).toBe('completed');
    });

    it('should throw if entry not found', () => {
      expect(() => updateStatus(99999, 'reading')).toThrow('Library entry 99999 not found');
    });
  });

  describe('updateScore', () => {
    it('should update score', () => {
      const id = addToLibrary({
        provider: 'asura',
        provider_manga_id: providerMangaId,
        added_at: Date.now(),
      });

      updateScore(id, 8.5);

      const entry = getLibraryEntryById(id);
      expect(entry?.score).toBe(8.5);
    });

    it('should allow setting score to null', () => {
      const id = addToLibrary({
        provider: 'asura',
        provider_manga_id: providerMangaId,
        score: 7.0,
        added_at: Date.now(),
      });

      updateScore(id, null);

      const entry = getLibraryEntryById(id);
      expect(entry?.score).toBeNull();
    });
  });

  describe('toggleFavorite', () => {
    it('should toggle favorite status', () => {
      const id = addToLibrary({
        provider: 'asura',
        provider_manga_id: providerMangaId,
        is_favorite: 0,
        added_at: Date.now(),
      });

      toggleFavorite(id);
      expect(getLibraryEntryById(id)?.is_favorite).toBe(1);

      toggleFavorite(id);
      expect(getLibraryEntryById(id)?.is_favorite).toBe(0);
    });
  });

  describe('updateNotes', () => {
    it('should update notes', () => {
      const id = addToLibrary({
        provider: 'asura',
        provider_manga_id: providerMangaId,
        added_at: Date.now(),
      });

      updateNotes(id, 'Amazing series!');

      const entry = getLibraryEntryById(id);
      expect(entry?.notes).toBe('Amazing series!');
    });
  });

  describe('removeFromLibrary', () => {
    it('should delete library entry', () => {
      const id = addToLibrary({
        provider: 'asura',
        provider_manga_id: providerMangaId,
        added_at: Date.now(),
      });

      expect(getLibraryEntryById(id)).not.toBeNull();

      removeFromLibrary(id);

      expect(getLibraryEntryById(id)).toBeNull();
    });
  });

  describe('getRecentlyRead', () => {
    it('should return recently read manga sorted by last_read', () => {
      const now = Date.now();

      const id1 = addToLibrary({
        provider: 'asura',
        provider_manga_id: providerMangaId,
        last_read: now - 1000,
        added_at: now,
      });

      const id2 = saveProviderManga({
        provider: 'asura',
        provider_id: 'test-2',
        provider_url: 'https://asura.com/test-2',
        title: 'Test 2',
        last_scraped: now,
      });

      addToLibrary({
        provider: 'asura',
        provider_manga_id: id2,
        last_read: now,
        added_at: now,
      });

      const recent = getRecentlyRead(10);
      expect(recent.length).toBe(2);
      expect(recent[0].provider_manga_id).toBe(id2); // More recent first
      expect(recent[1].provider_manga_id).toBe(providerMangaId);
    });

    it('should exclude entries with null last_read', () => {
      addToLibrary({
        provider: 'asura',
        provider_manga_id: providerMangaId,
        last_read: null,
        added_at: Date.now(),
      });

      const recent = getRecentlyRead(10);
      expect(recent.length).toBe(0);
    });
  });

  describe('getFavorites', () => {
    it('should return only favorited manga', () => {
      addToLibrary({
        provider: 'asura',
        provider_manga_id: providerMangaId,
        is_favorite: 1,
        added_at: Date.now(),
      });

      const id2 = saveProviderManga({
        provider: 'asura',
        provider_id: 'test-2',
        provider_url: 'https://asura.com/test-2',
        title: 'Test 2',
        last_scraped: Date.now(),
      });

      addToLibrary({
        provider: 'asura',
        provider_manga_id: id2,
        is_favorite: 0,
        added_at: Date.now(),
      });

      const favorites = getFavorites();
      expect(favorites.length).toBe(1);
      expect(favorites[0].is_favorite).toBe(1);
    });
  });

  describe('getLibraryStats', () => {
    beforeEach(() => {
      const now = Date.now();

      // Add various entries
      addToLibrary({
        provider: 'asura',
        provider_manga_id: providerMangaId,
        status: 'reading',
        is_favorite: 1,
        added_at: now,
      });

      const id2 = saveProviderManga({
        provider: 'asura',
        provider_id: 'test-2',
        provider_url: 'https://asura.com/test-2',
        title: 'Test 2',
        last_scraped: now,
      });

      addToLibrary({
        provider: 'asura',
        provider_manga_id: id2,
        status: 'completed',
        added_at: now,
      });

      const id3 = saveProviderManga({
        provider: 'asura',
        provider_id: 'test-3',
        provider_url: 'https://asura.com/test-3',
        title: 'Test 3',
        last_scraped: now,
      });

      addToLibrary({
        provider: 'asura',
        provider_manga_id: id3,
        status: 'plan_to_read',
        added_at: now,
      });
    });

    it('should return accurate statistics', () => {
      const stats = getLibraryStats();

      expect(stats.total).toBe(3);
      expect(stats.reading).toBe(1);
      expect(stats.completed).toBe(1);
      expect(stats.plan_to_read).toBe(1);
      expect(stats.paused).toBe(0);
      expect(stats.dropped).toBe(0);
      expect(stats.favorites).toBe(1);
    });
  });

  describe('searchLibrary', () => {
    beforeEach(() => {
      // Provider manga already created with title "Solo Leveling"
      addToLibrary({
        provider: 'asura',
        provider_manga_id: providerMangaId,
        added_at: Date.now(),
      });

      const id2 = saveProviderManga({
        provider: 'asura',
        provider_id: 'test-2',
        provider_url: 'https://asura.com/test-2',
        title: 'Tower of God',
        last_scraped: Date.now(),
      });

      addToLibrary({
        provider: 'asura',
        provider_manga_id: id2,
        added_at: Date.now(),
      });
    });

    it('should search library by title', () => {
      const results = searchLibrary('Solo');
      expect(results.length).toBe(1);
      expect(results[0].provider_manga_id).toBe(providerMangaId);
    });

    it('should be case-insensitive', () => {
      const results = searchLibrary('TOWER');
      expect(results.length).toBe(1);
    });

    it('should return empty array if no matches', () => {
      const results = searchLibrary('NonExistent');
      expect(results.length).toBe(0);
    });
  });
});
