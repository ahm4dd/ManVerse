import { getDatabase } from '../db.js';
import {
  type AniListSyncStateDb,
  type AniListSyncStateInput,
  AniListSyncStateInputSchema,
} from '../types.js';

/**
 * Get sync state for an AniList manga
 */
export function getSyncState(anilistId: number): AniListSyncStateDb | null {
  const db = getDatabase();

  const query = db.prepare<AniListSyncStateDb, [number]>(`
    SELECT * FROM anilist_sync_state WHERE anilist_id = ?1
  `);

  return query.get(anilistId) || null;
}

/**
 * Update sync state after successful synchronization
 */
export function updateSyncState(anilistId: number, state: Partial<AniListSyncStateInput>): void {
  const db = getDatabase();

  const existing = getSyncState(anilistId);

  if (!existing) {
    // Create new sync state
    const input: AniListSyncStateInput = {
      anilist_id: anilistId,
      local_progress: state.local_progress ?? 0,
      anilist_progress: state.anilist_progress ?? 0,
      last_synced: state.last_synced ?? Date.now(),
      ...state,
    };

    const validated = AniListSyncStateInputSchema.parse(input);

    const query = db.prepare(`
      INSERT INTO anilist_sync_state (
        anilist_id, local_progress, anilist_progress, local_status, anilist_status,
        local_score, anilist_score, last_synced, last_local_update, last_anilist_update,
        needs_sync, sync_direction
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
    `);

    query.run(
      validated.anilist_id,
      validated.local_progress,
      validated.anilist_progress,
      validated.local_status ?? null,
      validated.anilist_status ?? null,
      validated.local_score ?? null,
      validated.anilist_score ?? null,
      validated.last_synced,
      validated.last_local_update ?? null,
      validated.last_anilist_update ?? null,
      validated.needs_sync ?? 0,
      validated.sync_direction ?? null,
    );
  } else {
    // Update existing
    const query = db.prepare(`
      UPDATE anilist_sync_state SET
        local_progress = COALESCE(?2, local_progress),
        anilist_progress = COALESCE(?3, anilist_progress),
        local_status = COALESCE(?4, local_status),
        anilist_status = COALESCE(?5, anilist_status),
        local_score = COALESCE(?6, local_score),
        anilist_score = COALESCE(?7, anilist_score),
        last_synced = COALESCE(?8, last_synced),
        last_local_update = COALESCE(?9, last_local_update),
        last_anilist_update = COALESCE(?10, last_anilist_update),
        needs_sync = COALESCE(?11, needs_sync),
        sync_direction = COALESCE(?12, sync_direction)
      WHERE anilist_id = ?1
    `);

    query.run(
      anilistId,
      state.local_progress ?? null,
      state.anilist_progress ?? null,
      state.local_status ?? null,
      state.anilist_status ?? null,
      state.local_score ?? null,
      state.anilist_score ?? null,
      state.last_synced ?? null,
      state.last_local_update ?? null,
      state.last_anilist_update ?? null,
      state.needs_sync ?? null,
      state.sync_direction ?? null,
    );
  }
}

/**
 * Mark manga as needing sync
 */
export function markNeedsSync(anilistId: number, direction: 'push' | 'pull' | 'conflict'): void {
  const db = getDatabase();

  const query = db.prepare(`
    UPDATE anilist_sync_state 
    SET needs_sync = 1, sync_direction = ?2
    WHERE anilist_id = ?1
  `);

  query.run(anilistId, direction);
}

/**
 * Get all manga that need syncing
 */
export function getNeedsSyncList(): AniListSyncStateDb[] {
  const db = getDatabase();

  const query = db.prepare<AniListSyncStateDb, []>(`
    SELECT * FROM anilist_sync_state 
    WHERE needs_sync = 1
    ORDER BY last_local_update DESC
  `);

  return query.all();
}

/**
 * Clear sync flag after successful sync
 */
export function clearSyncFlag(anilistId: number): void {
  const db = getDatabase();

  const query = db.prepare(`
    UPDATE anilist_sync_state 
    SET needs_sync = 0, sync_direction = NULL, last_synced = ?2
    WHERE anilist_id = ?1
  `);

  query.run(anilistId, Date.now());
}

/**
 * Record local update (triggers sync check)
 */
export function recordLocalUpdate(
  anilistId: number,
  progress: number,
  status?: string,
  score?: number,
): void {
  const db = getDatabase();

  const state = getSyncState(anilistId);

  if (!state) {
    // Create new sync state
    updateSyncState(anilistId, {
      local_progress: progress,
      local_status: status ?? null,
      local_score: score ?? null,
      anilist_progress: 0,
      last_local_update: Date.now(),
      last_synced: Date.now(),
      needs_sync: 1,
      sync_direction: 'push',
    });
  } else {
    // Update and check if sync needed
    const needsSync =
      state.anilist_progress !== progress ||
      state.anilist_status !== status ||
      state.anilist_score !== score;

    const query = db.prepare(`
      UPDATE anilist_sync_state 
      SET 
        local_progress = ?2,
        local_status = ?3,
        local_score = ?4,
        last_local_update = ?5,
        needs_sync = ?6,
        sync_direction = ?7
      WHERE anilist_id = ?1
    `);

    query.run(
      anilistId,
      progress,
      status ?? null,
      score ?? null,
      Date.now(),
      needsSync ? 1 : 0,
      needsSync ? 'push' : null,
    );
  }
}

/**
 * Record AniList update (triggers sync check)
 */
export function recordAnilistUpdate(
  anilistId: number,
  progress: number,
  status?: string,
  score?: number,
): void {
  const db = getDatabase();

  const state = getSyncState(anilistId);

  if (!state) {
    // Create new sync state
    updateSyncState(anilistId, {
      anilist_progress: progress,
      anilist_status: status ?? null,
      anilist_score: score ?? null,
      local_progress: 0,
      last_anilist_update: Date.now(),
      last_synced: Date.now(),
      needs_sync: 1,
      sync_direction: 'pull',
    });
  } else {
    // Update and check if sync needed
    const needsSync =
      state.local_progress !== progress ||
      state.local_status !== status ||
      state.local_score !== score;

    // Detect conflicts
    let direction: 'pull' | 'conflict' | null = null;
    if (needsSync) {
      if (state.needs_sync === 1 && state.sync_direction === 'push') {
        direction = 'conflict'; // Both changed
      } else {
        direction = 'pull';
      }
    }

    const query = db.prepare(`
      UPDATE anilist_sync_state 
      SET 
        anilist_progress = ?2,
        anilist_status = ?3,
        anilist_score = ?4,
        last_anilist_update = ?5,
        needs_sync = ?6,
        sync_direction = ?7
      WHERE anilist_id = ?1
    `);

    query.run(
      anilistId,
      progress,
      status ?? null,
      score ?? null,
      Date.now(),
      needsSync ? 1 : 0,
      direction,
    );
  }
}
