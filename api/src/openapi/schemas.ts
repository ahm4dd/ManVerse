import { z } from '@hono/zod-openapi';

export const ApiMetaSchema = z.object({
  timestamp: z.number().int(),
  requestId: z.string(),
});

export const ApiErrorSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
  meta: ApiMetaSchema,
});

export const createApiSuccessSchema = <T extends z.ZodTypeAny>(data: T) =>
  z.object({
    success: z.literal(true),
    data,
    meta: ApiMetaSchema,
  });

export const ApiSuccessUnknownSchema = createApiSuccessSchema(z.unknown());

export const AuthUrlSchema = z.object({
  authUrl: z.string().url(),
});

export const TokenSchema = z.object({
  token: z.string(),
});

export const OkSchema = z.object({
  ok: z.boolean(),
});

export const AuthUserSchema = z
  .object({
    id: z.number().nullable(),
    username: z.string().optional(),
    isGuest: z.boolean().optional(),
    anilistToken: z.string().optional(),
  })
  .passthrough();

export const DownloadProgressSchema = z.object({
  total: z.number(),
  current: z.number(),
  currentFile: z.string().optional(),
});

export const DownloadJobSchema = z.object({
  id: z.string(),
  provider: z.string(),
  providerSeriesId: z.string(),
  providerMangaId: z.number().optional(),
  chapterId: z.string().optional(),
  chapterUrl: z.string().optional(),
  chapterNumber: z.string(),
  chapterTitle: z.string().optional(),
  seriesTitle: z.string().optional(),
  seriesImage: z.string().optional(),
  status: z.enum(['queued', 'downloading', 'completed', 'failed', 'canceled']),
  progress: DownloadProgressSchema.optional(),
  attempts: z.number(),
  maxAttempts: z.number(),
  error: z.string().optional(),
  filePath: z.string().optional(),
  fileSize: z.number().optional(),
  downloadId: z.number().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const DownloadJobResponseSchema = createApiSuccessSchema(DownloadJobSchema);

export const DownloadQueueResponseSchema = createApiSuccessSchema(
  z.object({
    jobs: z.array(DownloadJobSchema),
  }),
);

export const DownloadedChapterSchema = z.object({
  id: z.number(),
  providerMangaId: z.number(),
  chapterNumber: z.string(),
  filePath: z.string(),
  fileSize: z.number().nullable(),
  downloadedAt: z.number(),
});

export const DownloadedSeriesSchema = z.object({
  providerMangaId: z.number(),
  provider: z.string(),
  providerSeriesId: z.string(),
  title: z.string(),
  image: z.string().nullable(),
  chaptersDownloaded: z.number(),
  totalSize: z.number(),
  lastDownloaded: z.number().nullable(),
});

export const DownloadedSeriesResponseSchema = createApiSuccessSchema(
  z.array(DownloadedSeriesSchema),
);

export const DownloadedChaptersResponseSchema = createApiSuccessSchema(
  z.array(DownloadedChapterSchema),
);
