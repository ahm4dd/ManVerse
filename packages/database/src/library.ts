import { getDatabase } from './db.ts';
import type { AnilistMangaRecord, LibraryEntryRecord } from './types.ts';

export interface LibraryEntryInput {
  user_id: string;
  anilist_id: number;
  status: string;
  progress?: number | null;
  score?: number | null;
  notes?: string | null;
  is_favorite?: number | null;
  started_at?: number | null;
  completed_at?: number | null;
  provider?: string | null;
  provider_manga_id?: number | null;
  anilist_entry_id?: number | null;
  created_at?: number | null;
  updated_at?: number | null;
}

export interface LibraryEntryWithMedia {
  entry: LibraryEntryRecord;
  media: AnilistMangaRecord | null;
}

export function upsertLibraryEntry(input: LibraryEntryInput): LibraryEntryRecord {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);
  const createdAt = input.created_at ?? now;
  const updatedAt = input.updated_at ?? now;
  const params = {
    $user_id: input.user_id,
    $anilist_id: input.anilist_id,
    $provider: input.provider ?? null,
    $provider_manga_id: input.provider_manga_id ?? null,
    $anilist_entry_id: input.anilist_entry_id ?? null,
    $status: input.status,
    $progress: input.progress ?? 0,
    $score: input.score ?? null,
    $notes: input.notes ?? null,
    $is_favorite: input.is_favorite ?? 0,
    $started_at: input.started_at ?? null,
    $completed_at: input.completed_at ?? null,
    $created_at: createdAt,
    $updated_at: updatedAt,
  };

  const insert = db.prepare(`
    INSERT OR IGNORE INTO user_library (
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
    ) VALUES (
      $user_id,
      $anilist_id,
      $provider,
      $provider_manga_id,
      $anilist_entry_id,
      $status,
      $progress,
      $score,
      $notes,
      $is_favorite,
      $started_at,
      $completed_at,
      $created_at,
      $updated_at
    )
  `);

  const update = db.prepare(`
    UPDATE user_library SET
      provider = $provider,
      provider_manga_id = $provider_manga_id,
      anilist_entry_id = $anilist_entry_id,
      status = $status,
      progress = $progress,
      score = $score,
      notes = $notes,
      is_favorite = $is_favorite,
      started_at = $started_at,
      completed_at = $completed_at,
      updated_at = $updated_at
    WHERE user_id = $user_id AND anilist_id = $anilist_id
  `);

  const transaction = db.transaction(() => {
    insert.run(params);
    update.run(params);
  });

  transaction();

  return getLibraryEntry(input.user_id, input.anilist_id) as LibraryEntryRecord;
}

export function getLibraryEntry(userId: string, anilistId: number): LibraryEntryRecord | null {
  const db = getDatabase();
  const row = db
    .prepare('SELECT * FROM user_library WHERE user_id = ? AND anilist_id = ?')
    .get(userId, anilistId) as LibraryEntryRecord | undefined;
  return row ?? null;
}

export function listLibraryEntries(
  userId: string,
  status?: string,
): LibraryEntryWithMedia[] {
  const db = getDatabase();
  const rows = db
    .prepare(
      `SELECT
        ul.id as ul_id,
        ul.user_id as ul_user_id,
        ul.anilist_id as ul_anilist_id,
        ul.provider as ul_provider,
        ul.provider_manga_id as ul_provider_manga_id,
        ul.anilist_entry_id as ul_anilist_entry_id,
        ul.status as ul_status,
        ul.progress as ul_progress,
        ul.score as ul_score,
        ul.notes as ul_notes,
        ul.is_favorite as ul_is_favorite,
        ul.started_at as ul_started_at,
        ul.completed_at as ul_completed_at,
        ul.created_at as ul_created_at,
        ul.updated_at as ul_updated_at,
        am.id as am_id,
        am.title_romaji as am_title_romaji,
        am.title_english as am_title_english,
        am.title_native as am_title_native,
        am.description as am_description,
        am.cover_large as am_cover_large,
        am.cover_medium as am_cover_medium,
        am.banner_image as am_banner_image,
        am.status as am_status,
        am.format as am_format,
        am.chapters as am_chapters,
        am.volumes as am_volumes,
        am.genres as am_genres,
        am.average_score as am_average_score,
        am.popularity as am_popularity,
        am.favourites as am_favourites,
        am.updated_at as am_updated_at,
        am.country_of_origin as am_country_of_origin,
        am.cached_at as am_cached_at
       FROM user_library ul
       LEFT JOIN anilist_manga am ON am.id = ul.anilist_id
       WHERE ul.user_id = ?
       ${status ? 'AND ul.status = ?' : ''}
       ORDER BY ul.updated_at DESC`,
    )
    .all(status ? [userId, status] : [userId]) as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    entry: {
      id: row.ul_id as number,
      user_id: row.ul_user_id as string,
      anilist_id: row.ul_anilist_id as number,
      provider: row.ul_provider as string | null,
      provider_manga_id: row.ul_provider_manga_id as number | null,
      anilist_entry_id: row.ul_anilist_entry_id as number | null,
      status: row.ul_status as string,
      progress: row.ul_progress as number,
      score: row.ul_score as number | null,
      notes: row.ul_notes as string | null,
      is_favorite: row.ul_is_favorite as number,
      started_at: row.ul_started_at as number | null,
      completed_at: row.ul_completed_at as number | null,
      created_at: row.ul_created_at as number,
      updated_at: row.ul_updated_at as number,
    },
    media: row.am_id
      ? {
          id: row.am_id as number,
          title_romaji: row.am_title_romaji as string,
          title_english: row.am_title_english as string | null,
          title_native: row.am_title_native as string | null,
          description: row.am_description as string | null,
          cover_large: row.am_cover_large as string | null,
          cover_medium: row.am_cover_medium as string | null,
          banner_image: row.am_banner_image as string | null,
          status: row.am_status as string | null,
          format: row.am_format as string | null,
          chapters: row.am_chapters as number | null,
          volumes: row.am_volumes as number | null,
          genres: row.am_genres as string | null,
          average_score: row.am_average_score as number | null,
          popularity: row.am_popularity as number | null,
          favourites: row.am_favourites as number | null,
          updated_at: row.am_updated_at as number | null,
          country_of_origin: row.am_country_of_origin as string | null,
          cached_at: row.am_cached_at as number,
        }
      : null,
  }));
}

export function deleteLibraryEntry(userId: string, anilistId: number): boolean {
  const db = getDatabase();
  const result = db
    .prepare('DELETE FROM user_library WHERE user_id = ? AND anilist_id = ?')
    .run(userId, anilistId);
  return result.changes > 0;
}

export function countLibraryEntries(userId: string): number {
  const db = getDatabase();
  const row = db.prepare('SELECT COUNT(*) as count FROM user_library WHERE user_id = ?').get(userId) as
    | { count: number }
    | undefined;
  return row?.count ?? 0;
}
