import { Hono } from 'hono';
import { z } from 'zod';
import { jsonError, jsonSuccess } from '../utils/response.ts';
import { parseQuery } from '../utils/validation.ts';
import { MangaService, type MangaSource } from '../services/manga-service.ts';
import type { HonoEnv } from '../types/api.ts';
import { requireAuth } from '../middleware/auth.ts';

const manga = new Hono<HonoEnv>();
const service = new MangaService();

const searchSchema = z.object({
  query: z.string().min(1),
  source: z.enum(['anilist', 'asura', 'both']).optional(),
});

manga.get('/search', (c) => {
  const { query, source } = parseQuery(c, searchSchema);
  return service
    .search(query, (source || 'anilist') as MangaSource)
    .then((results) => jsonSuccess(c, results))
    .catch((error) =>
      jsonError(
        c,
        {
          code: 'MANGA_SEARCH_FAILED',
          message: error instanceof Error ? error.message : 'Search failed',
        },
        500,
      ),
    );
});

manga.get('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (Number.isNaN(id)) {
    return jsonError(c, { code: 'INVALID_ID', message: 'Manga id must be a number' }, 400);
  }

  const details = await service.getMangaDetails(id);
  return jsonSuccess(c, details);
});

manga.get('/:id/chapters', (c) => {
  return jsonError(
    c,
    { code: 'NOT_IMPLEMENTED', message: 'Chapter listing is not implemented yet' },
    501,
  );
});

manga.post('/:id/map', requireAuth, (c) => {
  return jsonError(
    c,
    { code: 'NOT_IMPLEMENTED', message: 'Provider mapping is not implemented yet' },
    501,
  );
});

manga.get('/:id/providers', (c) => {
  return jsonError(
    c,
    { code: 'NOT_IMPLEMENTED', message: 'Provider mappings are not implemented yet' },
    501,
  );
});

export default manga;
