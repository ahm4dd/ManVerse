import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test, type TestingModule } from '@nestjs/testing';
import { AnilistClient, type ProfileUser } from '@manverse/anilist-client';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import request from 'supertest';
import { z } from 'zod';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/bootstrap/configure-app.js';
import { ANILIST_PROVIDER_ID } from '../../src/common/constants/provider.constants.js';
import {
  ANILIST_ACCOUNT_NOT_LINKED_MESSAGE,
  ANILIST_RELINK_REQUIRED_MESSAGE,
} from '../../src/common/errors/anilist.errors.js';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import auth from '../../src/lib/auth.js';
import { authTest } from '../helpers/auth-test.js';
import { apiPath } from '../helpers/api-path.js';

const oauthSignInResponseBodySchema = z.object({
  url: z.url(),
});
const httpErrorResponseBodySchema = z.object({
  message: z.string(),
});

describe('Users AniList access token endpoint (e2e)', () => {
  let app: NestExpressApplication;
  let httpServer: ReturnType<NestExpressApplication['getHttpServer']>;
  let prisma: PrismaClient;
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();

    httpServer = app.getHttpServer();
    prisma = app.get(PrismaClient);
  });

  afterEach(async () => {
    vi.restoreAllMocks();

    await Promise.all(
      createdUserIds.splice(0).map(async (userId) => {
        await authTest.deleteUser(userId);
      }),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  const toRequestCookies = (
    cookies: string[] | string | undefined,
  ): string[] => {
    const normalizedCookies =
      typeof cookies === 'string' ? [cookies] : (cookies ?? []);

    if (!normalizedCookies.length) {
      throw new Error('Expected Better Auth to return cookies');
    }

    return normalizedCookies.map((cookie) => cookie.split(';', 1)[0]);
  };

  const startAniListOAuthSignIn = async (callbackURL: string) => {
    const response = await request(httpServer)
      .post('/api/auth/sign-in/oauth2')
      .send({
        providerId: ANILIST_PROVIDER_ID,
        callbackURL,
        disableRedirect: true,
      })
      .expect(200);

    const parsedBody = oauthSignInResponseBodySchema.parse(response.body);
    const authorizationUrl = new URL(parsedBody.url);
    const state = authorizationUrl.searchParams.get('state');

    if (!state) {
      throw new Error('Expected Better Auth OAuth sign-in to return state');
    }

    return { state, cookies: toRequestCookies(response.headers['set-cookie']) };
  };

  const signUpUnlinkedUser = async () => {
    const email = `anilist-token-test-${randomUUID()}@example.com`;
    const password = 'test123456';

    const response = await request(httpServer)
      .post('/api/auth/sign-up/email')
      .send({
        email,
        password,
        name: 'AniList Token Test User',
      })
      .expect(200);

    const createdUser = await prisma.user.findUniqueOrThrow({
      where: {
        email,
      },
    });

    createdUserIds.push(createdUser.id);

    return {
      userId: createdUser.id,
      sessionCookies: toRequestCookies(response.headers['set-cookie']),
    };
  };

  const linkAniListAccount = async () => {
    const callbackURL = 'http://localhost:5173/settings/accounts';
    const plaintextAccessToken = 'anilist-oauth-access-token';
    const viewerId = 7_407_199;
    const viewerProfile = {
      id: viewerId,
      name: 'ahm4dd',
      about: 'Backend engineer in training',
      bannerImage: null,
      siteUrl: 'https://anilist.co/user/ahm4dd',
      createdAt: 1_711_630_400,
      avatar: {
        large: 'https://example.com/avatar.png',
      },
      favourites: {
        manga: {
          nodes: [],
        },
      },
    } satisfies ProfileUser;

    const { state, cookies } = await startAniListOAuthSignIn(callbackURL);

    vi.spyOn(globalThis, 'fetch').mockImplementation(
      (input: string | URL | Request) => {
        const requestUrl =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;

        if (requestUrl === 'https://anilist.co/api/v2/oauth/token') {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                access_token: plaintextAccessToken,
                token_type: 'Bearer',
                expires_in: 3600,
              }),
              {
                status: 200,
                headers: {
                  'content-type': 'application/json',
                },
              },
            ),
          );
        }

        throw new Error(
          `Unexpected fetch request in AniList OAuth test: ${requestUrl}`,
        );
      },
    );

    vi.spyOn(AnilistClient.prototype, 'getViewerProfile').mockResolvedValue(
      viewerProfile,
    );

    const callbackResponse = await request(httpServer)
      .get(`/api/auth/oauth2/callback/${ANILIST_PROVIDER_ID}`)
      .set('Cookie', cookies)
      .query({
        code: 'anilist-oauth-code',
        state,
      })
      .expect(302)
      .expect('Location', callbackURL);

    const storedAccount = await prisma.account.findFirstOrThrow({
      where: {
        providerId: ANILIST_PROVIDER_ID,
        accountId: String(viewerId),
      },
    });

    createdUserIds.push(storedAccount.userId);

    return {
      sessionCookies: toRequestCookies(callbackResponse.headers['set-cookie']),
      storedAccountId: storedAccount.id,
      plaintextAccessToken,
    };
  };

  it('returns 401 when no Better Auth session cookie is sent', async () => {
    await request(httpServer)
      .post(apiPath('/users/accounts/anilist/access-token'))
      .expect(401);
  });

  it('returns 404 when the current session user has no linked AniList account', async () => {
    const { sessionCookies } = await signUpUnlinkedUser();

    await request(httpServer)
      .post(apiPath('/users/accounts/anilist/access-token'))
      .set('Cookie', sessionCookies)
      .expect(404)
      .expect(({ body }) => {
        const parsedBody = httpErrorResponseBodySchema.parse(body);

        expect(parsedBody.message).toBe(ANILIST_ACCOUNT_NOT_LINKED_MESSAGE);
      });
  });

  it('returns the current user AniList access token with no-store headers', async () => {
    const { sessionCookies, plaintextAccessToken } = await linkAniListAccount();

    await request(httpServer)
      .post(apiPath('/users/accounts/anilist/access-token'))
      .set('Cookie', sessionCookies)
      .expect(200)
      .expect('Cache-Control', 'no-store, private')
      .expect('Pragma', 'no-cache')
      .expect({
        providerId: ANILIST_PROVIDER_ID,
        accessToken: plaintextAccessToken,
      });
  });

  it('returns 404 when the linked AniList token can no longer be retrieved', async () => {
    const { sessionCookies, storedAccountId } = await linkAniListAccount();

    await prisma.account.update({
      where: {
        id: storedAccountId,
      },
      data: {
        accessToken: null,
      },
    });

    await request(httpServer)
      .post(apiPath('/users/accounts/anilist/access-token'))
      .set('Cookie', sessionCookies)
      .expect(404)
      .expect(({ body }) => {
        const parsedBody = httpErrorResponseBodySchema.parse(body);

        expect(parsedBody.message).toBe(ANILIST_RELINK_REQUIRED_MESSAGE);
      });
  });

  it('still allows Better Auth to recover the OAuth token directly after linking', async () => {
    const { plaintextAccessToken } = await linkAniListAccount();
    const linkedUserId = createdUserIds.at(-1);

    if (!linkedUserId) {
      throw new Error(
        'Expected linked AniList user id to be tracked for cleanup',
      );
    }

    await expect(
      auth.api.getAccessToken({
        body: {
          providerId: ANILIST_PROVIDER_ID,
          userId: linkedUserId,
        },
      }),
    ).resolves.toMatchObject({
      accessToken: plaintextAccessToken,
    });
  });
});
