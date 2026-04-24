/**
 * -----------------------------------------------------------------------------
 * This file is meant to be used by Better Auth CLI commands.
 * It is not imported by the Nest app to avoid creating an extra Prisma client.
 *
 * The CLI points to the compiled version in `dist/` so Node resolves `.js` files
 * consistently while the source of truth stays in `src/`.
 * -----------------------------------------------------------------------------
 * */

// import { PrismaPg } from '@prisma/adapter-pg';
// import { PrismaClient } from '../generated/prisma/client.js';
// import { createAuth } from '../infrastructure/auth/create-auth.js';
import { prisma } from '../infrastructure/database/prisma/prisma.js';
import { env } from '../config/env.js';
import { betterAuth } from 'better-auth';
import { openAPI, testUtils } from 'better-auth/plugins';
import { genericOAuth } from 'better-auth/plugins/generic-oauth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import * as argon2 from 'argon2';
import { AnilistClient } from '@manverse/anilist-client';
import {
  anilistAccountOptions,
  createAnilistOAuthProviderConfig,
} from './anilist-oauth.js';

type BetterAuthErrorLike = {
  body?: {
    code?: string;
  };
};

export function getBetterAuthErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object' || !('body' in error)) {
    return undefined;
  }

  const errorBody = (error as BetterAuthErrorLike).body;

  if (!errorBody || typeof errorBody !== 'object') {
    return undefined;
  }

  return typeof errorBody.code === 'string' ? errorBody.code : undefined;
}

const anilistCallbackUrl = new URL(
  '/api/auth/oauth2/callback/anilist',
  env.BETTER_AUTH_URL,
).toString();
const anilistClient = new AnilistClient();

const oauthPlugins = env.ANILIST_OAUTH_ENABLED
  ? [
      genericOAuth({
        config: [
          createAnilistOAuthProviderConfig({
            callbackUrl: anilistCallbackUrl,
            clientId: env.ANILIST_CLIENT_ID!,
            clientSecret: env.ANILIST_CLIENT_SECRET!,
            identitySalt: env.ANILIST_IDENTITY_SALT!,
            resolveViewer: (accessToken: string) =>
              anilistClient.getViewerProfile(accessToken),
          }),
        ],
      }),
    ]
  : [];

const testPlugins = env.NODE_ENV === 'test' ? [testUtils()] : [];

export const auth = betterAuth({
  // basePath: 'auth',
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  advanced: {
    useSecureCookies: env.NODE_ENV === 'production',
    // Better Auth already handles CSRF/origin protections; keep those checks on.
    disableCSRFCheck: false,
    disableOriginCheck: false,
  },
  account: anilistAccountOptions,
  trustedOrigins: env.TRUSTED_ORIGINS,
  rateLimit: {
    enabled: env.NODE_ENV === 'production',
    // TODO: Tune these settings
  },
  session: {
    cookieCache: {
      // Revalidate against the session store on every request so revoked
      // sessions are not accepted until the cookie cache expires.
      enabled: false,
    },
  },
  emailAndPassword: {
    enabled: true,
    hash: async (password: string) => {
      return argon2.hash(password);
    },
    verify: async (hash: string, password: string) => {
      return argon2.verify(hash, password);
    },
  },
  plugins: [openAPI({ path: 'reference' }), ...oauthPlugins, ...testPlugins],
  // socialProviders: { google: { clientId: 'test', clientSecret: 'test' } },
});

export default auth;
