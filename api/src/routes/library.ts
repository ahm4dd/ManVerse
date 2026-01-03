import { Hono } from 'hono';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.ts';
import type { HonoEnv } from '../types/api.ts';
import { jsonError, jsonSuccess } from '../utils/response.ts';
import { MediaListStatusSchema } from '@manverse/anilist';
import { parseQuery } from '../utils/validation.ts';
import { LibraryService } from '../services/library-service.ts';
import { createHash } from 'node:crypto';

const library = new Hono<HonoEnv>();
const service = new LibraryService();

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

library.get('/', requireAuth, async (c) => {
  const auth = c.get('auth');
  const { status } = parseQuery(c, z.object({ status: MediaListStatusSchema.optional() }));
  const userKey = resolveUserKey(c.req.header('Authorization'), auth?.id ?? null);
  const data = await service.list(userKey, status, auth);
  return jsonSuccess(c, data);
});

library.post('/', requireAuth, async (c) => {
  const auth = c.get('auth');
  const body = addSchema.parse(await c.req.json());
  const userKey = resolveUserKey(c.req.header('Authorization'), auth?.id ?? null);
  const entry = await service.add(userKey, body, auth);
  return jsonSuccess(c, entry, 201);
});

library.put('/:id', requireAuth, async (c) => {
  const auth = c.get('auth');
  const mediaId = Number(c.req.param('id'));
  if (Number.isNaN(mediaId)) {
    return jsonError(c, { code: 'INVALID_ID', message: 'Media id must be a number' }, 400);
  }

  const body = updateSchema.parse(await c.req.json());
  const userKey = resolveUserKey(c.req.header('Authorization'), auth?.id ?? null);
  const entry = await service.update(userKey, mediaId, body, auth);
  return jsonSuccess(c, entry);
});

library.delete('/:id', requireAuth, async (c) => {
  const auth = c.get('auth');
  const mediaId = Number(c.req.param('id'));
  if (Number.isNaN(mediaId)) {
    return jsonError(c, { code: 'INVALID_ID', message: 'Media id must be a number' }, 400);
  }

  const userKey = resolveUserKey(c.req.header('Authorization'), auth?.id ?? null);
  const result = await service.remove(userKey, mediaId, auth);
  return jsonSuccess(c, result);
});

library.get('/stats', requireAuth, async (c) => {
  const auth = c.get('auth');
  const userKey = resolveUserKey(c.req.header('Authorization'), auth?.id ?? null);
  const stats = await service.stats(userKey);
  return jsonSuccess(c, stats);
});

library.get('/recent', requireAuth, async (c) => {
  const auth = c.get('auth');
  const userKey = resolveUserKey(c.req.header('Authorization'), auth?.id ?? null);
  const data = await service.list(userKey, 'CURRENT', auth);
  return jsonSuccess(c, data);
});

export default library;
