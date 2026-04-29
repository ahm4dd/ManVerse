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
import { PrismaClient } from '../../src/generated/prisma/client.js';
import auth from '../../src/lib/auth.js';
import { authTest } from '../helpers/auth-test.js';

const oauthSignInResponseBodySchema = z.object({
  url: z.url(),
});

describe('AniList OAuth linking (e2e)', () => {
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

    const cookies = response.headers['set-cookie'];

    if (!cookies?.length) {
      throw new Error('Expected Better Auth OAuth sign-in to return cookies');
    }

    return { state, cookies };
  };

  it('stores AniList OAuth access tokens encrypted when Better Auth persists the OAuth account through the callback flow', async () => {
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

    await request(httpServer)
      .get(`/api/auth/oauth2/callback/${ANILIST_PROVIDER_ID}`)
      .set('cookie', cookies)
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

    expect(storedAccount.accessToken).not.toBeNull();
    expect(storedAccount.accessToken).not.toBe(plaintextAccessToken);
    expect(storedAccount.accessToken).not.toHaveLength(0);

    await expect(
      auth.api.getAccessToken({
        body: {
          providerId: ANILIST_PROVIDER_ID,
          userId: storedAccount.userId,
        },
      }),
    ).resolves.toMatchObject({
      accessToken: plaintextAccessToken,
    });
  });
});
