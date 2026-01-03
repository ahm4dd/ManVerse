import { getDatabase } from './db.ts';
import type { AnilistMangaRecord, MangaMappingRecord, ProviderMangaRecord } from './types.ts';

export interface ProviderMangaInput {
  provider: string;
  provider_id: string;
  title: string;
  image?: string | null;
  status?: string | null;
  rating?: string | null;
  chapters?: string | unknown;
  genres?: string[] | null;
  description?: string | null;
  author?: string | null;
  artist?: string | null;
  serialization?: string | null;
  updated_on?: string | null;
  last_scraped?: number | null;
}

function toJsonString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

export function upsertProviderManga(input: ProviderMangaInput): ProviderMangaRecord {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);
  if (!input.provider || !input.provider_id) {
    throw new Error('Provider mapping requires provider and provider_id');
  }

  const payload = {
    provider: input.provider,
    provider_id: input.provider_id,
    title: input.title,
    image: input.image ?? null,
    status: input.status ?? null,
    rating: input.rating ?? null,
    chapters: toJsonString(input.chapters),
    genres: input.genres ? JSON.stringify(input.genres) : null,
    description: input.description ?? null,
    author: input.author ?? null,
    artist: input.artist ?? null,
    serialization: input.serialization ?? null,
    updated_on: input.updated_on ?? null,
    last_scraped: input.last_scraped ?? now,
    created_at: now,
    updated_at: now,
  };

  const insert = db.prepare(`
    INSERT OR IGNORE INTO provider_manga (
      provider,
      provider_id,
      title,
      image,
      status,
      rating,
      chapters,
      genres,
      description,
      author,
      artist,
      serialization,
      updated_on,
      last_scraped,
      created_at,
      updated_at
    ) VALUES (
      $provider,
      $provider_id,
      $title,
      $image,
      $status,
      $rating,
      $chapters,
      $genres,
      $description,
      $author,
      $artist,
      $serialization,
      $updated_on,
      $last_scraped,
      $created_at,
      $updated_at
    )
  `);

  const update = db.prepare(`
    UPDATE provider_manga SET
      title = $title,
      image = $image,
      status = $status,
      rating = $rating,
      chapters = $chapters,
      genres = $genres,
      description = $description,
      author = $author,
      artist = $artist,
      serialization = $serialization,
      updated_on = $updated_on,
      last_scraped = $last_scraped,
      updated_at = $updated_at
    WHERE provider = $provider AND provider_id = $provider_id
  `);

  const transaction = db.transaction(() => {
    insert.run(payload);
    update.run(payload);
  });

  transaction();

  return getProviderMangaByProviderId(input.provider, input.provider_id) as ProviderMangaRecord;
}

export function getProviderMangaByProviderId(
  provider: string,
  providerId: string,
): ProviderMangaRecord | null {
  const db = getDatabase();
  const row = db
    .prepare('SELECT * FROM provider_manga WHERE provider = ? AND provider_id = ?')
    .get(provider, providerId) as ProviderMangaRecord | undefined;
  return row ?? null;
}

export function getProviderMangaById(id: number): ProviderMangaRecord | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM provider_manga WHERE id = ?').get(id) as
    | ProviderMangaRecord
    | undefined;
  return row ?? null;
}

export function listProviderMappings(anilistId: number): Array<{
  mapping: MangaMappingRecord;
  provider: ProviderMangaRecord;
}> {
  const db = getDatabase();
  const rows = db
    .prepare(
      `SELECT
        mm.id as mm_id,
        mm.anilist_id as mm_anilist_id,
        mm.provider as mm_provider,
        mm.provider_manga_id as mm_provider_manga_id,
        mm.mapping_source as mm_mapping_source,
        mm.is_active as mm_is_active,
        mm.replaced_by as mm_replaced_by,
        mm.created_at as mm_created_at,
        mm.updated_at as mm_updated_at,
        pm.id as pm_id,
        pm.provider as pm_provider,
        pm.provider_id as pm_provider_id,
        pm.title as pm_title,
        pm.image as pm_image,
        pm.status as pm_status,
        pm.rating as pm_rating,
        pm.chapters as pm_chapters,
        pm.genres as pm_genres,
        pm.description as pm_description,
        pm.author as pm_author,
        pm.artist as pm_artist,
        pm.serialization as pm_serialization,
        pm.updated_on as pm_updated_on,
        pm.is_active as pm_is_active,
        pm.domain_changed_from as pm_domain_changed_from,
        pm.last_scraped as pm_last_scraped,
        pm.created_at as pm_created_at,
        pm.updated_at as pm_updated_at
       FROM manga_mappings mm
       JOIN provider_manga pm ON pm.id = mm.provider_manga_id
       WHERE mm.anilist_id = ?
       ORDER BY mm.updated_at DESC`,
    )
    .all(anilistId) as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    mapping: {
      id: row.mm_id as number,
      anilist_id: row.mm_anilist_id as number,
      provider: row.mm_provider as string,
      provider_manga_id: row.mm_provider_manga_id as number,
      mapping_source: row.mm_mapping_source as string | null,
      is_active: row.mm_is_active as number,
      replaced_by: row.mm_replaced_by as number | null,
      created_at: row.mm_created_at as number,
      updated_at: row.mm_updated_at as number,
    },
    provider: {
      id: row.pm_id as number,
      provider: row.pm_provider as string,
      provider_id: row.pm_provider_id as string,
      title: row.pm_title as string,
      image: row.pm_image as string | null,
      status: row.pm_status as string | null,
      rating: row.pm_rating as string | null,
      chapters: row.pm_chapters as string | null,
      genres: row.pm_genres as string | null,
      description: row.pm_description as string | null,
      author: row.pm_author as string | null,
      artist: row.pm_artist as string | null,
      serialization: row.pm_serialization as string | null,
      updated_on: row.pm_updated_on as string | null,
      is_active: row.pm_is_active as number,
      domain_changed_from: row.pm_domain_changed_from as string | null,
      last_scraped: row.pm_last_scraped as number | null,
      created_at: row.pm_created_at as number,
      updated_at: row.pm_updated_at as number,
    },
  }));
}

export function getActiveMapping(
  anilistId: number,
  provider: string,
): { mapping: MangaMappingRecord; provider: ProviderMangaRecord } | null {
  const db = getDatabase();
  const row = db
    .prepare(
      `SELECT
        mm.id as mm_id,
        mm.anilist_id as mm_anilist_id,
        mm.provider as mm_provider,
        mm.provider_manga_id as mm_provider_manga_id,
        mm.mapping_source as mm_mapping_source,
        mm.is_active as mm_is_active,
        mm.replaced_by as mm_replaced_by,
        mm.created_at as mm_created_at,
        mm.updated_at as mm_updated_at,
        pm.id as pm_id,
        pm.provider as pm_provider,
        pm.provider_id as pm_provider_id,
        pm.title as pm_title,
        pm.image as pm_image,
        pm.status as pm_status,
        pm.rating as pm_rating,
        pm.chapters as pm_chapters,
        pm.genres as pm_genres,
        pm.description as pm_description,
        pm.author as pm_author,
        pm.artist as pm_artist,
        pm.serialization as pm_serialization,
        pm.updated_on as pm_updated_on,
        pm.is_active as pm_is_active,
        pm.domain_changed_from as pm_domain_changed_from,
        pm.last_scraped as pm_last_scraped,
        pm.created_at as pm_created_at,
        pm.updated_at as pm_updated_at
       FROM manga_mappings mm
       JOIN provider_manga pm ON pm.id = mm.provider_manga_id
       WHERE mm.anilist_id = ? AND mm.provider = ? AND mm.is_active = 1
       LIMIT 1`,
    )
    .get(anilistId, provider) as Record<string, unknown> | undefined;

  if (!row) return null;
  return {
    mapping: {
      id: row.mm_id as number,
      anilist_id: row.mm_anilist_id as number,
      provider: row.mm_provider as string,
      provider_manga_id: row.mm_provider_manga_id as number,
      mapping_source: row.mm_mapping_source as string | null,
      is_active: row.mm_is_active as number,
      replaced_by: row.mm_replaced_by as number | null,
      created_at: row.mm_created_at as number,
      updated_at: row.mm_updated_at as number,
    },
    provider: {
      id: row.pm_id as number,
      provider: row.pm_provider as string,
      provider_id: row.pm_provider_id as string,
      title: row.pm_title as string,
      image: row.pm_image as string | null,
      status: row.pm_status as string | null,
      rating: row.pm_rating as string | null,
      chapters: row.pm_chapters as string | null,
      genres: row.pm_genres as string | null,
      description: row.pm_description as string | null,
      author: row.pm_author as string | null,
      artist: row.pm_artist as string | null,
      serialization: row.pm_serialization as string | null,
      updated_on: row.pm_updated_on as string | null,
      is_active: row.pm_is_active as number,
      domain_changed_from: row.pm_domain_changed_from as string | null,
      last_scraped: row.pm_last_scraped as number | null,
      created_at: row.pm_created_at as number,
      updated_at: row.pm_updated_at as number,
    },
  };
}

export function setActiveMapping(
  anilistId: number,
  provider: string,
  providerMangaId: number,
  source = 'manual',
): MangaMappingRecord {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);
  const transaction = db.transaction(() => {
    db.prepare(
      `UPDATE manga_mappings
       SET is_active = 0, updated_at = unixepoch()
       WHERE anilist_id = ? AND provider = ? AND is_active = 1`,
    ).run(anilistId, provider);

    const insert = db.prepare(
      `INSERT INTO manga_mappings (
        anilist_id,
        provider,
        provider_manga_id,
        mapping_source,
        is_active,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, 1, ?, ?)`,
    );

    insert.run(anilistId, provider, providerMangaId, source, now, now);
  });

  transaction();

  const row = db
    .prepare(
      `SELECT * FROM manga_mappings
       WHERE anilist_id = ? AND provider = ? AND is_active = 1
       ORDER BY updated_at DESC
       LIMIT 1`,
    )
    .get(anilistId, provider) as MangaMappingRecord | undefined;

  return row as MangaMappingRecord;
}
