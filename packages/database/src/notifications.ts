import { getDatabase } from './db.ts';

export interface ProviderReleaseState {
  id: number;
  provider_manga_id: number;
  last_chapter: string | null;
  last_title: string | null;
  last_checked_at: number | null;
  last_seen_at: number | null;
}

export function getProviderReleaseState(
  providerMangaId: number,
): ProviderReleaseState | null {
  const db = getDatabase();
  const row = db
    .prepare('SELECT * FROM provider_release_state WHERE provider_manga_id = ?')
    .get(providerMangaId) as ProviderReleaseState | undefined;
  return row ?? null;
}

export function upsertProviderReleaseState(input: {
  providerMangaId: number;
  lastChapter?: string | null;
  lastTitle?: string | null;
  lastSeenAt?: number | null;
  lastCheckedAt?: number | null;
}): ProviderReleaseState {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);
  const params = {
    $provider_manga_id: input.providerMangaId,
    $last_chapter: input.lastChapter ?? null,
    $last_title: input.lastTitle ?? null,
    $last_seen_at: input.lastSeenAt ?? now,
    $last_checked_at: input.lastCheckedAt ?? now,
  };

  const insert = db.prepare(`
    INSERT OR IGNORE INTO provider_release_state (
      provider_manga_id,
      last_chapter,
      last_title,
      last_checked_at,
      last_seen_at
    ) VALUES (
      $provider_manga_id,
      $last_chapter,
      $last_title,
      $last_checked_at,
      $last_seen_at
    )
  `);

  const update = db.prepare(`
    UPDATE provider_release_state SET
      last_chapter = $last_chapter,
      last_title = $last_title,
      last_checked_at = $last_checked_at,
      last_seen_at = $last_seen_at
    WHERE provider_manga_id = $provider_manga_id
  `);

  const tx = db.transaction(() => {
    insert.run(params);
    update.run(params);
  });

  tx();

  const row = db
    .prepare('SELECT * FROM provider_release_state WHERE provider_manga_id = ?')
    .get(input.providerMangaId) as ProviderReleaseState | undefined;
  return row as ProviderReleaseState;
}
