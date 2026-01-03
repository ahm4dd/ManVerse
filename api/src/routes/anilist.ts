import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { requireAuth } from '../middleware/auth.ts';
import { jsonError, jsonSuccess } from '../utils/response.ts';
import type { HonoEnv } from '../types/api.ts';
import { AniListService } from '../services/anilist-service.ts';
import {
  AniListActivitySchema,
  AniListMangaSchema,
  AniListNotificationSchema,
  AniListUserSchema,
  AniListUserStatsSchema,
  MediaListCollectionSchema,
  MediaListEntrySchema,
  MediaListStatusSchema,
  SearchResultSchema,
} from '@manverse/anilist';
import { verify } from 'hono/jwt';
import { getJwtSecret } from '../utils/jwt.ts';
import type { AuthUser } from '../../../shared/types.ts';
import { ApiErrorSchema, createApiSuccessSchema } from '../openapi/schemas.ts';
import { openApiHook } from '../openapi/hook.ts';

const anilist = new OpenAPIHono<HonoEnv>({ defaultHook: openApiHook });
const service = new AniListService();

const errorResponse = {
  description: 'Error',
  content: {
    'application/json': {
      schema: ApiErrorSchema,
    },
  },
};

const pageSchema = z.object({
  page: z.coerce.number().int().positive().optional(),
});

const searchSchema = z.object({
  query: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  format: z.string().optional(),
  status: z.string().optional(),
  genre: z.string().optional(),
  country: z.string().optional(),
  sort: z.string().optional(),
});

const updateProgressSchema = z.object({
  mediaId: z.number(),
  progress: z.number(),
});

const updateStatusSchema = z.object({
  mediaId: z.number(),
  status: MediaListStatusSchema,
});

const updateEntrySchema = z.object({
  mediaId: z.number(),
  status: MediaListStatusSchema.optional(),
  score: z.number().optional(),
  progress: z.number().optional(),
  notes: z.string().optional(),
});

function normalizeSort(input?: string): string[] | undefined {
  if (!input || input === 'All') return undefined;
  const normalized = input.toUpperCase().replace(/\s+/g, '_');

  if (normalized.endsWith('_DESC') || normalized.endsWith('_ASC')) {
    return [normalized];
  }

  const map: Record<string, string> = {
    POPULARITY: 'POPULARITY_DESC',
    TITLE: 'TITLE_ROMAJI',
    SCORE: 'SCORE_DESC',
    PROGRESS: 'POPULARITY_DESC',
    LAST_UPDATED: 'UPDATED_AT_DESC',
    LAST_ADDED: 'ID_DESC',
    START_DATE: 'START_DATE_DESC',
  };

  const mapped = map[normalized];
  return mapped ? [mapped] : undefined;
}

function normalizeFormat(input?: string): string | undefined {
  if (!input || input === 'All') return undefined;
  return input.toUpperCase().replace(/\s+/g, '_');
}

function normalizeStatus(input?: string): string | undefined {
  if (!input || input === 'All') return undefined;
  return input.toUpperCase().replace(/\s+/g, '_');
}

function normalizeCountry(input?: string): string | undefined {
  if (!input || input === 'All') return undefined;
  return input.toUpperCase();
}

async function getOptionalAuth(c: Parameters<typeof anilist.get>[1]): Promise<AuthUser | null> {
  const header = c.req.header('Authorization');
  if (!header || !header.startsWith('Bearer ')) {
    return null;
  }
  const token = header.slice('Bearer '.length).trim();
  if (!token) return null;
  try {
    return (await verify(token, getJwtSecret())) as AuthUser;
  } catch {
    return null;
  }
}

const meRoute = createRoute({
  method: 'get',
  path: '/me',
  tags: ['anilist'],
  middleware: requireAuth,
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: 'AniList user profile',
      content: {
        'application/json': {
          schema: createApiSuccessSchema(AniListUserSchema),
        },
      },
    },
    default: errorResponse,
  },
});

anilist.openapi(meRoute, async (c) => {
  const auth = c.get('auth');
  if (!auth?.anilistToken) {
    return jsonError(
      c,
      { code: 'ANILIST_TOKEN_MISSING', message: 'AniList token not available' },
      401,
    );
  }

  const user = await service.getCurrentUser({
    accessToken: auth.anilistToken,
    tokenType: 'Bearer',
    expiresIn: 0,
    expiresAt: Date.now(),
  });
  return jsonSuccess(c, user);
});

const searchRoute = createRoute({
  method: 'get',
  path: '/search',
  tags: ['anilist'],
  request: {
    query: searchSchema,
  },
  responses: {
    200: {
      description: 'Search results',
      content: {
        'application/json': {
          schema: createApiSuccessSchema(SearchResultSchema),
        },
      },
    },
    default: errorResponse,
  },
});

anilist.openapi(searchRoute, async (c) => {
  const { query, page, format, status, genre, country, sort } = c.req.valid('query');
  const results = await service.searchMangaWithFilters(query || '', page || 1, {
    sort: normalizeSort(sort),
    format: normalizeFormat(format),
    status: normalizeStatus(status),
    genre: genre && genre !== 'All' ? genre : undefined,
    country: normalizeCountry(country),
  });

  return jsonSuccess(c, results);
});

const trendingRoute = createRoute({
  method: 'get',
  path: '/trending',
  tags: ['anilist'],
  request: {
    query: pageSchema,
  },
  responses: {
    200: {
      description: 'Trending manga',
      content: {
        'application/json': {
          schema: createApiSuccessSchema(SearchResultSchema),
        },
      },
    },
    default: errorResponse,
  },
});

anilist.openapi(trendingRoute, async (c) => {
  const { page } = c.req.valid('query');
  const results = await service.getTrending(page || 1);
  return jsonSuccess(c, results);
});

const popularRoute = createRoute({
  method: 'get',
  path: '/popular',
  tags: ['anilist'],
  request: {
    query: pageSchema,
  },
  responses: {
    200: {
      description: 'Popular manga',
      content: {
        'application/json': {
          schema: createApiSuccessSchema(SearchResultSchema),
        },
      },
    },
    default: errorResponse,
  },
});

anilist.openapi(popularRoute, async (c) => {
  const { page } = c.req.valid('query');
  const results = await service.getPopular(page || 1);
  return jsonSuccess(c, results);
});

const topRatedRoute = createRoute({
  method: 'get',
  path: '/top-rated',
  tags: ['anilist'],
  request: {
    query: pageSchema,
  },
  responses: {
    200: {
      description: 'Top rated manga',
      content: {
        'application/json': {
          schema: createApiSuccessSchema(SearchResultSchema),
        },
      },
    },
    default: errorResponse,
  },
});

anilist.openapi(topRatedRoute, async (c) => {
  const { page } = c.req.valid('query');
  const results = await service.getTopRated(page || 1);
  return jsonSuccess(c, results);
});

const mediaRoute = createRoute({
  method: 'get',
  path: '/media/{id}',
  tags: ['anilist'],
  request: {
    params: z.object({
      id: z.coerce.number().int(),
    }),
  },
  responses: {
    200: {
      description: 'Media details',
      content: {
        'application/json': {
          schema: createApiSuccessSchema(AniListMangaSchema),
        },
      },
    },
    default: errorResponse,
  },
});

anilist.openapi(mediaRoute, async (c) => {
  const { id } = c.req.valid('param');
  if (Number.isNaN(id)) {
    return jsonError(c, { code: 'INVALID_ID', message: 'Media id must be a number' }, 400);
  }

  const auth = await getOptionalAuth(c);
  const media = auth?.anilistToken
    ? await service.getMangaDetailsForUser(auth.anilistToken, id)
    : await service.getMangaDetails(id);
  return jsonSuccess(c, media);
});

const libraryRoute = createRoute({
  method: 'get',
  path: '/library',
  tags: ['anilist'],
  middleware: requireAuth,
  security: [{ BearerAuth: [] }],
  request: {
    query: z.object({
      status: MediaListStatusSchema.optional(),
    }),
  },
  responses: {
    200: {
      description: 'AniList library',
      content: {
        'application/json': {
          schema: createApiSuccessSchema(MediaListCollectionSchema),
        },
      },
    },
    default: errorResponse,
  },
});

anilist.openapi(libraryRoute, async (c) => {
  const auth = c.get('auth');
  if (!auth?.anilistToken || auth.id === null) {
    return jsonError(
      c,
      { code: 'ANILIST_TOKEN_MISSING', message: 'AniList token not available' },
      401,
    );
  }

  const { status } = c.req.valid('query');
  const library = await service.getUserLibrary(auth.id, auth.anilistToken, status);
  return jsonSuccess(c, library);
});

const statsRoute = createRoute({
  method: 'get',
  path: '/stats',
  tags: ['anilist'],
  middleware: requireAuth,
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: 'AniList stats',
      content: {
        'application/json': {
          schema: createApiSuccessSchema(AniListUserStatsSchema),
        },
      },
    },
    default: errorResponse,
  },
});

anilist.openapi(statsRoute, async (c) => {
  const auth = c.get('auth');
  if (!auth?.anilistToken || auth.id === null) {
    return jsonError(
      c,
      { code: 'ANILIST_TOKEN_MISSING', message: 'AniList token not available' },
      401,
    );
  }

  const stats = await service.getUserStats(auth.id, auth.anilistToken);
  return jsonSuccess(c, stats);
});

const activityRoute = createRoute({
  method: 'get',
  path: '/activity',
  tags: ['anilist'],
  middleware: requireAuth,
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: 'AniList activity',
      content: {
        'application/json': {
          schema: createApiSuccessSchema(z.array(AniListActivitySchema)),
        },
      },
    },
    default: errorResponse,
  },
});

anilist.openapi(activityRoute, async (c) => {
  const auth = c.get('auth');
  if (!auth?.anilistToken || auth.id === null) {
    return jsonError(
      c,
      { code: 'ANILIST_TOKEN_MISSING', message: 'AniList token not available' },
      401,
    );
  }

  const activity = await service.getUserActivity(auth.id, auth.anilistToken);
  return jsonSuccess(c, activity);
});

const notificationsRoute = createRoute({
  method: 'get',
  path: '/notifications',
  tags: ['anilist'],
  middleware: requireAuth,
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: 'AniList notifications',
      content: {
        'application/json': {
          schema: createApiSuccessSchema(z.array(AniListNotificationSchema)),
        },
      },
    },
    default: errorResponse,
  },
});

anilist.openapi(notificationsRoute, async (c) => {
  const auth = c.get('auth');
  if (!auth?.anilistToken) {
    return jsonError(
      c,
      { code: 'ANILIST_TOKEN_MISSING', message: 'AniList token not available' },
      401,
    );
  }

  const notifications = await service.getNotifications(auth.anilistToken);
  return jsonSuccess(c, notifications);
});

const progressRoute = createRoute({
  method: 'post',
  path: '/progress',
  tags: ['anilist'],
  middleware: requireAuth,
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: updateProgressSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Progress updated',
      content: {
        'application/json': {
          schema: createApiSuccessSchema(MediaListEntrySchema),
        },
      },
    },
    default: errorResponse,
  },
});

anilist.openapi(progressRoute, async (c) => {
  const auth = c.get('auth');
  if (!auth?.anilistToken) {
    return jsonError(
      c,
      { code: 'ANILIST_TOKEN_MISSING', message: 'AniList token not available' },
      401,
    );
  }

  const body = c.req.valid('json');
  const result = await service.updateProgress(auth.anilistToken, body.mediaId, body.progress);
  return jsonSuccess(c, result);
});

const statusRoute = createRoute({
  method: 'post',
  path: '/status',
  tags: ['anilist'],
  middleware: requireAuth,
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: updateStatusSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Status updated',
      content: {
        'application/json': {
          schema: createApiSuccessSchema(MediaListEntrySchema),
        },
      },
    },
    default: errorResponse,
  },
});

anilist.openapi(statusRoute, async (c) => {
  const auth = c.get('auth');
  if (!auth?.anilistToken) {
    return jsonError(
      c,
      { code: 'ANILIST_TOKEN_MISSING', message: 'AniList token not available' },
      401,
    );
  }

  const body = c.req.valid('json');
  const result = await service.updateStatus(auth.anilistToken, body.mediaId, body.status);
  return jsonSuccess(c, result);
});

const entryRoute = createRoute({
  method: 'post',
  path: '/entry',
  tags: ['anilist'],
  middleware: requireAuth,
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: updateEntrySchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Entry updated',
      content: {
        'application/json': {
          schema: createApiSuccessSchema(MediaListEntrySchema),
        },
      },
    },
    default: errorResponse,
  },
});

anilist.openapi(entryRoute, async (c) => {
  const auth = c.get('auth');
  if (!auth?.anilistToken) {
    return jsonError(
      c,
      { code: 'ANILIST_TOKEN_MISSING', message: 'AniList token not available' },
      401,
    );
  }

  const body = c.req.valid('json');
  const result = await service.updateEntry(auth.anilistToken, body);
  return jsonSuccess(c, result);
});

export default anilist;
