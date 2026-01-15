import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { AniListUserSchema } from '@manverse/anilist';
import { AniListService } from '../services/anilist-service.ts';
import { jsonError, jsonSuccess } from '../utils/response.ts';
import { signUser } from '../utils/jwt.ts';
import { requireAuth } from '../middleware/auth.ts';
import type { HonoEnv } from '../types/api.ts';
import { getRuntimeConfig, getRuntimeConfigValue, updateRuntimeConfig } from '../utils/runtime-config.ts';
import {
  ApiErrorSchema,
  AuthUrlSchema,
  AuthUserSchema,
  createApiSuccessSchema,
  OkSchema,
  TokenSchema,
} from '../openapi/schemas.ts';
import { openApiHook } from '../openapi/hook.ts';

const auth = new OpenAPIHono<HonoEnv>({ defaultHook: openApiHook });
const service = new AniListService();

const errorResponse = {
  description: 'Error',
  content: {
    'application/json': {
      schema: ApiErrorSchema,
    },
  },
};

const AUTH_STATE_VERSION = 1;

type AuthStatePayload = {
  v: number;
  redirectUri?: string;
  returnTo?: string;
};

type DecodedJwtPayload = {
  id?: number | string | null;
  username?: string;
  anilistToken?: string;
};

function encodeAuthState(payload: AuthStatePayload): string {
  const json = JSON.stringify(payload);
  return Buffer.from(json, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function decodeAuthState(raw?: string): AuthStatePayload | null {
  if (!raw) return null;
  const normalized = raw.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  try {
    const json = Buffer.from(padded, 'base64').toString('utf8');
    const parsed = JSON.parse(json) as AuthStatePayload;
    if (!parsed || parsed.v !== AUTH_STATE_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

function decodeJwtPayload(raw: string): DecodedJwtPayload | null {
  const parts = raw.split('.');
  if (parts.length < 2) return null;
  const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  try {
    const json = Buffer.from(padded, 'base64').toString('utf8');
    return JSON.parse(json) as DecodedJwtPayload;
  } catch {
    return null;
  }
}

function getFrontendBaseUrl(c?: { req: { url: string; header: (name: string) => string | undefined } }): string {
  const configured = Bun.env.FRONTEND_URL || Bun.env.CORS_ORIGIN;
  if (configured) {
    const first = configured
      .split(',')
      .map((origin) => origin.trim())
      .find((origin) => origin && origin !== '*');
    if (first) return first;
  }

  if (!c) return 'http://localhost:3000';

  try {
    const requestOrigin = getRequestOrigin(c);
    const url = new URL(requestOrigin);
    const apiPort = String(Bun.env.PORT || 3001);
    if (url.port && url.port === apiPort) {
      url.port = '3000';
    }
    return url.toString().replace(/\/$/, '');
  } catch {
    return 'http://localhost:3000';
  }
}

function getFrontendAuthPath(): string {
  const path = Bun.env.FRONTEND_AUTH_PATH;
  if (!path) return '/';
  return path.startsWith('/') ? path : `/${path}`;
}

function getAllowedOrigins(): string[] {
  const raw = Bun.env.CORS_ORIGIN || Bun.env.FRONTEND_URL;
  if (!raw) return [];
  return raw
    .split(',')
    .map((origin) => normalizeUrlValue(origin.trim()))
    .filter(Boolean);
}

function getRequestOrigin(c: { req: { url: string; header: (name: string) => string | undefined } }) {
  const url = new URL(c.req.url);
  const forwardedProto = c.req.header('x-forwarded-proto');
  const forwardedHost = c.req.header('x-forwarded-host');
  const host = forwardedHost || c.req.header('host') || url.host;
  const proto = forwardedProto || url.protocol.replace(':', '');
  return `${proto}://${host}`;
}

function getAuthRedirectUri(c: { req: { url: string; header: (name: string) => string | undefined } }) {
  const requestOrigin = getRequestOrigin(c);
  const configured = Bun.env.ANILIST_REDIRECT_URI || getRuntimeConfigValue('ANILIST_REDIRECT_URI');
  if (configured) return configured;
  return `${requestOrigin}/api/auth/anilist/callback`;
}

function getConfiguredRedirectUri(): string | undefined {
  const configured = Bun.env.ANILIST_REDIRECT_URI || getRuntimeConfigValue('ANILIST_REDIRECT_URI');
  return configured?.trim() || undefined;
}

function normalizeUrlValue(value: string): string {
  return value.replace(/\/$/, '');
}

function isLocalHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '0.0.0.0';
}

function isPrivateHostname(hostname: string): boolean {
  if (hostname.endsWith('.local')) return true;
  if (hostname.startsWith('10.')) return true;
  if (hostname.startsWith('192.168.')) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)) return true;
  return false;
}

function isEquivalentHost(a: string, b: string): boolean {
  if (a === b) return true;
  if (isLocalHostname(a) && isLocalHostname(b)) return true;
  return false;
}

function isTrustedHostname(hostname: string): boolean {
  return isLocalHostname(hostname) || isPrivateHostname(hostname);
}

function resolveReturnTo(
  c: { req: { url: string; header: (name: string) => string | undefined } },
  candidate?: string,
): string {
  if (candidate) {
    try {
      const candidateUrl = new URL(candidate);
      const candidateOrigin = normalizeUrlValue(candidateUrl.origin);
      const allowedOrigins = getAllowedOrigins();
      if (allowedOrigins.includes(candidateOrigin)) {
        return candidateUrl.toString().replace(/\/$/, '');
      }
      const requestUrl = new URL(getRequestOrigin(c));
      if (isEquivalentHost(candidateUrl.hostname, requestUrl.hostname)) {
        return candidateUrl.toString().replace(/\/$/, '');
      }
      if (isTrustedHostname(requestUrl.hostname) && isTrustedHostname(candidateUrl.hostname)) {
        return candidateUrl.toString().replace(/\/$/, '');
      }
    } catch {
      // ignore invalid candidate
    }
  }
  return getFrontendBaseUrl(c);
}

function resolveRedirectUri(
  c: { req: { url: string; header: (name: string) => string | undefined } },
  candidate?: string,
): string {
  if (candidate) {
    try {
      const configured = getConfiguredRedirectUri();
      if (configured && normalizeUrlValue(candidate) === normalizeUrlValue(configured)) {
        return normalizeUrlValue(candidate);
      }
      const candidateUrl = new URL(candidate);
      const requestUrl = new URL(getRequestOrigin(c));
      if (isEquivalentHost(candidateUrl.hostname, requestUrl.hostname)) {
        return candidateUrl.toString().replace(/\/$/, '');
      }
    } catch {
      // ignore invalid candidate
    }
  }
  return getAuthRedirectUri(c);
}

function ensureSettingsToken(c: {
  req: { header: (name: string) => string | undefined };
}): { ok: true } | { ok: false; response: Response } {
  const token = Bun.env.MANVERSE_SETTINGS_TOKEN;
  if (!token) return { ok: true };
  const provided = c.req.header('x-settings-token');
  if (provided && provided === token) return { ok: true };
  return {
    ok: false,
    response: jsonError(
      c as never,
      { code: 'AUTH_REQUIRED', message: 'Missing or invalid settings token.' },
      401,
    ),
  };
}

const loginRoute = createRoute({
  method: 'post',
  path: '/anilist/login',
  tags: ['auth'],
  request: {
    query: z.object({
      redirectUri: z.string().url().optional(),
      returnTo: z.string().url().optional(),
    }),
  },
  responses: {
    200: {
      description: 'Authorization URL',
      content: {
        'application/json': {
          schema: createApiSuccessSchema(AuthUrlSchema),
        },
      },
    },
    default: errorResponse,
  },
});

auth.openapi(loginRoute, (c) => {
  const { redirectUri, returnTo } = c.req.valid('query');
  const resolvedRedirectUri = resolveRedirectUri(c, redirectUri);
  const resolvedReturnTo = resolveReturnTo(c, returnTo);
  const authUrl = new URL(service.getAuthorizationUrl(resolvedRedirectUri));
  authUrl.searchParams.set(
    'state',
    encodeAuthState({
      v: AUTH_STATE_VERSION,
      redirectUri: resolvedRedirectUri,
      returnTo: resolvedReturnTo,
    }),
  );
  return jsonSuccess(c, { authUrl: authUrl.toString() });
});

const credentialsRoute = createRoute({
  method: 'post',
  path: '/anilist/credentials',
  tags: ['auth'],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            clientId: z.string().min(1),
            clientSecret: z.string().min(1),
            redirectUri: z.string().url().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Credentials saved',
      content: {
        'application/json': {
          schema: createApiSuccessSchema(OkSchema),
        },
      },
    },
    401: errorResponse,
    default: errorResponse,
  },
});

auth.openapi(credentialsRoute, async (c) => {
  const authCheck = ensureSettingsToken(c);
  if (!authCheck.ok) return authCheck.response;
  const body = c.req.valid('json');
  try {
    updateRuntimeConfig({
      anilistClientId: body.clientId.trim(),
      anilistClientSecret: body.clientSecret.trim(),
      anilistRedirectUri: body.redirectUri?.trim() || '',
    });
    Bun.env.ANILIST_CLIENT_ID = body.clientId.trim();
    Bun.env.ANILIST_CLIENT_SECRET = body.clientSecret.trim();
    Bun.env.ANILIST_REDIRECT_URI = body.redirectUri?.trim() || '';
    return jsonSuccess(c, { ok: true });
  } catch (error) {
    return jsonError(
      c,
      { code: 'CONFIG_WRITE_FAILED', message: (error as Error)?.message || 'Failed to save.' },
      500,
    );
  }
});

const statusRoute = createRoute({
  method: 'get',
  path: '/anilist/status',
  tags: ['auth'],
  responses: {
    200: {
      description: 'Credential status',
      content: {
        'application/json': {
          schema: createApiSuccessSchema(
            z.object({
              configured: z.boolean(),
              source: z.enum(['env', 'runtime', 'none']),
              redirectUri: z.string().optional(),
            }),
          ),
        },
      },
    },
    default: errorResponse,
  },
});

auth.openapi(statusRoute, (c) => {
  const envId = Bun.env.ANILIST_CLIENT_ID;
  const envSecret = Bun.env.ANILIST_CLIENT_SECRET;
  const runtime = getRuntimeConfig();
  let source: 'env' | 'runtime' | 'none' = 'none';
  if (envId && envSecret) {
    source = 'env';
  } else if (runtime.anilistClientId && runtime.anilistClientSecret) {
    source = 'runtime';
  }
  return jsonSuccess(c, {
    configured: source !== 'none',
    source,
    redirectUri: Bun.env.ANILIST_REDIRECT_URI || runtime.anilistRedirectUri || undefined,
  });
});

const callbackRoute = createRoute({
  method: 'get',
  path: '/anilist/callback',
  tags: ['auth'],
  request: {
    query: z.object({
      code: z.string(),
      state: z.string().optional(),
    }),
  },
  responses: {
    302: {
      description: 'Redirect to frontend with token',
    },
    default: errorResponse,
  },
});

auth.openapi(callbackRoute, async (c) => {
  const { code, state } = c.req.valid('query');
  if (!code) {
    return jsonError(
      c,
      { code: 'MISSING_CODE', message: 'Authorization code is required' },
      400,
    );
  }

  try {
    const parsedState = decodeAuthState(state);
    const redirectUri = resolveRedirectUri(c, parsedState?.redirectUri);
    const returnTo = resolveReturnTo(c, parsedState?.returnTo);
    let token: Awaited<ReturnType<typeof service.exchangeCodeForToken>>;

    try {
      token = await service.exchangeCodeForToken(code, redirectUri);
    } catch (error) {
      const fallbackRedirectUri = getAuthRedirectUri(c);
      if (normalizeUrlValue(fallbackRedirectUri) === normalizeUrlValue(redirectUri)) {
        throw error;
      }
      console.warn('AniList token exchange failed, retrying with fallback redirect.', {
        redirectUri,
        fallbackRedirectUri,
      });
      token = await service.exchangeCodeForToken(code, fallbackRedirectUri);
    }
    const user = await service.getCurrentUser(token);
    const jwt = await signUser({
      id: user.id,
      username: user.name,
      anilistToken: token.accessToken,
    });

    const redirectUrl = new URL(returnTo);
    redirectUrl.pathname = getFrontendAuthPath();
    redirectUrl.searchParams.set('token', jwt);

    return c.redirect(redirectUrl.toString());
  } catch (error) {
    console.error('AniList OAuth callback failed.', {
      message: error instanceof Error ? error.message : String(error),
      requestOrigin: getRequestOrigin(c),
    });
    const redirectUrl = new URL(getFrontendBaseUrl(c));
    redirectUrl.pathname = getFrontendAuthPath();
    redirectUrl.searchParams.set('error', 'AUTH_ERROR');
    return c.redirect(redirectUrl.toString());
  }
});

const guestRoute = createRoute({
  method: 'post',
  path: '/guest',
  tags: ['auth'],
  responses: {
    200: {
      description: 'Guest token',
      content: {
        'application/json': {
          schema: createApiSuccessSchema(TokenSchema),
        },
      },
    },
    default: errorResponse,
  },
});

auth.openapi(guestRoute, async (c) => {
  const jwt = await signUser({
    id: null,
    isGuest: true,
  });

  return jsonSuccess(c, { token: jwt });
});

const meRoute = createRoute({
  method: 'get',
  path: '/me',
  tags: ['auth'],
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: 'Current user',
      content: {
        'application/json': {
          schema: createApiSuccessSchema(AuthUserSchema),
        },
      },
    },
    401: errorResponse,
    default: errorResponse,
  },
});

auth.openapi(meRoute, requireAuth, (c) => {
  const user = c.get('auth');
  return jsonSuccess(c, user ?? null);
});

const logoutRoute = createRoute({
  method: 'post',
  path: '/logout',
  tags: ['auth'],
  responses: {
    200: {
      description: 'Logout success',
      content: {
        'application/json': {
          schema: createApiSuccessSchema(OkSchema),
        },
      },
    },
    default: errorResponse,
  },
});

auth.openapi(logoutRoute, (c) => {
  return jsonSuccess(c, { ok: true });
});

const recoverRoute = createRoute({
  method: 'post',
  path: '/recover',
  tags: ['auth'],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            token: z.string().min(10),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Recovered token',
      content: {
        'application/json': {
          schema: createApiSuccessSchema(
            z.object({
              token: z.string(),
              user: AniListUserSchema,
            }),
          ),
        },
      },
    },
    400: errorResponse,
    401: errorResponse,
    default: errorResponse,
  },
});

auth.openapi(recoverRoute, async (c) => {
  const { token } = c.req.valid('json');
  const payload = decodeJwtPayload(token);
  if (!payload?.anilistToken) {
    return jsonError(
      c,
      { code: 'ANILIST_TOKEN_MISSING', message: 'AniList token not available' },
      401,
    );
  }
  try {
    const user = await service.getCurrentUser({
      accessToken: payload.anilistToken,
      tokenType: 'Bearer',
      expiresIn: 0,
      expiresAt: Date.now(),
    });
    const jwt = await signUser({
      id: user.id,
      username: user.name,
      anilistToken: payload.anilistToken,
    });
    return jsonSuccess(c, { token: jwt, user });
  } catch (error) {
    return jsonError(
      c,
      {
        code: 'RECOVERY_FAILED',
        message: error instanceof Error ? error.message : 'Failed to recover session',
      },
      401,
    );
  }
});

export default auth;
