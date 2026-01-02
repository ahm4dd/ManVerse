import { getDatabase } from '../db.js';
import { type AniListMangaDb, type AniListMangaInput, AniListMangaInputSchema } from '../types.js';

/**
 * Save or update AniList manga in database (upsert)
 */
export function saveAnilistManga(manga: AniListMangaInput): void {
  const db = getDatabase();

  // Validate input
  const validated = AniListMangaInputSchema.parse(manga);

  const query = db.prepare(`
    INSERT INTO anilist_manga (
      id, title_romaji, title_english, title_native, synonyms,
      description, cover_image_url, banner_image_url, status, format,
      chapters, volumes, start_date, end_date, genres, tags,
      average_score, mean_score, popularity, favorites, is_adult,
      site_url, last_updated
    ) VALUES (
      ?1, ?2, ?3, ?4, ?5,
      ?6, ?7, ?8, ?9, ?10,
      ?11, ?12, ?13, ?14, ?15, ?16,
      ?17, ?18, ?19, ?20, ?21,
      ?22, ?23
    )
    ON CONFLICT(id) DO UPDATE SET
      title_romaji = excluded.title_romaji,
      title_english = excluded.title_english,
      title_native = excluded.title_native,
      synonyms = excluded.synonyms,
      description = excluded.description,
      cover_image_url = excluded.cover_image_url,
      banner_image_url = excluded.banner_image_url,
      status = excluded.status,
      format = excluded.format,
      chapters = excluded.chapters,
      volumes = excluded.volumes,
      start_date = excluded.start_date,
      end_date = excluded.end_date,
      genres = excluded.genres,
      tags = excluded.tags,
      average_score = excluded.average_score,
      mean_score = excluded.mean_score,
      popularity = excluded.popularity,
      favorites = excluded.favorites,
      is_adult = excluded.is_adult,
      site_url = excluded.site_url,
      last_updated = excluded.last_updated
  `);

  query.run(
    validated.id,
    validated.title_romaji,
    validated.title_english ?? null,
    validated.title_native ?? null,
    validated.synonyms ?? null,
    validated.description ?? null,
    validated.cover_image_url ?? null,
    validated.banner_image_url ?? null,
    validated.status,
    validated.format ?? null,
    validated.chapters ?? null,
    validated.volumes ?? null,
    validated.start_date ?? null,
    validated.end_date ?? null,
    validated.genres,
    validated.tags ?? null,
    validated.average_score ?? null,
    validated.mean_score ?? null,
    validated.popularity ?? null,
    validated.favorites ?? null,
    validated.is_adult ?? 0,
    validated.site_url ?? null,
    validated.last_updated,
  );
}

/**
 * Get AniList manga by ID
 * Returns null if not found
 */
export function getAnilistManga(id: number): AniListMangaDb | null {
  const db = getDatabase();

  const query = db.prepare<AniListMangaDb, [number]>(`
    SELECT * FROM anilist_manga WHERE id = ?1
  `);

  return query.get(id) || null;
}

/**
 * Search locally cached AniList manga by title
 * Case-insensitive search across romaji, english, and native titles
 */
export function searchLocalAnilist(searchQuery: string, limit = 20): AniListMangaDb[] {
  const db = getDatabase();

  const query = db.prepare<AniListMangaDb, [string, number]>(`
    SELECT * FROM anilist_manga
    WHERE 
      title_romaji LIKE '%' || ?1 || '%' COLLATE NOCASE
      OR title_english LIKE '%' || ?1 || '%' COLLATE NOCASE  
      OR title_native LIKE '%' || ?1 || '%' COLLATE NOCASE
    ORDER BY popularity DESC
    LIMIT ?2
  `);

  return query.all(searchQuery, limit);
}

/**
 * Bulk insert AniList manga (for initial cache warming)
 * More efficient than individual inserts
 */
export function bulkInsertAnilist(mangas: AniListMangaInput[]): void {
  const db = getDatabase();

  // Use transaction for atomic bulk insert
  const transaction = db.transaction((items: AniListMangaInput[]) => {
    for (const manga of items) {
      saveAnilistManga(manga);
    }
  });

  transaction(mangas);
}

/**
 * Check if AniList data is stale and needs refresh
 * Returns true if last_updated is older than maxAge (in milliseconds)
 */
export function isAnilistDataStale(id: number, maxAge: number): boolean {
  const manga = getAnilistManga(id);

  if (!manga) {
    return true; // Not cached at all
  }

  const age = Date.now() - manga.last_updated;
  return age > maxAge;
}

/**
 * Get all AniList manga (for cache inspection)
 * Use sparingly - can return large result set
 */
export function getAllAnilistManga(limit = 100): AniListMangaDb[] {
  const db = getDatabase();

  const query = db.prepare<AniListMangaDb, [number]>(`
    SELECT * FROM anilist_manga
    ORDER BY last_updated DESC
    LIMIT ?1
  `);

  return query.all(limit);
}

/**
 * Delete AniList manga by ID
 * Cascades to mappings and sync state
 */
export function deleteAnilistManga(id: number): void {
  const db = getDatabase();

  const query = db.prepare(`DELETE FROM anilist_manga WHERE id = ?1`);
  query.run(id);
}

/**
 * Count total cached AniList manga
 */
export function countAnilistManga(): number {
  const db = getDatabase();

  const query = db.prepare<{ count: number }, []>(`
    SELECT COUNT(*) as count FROM anilist_manga
  `);

  const result = query.get();
  return result?.count || 0;
}
