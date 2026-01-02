import { Hono } from 'hono';
import { jsonError } from '../utils/response.ts';
import { requireAuth } from '../middleware/auth.ts';
import type { HonoEnv } from '../types/api.ts';

const library = new Hono<HonoEnv>();

library.get('/', requireAuth, (c) => {
  return jsonError(
    c,
    { code: 'NOT_IMPLEMENTED', message: 'Library listing is not implemented yet' },
    501,
  );
});

library.post('/', requireAuth, (c) => {
  return jsonError(
    c,
    { code: 'NOT_IMPLEMENTED', message: 'Library creation is not implemented yet' },
    501,
  );
});

library.put('/:id', requireAuth, (c) => {
  return jsonError(
    c,
    { code: 'NOT_IMPLEMENTED', message: 'Library updates are not implemented yet' },
    501,
  );
});

library.delete('/:id', requireAuth, (c) => {
  return jsonError(
    c,
    { code: 'NOT_IMPLEMENTED', message: 'Library deletion is not implemented yet' },
    501,
  );
});

library.get('/stats', requireAuth, (c) => {
  return jsonError(
    c,
    { code: 'NOT_IMPLEMENTED', message: 'Library stats are not implemented yet' },
    501,
  );
});

library.get('/recent', requireAuth, (c) => {
  return jsonError(
    c,
    { code: 'NOT_IMPLEMENTED', message: 'Recent library entries are not implemented yet' },
    501,
  );
});

export default library;
