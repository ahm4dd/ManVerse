import { getDatabase } from './db.ts';
import type { SyncStateRecord } from './types.ts';

export interface SyncStateInput {
  user_id: string;
  anilist_id: number;
  local_status?: string | null;
  local_progress?: number | null;
  local_score?: number | null;
  anilist_status?: string | null;
  anilist_progress?: number | null;
  anilist_score?: number | null;
  needs_sync?: number | null;
  conflict_state?: string | null;
}

export function upsertSyncState(input: SyncStateInput): SyncStateRecord {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    user_id: input.user_id,
    anilist_id: input.anilist_id,
    local_status: input.local_status ?? null,
    local_progress: input.local_progress ?? null,
    local_score: input.local_score ?? null,
    anilist_status: input.anilist_status ?? null,
    anilist_progress: input.anilist_progress ?? null,
    anilist_score: input.anilist_score ?? null,
    needs_sync: input.needs_sync ?? 0,
    conflict_state: input.conflict_state ?? null,
    updated_at: now,
  };

  const insert = db.prepare(`
    INSERT OR IGNORE INTO anilist_sync_state (
      user_id,
      anilist_id,
      local_status,
      local_progress,
      local_score,
      anilist_status,
      anilist_progress,
      anilist_score,
      needs_sync,
      conflict_state,
      updated_at
    ) VALUES (
      $user_id,
      $anilist_id,
      $local_status,
      $local_progress,
      $local_score,
      $anilist_status,
      $anilist_progress,
      $anilist_score,
      $needs_sync,
      $conflict_state,
      $updated_at
    )
  `);

  const update = db.prepare(`
    UPDATE anilist_sync_state SET
      local_status = $local_status,
      local_progress = $local_progress,
      local_score = $local_score,
      anilist_status = $anilist_status,
      anilist_progress = $anilist_progress,
      anilist_score = $anilist_score,
      needs_sync = $needs_sync,
      conflict_state = $conflict_state,
      updated_at = $updated_at
    WHERE user_id = $user_id AND anilist_id = $anilist_id
  `);

  const transaction = db.transaction(() => {
    insert.run(payload);
    update.run(payload);
  });

  transaction();

  return getSyncState(input.user_id, input.anilist_id) as SyncStateRecord;
}

export function getSyncState(userId: string, anilistId: number): SyncStateRecord | null {
  const db = getDatabase();
  const row = db
    .prepare('SELECT * FROM anilist_sync_state WHERE user_id = ? AND anilist_id = ?')
    .get(userId, anilistId) as SyncStateRecord | undefined;
  return row ?? null;
}
