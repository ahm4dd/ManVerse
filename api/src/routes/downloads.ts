import { Hono } from 'hono';
import { jsonError } from '../utils/response.ts';
import { requireAuth } from '../middleware/auth.ts';
import type { HonoEnv } from '../types/api.ts';

const downloads = new Hono<HonoEnv>();

downloads.post('/', requireAuth, (c) => {
  return jsonError(
    c,
    { code: 'NOT_IMPLEMENTED', message: 'Download queueing is not implemented yet' },
    501,
  );
});

downloads.get('/', requireAuth, (c) => {
  return jsonError(
    c,
    { code: 'NOT_IMPLEMENTED', message: 'Download listing is not implemented yet' },
    501,
  );
});

downloads.get('/:id', requireAuth, (c) => {
  return jsonError(
    c,
    { code: 'NOT_IMPLEMENTED', message: 'Download status is not implemented yet' },
    501,
  );
});

downloads.delete('/:id', requireAuth, (c) => {
  return jsonError(
    c,
    { code: 'NOT_IMPLEMENTED', message: 'Download cancellation is not implemented yet' },
    501,
  );
});

downloads.get('/:id/file', requireAuth, (c) => {
  return jsonError(
    c,
    { code: 'NOT_IMPLEMENTED', message: 'Download streaming is not implemented yet' },
    501,
  );
});

export default downloads;
