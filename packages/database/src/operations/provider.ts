import { getDatabase } from '../db.js';
import {
  type ProviderMangaDb,
  type ProviderMangaInput,
  ProviderMangaInputSchema,
} from '../types.js';

/**
 * Save provider manga entry (upsert)
 */
export function saveProviderManga(manga: ProviderMangaInput): number {
  const db = getDatabase();
  const validated = ProviderMangaInputSchema.parse(manga);

  const query = db.prepare(`
    INSERT INTO provider_manga (
      provider, provider_id, provider_url, title, alt_titles,
      cover_url, status, latest_chapter, total_chapters, description,
      genres, last_scraped, is_active, domain_changed_from, last_checked, failed_checks
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)
    ON CONFLICT(provider, provider_id) DO UPDATE SET
      provider_url = excluded.provider_url,
      title = excluded.title,
      alt_titles = excluded.alt_titles,
      cover_url = excluded.cover_url,
      status = excluded.status,
      latest_chapter = excluded.latest_chapter,
      total_chapters = excluded.total_chapters,
      description = excluded.description,
      genres = excluded.genres,
      last_scraped = excluded.last_scraped,
      is_active = excluded.is_active
  `);

  const result = query.run(
    validated.provider,
    validated.provider_id,
    validated.provider_url,
    validated.title,
    validated.alt_titles ?? null,
    validated.cover_url ?? null,
    validated.status ?? null,
    validated.latest_chapter ?? null,
    validated.total_chapters ?? null,
    validated.description ?? null,
    validated.genres ?? null,
    validated.last_scraped,
    validated.is_active ?? 1,
    validated.domain_changed_from ?? null,
    validated.last_checked ?? null,
    validated.failed_checks ?? 0,
  );

  return Number(result.lastInsertRowid);
}

export function getProviderManga(provider: string, providerId: string): ProviderMangaDb | null {
  const db = getDatabase();
  const query = db.prepare<ProviderMangaDb, [string, string]>(
    `SELECT * FROM provider_manga WHERE provider = ?1 AND provider_id = ?2`,
  );
  return query.get(provider, providerId) || null;
}

export function getProviderMangaById(id: number): ProviderMangaDb | null {
  const db = getDatabase();
  const query = db.prepare<ProviderMangaDb, [number]>(`SELECT * FROM provider_manga WHERE id = ?1`);
  return query.get(id) || null;
}

export function searchProviderLocal(
  provider: string,
  searchQuery: string,
  limit = 20,
): ProviderMangaDb[] {
  const db = getDatabase();
  const query = db.prepare<ProviderMangaDb, [string, string, number]>(`
    SELECT * FROM provider_manga
    WHERE provider = ?1 AND title LIKE '%' || ?2 || '%' COLLATE NOCASE
    ORDER BY last_scraped DESC
    LIMIT ?3
  `);
  return query.all(provider, searchQuery, limit);
}

export function deactivateProvider(provider: string): void {
  const db = getDatabase();
  const query = db.prepare(`UPDATE provider_manga SET is_active = 0 WHERE provider = ?1`);
  query.run(provider);
}
