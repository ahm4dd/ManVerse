import { Database } from 'bun:sqlite';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { mkdirSync } from 'node:fs';

// Singleton database instance
let db: Database | null = null;

// Default database path (~/.config/manverse/data.db)
const getDefaultDbPath = (): string => {
  const configDir = join(homedir(), '.config', 'manverse');

  // Ensure directory exists
  try {
    mkdirSync(configDir, { recursive: true });
  } catch {
    // Directory already exists
  }

  return join(configDir, 'data.db');
};

/**
 * Initialize database connection
 * Creates tables if they don't exist
 */
export function initDatabase(dbPath?: string): Database {
  if (db) {
    return db;
  }

  const path = dbPath || getDefaultDbPath();

  // Open database (creates file if doesn't exist)
  db = new Database(path, { create: true });

  // Enable foreign keys (critical for referential integrity)
  db.run('PRAGMA foreign_keys = ON');

  // Enable WAL mode for better concurrency
  db.run('PRAGMA journal_mode = WAL');

  console.log(`📦 Database initialized at ${path}`);

  return db;
}

/**
 * Get current database instance
 * Throws if database not initialized
 */
export function getDatabase(): Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

/**
 * Run migrations (create all tables)
 * Reads schema.sql and executes
 */
export function migrate(): void {
  const db = getDatabase();

  // Read schema file
  const schemaPath = join(import.meta.dirname, 'schema.sql');
  const schema = readFileSync(schemaPath, 'utf-8');

  // Execute schema (creates tables if not exist)
  db.exec(schema);

  console.log('✅ Database migrated successfully');
}

/**
 * Close database connection
 * Should be called on app shutdown
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
    console.log('🔒 Database connection closed');
  }
}

/**
 * Reset database (delete all data)
 * Used for testing only
 */
export function resetDatabase(): void {
  const db = getDatabase();

  // Disable foreign keys to avoid constraint errors during drops
  db.run('PRAGMA foreign_keys = OFF');

  // Get all table names
  const tables = db
    .query<
      { name: string },
      []
    >("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    .all();

  // Drop each table
  for (const table of tables) {
    db.run(`DROP TABLE IF EXISTS ${table.name}`);
  }

  // Re-enable foreign keys
  db.run('PRAGMA foreign_keys = ON');

  console.log('🗑️  Database reset complete');
}

/**
 * Get database statistics
 */
export function getDbStats(): {
  path: string;
  size: number;
  tableCount: number;
  tables: Array<{ name: string; rows: number }>;
} {
  const db = getDatabase();

  // Get all tables
  const tables = db
    .query<
      { name: string },
      []
    >("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    .all();

  // Count rows in each table
  const tableStats = tables.map((table: { name: string }) => {
    const count = db
      .query<{ count: number }, []>(`SELECT COUNT(*) as count FROM ${table.name}`)
      .get();
    return {
      name: table.name,
      rows: count?.count || 0,
    };
  });

  return {
    path: db.filename,
    size: 0, // Will add file size later
    tableCount: tables.length,
    tables: tableStats,
  };
}
