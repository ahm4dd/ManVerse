import { z } from 'zod';

/**
 * Zod schemas and TypeScript types for database models
 * Following ManVerse pattern: Zod-first validation
 */

// ========== AniList Manga ==========

export const AniListMangaDbSchema = z.object({
  id: z.number(),
  title_romaji: z.string(),
  title_english: z.string().nullable(),
  title_native: z.string().nullable(),
  synonyms: z.string().nullable(), // JSON array stored as string
  description: z.string().nullable(),
  cover_image_url: z.string().nullable(),
  banner_image_url: z.string().nullable(),
  status: z.string(),
  format: z.string().nullable(),
  chapters: z.number().nullable(),
  volumes: z.number().nullable(),
  start_date: z.string().nullable(),
  end_date: z.string().nullable(),
  genres: z.string(), // JSON array
  tags: z.string().nullable(), // JSON array
  average_score: z.number().nullable(),
  mean_score: z.number().nullable(),
  popularity: z.number().nullable(),
  favorites: z.number().nullable(),
  is_adult: z.number().default(0),
  site_url: z.string().nullable(),
  last_updated: z.number(),
});

export type AniListMangaDb = z.infer<typeof AniListMangaDbSchema>;

// Input type (for inserts - fewer required fields)
export const AniListMangaInputSchema = AniListMangaDbSchema.partial().required({
  id: true,
  title_romaji: true,
  status: true,
  genres: true,
  last_updated: true,
});

export type AniListMangaInput = z.infer<typeof AniListMangaInputSchema>;

// ========== Provider Manga ==========

export const ProviderMangaDbSchema = z.object({
  id: z.number(),
  provider: z.string(),
  provider_id: z.string(),
  provider_url: z.string(),
  title: z.string(),
  alt_titles: z.string().nullable(), //JSON array
  cover_url: z.string().nullable(),
  status: z.string().nullable(),
  latest_chapter: z.string().nullable(),
  total_chapters: z.number().nullable(),
  description: z.string().nullable(),
  genres: z.string().nullable(), // JSON array
  last_scraped: z.number(),
  is_active: z.number().default(1),
  domain_changed_from: z.string().nullable(),
  last_checked: z.number().nullable(),
  failed_checks: z.number().default(0),
});

export type ProviderMangaDb = z.infer<typeof ProviderMangaDbSchema>;

export const ProviderMangaInputSchema = ProviderMangaDbSchema.omit({ id: true })
  .partial()
  .required({
    provider: true,
    provider_id: true,
    provider_url: true,
    title: true,
    last_scraped: true,
  });

export type ProviderMangaInput = z.infer<typeof ProviderMangaInputSchema>;

// ========== Manga Mappings ==========

export const MangaMappingDbSchema = z.object({
  id: z.number(),
  anilist_id: z.number(),
  provider: z.string(),
  provider_manga_id: z.number(),
  confidence: z.enum(['manual', 'auto-high', 'auto-low']).default('manual'),
  verified: z.number().default(0),
  created_at: z.number(),
  created_by: z.string().default('user'),
  replaced_by: z.number().nullable(),
  is_active: z.number().default(1),
  notes: z.string().nullable(),
});

export type MangaMappingDb = z.infer<typeof MangaMappingDbSchema>;

export const MangaMappingInputSchema = MangaMappingDbSchema.omit({ id: true }).partial().required({
  anilist_id: true,
  provider: true,
  provider_manga_id: true,
  created_at: true,
});

export type MangaMappingInput = z.infer<typeof MangaMappingInputSchema>;

// ========== User Library ==========

export const UserLibraryDbSchema = z.object({
  id: z.number(),
  anilist_id: z.number().nullable(),
  provider: z.string(),
  provider_manga_id: z.number(),
  status: z.enum(['reading', 'completed', 'plan_to_read', 'paused', 'dropped']).default('reading'),
  progress: z.number().default(0),
  score: z.number().nullable(),
  notes: z.string().nullable(),
  is_favorite: z.number().default(0),
  added_at: z.number(),
  last_read: z.number().nullable(),
  started_at: z.number().nullable(),
  completed_at: z.number().nullable(),
});

export type UserLibraryDb = z.infer<typeof UserLibraryDbSchema>;

export const UserLibraryInputSchema = UserLibraryDbSchema.omit({ id: true }).partial().required({
  provider: true,
  provider_manga_id: true,
  added_at: true,
});

export type UserLibraryInput = z.infer<typeof UserLibraryInputSchema>;

// ========== Downloaded Chapters ==========

export const DownloadedChapterDbSchema = z.object({
  id: z.number(),
  provider_manga_id: z.number(),
  chapter_number: z.string(),
  chapter_title: z.string().nullable(),
  chapter_url: z.string().nullable(),
  file_path: z.string(),
  file_size: z.number().nullable(),
  page_count: z.number().nullable(),
  downloaded_at: z.number(),
});

export type DownloadedChapterDb = z.infer<typeof DownloadedChapterDbSchema>;

export const DownloadedChapterInputSchema = DownloadedChapterDbSchema.omit({ id: true })
  .partial()
  .required({
    provider_manga_id: true,
    chapter_number: true,
    file_path: true,
    downloaded_at: true,
  });

export type DownloadedChapterInput = z.infer<typeof DownloadedChapterInputSchema>;

// ========== AniList Sync State ==========

export const AniListSyncStateDbSchema = z.object({
  anilist_id: z.number(),
  local_progress: z.number(),
  anilist_progress: z.number(),
  local_status: z.string().nullable(),
  anilist_status: z.string().nullable(),
  local_score: z.number().nullable(),
  anilist_score: z.number().nullable(),
  last_synced: z.number(),
  last_local_update: z.number().nullable(),
  last_anilist_update: z.number().nullable(),
  needs_sync: z.number().default(0),
  sync_direction: z.enum(['push', 'pull', 'conflict']).nullable(),
});

export type AniListSyncStateDb = z.infer<typeof AniListSyncStateDbSchema>;

export const AniListSyncStateInputSchema = AniListSyncStateDbSchema.partial().required({
  anilist_id: true,
  local_progress: true,
  anilist_progress: true,
  last_synced: true,
});

export type AniListSyncStateInput = z.infer<typeof AniListSyncStateInputSchema>;

// ========== Provider Domains ==========

export const ProviderDomainDbSchema = z.object({
  id: z.number(),
  provider: z.string(),
  current_domain: z.string(),
  previous_domains: z.string().nullable(), // JSON array
  last_updated: z.number(),
  is_active: z.number().default(1),
  notes: z.string().nullable(),
});

export type ProviderDomainDb = z.infer<typeof ProviderDomainDbSchema>;

export const ProviderDomainInputSchema = ProviderDomainDbSchema.omit({ id: true })
  .partial()
  .required({
    provider: true,
    current_domain: true,
    last_updated: true,
  });

export type ProviderDomainInput = z.infer<typeof ProviderDomainInputSchema>;

// ========== Custom Providers ==========

export const CustomProviderDbSchema = z.object({
  id: z.number(),
  name: z.string(),
  base_url: z.string(),
  scraper_type: z.string().default('generic'),
  selector_config: z.string().nullable(), // JSON
  created_at: z.number(),
  is_active: z.number().default(1),
});

export type CustomProviderDb = z.infer<typeof CustomProviderDbSchema>;

export const CustomProviderInputSchema = CustomProviderDbSchema.omit({ id: true })
  .partial()
  .required({
    name: true,
    base_url: true,
    created_at: true,
  });

export type CustomProviderInput = z.infer<typeof CustomProviderInputSchema>;

// ========== Helper Types ==========

// Parsed versions (with JSON fields as objects)
export interface AniListMangaParsed extends Omit<AniListMangaDb, 'genres' | 'synonyms' | 'tags'> {
  genres: string[];
  synonyms: string[];
  tags: Array<{ id: number; name: string; rank: number }> | null;
}

export interface ProviderMangaParsed extends Omit<ProviderMangaDb, 'alt_titles' | 'genres'> {
  alt_titles: string[];
  genres: string[];
}
