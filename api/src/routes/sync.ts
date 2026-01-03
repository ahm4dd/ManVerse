import { Hono } from 'hono';
import { jsonError, jsonSuccess } from '../utils/response.ts';
import { requireAuth } from '../middleware/auth.ts';
import type { HonoEnv } from '../types/api.ts';
import { SyncService } from '../services/sync-service.ts';
import { createHash } from 'node:crypto';

const sync = new Hono<HonoEnv>();
const service = new SyncService();

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

sync.get('/status', requireAuth, (c) => {
  const auth = c.get('auth');
  const userKey = resolveUserKey(c.req.header('Authorization'), auth?.id ?? null);
  const data = service.getStatus(userKey);
  return jsonSuccess(c, data);
});

sync.post('/push/:id', requireAuth, async (c) => {
  const auth = c.get('auth');
  const mediaId = Number(c.req.param('id'));
  if (Number.isNaN(mediaId)) {
    return jsonError(c, { code: 'INVALID_ID', message: 'Media id must be a number' }, 400);
  }

  const userKey = resolveUserKey(c.req.header('Authorization'), auth?.id ?? null);
  const data = await service.pushOne(userKey, mediaId, auth);
  return jsonSuccess(c, data);
});

sync.post('/pull/:id', requireAuth, async (c) => {
  const auth = c.get('auth');
  const mediaId = Number(c.req.param('id'));
  if (Number.isNaN(mediaId)) {
    return jsonError(c, { code: 'INVALID_ID', message: 'Media id must be a number' }, 400);
  }

  const userKey = resolveUserKey(c.req.header('Authorization'), auth?.id ?? null);
  const data = await service.pullOne(userKey, mediaId, auth);
  return jsonSuccess(c, data);
});

sync.post('/resolve/:id', requireAuth, async (c) => {
  const auth = c.get('auth');
  const mediaId = Number(c.req.param('id'));
  if (Number.isNaN(mediaId)) {
    return jsonError(c, { code: 'INVALID_ID', message: 'Media id must be a number' }, 400);
  }

  const body = await c.req.json().catch(() => ({}));
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
      ? await service.pushOne(userKey, mediaId, auth)
      : await service.pullOne(userKey, mediaId, auth);
  return jsonSuccess(c, data);
});

sync.post('/all', requireAuth, async (c) => {
  const auth = c.get('auth');
  const userKey = resolveUserKey(c.req.header('Authorization'), auth?.id ?? null);
  const data = await service.syncAll(userKey, auth);
  return jsonSuccess(c, data);
});

export default sync;
