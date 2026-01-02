import { Hono } from 'hono';
import { randomUUID } from 'node:crypto';
import type { HonoEnv } from './types/api.ts';
import { corsMiddleware } from './middleware/cors.ts';
import { handleError } from './middleware/error.ts';
import { jsonSuccess } from './utils/response.ts';

import authRoutes from './routes/auth.ts';
import mangaRoutes from './routes/manga.ts';
import libraryRoutes from './routes/library.ts';
import chaptersRoutes from './routes/chapters.ts';
import downloadsRoutes from './routes/downloads.ts';
import syncRoutes from './routes/sync.ts';
import anilistRoutes from './routes/anilist.ts';

const app = new Hono<HonoEnv>();

app.use('*', async (c, next) => {
  c.set('requestId', randomUUID());
  await next();
});

app.use('*', corsMiddleware);

app.get('/health', (c) => jsonSuccess(c, { status: 'ok' }));

app.route('/api/auth', authRoutes);
app.route('/api/manga', mangaRoutes);
app.route('/api/library', libraryRoutes);
app.route('/api/chapters', chaptersRoutes);
app.route('/api/downloads', downloadsRoutes);
app.route('/api/sync', syncRoutes);
app.route('/api/anilist', anilistRoutes);

app.onError(handleError);

const port = Number(Bun.env.PORT || 3001);
Bun.serve({
  fetch: app.fetch,
  port,
});

console.log(`ManVerse API listening on http://localhost:${port}`);

export default app;
