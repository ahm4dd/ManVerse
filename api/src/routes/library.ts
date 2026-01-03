import { Hono } from 'hono';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.ts';
import type { HonoEnv } from '../types/api.ts';
import { jsonError, jsonSuccess } from '../utils/response.ts';
import { AniListService } from '../services/anilist-service.ts';
import { MediaListStatusSchema } from '@manverse/anilist';
import { parseQuery } from '../utils/validation.ts';

const library = new Hono<HonoEnv>();
const service = new AniListService();

const addSchema = z.object({
  mediaId: z.number(),
  status: MediaListStatusSchema,
});

const updateSchema = z.object({
  status: MediaListStatusSchema.optional(),
  score: z.number().optional(),
  progress: z.number().optional(),
  notes: z.string().optional(),
});

library.get('/', requireAuth, async (c) => {
  const auth = c.get('auth');
  if (!auth?.anilistToken || auth.id === null) {
    return jsonError(
      c,
      { code: 'ANILIST_TOKEN_MISSING', message: 'AniList token not available' },
      401,
    );
  }

  const { status } = parseQuery(c, z.object({ status: MediaListStatusSchema.optional() }));
  const data = await service.getUserLibrary(auth.id, auth.anilistToken, status);
  return jsonSuccess(c, data);
});

library.post('/', requireAuth, async (c) => {
  const auth = c.get('auth');
  if (!auth?.anilistToken) {
    return jsonError(
      c,
      { code: 'ANILIST_TOKEN_MISSING', message: 'AniList token not available' },
      401,
    );
  }

  const body = addSchema.parse(await c.req.json());
  const entry = await service.addToList(auth.anilistToken, body.mediaId, body.status);
  return jsonSuccess(c, entry, 201);
});

library.put('/:id', requireAuth, async (c) => {
  const auth = c.get('auth');
  if (!auth?.anilistToken) {
    return jsonError(
      c,
      { code: 'ANILIST_TOKEN_MISSING', message: 'AniList token not available' },
      401,
    );
  }

  const mediaId = Number(c.req.param('id'));
  if (Number.isNaN(mediaId)) {
    return jsonError(c, { code: 'INVALID_ID', message: 'Media id must be a number' }, 400);
  }

  const body = updateSchema.parse(await c.req.json());
  const entry = await service.updateEntry(auth.anilistToken, { mediaId, ...body });
  return jsonSuccess(c, entry);
});

library.delete('/:id', requireAuth, async (c) => {
  const auth = c.get('auth');
  if (!auth?.anilistToken) {
    return jsonError(
      c,
      { code: 'ANILIST_TOKEN_MISSING', message: 'AniList token not available' },
      401,
    );
  }

  const entryId = Number(c.req.param('id'));
  if (Number.isNaN(entryId)) {
    return jsonError(c, { code: 'INVALID_ID', message: 'Entry id must be a number' }, 400);
  }

  const deleted = await service.removeFromList(auth.anilistToken, entryId);
  return jsonSuccess(c, { deleted });
});

library.get('/stats', requireAuth, async (c) => {
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

library.get('/recent', requireAuth, async (c) => {
  const auth = c.get('auth');
  if (!auth?.anilistToken || auth.id === null) {
    return jsonError(
      c,
      { code: 'ANILIST_TOKEN_MISSING', message: 'AniList token not available' },
      401,
    );
  }

  const data = await service.getUserLibrary(auth.id, auth.anilistToken, 'CURRENT');
  return jsonSuccess(c, data);
});

export default library;
