import type { MiddlewareHandler } from 'hono';
import { verify } from 'hono/jwt';
import type { AuthUser } from '../../../shared/types.ts';
import type { HonoEnv } from '../types/api.ts';
import { jsonError } from '../utils/response.ts';
import { getJwtSecret } from '../utils/jwt.ts';

export const requireAuth: MiddlewareHandler<HonoEnv> = async (c, next) => {
  const header = c.req.header('Authorization');
  if (!header || !header.startsWith('Bearer ')) {
    return jsonError(
      c,
      {
        code: 'AUTH_REQUIRED',
        message: 'Missing Authorization bearer token',
      },
      401,
    );
  }

  const token = header.slice('Bearer '.length).trim();
  try {
    const payload = (await verify(token, getJwtSecret())) as AuthUser;
    c.set('auth', payload);
    await next();
  } catch (error) {
    return jsonError(
      c,
      {
        code: 'INVALID_TOKEN',
        message: 'Token verification failed',
        details: error instanceof Error ? error.message : String(error),
      },
      401,
    );
  }
};
