import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  initDatabase,
  migrate,
  getDatabase,
  closeDatabase,
  resetDatabase,
  getDbStats,
} from './db.js';
import { unlinkSync } from 'node:fs';

const TEST_DB_PATH = './test-db.sqlite';

describe('Database Connection', () => {
  beforeEach(() => {
    // Clean slate for each test
    try {
      unlinkSync(TEST_DB_PATH);
    } catch {
      // File doesn't exist, that's fine
    }
  });

  afterEach(() => {
    closeDatabase();
    try {
      unlinkSync(TEST_DB_PATH);
    } catch {
      // Cleanup
    }
  });

  it('should initialize database', () => {
    const db = initDatabase(TEST_DB_PATH);
    expect(db).toBeDefined();
    expect(db.filename).toBe(TEST_DB_PATH);
  });

  it('should return same instance on repeated calls', () => {
    const db1 = initDatabase(TEST_DB_PATH);
    const db2 = initDatabase(TEST_DB_PATH);
    expect(db1).toBe(db2);
  });

  it('should enable foreign keys', () => {
    initDatabase(TEST_DB_PATH);
    const db = getDatabase();
    const result = db.query<{ foreign_keys: number }, []>('PRAGMA foreign_keys').get();
    expect(result?.foreign_keys).toBe(1);
  });

  it('should create all tables via migration', () => {
    initDatabase(TEST_DB_PATH);
    migrate();

    const stats = getDbStats();
    expect(stats.tableCount).toBe(8);
    expect(stats.tables.map((t) => t.name)).toContain('anilist_manga');
    expect(stats.tables.map((t) => t.name)).toContain('provider_manga');
    expect(stats.tables.map((t) => t.name)).toContain('manga_mappings');
  });

  it('should reset database (delete all tables)', () => {
    initDatabase(TEST_DB_PATH);
    migrate();

    let stats = getDbStats();
    expect(stats.tableCount).toBe(8);

    resetDatabase();

    stats = getDbStats();
    expect(stats.tableCount).toBe(0);
  });

  it('should close database connection', () => {
    initDatabase(TEST_DB_PATH);
    closeDatabase();

    // Getting database should throw after close
    expect(() => getDatabase()).toThrow('Database not initialized');
  });
});
