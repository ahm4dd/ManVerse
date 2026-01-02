import { randomUUID } from 'node:crypto';
import type { Context } from 'hono';
import type { ApiErrorResponse, ApiSuccess } from '../../../shared/types.ts';
import type { HonoEnv } from '../types/api.ts';

function ensureRequestId(c: Context<HonoEnv>): string {
  let requestId = c.get('requestId');
  if (!requestId) {
    requestId = randomUUID();
    c.set('requestId', requestId);
  }

  return requestId;
}

export function jsonSuccess<T>(c: Context<HonoEnv>, data: T, status = 200) {
  const payload: ApiSuccess<T> = {
    success: true,
    data,
    meta: {
      timestamp: Date.now(),
      requestId: ensureRequestId(c),
    },
  };

  return c.json(payload, status);
}

export function jsonError(
  c: Context<HonoEnv>,
  error: ApiErrorResponse['error'],
  status = 500,
) {
  const payload: ApiErrorResponse = {
    success: false,
    error,
    meta: {
      timestamp: Date.now(),
      requestId: ensureRequestId(c),
    },
  };

  return c.json(payload, status);
}
