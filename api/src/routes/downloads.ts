import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { jsonError } from '../utils/response.ts';
import { requireAuth } from '../middleware/auth.ts';
import type { HonoEnv } from '../types/api.ts';
import { ApiErrorSchema } from '../openapi/schemas.ts';
import { openApiHook } from '../openapi/hook.ts';

const downloads = new OpenAPIHono<HonoEnv>({ defaultHook: openApiHook });

const notImplementedResponse = {
  description: 'Not implemented',
  content: {
    'application/json': {
      schema: ApiErrorSchema,
    },
  },
};

const queueRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['downloads'],
  middleware: requireAuth,
  security: [{ BearerAuth: [] }],
  responses: {
    501: notImplementedResponse,
    default: notImplementedResponse,
  },
});

downloads.openapi(queueRoute, (c) => {
  return jsonError(
    c,
    { code: 'NOT_IMPLEMENTED', message: 'Download queueing is not implemented yet' },
    501,
  );
});

const listRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['downloads'],
  middleware: requireAuth,
  security: [{ BearerAuth: [] }],
  responses: {
    501: notImplementedResponse,
    default: notImplementedResponse,
  },
});

downloads.openapi(listRoute, (c) => {
  return jsonError(
    c,
    { code: 'NOT_IMPLEMENTED', message: 'Download listing is not implemented yet' },
    501,
  );
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
    501: notImplementedResponse,
    default: notImplementedResponse,
  },
});

downloads.openapi(statusRoute, (c) => {
  return jsonError(
    c,
    { code: 'NOT_IMPLEMENTED', message: 'Download status is not implemented yet' },
    501,
  );
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
    501: notImplementedResponse,
    default: notImplementedResponse,
  },
});

downloads.openapi(cancelRoute, (c) => {
  return jsonError(
    c,
    { code: 'NOT_IMPLEMENTED', message: 'Download cancellation is not implemented yet' },
    501,
  );
});

const fileRoute = createRoute({
  method: 'get',
  path: '/{id}/file',
  tags: ['downloads'],
  middleware: requireAuth,
  security: [{ BearerAuth: [] }],
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    501: notImplementedResponse,
    default: notImplementedResponse,
  },
});

downloads.openapi(fileRoute, (c) => {
  return jsonError(
    c,
    { code: 'NOT_IMPLEMENTED', message: 'Download streaming is not implemented yet' },
    501,
  );
});

export default downloads;
