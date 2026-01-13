import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
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

function getFrontendBaseUrl(): string {
  return Bun.env.FRONTEND_URL || 'http://localhost:3000';
}

function getFrontendAuthPath(): string {
  const path = Bun.env.FRONTEND_AUTH_PATH;
  if (!path) return '/';
  return path.startsWith('/') ? path : `/${path}`;
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
  const { redirectUri } = c.req.valid('query');
  const authUrl = service.getAuthorizationUrl(redirectUri || getAuthRedirectUri(c));
  return jsonSuccess(c, { authUrl });
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
  const { code } = c.req.valid('query');
  if (!code) {
    return jsonError(
      c,
      { code: 'MISSING_CODE', message: 'Authorization code is required' },
      400,
    );
  }

  try {
    const token = await service.exchangeCodeForToken(code, getAuthRedirectUri(c));
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
  } catch {
    const redirectUrl = new URL(getFrontendBaseUrl());
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

export default auth;
