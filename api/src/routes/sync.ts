import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { jsonError, jsonSuccess } from '../utils/response.ts';
import { requireAuth } from '../middleware/auth.ts';
import type { HonoEnv } from '../types/api.ts';
import { SyncService } from '../services/sync-service.ts';
import { createHash } from 'node:crypto';
import { ApiErrorSchema, ApiSuccessUnknownSchema } from '../openapi/schemas.ts';
import { openApiHook } from '../openapi/hook.ts';

const sync = new OpenAPIHono<HonoEnv>({ defaultHook: openApiHook });
const service = new SyncService();

const errorResponse = {
  description: 'Error',
  content: {
    'application/json': {
      schema: ApiErrorSchema,
    },
  },
};

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

const statusRoute = createRoute({
  method: 'get',
  path: '/status',
  tags: ['sync'],
  middleware: requireAuth,
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: 'Sync status',
      content: {
        'application/json': {
          schema: ApiSuccessUnknownSchema,
        },
      },
    },
    default: errorResponse,
  },
});

sync.openapi(statusRoute, (c) => {
  const auth = c.get('auth');
  const userKey = resolveUserKey(c.req.header('Authorization'), auth?.id ?? null);
  const data = service.getStatus(userKey);
  return jsonSuccess(c, data);
});

const pushRoute = createRoute({
  method: 'post',
  path: '/push/{id}',
  tags: ['sync'],
  middleware: requireAuth,
  security: [{ BearerAuth: [] }],
  request: {
    params: z.object({
      id: z.coerce.number().int(),
    }),
  },
  responses: {
    200: {
      description: 'Sync result',
      content: {
        'application/json': {
          schema: ApiSuccessUnknownSchema,
        },
      },
    },
    default: errorResponse,
  },
});

sync.openapi(pushRoute, async (c) => {
  const auth = c.get('auth');
  const { id } = c.req.valid('param');
  if (Number.isNaN(id)) {
    return jsonError(c, { code: 'INVALID_ID', message: 'Media id must be a number' }, 400);
  }

  const userKey = resolveUserKey(c.req.header('Authorization'), auth?.id ?? null);
  const data = await service.pushOne(userKey, id, auth);
  return jsonSuccess(c, data);
});

const pullRoute = createRoute({
  method: 'post',
  path: '/pull/{id}',
  tags: ['sync'],
  middleware: requireAuth,
  security: [{ BearerAuth: [] }],
  request: {
    params: z.object({
      id: z.coerce.number().int(),
    }),
  },
  responses: {
    200: {
      description: 'Sync result',
      content: {
        'application/json': {
          schema: ApiSuccessUnknownSchema,
        },
      },
    },
    default: errorResponse,
  },
});

sync.openapi(pullRoute, async (c) => {
  const auth = c.get('auth');
  const { id } = c.req.valid('param');
  if (Number.isNaN(id)) {
    return jsonError(c, { code: 'INVALID_ID', message: 'Media id must be a number' }, 400);
  }

  const userKey = resolveUserKey(c.req.header('Authorization'), auth?.id ?? null);
  const data = await service.pullOne(userKey, id, auth);
  return jsonSuccess(c, data);
});

const resolveRoute = createRoute({
  method: 'post',
  path: '/resolve/{id}',
  tags: ['sync'],
  middleware: requireAuth,
  security: [{ BearerAuth: [] }],
  request: {
    params: z.object({
      id: z.coerce.number().int(),
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            strategy: z.enum(['local', 'remote']),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Sync result',
      content: {
        'application/json': {
          schema: ApiSuccessUnknownSchema,
        },
      },
    },
    default: errorResponse,
  },
});

sync.openapi(resolveRoute, async (c) => {
  const auth = c.get('auth');
  const { id } = c.req.valid('param');
  if (Number.isNaN(id)) {
    return jsonError(c, { code: 'INVALID_ID', message: 'Media id must be a number' }, 400);
  }

  const body = c.req.valid('json');
  const strategy = body?.strategy;
  if (strategy !== 'local' && strategy !== 'remote') {
    return jsonError(
      c,
      { code: 'INVALID_STRATEGY', message: 'Strategy must be local or remote' },
      400,
    );
  }

  const userKey = resolveUserKey(c.req.header('Authorization'), auth?.id ?? null);
  const data =
    strategy === 'local'
      ? await service.pushOne(userKey, id, auth)
      : await service.pullOne(userKey, id, auth);
  return jsonSuccess(c, data);
});

const syncAllRoute = createRoute({
  method: 'post',
  path: '/all',
  tags: ['sync'],
  middleware: requireAuth,
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: 'Sync result',
      content: {
        'application/json': {
          schema: ApiSuccessUnknownSchema,
        },
      },
    },
    default: errorResponse,
  },
});

sync.openapi(syncAllRoute, async (c) => {
  const auth = c.get('auth');
  const userKey = resolveUserKey(c.req.header('Authorization'), auth?.id ?? null);
  const data = await service.syncAll(userKey, auth);
  return jsonSuccess(c, data);
});

export default sync;
