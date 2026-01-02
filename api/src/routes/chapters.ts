import { Hono } from 'hono';
import { jsonError } from '../utils/response.ts';
import type { HonoEnv } from '../types/api.ts';

const chapters = new Hono<HonoEnv>();

chapters.get('/:id', (c) => {
  return jsonError(
    c,
    { code: 'NOT_IMPLEMENTED', message: 'Chapter endpoint is not implemented yet' },
    501,
  );
});

export default chapters;
