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
import { betterAuth, OAuth2UserInfo } from 'better-auth';
import { genericOAuth, openAPI, testUtils } from 'better-auth/plugins';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import * as argon2 from 'argon2';

// const prisma = new PrismaClient({
//   adapter: new PrismaPg({
//     connectionString: env.DATABASE_URL,
//   }),
// });

const anilistCallbackUrl = new URL(
  '/api/auth/oauth2/callback/anilist',
  env.BETTER_AUTH_URL,
).toString();
const anilistSyntheticEmailDomain = 'anilist.manverse.local';

const oauthPlugins = env.ANILIST_OAUTH_ENABLED
  ? [
      genericOAuth({
        // TODO: Add the AniList OAuth provider config here.
        config: [
          {
            responseType: 'code',
            redirectURI: anilistCallbackUrl,
            authorizationUrl: 'https://anilist.co/api/v2/oauth/authorize',
            authorizationHeaders: {
              Accept: 'application/json',
            },
            tokenUrl: 'https://anilist.co/api/v2/oauth/token',
            clientId: env.ANILIST_CLIENT_ID!,
            clientSecret: env.ANILIST_CLIENT_SECRET!,
            providerId: 'anilist',
            pkce: true,
            getUserInfo: async (tokens) => {
              if (!tokens.accessToken) {
                throw new Error('AniList did not return an access token.');
              }

              const query = `
                query Viewer {
                  Viewer {
                    id
                    name
                    avatar {
                      large
                    }
                  }
                }
              `;

              const res = await fetch('https://graphql.anilist.co', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Accept: 'application/json',
                  Authorization: `Bearer ${tokens.accessToken}`,
                },
                body: JSON.stringify({
                  query,
                  operationName: 'Viewer',
                }),
              });

              const json = (await res.json()) as {
                data?: {
                  Viewer?: {
                    id: number;
                    name: string;
                    avatar?: {
                      large?: string | null;
                    } | null;
                  } | null;
                };
                errors?: unknown;
              };

              if (!res.ok || json.errors) {
                throw new Error(JSON.stringify(json.errors ?? json));
              }

              const viewer = json.data?.Viewer;

              if (!viewer) {
                return null;
              }

              const user: OAuth2UserInfo = {
                id: String(viewer.id),
                name: viewer.name,
                image: viewer.avatar?.large ?? undefined,
                // AniList does not appear to expose a user email here, but Better Auth
                // requires one for the provider sign-in flow.
                email: `${viewer.id}@${anilistSyntheticEmailDomain}`,
                emailVerified: true,
              };

              return user;
            },
          },
        ],
      }),
    ]
  : [];

export const auth = betterAuth({
  // basePath: 'auth',
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: env.TRUSTED_ORIGINS,
  rateLimit: {
    enabled: env.NODE_ENV === 'production' ? true : false,
  },
  session: {
    cookieCache: {
      /**
       * When it is critical that all revoked session get deactivated on all devices
       * as soon as they are revoked, you should use disableCookieCache: true
       * or disable the following code.
       */
      enabled: true,
      maxAge: 5 * 60, // Cache duration in seconds (5 minutes)
      strategy: 'compact', // You can use 'jwt' or 'jwe' for signing and security
    },
  },
  emailAndPassword: {
    enabled: true,
    hash: async (password) => {
      return argon2.hash(password as string);
    },
    verify: async (hash, password) => {
      return argon2.verify(hash as string, password as string);
    },
  },
  plugins: [
    openAPI({ path: 'reference' }),
    ...oauthPlugins,
    testUtils(), // TODO: Put this to use in integration and E2E tests
  ],
  // TODO: add anilist oauth2 using the genericOAuth plugin
  // socialProviders: { google: { clientId: 'test', clientSecret: 'test' } },
});

const ctx = await auth.$context;
export const test = ctx.test;

export default auth;
