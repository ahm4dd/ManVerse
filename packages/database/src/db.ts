import { Database } from 'bun:sqlite';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let db: Database | null = null;

const DEFAULT_DB_PATH = (() => {
  const override = Bun.env.MANVERSE_DB_PATH;
  if (override && override.trim().length > 0) {
    return override;
  }

  return path.join(os.homedir(), '.config', 'manverse', 'data.db');
})();

function ensureDirectory(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function initDatabase(dbPath: string = DEFAULT_DB_PATH): Database {
  if (db) {
    return db;
  }

  ensureDirectory(dbPath);
  db = new Database(dbPath);

  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');

  migrate(db);
  return db;
}

export function getDatabase(): Database {
  return db ?? initDatabase();
}

export function migrate(target: Database = getDatabase()): void {
  const schemaPath = new URL('./schema.sql', import.meta.url);
  const schema = fs.readFileSync(schemaPath, 'utf8');

  const legacyProvider = isLegacyProviderManga(target);
  const legacyLibrary = isLegacyUserLibrary(target);

  if (legacyProvider) {
    renameTableIfExists(target, 'provider_manga', 'provider_manga_legacy');
  }

  if (legacyLibrary) {
    renameTableIfExists(target, 'user_library', 'user_library_legacy');
  }

  try {
    target.exec(schema);
  } catch (error) {
    console.warn('Database schema migration warning:', error);
  }

  ensureColumn(target, 'anilist_manga', 'country_of_origin', 'TEXT');
  ensureColumn(target, 'user_library', 'user_id', 'TEXT');
  ensureColumn(target, 'user_library', 'anilist_entry_id', 'INTEGER');
  ensureColumn(target, 'user_library', 'created_at', 'INTEGER');
  ensureColumn(target, 'user_library', 'updated_at', 'INTEGER');
  ensureColumn(target, 'anilist_sync_state', 'user_id', 'TEXT');
  ensureColumn(target, 'anilist_sync_state', 'local_status', 'TEXT');
  ensureColumn(target, 'anilist_sync_state', 'local_progress', 'REAL');
  ensureColumn(target, 'anilist_sync_state', 'local_score', 'REAL');
  ensureColumn(target, 'anilist_sync_state', 'anilist_status', 'TEXT');
  ensureColumn(target, 'anilist_sync_state', 'anilist_progress', 'REAL');
  ensureColumn(target, 'anilist_sync_state', 'anilist_score', 'REAL');
  ensureColumn(target, 'anilist_sync_state', 'needs_sync', 'INTEGER');
  ensureColumn(target, 'anilist_sync_state', 'conflict_state', 'TEXT');
  ensureColumn(target, 'anilist_sync_state', 'updated_at', 'INTEGER');

  ensureColumn(target, 'provider_manga', 'image', 'TEXT');
  ensureColumn(target, 'provider_manga', 'rating', 'TEXT');
  ensureColumn(target, 'provider_manga', 'chapters', 'TEXT');
  ensureColumn(target, 'provider_manga', 'genres', 'TEXT');
  ensureColumn(target, 'provider_manga', 'description', 'TEXT');
  ensureColumn(target, 'provider_manga', 'author', 'TEXT');
  ensureColumn(target, 'provider_manga', 'artist', 'TEXT');
  ensureColumn(target, 'provider_manga', 'serialization', 'TEXT');
  ensureColumn(target, 'provider_manga', 'updated_on', 'TEXT');
  ensureColumn(target, 'provider_manga', 'created_at', 'INTEGER');
  ensureColumn(target, 'provider_manga', 'updated_at', 'INTEGER');

  if (legacyProvider) {
    migrateLegacyProviderData(target);
  }

  if (legacyLibrary) {
    migrateLegacyLibraryData(target);
  }
}

function ensureColumn(dbRef: Database, table: string, column: string, definition: string): void {
  if (!tableExists(dbRef, table)) {
    return;
  }

  const columns = getTableColumns(dbRef, table);
  if (columns.some((entry) => entry.name === column)) {
    return;
  }

  dbRef.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

function tableExists(dbRef: Database, table: string): boolean {
  const row = dbRef
    .prepare('SELECT name FROM sqlite_master WHERE type = ? AND name = ?')
    .get('table', table) as { name?: string } | undefined;
  return Boolean(row?.name);
}

function getTableColumns(dbRef: Database, table: string): Array<{ name: string; notnull: number }> {
  return dbRef.prepare(`PRAGMA table_info(${table})`).all() as Array<{
    name: string;
    notnull: number;
  }>;
}

function renameTableIfExists(dbRef: Database, source: string, target: string): void {
  if (!tableExists(dbRef, source)) {
    return;
  }

  if (tableExists(dbRef, target)) {
    return;
  }

  dbRef.exec(`ALTER TABLE ${source} RENAME TO ${target}`);
}

function isLegacyProviderManga(dbRef: Database): boolean {
  if (!tableExists(dbRef, 'provider_manga')) {
    return false;
  }

  const columns = getTableColumns(dbRef, 'provider_manga');
  return columns.some((entry) => entry.name === 'provider_url');
}

function isLegacyUserLibrary(dbRef: Database): boolean {
  if (!tableExists(dbRef, 'user_library')) {
    return false;
  }

  const columns = getTableColumns(dbRef, 'user_library');
  return columns.some((entry) => entry.name === 'added_at') || !columns.some((entry) => entry.name === 'user_id');
}

function migrateLegacyProviderData(dbRef: Database): void {
  if (!tableExists(dbRef, 'provider_manga_legacy')) {
    return;
  }

  if (!tableExists(dbRef, 'provider_manga')) {
    return;
  }

  if (!isTableEmpty(dbRef, 'provider_manga')) {
    return;
  }

  dbRef.exec(`
    INSERT INTO provider_manga (
      provider,
      provider_id,
      title,
      image,
      status,
      rating,
      chapters,
      genres,
      description,
      author,
      artist,
      serialization,
      updated_on,
      is_active,
      domain_changed_from,
      last_scraped,
      created_at,
      updated_at
    )
    SELECT
      provider,
      provider_id,
      title,
      cover_url,
      status,
      NULL,
      COALESCE(latest_chapter, CAST(total_chapters AS TEXT)),
      genres,
      description,
      NULL,
      NULL,
      NULL,
      NULL,
      is_active,
      domain_changed_from,
      last_scraped,
      COALESCE(last_scraped, unixepoch()),
      COALESCE(last_scraped, unixepoch())
    FROM provider_manga_legacy
    WHERE provider IS NOT NULL AND provider_id IS NOT NULL
  `);
}

function migrateLegacyLibraryData(dbRef: Database): void {
  if (!tableExists(dbRef, 'user_library_legacy')) {
    return;
  }

  if (!tableExists(dbRef, 'user_library')) {
    return;
  }

  if (!isTableEmpty(dbRef, 'user_library')) {
    return;
  }

  dbRef.exec(`
    INSERT INTO user_library (
      user_id,
      anilist_id,
      provider,
      provider_manga_id,
      anilist_entry_id,
      status,
      progress,
      score,
      notes,
      is_favorite,
      started_at,
      completed_at,
      created_at,
      updated_at
    )
    SELECT
      NULL,
      anilist_id,
      provider,
      provider_manga_id,
      NULL,
      CASE LOWER(status)
        WHEN 'reading' THEN 'CURRENT'
        WHEN 'current' THEN 'CURRENT'
        WHEN 'planned' THEN 'PLANNING'
        WHEN 'planning' THEN 'PLANNING'
        WHEN 'completed' THEN 'COMPLETED'
        WHEN 'dropped' THEN 'DROPPED'
        WHEN 'paused' THEN 'PAUSED'
        WHEN 'on_hold' THEN 'PAUSED'
        ELSE UPPER(status)
      END,
      progress,
      score,
      notes,
      is_favorite,
      started_at,
      completed_at,
      COALESCE(added_at, unixepoch()),
      COALESCE(last_read, added_at, unixepoch())
    FROM user_library_legacy
    WHERE anilist_id IS NOT NULL
  `);
}

function isTableEmpty(dbRef: Database, table: string): boolean {
  const row = dbRef.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as
    | { count: number }
    | undefined;
  return (row?.count ?? 0) === 0;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

export function resetDatabase(dbPath: string = DEFAULT_DB_PATH): void {
  closeDatabase();
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }
}
