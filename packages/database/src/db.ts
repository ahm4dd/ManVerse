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
  target.exec(schema);
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
