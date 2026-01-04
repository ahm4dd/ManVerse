import fs from 'node:fs';
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { jsonError, jsonSuccess } from '../utils/response.ts';
import { requireAuth, requireAuthOrQuery } from '../middleware/auth.ts';
import type { HonoEnv } from '../types/api.ts';
import {
  ApiErrorSchema,
  DownloadJobSchema,
  DownloadJobResponseSchema,
  DownloadQueueResponseSchema,
  DownloadedChaptersResponseSchema,
  DownloadedSeriesResponseSchema,
} from '../openapi/schemas.ts';
import { openApiHook } from '../openapi/hook.ts';
import { DownloadService } from '../services/download-service.ts';

const downloads = new OpenAPIHono<HonoEnv>({ defaultHook: openApiHook });
const downloadService = DownloadService.getInstance();

const errorResponse = {
  description: 'Error',
  content: {
    'application/json': {
      schema: ApiErrorSchema,
    },
  },
};

const queueSchema = z.object({
  provider: z.string().optional(),
  providerSeriesId: z.string(),
  chapterId: z.string().optional(),
  chapterUrl: z.string().optional(),
  chapterNumber: z.string(),
  chapterTitle: z.string().optional(),
  seriesTitle: z.string().optional(),
  seriesImage: z.string().optional(),
  seriesStatus: z.string().optional(),
  seriesRating: z.string().optional(),
  seriesChapters: z.string().optional(),
  force: z.boolean().optional(),
  seriesBudgetMb: z.number().optional(),
});

const queueRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['downloads'],
  middleware: requireAuth,
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: queueSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Download queued',
      content: {
        'application/json': {
          schema: DownloadJobResponseSchema,
        },
      },
    },
    default: errorResponse,
  },
});

downloads.openapi(queueRoute, async (c) => {
  const body = c.req.valid('json');
  const userId = c.get('auth')?.id?.toString() ?? null;

  try {
    const job = await downloadService.enqueue({
      ...body,
      userId,
    });
    return jsonSuccess(c, job);
  } catch (error) {
    return jsonError(
      c,
      {
        code: 'DOWNLOAD_QUEUE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to queue download',
      },
      400,
    );
  }
});

const listRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['downloads'],
  middleware: requireAuth,
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: 'Download jobs list',
      content: {
        'application/json': {
          schema: DownloadQueueResponseSchema,
        },
      },
    },
    default: errorResponse,
  },
});

downloads.openapi(listRoute, (c) => {
  const jobs = downloadService.listJobs();
  return jsonSuccess(c, { jobs });
});

const cancelRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  tags: ['downloads'],
  middleware: requireAuth,
  security: [{ BearerAuth: [] }],
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    200: {
      description: 'Download canceled',
      content: {
        'application/json': {
          schema: DownloadJobResponseSchema,
        },
      },
    },
    default: errorResponse,
  },
});

downloads.openapi(cancelRoute, (c) => {
  const { id } = c.req.valid('param');
  const job = downloadService.cancel(id);
  if (!job) {
    return jsonError(c, { code: 'NOT_FOUND', message: 'Download job not found' }, 404);
  }
  return jsonSuccess(c, job);
});

const fileRoute = createRoute({
  method: 'get',
  path: '/{id}/file',
  tags: ['downloads'],
  middleware: requireAuthOrQuery,
  security: [{ BearerAuth: [] }],
  request: {
    params: z.object({
      id: z.string(),
    }),
    query: z.object({
      token: z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: 'Download file',
      content: {
        'application/pdf': {
          schema: z.string(),
        },
      },
    },
    default: errorResponse,
  },
});

downloads.openapi(fileRoute, (c) => {
  const { id } = c.req.valid('param');
  const job = downloadService.getJob(id);
  const downloadRecord = job?.downloadId
    ? downloadService.getDownloadedChapterById(job.downloadId)
    : downloadService.getDownloadedChapterById(Number(id));

  const filePath = job?.filePath ?? downloadRecord?.file_path;
  if (!filePath || !fs.existsSync(filePath)) {
    return jsonError(c, { code: 'NOT_FOUND', message: 'Download file not found' }, 404);
  }

  const file = Bun.file(filePath);
  const headers = new Headers();
  headers.set('Content-Type', 'application/pdf');
  headers.set('Content-Disposition', `inline; filename="${encodeURIComponent(filePath.split('/').pop() || 'chapter.pdf')}"`);
  return new Response(file.stream(), { status: 200, headers });
});

const offlineLibraryRoute = createRoute({
  method: 'get',
  path: '/library',
  tags: ['downloads'],
  middleware: requireAuth,
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: 'Offline library summary',
      content: {
        'application/json': {
          schema: DownloadedSeriesResponseSchema,
        },
      },
    },
    default: errorResponse,
  },
});

downloads.openapi(offlineLibraryRoute, (c) => {
  const data = downloadService.listDownloadedSeries().map((item) => ({
    providerMangaId: item.provider_manga_id,
    provider: item.provider,
    providerSeriesId: item.provider_id,
    title: item.title,
    image: item.image,
    chaptersDownloaded: item.chapters_downloaded,
    totalSize: item.total_size,
    lastDownloaded: item.last_downloaded,
  }));
  return jsonSuccess(c, data);
});

const offlineChaptersRoute = createRoute({
  method: 'get',
  path: '/series/{providerMangaId}',
  tags: ['downloads'],
  middleware: requireAuth,
  security: [{ BearerAuth: [] }],
  request: {
    params: z.object({
      providerMangaId: z.coerce.number().int(),
    }),
  },
  responses: {
    200: {
      description: 'Downloaded chapters for series',
      content: {
        'application/json': {
          schema: DownloadedChaptersResponseSchema,
        },
      },
    },
    default: errorResponse,
  },
});

downloads.openapi(offlineChaptersRoute, (c) => {
  const { providerMangaId } = c.req.valid('param');
  const chapters = downloadService.listDownloadedChapters(providerMangaId).map((chapter) => ({
    id: chapter.id,
    providerMangaId: chapter.provider_manga_id,
    chapterNumber: chapter.chapter_number,
    filePath: chapter.file_path,
    fileSize: chapter.file_size ?? null,
    downloadedAt: chapter.downloaded_at,
  }));
  return jsonSuccess(c, chapters);
});

const statusRoute = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['downloads'],
  middleware: requireAuth,
  security: [{ BearerAuth: [] }],
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    200: {
      description: 'Download status',
      content: {
        'application/json': {
          schema: DownloadJobResponseSchema,
        },
      },
    },
    default: errorResponse,
  },
});

downloads.openapi(statusRoute, (c) => {
  const { id } = c.req.valid('param');
  const job = downloadService.getJob(id);
  if (!job) {
    return jsonError(c, { code: 'NOT_FOUND', message: 'Download job not found' }, 404);
  }
  return jsonSuccess(c, job);
});

export default downloads;
