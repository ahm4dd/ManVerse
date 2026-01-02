import { Hono } from 'hono';
import { jsonError } from '../utils/response.ts';
import { requireAuth } from '../middleware/auth.ts';
import type { HonoEnv } from '../types/api.ts';

const sync = new Hono<HonoEnv>();

sync.get('/status', requireAuth, (c) => {
  return jsonError(
    c,
    { code: 'NOT_IMPLEMENTED', message: 'Sync status is not implemented yet' },
    501,
  );
});

sync.post('/push/:id', requireAuth, (c) => {
  return jsonError(
    c,
    { code: 'NOT_IMPLEMENTED', message: 'Sync push is not implemented yet' },
    501,
  );
});

sync.post('/pull/:id', requireAuth, (c) => {
  return jsonError(
    c,
    { code: 'NOT_IMPLEMENTED', message: 'Sync pull is not implemented yet' },
    501,
  );
});

sync.post('/resolve/:id', requireAuth, (c) => {
  return jsonError(
    c,
    { code: 'NOT_IMPLEMENTED', message: 'Sync resolution is not implemented yet' },
    501,
  );
});

sync.post('/all', requireAuth, (c) => {
  return jsonError(
    c,
    { code: 'NOT_IMPLEMENTED', message: 'Batch sync is not implemented yet' },
    501,
  );
});

export default sync;
