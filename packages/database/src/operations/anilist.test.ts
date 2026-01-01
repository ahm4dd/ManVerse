import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initDatabase, migrate, closeDatabase, resetDatabase } from '../db.js';
import {
  saveAnilistManga,
  getAnilistManga,
  searchLocalAnilist,
  bulkInsertAnilist,
  isAnilistDataStale,
  countAnilistManga,
  deleteAnilistManga,
} from './anilist.js';
import type { AniListMangaInput } from '../types.js';
import { unlinkSync } from 'node:fs';

const TEST_DB_PATH = './test-anilist-ops.sqlite';

const sampleManga: AniListMangaInput = {
  id: 105398,
  title_romaji: 'Na Honjaman Level Up',
  title_english: 'Solo Leveling',
  title_native: '나 혼자만 레벨업',
  status: 'FINISHED',
  genres: JSON.stringify(['Action', 'Adventure', 'Fantasy']),
  last_updated: Date.now(),
  chapters: 201,
  average_score: 84,
  popularity: 50000,
};

describe('AniList Operations', () => {
  beforeEach(() => {
    try {
      unlinkSync(TEST_DB_PATH);
    } catch {
      // File doesn't exist
    }
    initDatabase(TEST_DB_PATH);
    migrate();
  });

  afterEach(() => {
    closeDatabase();
    try {
      unlinkSync(TEST_DB_PATH);
    } catch {
      // Cleanup
    }
  });

  it('should save new AniList manga', () => {
    saveAnilistManga(sampleManga);

    const manga = getAnilistManga(105398);
    expect(manga).not.toBeNull();
    expect(manga?.title_romaji).toBe('Na Honjaman Level Up');
    expect(manga?.title_english).toBe('Solo Leveling');
  });

  it('should update existing manga (upsert)', () => {
    saveAnilistManga(sampleManga);

    // Update with new data
    saveAnilistManga({
      ...sampleManga,
      chapters: 202, // Changed
      last_updated: Date.now(),
    });

    const manga = getAnilistManga(105398);
    expect(manga?.chapters).toBe(202);
  });

  it('should return null for non-existent manga', () => {
    const manga = getAnilistManga(99999);
    expect(manga).toBeNull();
  });

  it('should search by title (romaji)', () => {
    saveAnilistManga(sampleManga);

    const results = searchLocalAnilist('Solo');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe(105398);
  });

  it('should search by title (english)', () => {
    saveAnilistManga(sampleManga);

    const results = searchLocalAnilist('Level Up');
    expect(results.length).toBeGreaterThan(0);
  });

  it('should search case-insensitively', () => {
    saveAnilistManga(sampleManga);

    const results = searchLocalAnilist('SOLO LEVELING');
    expect(results.length).toBeGreaterThan(0);
  });

  it('should bulk insert multiple manga', () => {
    const mangas: AniListMangaInput[] = [
      sampleManga,
      {
        id: 30002,
        title_romaji: 'Berserk',
        title_english: 'Berserk',
        status: 'RELEASING',
        genres: JSON.stringify(['Action', 'Dark Fantasy']),
        last_updated: Date.now(),
      },
      {
        id: 101517,
        title_romaji: 'Tower of God',
        title_english: null,
        status: 'RELEASING',
        genres: JSON.stringify(['Action', 'Fantasy']),
        last_updated: Date.now(),
      },
    ];

    bulkInsertAnilist(mangas);

    expect(countAnilistManga()).toBe(3);
    expect(getAnilistManga(30002)).not.toBeNull();
    expect(getAnilistManga(101517)).not.toBeNull();
  });

  it('should check if data is stale', () => {
    const oldTimestamp = Date.now() - 25 * 60 * 60 * 1000; // 25 hours ago
    saveAnilistManga({
      ...sampleManga,
      last_updated: oldTimestamp,
    });

    const isStale = isAnilistDataStale(105398, 24 * 60 * 60 * 1000); // 24 hour TTL
    expect(isStale).toBe(true);
  });

  it('should return true for non-cached manga', () => {
    const isStale = isAnilistDataStale(99999, 24 * 60 * 60 * 1000);
    expect(isStale).toBe(true);
  });

  it('should delete manga', () => {
    saveAnilistManga(sampleManga);
    expect(getAnilistManga(105398)).not.toBeNull();

    deleteAnilistManga(105398);
    expect(getAnilistManga(105398)).toBeNull();
  });

  it('should count total manga', () => {
    expect(countAnilistManga()).toBe(0);

    saveAnilistManga(sampleManga);
    expect(countAnilistManga()).toBe(1);

    saveAnilistManga({
      id: 30002,
      title_romaji: 'Berserk',
      status: 'RELEASING',
      genres: '[]',
      last_updated: Date.now(),
    });
    expect(countAnilistManga()).toBe(2);
  });
});
