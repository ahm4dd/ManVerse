import type { MiddlewareHandler } from 'hono';
import { verify } from 'hono/jwt';
import type { AuthUser } from '../../../shared/types.ts';
import type { HonoEnv } from '../types/api.ts';
import { jsonError } from '../utils/response.ts';
import { getJwtSecret } from '../utils/jwt.ts';

export const requireAuth: MiddlewareHandler<HonoEnv> = async (c, next) => {
  const header = c.req.header('Authorization');
  if (!header || !header.startsWith('Bearer ')) {
    console.warn('Auth header missing', { path: c.req.path });
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
    console.warn('Auth token verification failed', {
      path: c.req.path,
      message: error instanceof Error ? error.message : String(error),
    });
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

export const requireAuthOrQuery: MiddlewareHandler<HonoEnv> = async (c, next) => {
  const header = c.req.header('Authorization');
  let token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';

  if (!token) {
    const queryToken = c.req.query('token');
    token = queryToken ? queryToken.trim() : '';
  }

  if (!token) {
    console.warn('Auth header missing', { path: c.req.path });
    return jsonError(
      c,
      {
        code: 'AUTH_REQUIRED',
        message: 'Missing Authorization bearer token',
      },
      401,
    );
  }

  try {
    const payload = (await verify(token, getJwtSecret())) as AuthUser;
    c.set('auth', payload);
    await next();
  } catch (error) {
    console.warn('Auth token verification failed', {
      path: c.req.path,
      message: error instanceof Error ? error.message : String(error),
    });
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
