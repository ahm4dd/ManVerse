import { getDatabase } from '../db.js';
import { type UserLibraryDb, type UserLibraryInput, UserLibraryInputSchema } from '../types.js';

/**
 * Add manga to user's reading library (upsert)
 * Returns the library entry ID
 */
export function addToLibrary(entry: UserLibraryInput): number {
  const db = getDatabase();
  const validated = UserLibraryInputSchema.parse(entry);

  const query = db.prepare(`
    INSERT INTO user_library (
      anilist_id, provider, provider_manga_id, status, progress,
      score, notes, is_favorite, added_at, last_read, started_at, completed_at
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
    ON CONFLICT(provider, provider_manga_id) DO UPDATE SET
      anilist_id = excluded.anilist_id,
      status = excluded.status,
      progress = excluded.progress,
      score = excluded.score,
      notes = excluded.notes,
      is_favorite = excluded.is_favorite,
      last_read = excluded.last_read,
      started_at = excluded.started_at,
      completed_at = excluded.completed_at
  `);

  const result = query.run(
    validated.anilist_id ?? null,
    validated.provider,
    validated.provider_manga_id,
    validated.status ?? 'reading',
    validated.progress ?? 0,
    validated.score ?? null,
    validated.notes ?? null,
    validated.is_favorite ?? 0,
    validated.added_at,
    validated.last_read ?? null,
    validated.started_at ?? null,
    validated.completed_at ?? null,
  );

  return Number(result.lastInsertRowid);
}

/**
 * Get user's library entries, optionally filtered by status
 */
export function getLibrary(status?: string): UserLibraryDb[] {
  const db = getDatabase();

  if (status) {
    const query = db.prepare<UserLibraryDb, [string]>(`
      SELECT * FROM user_library WHERE status = ?1 ORDER BY last_read DESC
    `);
    return query.all(status);
  }

  const query = db.prepare<UserLibraryDb, []>(`
    SELECT * FROM user_library ORDER BY last_read DESC
  `);
  return query.all();
}

/**
 * Get single library entry by provider info
 */
export function getLibraryEntry(provider: string, providerMangaId: number): UserLibraryDb | null {
  const db = getDatabase();

  const query = db.prepare<UserLibraryDb, [string, number]>(`
    SELECT * FROM user_library WHERE provider = ?1 AND provider_manga_id = ?2
  `);

  return query.get(provider, providerMangaId) || null;
}

/**
 * Get library entry by ID
 */
export function getLibraryEntryById(id: number): UserLibraryDb | null {
  const db = getDatabase();

  const query = db.prepare<UserLibraryDb, [number]>(`
    SELECT * FROM user_library WHERE id = ?1
  `);

  return query.get(id) || null;
}

/**
 * Update reading progress for a library entry
 */
export function updateProgress(id: number, progress: number): void {
  const db = getDatabase();

  const query = db.prepare(`
    UPDATE user_library 
    SET progress = ?2, last_read = ?3
    WHERE id = ?1
  `);

  query.run(id, progress, Date.now());
}

/**
 * Update status for a library entry
 * Automatically sets started_at or completed_at timestamps
 */
export function updateStatus(
  id: number,
  status: 'reading' | 'completed' | 'plan_to_read' | 'paused' | 'dropped',
): void {
  const db = getDatabase();

  const now = Date.now();
  const entry = getLibraryEntryById(id);

  if (!entry) {
    throw new Error(`Library entry ${id} not found`);
  }

  // Set timestamps based on status transitions
  let startedAt = entry.started_at;
  let completedAt = entry.completed_at;

  if (status === 'reading' && !startedAt) {
    startedAt = now;
  }

  if (status === 'completed' && !completedAt) {
    completedAt = now;
  }

  const query = db.prepare(`
    UPDATE user_library
    SET status = ?2, started_at = ?3, completed_at = ?4, last_read = ?5
    WHERE id = ?1
  `);

  query.run(id, status, startedAt, completedAt, now);
}

/**
 * Update score/rating for a library entry
 */
export function updateScore(id: number, score: number | null): void {
  const db = getDatabase();

  const query = db.prepare(`
    UPDATE user_library SET score = ?2 WHERE id = ?1
  `);

  query.run(id, score);
}

/**
 * Toggle favorite status for a library entry
 */
export function toggleFavorite(id: number): void {
  const db = getDatabase();

  const query = db.prepare(`
    UPDATE user_library SET is_favorite = NOT is_favorite WHERE id = ?1
  `);

  query.run(id);
}

/**
 * Update notes for a library entry
 */
export function updateNotes(id: number, notes: string | null): void {
  const db = getDatabase();

  const query = db.prepare(`
    UPDATE user_library SET notes = ?2 WHERE id = ?1
  `);

  query.run(id, notes);
}

/**
 * Remove manga from library (hard delete - user decision)
 */
export function removeFromLibrary(id: number): void {
  const db = getDatabase();

  const query = db.prepare(`DELETE FROM user_library WHERE id = ?1`);
  query.run(id);
}

/**
 * Get recently read manga
 */
export function getRecentlyRead(limit = 20): UserLibraryDb[] {
  const db = getDatabase();

  const query = db.prepare<UserLibraryDb, [number]>(`
    SELECT * FROM user_library 
    WHERE last_read IS NOT NULL
    ORDER BY last_read DESC
    LIMIT ?1
  `);

  return query.all(limit);
}

/**
 * Get all favorites
 */
export function getFavorites(): UserLibraryDb[] {
  const db = getDatabase();

  const query = db.prepare<UserLibraryDb, []>(`
    SELECT * FROM user_library WHERE is_favorite = 1 ORDER BY last_read DESC
  `);

  return query.all();
}

/**
 * Get library statistics
 */
export function getLibraryStats(): {
  total: number;
  reading: number;
  completed: number;
  plan_to_read: number;
  paused: number;
  dropped: number;
  favorites: number;
} {
  const db = getDatabase();

  const total = db
    .prepare<{ count: number }, []>('SELECT COUNT(*) as count FROM user_library')
    .get();
  const reading = db
    .prepare<
      { count: number },
      []
    >("SELECT COUNT(*) as count FROM user_library WHERE status = 'reading'")
    .get();
  const completed = db
    .prepare<
      { count: number },
      []
    >("SELECT COUNT(*) as count FROM user_library WHERE status = 'completed'")
    .get();
  const planToRead = db
    .prepare<
      { count: number },
      []
    >("SELECT COUNT(*) as count FROM user_library WHERE status = 'plan_to_read'")
    .get();
  const paused = db
    .prepare<
      { count: number },
      []
    >("SELECT COUNT(*) as count FROM user_library WHERE status = 'paused'")
    .get();
  const dropped = db
    .prepare<
      { count: number },
      []
    >("SELECT COUNT(*) as count FROM user_library WHERE status = 'dropped'")
    .get();
  const favorites = db
    .prepare<
      { count: number },
      []
    >('SELECT COUNT(*) as count FROM user_library WHERE is_favorite = 1')
    .get();

  return {
    total: total?.count || 0,
    reading: reading?.count || 0,
    completed: completed?.count || 0,
    plan_to_read: planToRead?.count || 0,
    paused: paused?.count || 0,
    dropped: dropped?.count || 0,
    favorites: favorites?.count || 0,
  };
}

/**
 * Search library by title (requires joining with provider_manga)
 */
export function searchLibrary(searchQuery: string, limit = 20): UserLibraryDb[] {
  const db = getDatabase();

  const query = db.prepare<UserLibraryDb, [string, number]>(`
    SELECT ul.* FROM user_library ul
    JOIN provider_manga pm ON ul.provider_manga_id = pm.id
    WHERE pm.title LIKE '%' || ?1 || '%' COLLATE NOCASE
    ORDER BY ul.last_read DESC
    LIMIT ?2
  `);

  return query.all(searchQuery, limit);
}
