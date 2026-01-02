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
  cached_at: z.number(),
});

export type AnilistMangaRecord = z.infer<typeof AnilistMangaRecordSchema>;
