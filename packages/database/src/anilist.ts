import { getDatabase } from './db.ts';
import type { AnilistMangaRecord } from './types.ts';

export interface AnilistMangaInput {
  id: number;
  title_romaji: string;
  title_english?: string | null;
  title_native?: string | null;
  description?: string | null;
  cover_large?: string | null;
  cover_medium?: string | null;
  banner_image?: string | null;
  status?: string | null;
  format?: string | null;
  chapters?: number | null;
  volumes?: number | null;
  genres?: string[] | null;
  average_score?: number | null;
  popularity?: number | null;
  favourites?: number | null;
  updated_at?: number | null;
  country_of_origin?: string | null;
  cached_at?: number;
}

function toGenresString(genres?: string[] | null): string | null {
  if (!genres) return null;
  return JSON.stringify(genres);
}

export function upsertAnilistManga(input: AnilistMangaInput): AnilistMangaRecord {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);
  const params = {
    $id: input.id,
    $title_romaji: input.title_romaji,
    $title_english: input.title_english ?? null,
    $title_native: input.title_native ?? null,
    $description: input.description ?? null,
    $cover_large: input.cover_large ?? null,
    $cover_medium: input.cover_medium ?? null,
    $banner_image: input.banner_image ?? null,
    $status: input.status ?? null,
    $format: input.format ?? null,
    $chapters: input.chapters ?? null,
    $volumes: input.volumes ?? null,
    $genres: toGenresString(input.genres),
    $average_score: input.average_score ?? null,
    $popularity: input.popularity ?? null,
    $favourites: input.favourites ?? null,
    $updated_at: input.updated_at ?? null,
    $country_of_origin: input.country_of_origin ?? null,
    $cached_at: input.cached_at ?? now,
  };

  const insert = db.prepare(`
    INSERT OR IGNORE INTO anilist_manga (
      id,
      title_romaji,
      title_english,
      title_native,
      description,
      cover_large,
      cover_medium,
      banner_image,
      status,
      format,
      chapters,
      volumes,
      genres,
      average_score,
      popularity,
      favourites,
      updated_at,
      country_of_origin,
      cached_at
    ) VALUES (
      $id,
      $title_romaji,
      $title_english,
      $title_native,
      $description,
      $cover_large,
      $cover_medium,
      $banner_image,
      $status,
      $format,
      $chapters,
      $volumes,
      $genres,
      $average_score,
      $popularity,
      $favourites,
      $updated_at,
      $country_of_origin,
      $cached_at
    )
  `);

  const update = db.prepare(`
    UPDATE anilist_manga SET
      title_romaji = $title_romaji,
      title_english = $title_english,
      title_native = $title_native,
      description = $description,
      cover_large = $cover_large,
      cover_medium = $cover_medium,
      banner_image = $banner_image,
      status = $status,
      format = $format,
      chapters = $chapters,
      volumes = $volumes,
      genres = $genres,
      average_score = $average_score,
      popularity = $popularity,
      favourites = $favourites,
      updated_at = $updated_at,
      country_of_origin = $country_of_origin,
      cached_at = $cached_at
    WHERE id = $id
  `);

  const transaction = db.transaction(() => {
    insert.run(params);
    update.run(params);
  });

  transaction();

  return getAnilistMangaById(input.id) as AnilistMangaRecord;
}

export function getAnilistMangaById(id: number): AnilistMangaRecord | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM anilist_manga WHERE id = ?').get(id) as
    | AnilistMangaRecord
    | undefined;
  return row ?? null;
}

export function searchAnilistMangaByTitle(query: string, limit = 20): AnilistMangaRecord[] {
  const db = getDatabase();
  const like = `%${query}%`;
  return db
    .prepare(
      `SELECT * FROM anilist_manga
       WHERE title_romaji LIKE ? OR title_english LIKE ? OR title_native LIKE ?
       ORDER BY updated_at DESC
       LIMIT ?`,
    )
    .all(like, like, like, limit) as AnilistMangaRecord[];
}
