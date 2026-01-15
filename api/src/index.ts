import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { randomUUID } from 'node:crypto';
import type { HonoEnv } from './types/api.ts';
import { corsMiddleware } from './middleware/cors.ts';
import { handleError } from './middleware/error.ts';
import { jsonSuccess } from './utils/response.ts';
import { Scalar } from '@scalar/hono-api-reference';
import { openApiHook } from './openapi/hook.ts';
import { createApiSuccessSchema } from './openapi/schemas.ts';

import authRoutes from './routes/auth.ts';
import mangaRoutes from './routes/manga.ts';
import libraryRoutes from './routes/library.ts';
import chaptersRoutes from './routes/chapters.ts';
import downloadsRoutes from './routes/downloads.ts';
import syncRoutes from './routes/sync.ts';
import anilistRoutes from './routes/anilist.ts';
import notificationsRoutes from './routes/notifications.ts';

const app = new OpenAPIHono<HonoEnv>({ defaultHook: openApiHook });
const port = Number(Bun.env.PORT || 3001);
const rawHost = Bun.env.MANVERSE_API_HOST;
const hostname = rawHost && rawHost.trim().length > 0 ? rawHost.trim() : undefined;

app.use('*', async (c, next) => {
  c.set('requestId', randomUUID());
  await next();
});

app.use('*', corsMiddleware);

const healthRoute = createRoute({
  method: 'get',
  path: '/health',
  tags: ['health'],
  responses: {
    200: {
      description: 'Service status',
      content: {
        'application/json': {
          schema: createApiSuccessSchema(
            z.object({
              status: z.string(),
            }),
          ),
        },
      },
    },
  },
});

app.openapi(healthRoute, (c) => jsonSuccess(c, { status: 'ok' }));

app.get(
  '/api/docs',
  Scalar({
    pageTitle: 'ManVerse API',
    theme: 'deepSpace',
    spec: {
      url: '/api/openapi.json',
    },
  }),
);

app.doc('/api/openapi.json', {
  openapi: '3.0.0',
  info: {
    title: 'ManVerse API',
    version: '1.1.1',
  },
  servers: [
    {
      url: `http://localhost:${port}`,
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
});

app.route('/api/auth', authRoutes);
app.route('/api/manga', mangaRoutes);
app.route('/api/library', libraryRoutes);
app.route('/api/chapters', chaptersRoutes);
app.route('/api/downloads', downloadsRoutes);
app.route('/api/sync', syncRoutes);
app.route('/api/anilist', anilistRoutes);
app.route('/api/notifications', notificationsRoutes);

app.onError(handleError);

const server = {
  port,
  hostname,
  fetch: app.fetch,
};

const displayHost =
  hostname && hostname !== '0.0.0.0' && hostname !== '::' ? hostname : 'localhost';
console.log(`ManVerse API listening on http://${displayHost}:${port}`);

export { app };
export default server;
