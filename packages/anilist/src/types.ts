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

const FuzzyDateSchema = z
  .object({
    year: z.number().nullable(),
    month: z.number().nullable(),
    day: z.number().nullable(),
  })
  .nullable();

const TitleSchema = z.object({
  romaji: z.string(),
  english: z.string().nullable(),
  native: z.string().nullable(),
  userPreferred: z.string().optional(),
});

const CoverImageSchema = z.object({
  extraLarge: z.string().url().optional(),
  large: z.string().url().optional(),
  medium: z.string().url().optional(),
  color: z.string().nullable().optional(),
});

const NextAiringEpisodeSchema = z.object({
  airingAt: z.number(),
  timeUntilAiring: z.number(),
  episode: z.number(),
});

const StaffEdgeSchema = z.object({
  role: z.string(),
  node: z.object({
    id: z.number().optional(),
    name: z.object({
      full: z.string(),
    }),
    image: z
      .object({
        large: z.url().optional(),
        medium: z.url().optional(),
      })
      .optional(),
  }),
});

const CharacterEdgeSchema = z.object({
  role: z.string(),
  node: z.object({
    id: z.number().optional(),
    name: z.object({
      full: z.string(),
    }),
    image: z
      .object({
        large: z.url().optional(),
        medium: z.url().optional(),
      })
      .optional(),
  }),
});

const MediaListEntryPreviewSchema = z.object({
  id: z.number(),
  status: z.string().nullable().optional(),
  progress: z.number().nullable().optional(),
  score: z.number().nullable().optional(),
  startedAt: FuzzyDateSchema.optional(),
  completedAt: FuzzyDateSchema.optional(),
  repeat: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const MediaStatusSchema = z.enum([
  'FINISHED',
  'RELEASING',
  'NOT_YET_RELEASED',
  'CANCELLED',
  'HIATUS',
]);

export const MediaFormatSchema = z.enum(['MANGA', 'NOVEL', 'ONE_SHOT', 'MANHWA', 'MANHUA']);

export const AniListMangaSchema = z.object({
  id: z.number(),
  idMal: z.number().nullable().optional(), // MyAnimeList ID
  title: TitleSchema,
  synonyms: z.array(z.string()).default([]),
  description: z.string().nullable(),
  coverImage: CoverImageSchema,
  bannerImage: z.url().nullable().optional(),
  status: MediaStatusSchema.nullable(),
  format: MediaFormatSchema.nullable(),
  chapters: z.number().nullable(),
  volumes: z.number().nullable(),
  genres: z.array(z.string()),
  tags: z
    .array(
      z.object({
        id: z.number(),
        name: z.string(),
        rank: z.number(), // Relevance 0-100
        isMediaSpoiler: z.boolean().optional(),
      }),
    )
    .optional(),
  averageScore: z.number().nullable(), // 0-100
  meanScore: z.number().nullable().optional(),
  popularity: z.number(),
  favourites: z.number(),
  source: z.string().nullable().optional(),
  updatedAt: z.number().nullable().optional(),
  countryOfOrigin: z.string().nullable().optional(),
  nextAiringEpisode: NextAiringEpisodeSchema.nullable().optional(),
  rankings: z
    .array(
      z.object({
        id: z.number(),
        rank: z.number(),
        type: z.string().optional(),
        allTime: z.boolean().optional(),
        context: z.string().optional(),
      }),
    )
    .optional(),
  stats: z
    .object({
      scoreDistribution: z.array(
        z.object({
          score: z.number(),
          amount: z.number(),
        }),
      ),
      statusDistribution: z.array(
        z.object({
          status: z.string(),
          amount: z.number(),
        }),
      ),
    })
    .optional(),
  characters: z
    .object({
      edges: z.array(CharacterEdgeSchema),
    })
    .optional(),
  staff: z
    .object({
      edges: z.array(StaffEdgeSchema),
    })
    .optional(),
  mediaListEntry: MediaListEntryPreviewSchema.nullable().optional(),
  recommendations: z
    .object({
      nodes: z.array(
        z.object({
          mediaRecommendation: z
            .object({
              id: z.number(),
              title: TitleSchema,
              coverImage: CoverImageSchema,
              bannerImage: z.string().nullable().optional(),
              status: MediaStatusSchema.nullable().optional(),
              averageScore: z.number().nullable().optional(),
              genres: z.array(z.string()).optional(),
              format: MediaFormatSchema.nullable().optional(),
              chapters: z.number().nullable().optional(),
              volumes: z.number().nullable().optional(),
              updatedAt: z.number().nullable().optional(),
              countryOfOrigin: z.string().nullable().optional(),
              nextAiringEpisode: NextAiringEpisodeSchema.nullable().optional(),
            })
            .passthrough(),
        }),
      ),
    })
    .optional(),
  startDate: FuzzyDateSchema.optional(),
  endDate: FuzzyDateSchema.optional(),
  siteUrl: z.url(),
});

export type AniListManga = z.infer<typeof AniListMangaSchema>;

const AniListMangaListSchema = z.object({
  id: z.number(),
  title: TitleSchema,
  coverImage: CoverImageSchema.optional(),
  bannerImage: z.string().nullable().optional(),
  status: MediaStatusSchema.nullable().optional(),
  format: MediaFormatSchema.nullable().optional(),
  chapters: z.number().nullable().optional(),
  volumes: z.number().nullable().optional(),
  genres: z.array(z.string()).optional(),
  averageScore: z.number().nullable().optional(),
  updatedAt: z.number().nullable().optional(),
  countryOfOrigin: z.string().nullable().optional(),
});

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
  progress: z.number().nullable().optional().transform((value) => value ?? 0), // Chapters read
  progressVolumes: z.number().nullable(),
  repeat: z.number().nullable().optional().transform((value) => value ?? 0), // Re-read count
  priority: z.number().nullable(), // 0-5
  private: z.boolean().optional(),
  notes: z.string().nullable(),
  hiddenFromStatusLists: z.boolean().optional(),
  startedAt: FuzzyDateSchema,
  completedAt: FuzzyDateSchema,
  updatedAt: z.number().optional(), // Unix timestamp
  createdAt: z.number().optional(),
  media: AniListMangaListSchema.optional(), // Populated in list queries
});

export type MediaListEntry = z.infer<typeof MediaListEntrySchema>;

export const MediaListCollectionSchema = z.object({
  lists: z.array(
    z.object({
      name: z.string().optional(),
      entries: z.array(MediaListEntrySchema),
    }),
  ),
});

export type MediaListCollection = z.infer<typeof MediaListCollectionSchema>;

// ---------- User Stats ----------

const ActivityHistorySchema = z.object({
  date: z.number(),
  amount: z.number(),
  level: z.number(),
});

const StatGenreSchema = z.object({
  genre: z.string(),
  count: z.number(),
  meanScore: z.number().nullable().optional(),
  chaptersRead: z.number().optional(),
});

const StatStatusSchema = z.object({
  status: z.string(),
  count: z.number(),
  meanScore: z.number().nullable().optional(),
  chaptersRead: z.number().optional(),
});

const StatFormatSchema = z.object({
  format: z.string(),
  count: z.number(),
});

const StatCountrySchema = z.object({
  country: z.string(),
  count: z.number(),
});

export const AniListUserStatsSchema = z.object({
  stats: z
    .object({
      activityHistory: z.array(ActivityHistorySchema).optional(),
      mangaActivityHistory: z.array(ActivityHistorySchema).optional(),
    })
    .optional(),
  statistics: z
    .object({
      manga: z
        .object({
          count: z.number().optional(),
          chaptersRead: z.number().optional(),
          volumesRead: z.number().optional(),
          meanScore: z.number().nullable().optional(),
          standardDeviation: z.number().nullable().optional(),
          genres: z.array(StatGenreSchema).optional(),
          statuses: z.array(StatStatusSchema).optional(),
          formats: z.array(StatFormatSchema).optional(),
          countries: z.array(StatCountrySchema).optional(),
        })
        .optional(),
    })
    .optional(),
});

export type AniListUserStats = z.infer<typeof AniListUserStatsSchema>;

// ---------- Activity ----------

export const AniListActivitySchema = z.object({
  id: z.number(),
  status: z.string().nullable().optional(),
  progress: z.union([z.number(), z.string()]).nullable().optional(),
  createdAt: z.number(),
  media: z
    .object({
      id: z.number(),
      title: z.object({
        userPreferred: z.string(),
      }),
      coverImage: z
        .object({
          medium: z.string().url().optional(),
        })
        .optional(),
    })
    .nullable()
    .optional(),
});

export type AniListActivity = z.infer<typeof AniListActivitySchema>;

// ---------- Notifications ----------

const NotificationMessageSchema = z.preprocess(
  (value) => {
    if (value == null || typeof value === 'string') return value;
    if (typeof value === 'object' && value && 'message' in value) {
      return (value as { message?: string | null }).message ?? null;
    }
    return null;
  },
  z.string().nullable(),
);

export const AniListNotificationSchema = z.object({
  id: z.number(),
  type: z.string(),
  createdAt: z.number(),
  message: NotificationMessageSchema.optional(),
  user: z
    .object({
      name: z.string(),
      avatar: z
        .object({
          medium: z.string().url().optional(),
        })
        .optional(),
    })
    .optional(),
  episode: z.number().optional(),
  media: z
    .object({
      title: z
        .object({
          userPreferred: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
});

export type AniListNotification = z.infer<typeof AniListNotificationSchema>;

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
