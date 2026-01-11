import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { AniListService } from '../services/anilist-service.ts';
import { jsonError, jsonSuccess } from '../utils/response.ts';
import { signUser } from '../utils/jwt.ts';
import { requireAuth } from '../middleware/auth.ts';
import type { HonoEnv } from '../types/api.ts';
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

const loginRoute = createRoute({
  method: 'post',
  path: '/anilist/login',
  tags: ['auth'],
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
  const authUrl = service.getAuthorizationUrl();
  return jsonSuccess(c, { authUrl });
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
