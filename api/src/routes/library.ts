import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { requireAuth } from '../middleware/auth.ts';
import type { HonoEnv } from '../types/api.ts';
import { jsonError, jsonSuccess } from '../utils/response.ts';
import { MediaListStatusSchema, type MediaListStatus } from '@manverse/anilist';
import { LibraryService } from '../services/library-service.ts';
import { createHash } from 'node:crypto';
import { ApiErrorSchema, ApiSuccessUnknownSchema } from '../openapi/schemas.ts';
import { openApiHook } from '../openapi/hook.ts';

const library = new OpenAPIHono<HonoEnv>({ defaultHook: openApiHook });
const service = new LibraryService();

const errorResponse = {
  description: 'Error',
  content: {
    'application/json': {
      schema: ApiErrorSchema,
    },
  },
};

const addSchema = z.object({
  mediaId: z.number(),
  status: MediaListStatusSchema,
  progress: z.number().optional(),
  score: z.number().optional(),
  notes: z.string().optional(),
});

const updateSchema = z.object({
  status: MediaListStatusSchema.optional(),
  score: z.number().optional(),
  progress: z.number().optional(),
  notes: z.string().optional(),
});

function resolveUserKey(authHeader: string | undefined, userId: number | null | undefined): string {
  if (userId !== null && userId !== undefined) {
    return `anilist:${userId}`;
  }

  if (!authHeader) {
    return 'guest:anonymous';
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return 'guest:anonymous';
  }

  const hash = createHash('sha256').update(token).digest('hex');
  return `guest:${hash}`;
}

function normalizeStatus(input?: string): MediaListStatus | undefined {
  if (!input) return undefined;
  const trimmed = input.trim();
  if (!trimmed) return undefined;
  const upper = trimmed.toUpperCase();

  const direct = MediaListStatusSchema.safeParse(upper);
  if (direct.success) return upper as MediaListStatus;

  const mapped: Record<string, MediaListStatus> = {
    READING: 'CURRENT',
    CURRENT: 'CURRENT',
    PLANNING: 'PLANNING',
    PLAN: 'PLANNING',
    PLAN_TO_READ: 'PLANNING',
    COMPLETED: 'COMPLETED',
    PAUSED: 'PAUSED',
    ON_HOLD: 'PAUSED',
    DROPPED: 'DROPPED',
    REPEATING: 'REPEATING',
    REREADING: 'REPEATING',
  };

  const normalized = upper.replace(/\s+/g, '_');
  return mapped[normalized];
}

const listRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['library'],
  middleware: requireAuth,
  security: [{ BearerAuth: [] }],
  request: {
    query: z.object({
      status: z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: 'Library list',
      content: {
        'application/json': {
          schema: ApiSuccessUnknownSchema,
        },
      },
    },
    default: errorResponse,
  },
});

library.openapi(listRoute, async (c) => {
  const auth = c.get('auth');
  const { status } = c.req.valid('query');
  const userKey = resolveUserKey(c.req.header('Authorization'), auth?.id ?? null);
  const normalizedStatus = normalizeStatus(status);
  const data = await service.list(userKey, normalizedStatus, auth);
  return jsonSuccess(c, data);
});

const addRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['library'],
  middleware: requireAuth,
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: addSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Entry created',
      content: {
        'application/json': {
          schema: ApiSuccessUnknownSchema,
        },
      },
    },
    default: errorResponse,
  },
});

library.openapi(addRoute, async (c) => {
  const auth = c.get('auth');
  const body = c.req.valid('json');
  const userKey = resolveUserKey(c.req.header('Authorization'), auth?.id ?? null);
  const entry = await service.add(userKey, body, auth);
  return jsonSuccess(c, entry, 201);
});

const updateRoute = createRoute({
  method: 'put',
  path: '/{id}',
  tags: ['library'],
  middleware: requireAuth,
  security: [{ BearerAuth: [] }],
  request: {
    params: z.object({
      id: z.coerce.number().int(),
    }),
    body: {
      content: {
        'application/json': {
          schema: updateSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Entry updated',
      content: {
        'application/json': {
          schema: ApiSuccessUnknownSchema,
        },
      },
    },
    default: errorResponse,
  },
});

library.openapi(updateRoute, async (c) => {
  const auth = c.get('auth');
  const { id } = c.req.valid('param');
  if (Number.isNaN(id)) {
    return jsonError(c, { code: 'INVALID_ID', message: 'Media id must be a number' }, 400);
  }

  const body = c.req.valid('json');
  const userKey = resolveUserKey(c.req.header('Authorization'), auth?.id ?? null);
  const entry = await service.update(userKey, id, body, auth);
  return jsonSuccess(c, entry);
});

const deleteRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  tags: ['library'],
  middleware: requireAuth,
  security: [{ BearerAuth: [] }],
  request: {
    params: z.object({
      id: z.coerce.number().int(),
    }),
  },
  responses: {
    200: {
      description: 'Entry removed',
      content: {
        'application/json': {
          schema: ApiSuccessUnknownSchema,
        },
      },
    },
    default: errorResponse,
  },
});

library.openapi(deleteRoute, async (c) => {
  const auth = c.get('auth');
  const { id } = c.req.valid('param');
  if (Number.isNaN(id)) {
    return jsonError(c, { code: 'INVALID_ID', message: 'Media id must be a number' }, 400);
  }

  const userKey = resolveUserKey(c.req.header('Authorization'), auth?.id ?? null);
  const result = await service.remove(userKey, id, auth);
  return jsonSuccess(c, result);
});

const statsRoute = createRoute({
  method: 'get',
  path: '/stats',
  tags: ['library'],
  middleware: requireAuth,
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: 'Library stats',
      content: {
        'application/json': {
          schema: ApiSuccessUnknownSchema,
        },
      },
    },
    default: errorResponse,
  },
});

library.openapi(statsRoute, async (c) => {
  const auth = c.get('auth');
  const userKey = resolveUserKey(c.req.header('Authorization'), auth?.id ?? null);
  const stats = await service.stats(userKey, auth);
  return jsonSuccess(c, stats);
});

const recentRoute = createRoute({
  method: 'get',
  path: '/recent',
  tags: ['library'],
  middleware: requireAuth,
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: 'Recent library entries',
      content: {
        'application/json': {
          schema: ApiSuccessUnknownSchema,
        },
      },
    },
    default: errorResponse,
  },
});

library.openapi(recentRoute, async (c) => {
  const auth = c.get('auth');
  const userKey = resolveUserKey(c.req.header('Authorization'), auth?.id ?? null);
  const data = await service.list(userKey, 'CURRENT', auth);
  return jsonSuccess(c, data);
});

export default library;
