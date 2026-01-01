import { z } from 'zod';

/**
 * AniList TypeScript types and Zod schemas
 * Following ManVerse patterns: Zod-first validation at all boundaries
 */

// ---------- Authentication ----------

export const AuthTokenSchema = z.object({
  accessToken: z.string(),
  tokenType: z.string().default('Bearer'),
  expiresIn: z.number(), // seconds
  expiresAt: z.number(), // Unix timestamp
});

export type AuthToken = z.infer<typeof AuthTokenSchema>;

// ---------- User ----------

export const AniListUserSchema = z.object({
  id: z.number(),
  name: z.string(),
  avatar: z
    .object({
      large: z.url().optional(),
      medium: z.url().optional(),
    })
    .optional(),
  bannerImage: z.url().nullable().optional(),
  about: z.string().nullable().optional(),
});

export type AniListUser = z.infer<typeof AniListUserSchema>;

// ---------- Manga/Media ----------

export const MediaStatusSchema = z.enum([
  'FINISHED',
  'RELEASING',
  'NOT_YET_RELEASED',
  'CANCELLED',
  'HIATUS',
]);

export const MediaFormatSchema = z.enum(['MANGA', 'NOVEL', 'ONE_SHOT']);

export const AniListMangaSchema = z.object({
  id: z.number(),
  idMal: z.number().nullable().optional(), // MyAnimeList ID
  title: z.object({
    romaji: z.string(),
    english: z.string().nullable(),
    native: z.string().nullable(),
  }),
  synonyms: z.array(z.string()).default([]),
  description: z.string().nullable(),
  coverImage: z.object({
    large: z.url(),
    medium: z.url(),
    color: z.string().nullable(),
  }),
  bannerImage: z.url().nullable().optional(),
  status: MediaStatusSchema,
  format: MediaFormatSchema,
  chapters: z.number().nullable(),
  volumes: z.number().nullable(),
  genres: z.array(z.string()),
  tags: z
    .array(
      z.object({
        id: z.number(),
        name: z.string(),
        rank: z.number(), // Relevance 0-100
      }),
    )
    .optional(),
  averageScore: z.number().nullable(), // 0-100
  meanScore: z.number().nullable().optional(),
  popularity: z.number(),
  favourites: z.number(),
  startDate: z
    .object({
      year: z.number().nullable(),
      month: z.number().nullable(),
      day: z.number().nullable(),
    })
    .nullable()
    .optional(),
  endDate: z
    .object({
      year: z.number().nullable(),
      month: z.number().nullable(),
      day: z.number().nullable(),
    })
    .nullable()
    .optional(),
  siteUrl: z.url(),
});

export type AniListManga = z.infer<typeof AniListMangaSchema>;

// ---------- Media List ----------

export const MediaListStatusSchema = z.enum([
  'CURRENT', // Reading
  'PLANNING', // Plan to Read
  'COMPLETED', // Completed
  'PAUSED', // On Hold
  'DROPPED', // Dropped
  'REPEATING', // Re-reading
]);

export type MediaListStatus = z.infer<typeof MediaListStatusSchema>;

export const MediaListEntrySchema = z.object({
  id: z.number(),
  mediaId: z.number(),
  status: MediaListStatusSchema,
  score: z.number().nullable(), // User's rating (0-100)
  progress: z.number(), // Chapters read
  progressVolumes: z.number().nullable(),
  repeat: z.number(), // Re-read count
  priority: z.number().nullable(), // 0-5
  private: z.boolean().optional(),
  notes: z.string().nullable(),
  hiddenFromStatusLists: z.boolean().optional(),
  startedAt: z
    .object({
      year: z.number().nullable(),
      month: z.number().nullable(),
      day: z.number().nullable(),
    })
    .nullable(),
  completedAt: z
    .object({
      year: z.number().nullable(),
      month: z.number().nullable(),
      day: z.number().nullable(),
    })
    .nullable(),
  updatedAt: z.number().optional(), // Unix timestamp
  createdAt: z.number().optional(),
  media: AniListMangaSchema.optional(), // Populated in some queries
});

export type MediaListEntry = z.infer<typeof MediaListEntrySchema>;

// ---------- Search Results ----------

export const PageInfoSchema = z.object({
  total: z.number(),
  currentPage: z.number(),
  lastPage: z.number(),
  hasNextPage: z.boolean(),
  perPage: z.number(),
});

export const SearchResultSchema = z.object({
  pageInfo: PageInfoSchema,
  media: z.array(AniListMangaSchema),
});

export type SearchResult = z.infer<typeof SearchResultSchema>;

// ---------- Error Types ----------

export class AniListError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number,
  ) {
    super(message);
    this.name = 'AniListError';
  }
}

export class AniListAuthError extends AniListError {
  constructor(message: string) {
    super(message, 'AUTH_ERROR', 401);
    this.name = 'AniListAuthError';
  }
}

export class AniListRateLimitError extends AniListError {
  constructor(
    message: string,
    public retryAfter?: number,
  ) {
    super(message, 'RATE_LIMIT', 429);
    this.name = 'AniListRateLimitError';
  }
}

export class AniListNotFoundError extends AniListError {
  constructor(resource: string) {
    super(`${resource} not found`, 'NOT_FOUND', 404);
    this.name = 'AniListNotFoundError';
  }
}
