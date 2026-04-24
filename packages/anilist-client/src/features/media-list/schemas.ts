import { z } from 'zod';
export {
  viewerIdDataSchema as viewerMangaListsViewerDataSchema,
  viewerIdSchema as viewerMangaListsViewerSchema,
} from '../shared/viewer/schemas.js';
export type {
  ViewerId as ViewerMangaListsViewer,
  ViewerIdData as ViewerMangaListsViewerData,
} from '../shared/viewer/schemas.js';

export const viewerMangaListsInputSchema = z.object({
  chunk: z.number().int().positive().optional(),
  perChunk: z.number().int().positive().max(500).optional(),
});

export const saveMediaListEntryStatusSchema = z.enum([
  'CURRENT',
  'PLANNING',
  'COMPLETED',
  'DROPPED',
  'PAUSED',
  'REPEATING',
]);

export const viewerMangaListFuzzyDateSchema = z.object({
  year: z.number().nullable(),
  month: z.number().nullable(),
  day: z.number().nullable(),
});

export const viewerMangaListTitleSchema = z.object({
  romaji: z.string().nullable(),
  english: z.string().nullable(),
  native: z.string().nullable(),
  userPreferred: z.string(),
});

export const viewerMangaListCoverImageSchema = z.object({
  extraLarge: z.string().nullable(),
  large: z.string().nullable(),
  medium: z.string().nullable(),
  color: z.string().nullable(),
});

export const viewerMangaListMediaSchema = z.object({
  id: z.number(),
  idMal: z.number().nullable(),
  title: viewerMangaListTitleSchema,
  coverImage: viewerMangaListCoverImageSchema,
  format: z.string().nullable(),
  status: z.string().nullable(),
  chapters: z.number().nullable(),
  volumes: z.number().nullable(),
  countryOfOrigin: z.string().nullable(),
  siteUrl: z.string().nullable(),
});

export const viewerMangaListEntrySchema = z.object({
  id: z.number(),
  mediaId: z.number(),
  status: z.string(),
  score: z.number().nullable(),
  progress: z.number().nullable(),
  progressVolumes: z.number().nullable(),
  repeat: z.number().nullable(),
  priority: z.number().nullable(),
  private: z.boolean().nullable(),
  hiddenFromStatusLists: z.boolean().nullable(),
  notes: z.string().nullable(),
  updatedAt: z.number().nullable(),
  startedAt: viewerMangaListFuzzyDateSchema.nullable(),
  completedAt: viewerMangaListFuzzyDateSchema.nullable(),
  media: viewerMangaListMediaSchema.nullable(),
});

export const viewerMangaListGroupSchema = z.object({
  name: z.string(),
  isCustomList: z.boolean().nullable(),
  isSplitCompletedList: z.boolean().nullable(),
  status: z.string().nullable(),
  entries: z.array(viewerMangaListEntrySchema),
});

export const viewerMangaListCollectionSchema = z.object({
  hasNextChunk: z.boolean().nullable(),
  lists: z.array(viewerMangaListGroupSchema),
});

export const viewerMangaListsDataSchema = z.object({
  MediaListCollection: viewerMangaListCollectionSchema.nullable(),
});

export const saveMediaListEntryMediaSchema = z.object({
  id: z.number(),
  title: viewerMangaListTitleSchema,
});

export const saveMediaListEntrySchema = z.object({
  id: z.number(),
  mediaId: z.number(),
  status: saveMediaListEntryStatusSchema,
  score: z.number().nullable(),
  progress: z.number().nullable(),
  media: saveMediaListEntryMediaSchema.nullable(),
});

export const saveMediaListEntryDataSchema = z.object({
  SaveMediaListEntry: saveMediaListEntrySchema.nullable(),
});

export const saveMediaListEntryInputSchema = z.object({
  mediaId: z.number().int().positive(),
  status: saveMediaListEntryStatusSchema,
  progress: z.number().int().min(0).optional(),
  score: z.number().min(0).max(10).optional(),
});

export const deleteMediaListEntryMutationSchema = z.object({
  deleted: z.boolean(),
});

export const deleteMediaListEntryDataSchema = z.object({
  DeleteMediaListEntry: deleteMediaListEntryMutationSchema,
});

export const deleteMediaListEntryInputSchema = z.object({
  entryId: z.number().int().positive(),
});

export const deleteMediaListEntryResultSchema = z.object({
  entryId: z.number().int().positive(),
  deleted: z.boolean(),
});

export type ViewerMangaListsInput = z.input<typeof viewerMangaListsInputSchema>;
export type SaveMediaListEntryStatus = z.infer<
  typeof saveMediaListEntryStatusSchema
>;
export type ViewerMangaListFuzzyDate = z.infer<
  typeof viewerMangaListFuzzyDateSchema
>;
export type ViewerMangaListTitle = z.infer<typeof viewerMangaListTitleSchema>;
export type ViewerMangaListCoverImage = z.infer<
  typeof viewerMangaListCoverImageSchema
>;
export type ViewerMangaListMedia = z.infer<typeof viewerMangaListMediaSchema>;
export type ViewerMangaListEntry = z.infer<typeof viewerMangaListEntrySchema>;
export type ViewerMangaListGroup = z.infer<typeof viewerMangaListGroupSchema>;
export type ViewerMangaListCollection = z.infer<
  typeof viewerMangaListCollectionSchema
>;
export type ViewerMangaListsData = z.infer<typeof viewerMangaListsDataSchema>;
export type SaveMediaListEntryMedia = z.infer<
  typeof saveMediaListEntryMediaSchema
>;
export type SaveMediaListEntry = z.infer<typeof saveMediaListEntrySchema>;
export type SaveMediaListEntryData = z.infer<
  typeof saveMediaListEntryDataSchema
>;
export type SaveMediaListEntryInput = z.input<
  typeof saveMediaListEntryInputSchema
>;
export type DeleteMediaListEntryMutation = z.infer<
  typeof deleteMediaListEntryMutationSchema
>;
export type DeleteMediaListEntryData = z.infer<
  typeof deleteMediaListEntryDataSchema
>;
export type DeleteMediaListEntryInput = z.input<
  typeof deleteMediaListEntryInputSchema
>;
export type DeleteMediaListEntryResult = z.infer<
  typeof deleteMediaListEntryResultSchema
>;
