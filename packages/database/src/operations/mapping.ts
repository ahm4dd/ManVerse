import { getDatabase } from '../db.js';
import { type MangaMappingDb, type MangaMappingInput, MangaMappingInputSchema } from '../types.js';

/**
 * Create or update mapping (upsert)
 * This links AniList manga to provider manga
 */
export function createMapping(
  anilistId: number,
  provider: string,
  providerMangaId: number,
  confidence: 'manual' | 'auto-high' | 'auto-low' = 'manual',
): void {
  const db = getDatabase();

  const input: MangaMappingInput = {
    anilist_id: anilistId,
    provider,
    provider_manga_id: providerMangaId,
    confidence,
    verified: confidence === 'manual' ? 1 : 0,
    created_at: Date.now(),
    created_by: 'user',
    is_active: 1,
  };

  const validated = MangaMappingInputSchema.parse(input);

  const query = db.prepare(`
    INSERT INTO manga_mappings (
      anilist_id, provider, provider_manga_id, confidence, verified,
      created_at, created_by, is_active
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
    ON CONFLICT(anilist_id, provider, is_active) DO UPDATE SET
      provider_manga_id = excluded.provider_manga_id,
      confidence = excluded.confidence,
      verified = excluded.verified
  `);

  query.run(
    validated.anilist_id,
    validated.provider,
    validated.provider_manga_id,
    validated.confidence,
    validated.verified,
    validated.created_at,
    validated.created_by,
    validated.is_active,
  );
}

export function getMapping(anilistId: number, provider: string): MangaMappingDb | null {
  const db = getDatabase();
  const query = db.prepare<MangaMappingDb, [number, string]>(`
    SELECT * FROM manga_mappings
    WHERE anilist_id = ?1 AND provider = ?2 AND is_active = 1
  `);
  return query.get(anilistId, provider) || null;
}

export function getAllMappings(anilistId: number): MangaMappingDb[] {
  const db = getDatabase();
  const query = db.prepare<MangaMappingDb, [number]>(`
    SELECT * FROM manga_mappings WHERE anilist_id = ?1 AND is_active = 1
  `);
  return query.all(anilistId);
}

export function deleteMapping(anilistId: number, provider: string): void {
  const db = getDatabase();
  const query = db.prepare(`
    UPDATE manga_mappings SET is_active = 0 WHERE anilist_id = ?1 AND provider = ?2
  `);
  query.run(anilistId, provider);
}

/**
 * Remap manga to new provider (keeps history)
 */
export function remapManga(
  anilistId: number,
  provider: string,
  newProviderMangaId: number,
  reason?: string,
): void {
  const db = getDatabase();

  // Deactivate old mapping
  const oldMapping = getMapping(anilistId, provider);
  if (oldMapping) {
    deleteMapping(anilistId, provider);
  }

  // Create new mapping
  createMapping(anilistId, provider, newProviderMangaId, 'manual');

  // Link old to new (if old existed)
  if (oldMapping && reason) {
    const updateQuery = db.prepare(`
      UPDATE manga_mappings SET notes = ?1 WHERE id = ?2
    `);
    updateQuery.run(reason, oldMapping.id);
  }
}
