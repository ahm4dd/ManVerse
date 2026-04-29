import { z } from 'zod';

export const searchMediaPageInfoSchema = z.object({
  currentPage: z.number(),
  hasNextPage: z.boolean(),
  lastPage: z.number().nullable(),
  perPage: z.number(),
  total: z.number(),
});

export const searchMediaTitleSchema = z.object({
  romaji: z.string().nullable(),
  english: z.string().nullable(),
  native: z.string().nullable(),
  userPreferred: z.string(),
});

export const searchMediaCoverImageSchema = z.object({
  extraLarge: z.string().nullable(),
  large: z.string().nullable(),
  medium: z.string().nullable(),
  color: z.string().nullable(),
});

export const searchMediaTagSchema = z.object({
  id: z.number(),
  name: z.string(),
  rank: z.number(),
  isGeneralSpoiler: z.boolean(),
  isMediaSpoiler: z.boolean(),
  category: z.string(),
});

export const searchMediaRelationNodeSchema = z.object({
  id: z.number(),
  type: z.string(),
  format: z.string().nullable(),
  status: z.string().nullable(),
  chapters: z.number().nullable(),
  volumes: z.number().nullable(),
  countryOfOrigin: z.string().nullable(),
  title: z.object({
    romaji: z.string().nullable(),
    english: z.string().nullable(),
    native: z.string().nullable(),
    userPreferred: z.string(),
  }),
  coverImage: z.object({
    large: z.string().nullable(),
    medium: z.string().nullable(),
  }),
  siteUrl: z.string().nullable(),
});

export const searchMediaRelationEdgeSchema = z.object({
  relationType: z.string(),
  node: searchMediaRelationNodeSchema.nullable(),
});

export const searchMediaSchema = z.object({
  id: z.number(),
  idMal: z.number().nullable(),
  type: z.string(),
  format: z.string().nullable(),
  status: z.string().nullable(),
  description: z.string().nullable(),
  startDate: z.object({
    year: z.number().nullable(),
    month: z.number().nullable(),
    day: z.number().nullable(),
  }),
  endDate: z.object({
    year: z.number().nullable(),
    month: z.number().nullable(),
    day: z.number().nullable(),
  }),
  season: z.string().nullable(),
  seasonYear: z.number().nullable(),
  chapters: z.number().nullable(),
  volumes: z.number().nullable(),
  countryOfOrigin: z.string().nullable(),
  source: z.string().nullable(),
  coverImage: searchMediaCoverImageSchema,
  bannerImage: z.string().nullable(),
  title: searchMediaTitleSchema,
  synonyms: z.array(z.string()),
  genres: z.array(z.string()),
  tags: z.array(searchMediaTagSchema),
  averageScore: z.number().nullable(),
  meanScore: z.number().nullable(),
  popularity: z.number(),
  favourites: z.number(),
  trending: z.number().nullable(),
  isAdult: z.boolean(),
  siteUrl: z.string().nullable(),
  relations: z
    .object({
      edges: z.array(searchMediaRelationEdgeSchema),
    })
    .nullable(),
});

export const searchMediaPageSchema = z.object({
  pageInfo: searchMediaPageInfoSchema,
  media: z.array(searchMediaSchema),
});

export const searchMediaDataSchema = z.object({
  Page: searchMediaPageSchema.nullable(),
});

export const searchMediaInputSchema = z.object({
  search: z.string().min(1),
  page: z.number().int().positive().optional().default(1),
  perPage: z.number().int().positive().max(50).optional().default(10),
  isAdult: z.boolean().optional().default(false),
});

export type SearchMediaPageInfo = z.infer<typeof searchMediaPageInfoSchema>;
export type SearchMediaTitle = z.infer<typeof searchMediaTitleSchema>;
export type SearchMediaCoverImage = z.infer<typeof searchMediaCoverImageSchema>;
export type SearchMediaTag = z.infer<typeof searchMediaTagSchema>;
export type SearchMediaRelationNode = z.infer<
  typeof searchMediaRelationNodeSchema
>;
export type SearchMediaRelationEdge = z.infer<
  typeof searchMediaRelationEdgeSchema
>;
export type SearchMedia = z.infer<typeof searchMediaSchema>;
export type SearchMediaPage = z.infer<typeof searchMediaPageSchema>;
export type SearchMediaData = z.infer<typeof searchMediaDataSchema>;
export type SearchMediaInput = z.input<typeof searchMediaInputSchema>;
export type ResolvedSearchMediaInput = z.output<typeof searchMediaInputSchema>;
