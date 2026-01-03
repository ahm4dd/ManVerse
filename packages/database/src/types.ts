import { z } from 'zod';

export const AnilistMangaRecordSchema = z.object({
  id: z.number(),
  title_romaji: z.string(),
  title_english: z.string().nullable().optional(),
  title_native: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  cover_large: z.string().nullable().optional(),
  cover_medium: z.string().nullable().optional(),
  banner_image: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  format: z.string().nullable().optional(),
  chapters: z.number().nullable().optional(),
  volumes: z.number().nullable().optional(),
  genres: z.string().nullable().optional(),
  average_score: z.number().nullable().optional(),
  popularity: z.number().nullable().optional(),
  favourites: z.number().nullable().optional(),
  updated_at: z.number().nullable().optional(),
  country_of_origin: z.string().nullable().optional(),
  cached_at: z.number(),
});

export type AnilistMangaRecord = z.infer<typeof AnilistMangaRecordSchema>;

export const ProviderMangaRecordSchema = z.object({
  id: z.number(),
  provider: z.string(),
  provider_id: z.string(),
  title: z.string(),
  image: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  rating: z.string().nullable().optional(),
  chapters: z.string().nullable().optional(),
  genres: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  author: z.string().nullable().optional(),
  artist: z.string().nullable().optional(),
  serialization: z.string().nullable().optional(),
  updated_on: z.string().nullable().optional(),
  is_active: z.number().nullable().optional(),
  domain_changed_from: z.string().nullable().optional(),
  last_scraped: z.number().nullable().optional(),
  created_at: z.number().nullable().optional(),
  updated_at: z.number().nullable().optional(),
});

export type ProviderMangaRecord = z.infer<typeof ProviderMangaRecordSchema>;

export const MangaMappingRecordSchema = z.object({
  id: z.number(),
  anilist_id: z.number(),
  provider: z.string(),
  provider_manga_id: z.number(),
  mapping_source: z.string().nullable().optional(),
  is_active: z.number().nullable().optional(),
  replaced_by: z.number().nullable().optional(),
  created_at: z.number().nullable().optional(),
  updated_at: z.number().nullable().optional(),
});

export type MangaMappingRecord = z.infer<typeof MangaMappingRecordSchema>;

export const LibraryEntryRecordSchema = z.object({
  id: z.number(),
  user_id: z.string().nullable().optional(),
  anilist_id: z.number().nullable().optional(),
  provider: z.string().nullable().optional(),
  provider_manga_id: z.number().nullable().optional(),
  anilist_entry_id: z.number().nullable().optional(),
  status: z.string(),
  progress: z.number().nullable().optional(),
  score: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
  is_favorite: z.number().nullable().optional(),
  started_at: z.number().nullable().optional(),
  completed_at: z.number().nullable().optional(),
  created_at: z.number().nullable().optional(),
  updated_at: z.number().nullable().optional(),
});

export type LibraryEntryRecord = z.infer<typeof LibraryEntryRecordSchema>;

export const SyncStateRecordSchema = z.object({
  id: z.number(),
  user_id: z.string().nullable().optional(),
  anilist_id: z.number(),
  local_status: z.string().nullable().optional(),
  local_progress: z.number().nullable().optional(),
  local_score: z.number().nullable().optional(),
  anilist_status: z.string().nullable().optional(),
  anilist_progress: z.number().nullable().optional(),
  anilist_score: z.number().nullable().optional(),
  needs_sync: z.number().nullable().optional(),
  conflict_state: z.string().nullable().optional(),
  updated_at: z.number().nullable().optional(),
});

export type SyncStateRecord = z.infer<typeof SyncStateRecordSchema>;
