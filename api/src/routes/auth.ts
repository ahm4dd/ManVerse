import { Hono } from 'hono';
import { AniListService } from '../services/anilist-service.ts';
import { jsonError, jsonSuccess } from '../utils/response.ts';
import { signUser } from '../utils/jwt.ts';
import { requireAuth } from '../middleware/auth.ts';
import type { HonoEnv } from '../types/api.ts';

const auth = new Hono<HonoEnv>();
const service = new AniListService();

function getFrontendBaseUrl(): string {
  return Bun.env.FRONTEND_URL || 'http://localhost:3000';
}

function getFrontendAuthPath(): string {
  const path = Bun.env.FRONTEND_AUTH_PATH;
  if (!path) return '/';
  return path.startsWith('/') ? path : `/${path}`;
}

auth.post('/anilist/login', (c) => {
  const authUrl = service.getAuthorizationUrl();
  return jsonSuccess(c, { authUrl });
});

auth.get('/anilist/callback', async (c) => {
  const code = c.req.query('code');
  if (!code) {
    return jsonError(
      c,
      { code: 'MISSING_CODE', message: 'Authorization code is required' },
      400,
    );
  }

  const token = await service.exchangeCodeForToken(code);
  const user = await service.getCurrentUser(token);
  const jwt = await signUser({
    id: user.id,
    username: user.name,
    anilistToken: token.accessToken,
  });

  const redirectUrl = new URL(getFrontendBaseUrl());
  redirectUrl.pathname = getFrontendAuthPath();
  redirectUrl.searchParams.set('token', jwt);

  return c.redirect(redirectUrl.toString());
});

auth.post('/guest', async (c) => {
  const jwt = await signUser({
    id: null,
    isGuest: true,
  });

  return jsonSuccess(c, { token: jwt });
});

auth.get('/me', requireAuth, (c) => {
  const user = c.get('auth');
  return jsonSuccess(c, user ?? null);
});

auth.post('/logout', (c) => {
  return jsonSuccess(c, { ok: true });
});

export default auth;
