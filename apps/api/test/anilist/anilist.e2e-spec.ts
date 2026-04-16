import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import { AnilistClient, type ProfileUser } from '@manverse/anilist-client';
import {
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { z } from 'zod';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/bootstrap/configure-app.js';
import { ANILIST_PROVIDER_ID } from '../../src/common/constants/provider.constants.js';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import {
  ANILIST_ACCOUNT_NOT_LINKED_MESSAGE,
  ANILIST_RELINK_REQUIRED_MESSAGE,
} from '../../src/lib/anilist-oauth.js';
import auth from '../../src/lib/auth.js';
import { ANILIST_CLIENT_TOKEN } from '../../src/modules/anilist/anilist.constants.js';
import { authTest } from '../helpers/auth-test.js';
import { apiPath } from '../helpers/api-path.js';

const validationErrorBodySchema = z.object({
  message: z.string(),
  errors: z.array(
    z.object({
      code: z.string(),
      message: z.string(),
    }),
  ),
});

const errorMessageBodySchema = z.object({
  message: z.string(),
});

const oauthSignInResponseBodySchema = z.object({
  url: z.url(),
});

describe('AnilistController (e2e)', () => {
  let app: NestExpressApplication;
  let httpServer: Express;
  let prisma: PrismaClient;
  let throttlerStorage: ThrottlerStorageService;
  const createdUserIds: string[] = [];

  const mockAnilistClient = {
    getUserProfile: vi.fn(),
    getViewerProfile: vi.fn(),
    getViewerMangaLists: vi.fn(),
    searchMedia: vi.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ANILIST_CLIENT_TOKEN)
      .useValue(mockAnilistClient)
      .compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();
    httpServer = app.getHttpAdapter().getInstance();
    prisma = app.get(PrismaClient);
    throttlerStorage = app.get<ThrottlerStorageService>(
      ThrottlerStorage as never,
    );
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    throttlerStorage.storage.clear();
  });

  afterEach(async () => {
    vi.restoreAllMocks();

    await Promise.all(
      createdUserIds.splice(0).map(async (userId) => {
        await authTest.deleteUser(userId);
      }),
    );
  });

  const createAuthenticatedAniListUser = async (options?: {
    accessToken?: string | null;
  }) => {
    const user = await authTest.saveUser(authTest.createUser());
    createdUserIds.push(user.id);

    const session = await authTest.login({ userId: user.id });
    const cookie = session.headers.get('cookie');

    if (!cookie) {
      throw new Error('Expected Better Auth test login to produce a cookie');
    }

    const accessToken =
      options && 'accessToken' in options
        ? (options.accessToken ?? null)
        : 'anilist-access-token';

    await prisma.account.create({
      data: {
        id: randomUUID(),
        accountId: `anilist-${randomUUID()}`,
        providerId: ANILIST_PROVIDER_ID,
        userId: user.id,
        accessToken,
      },
    });

    return {
      user,
      cookie,
      accessToken,
    };
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

    const cookies = response.headers['set-cookie'];

    if (!cookies || cookies.length === 0) {
      throw new Error(
        'Expected Better Auth OAuth sign-in to return state cookies',
      );
    }

    return { state, cookies };
  };

  const expectSuccessfulAnonymousGet = async (
    path: string,
    query: Record<string, string | number | boolean>,
    count: number,
  ) => {
    for (let attempt = 0; attempt < count; attempt += 1) {
      await request(httpServer).get(apiPath(path)).query(query).expect(200);
    }
  };

  it('GET /api/v1/anilist/users returns the requested AniList user', async () => {
    const username = 'ahm4dd';
    const profile = {
      id: 7_407_199,
      name: username,
      about: 'Backend engineer in training',
      bannerImage: null,
      siteUrl: 'https://anilist.co/user/ahm4dd',
      createdAt: 1_711_630_400,
      avatar: {
        large: 'https://example.com/avatar.png',
      },
      favourites: {
        manga: [],
      },
    };

    mockAnilistClient.getUserProfile.mockResolvedValueOnce(profile);

    await request(httpServer)
      .get(apiPath('/anilist/users'))
      .query({ name: username })
      .expect(200)
      .expect(({ body }) => {
        expect(mockAnilistClient.getUserProfile).toHaveBeenCalledWith({
          id: undefined,
          name: username,
        });

        expect(body).toEqual(profile);
      });
  });

  it('GET /api/v1/anilist/users returns 400 when neither id nor name is provided', async () => {
    await request(httpServer)
      .get(apiPath('/anilist/users'))
      .expect(400)
      .expect(({ body }) => {
        expect(mockAnilistClient.getUserProfile).not.toHaveBeenCalled();
        const parsedBody = validationErrorBodySchema.parse(body);

        expect(parsedBody.message).toContain('Validation failed');
        expect(parsedBody.errors[0].code).toBe('custom');
        expect(parsedBody.errors[0].message).toBe(
          'AniList requires at least one query argument: id or name.',
        );
      });
  });

  it('GET /api/v1/anilist/viewer returns the linked AniList viewer for the authenticated user', async () => {
    const { cookie, accessToken } = await createAuthenticatedAniListUser();
    const profile = {
      id: 7_407_199,
      name: 'ahm4dd',
      about: 'Backend engineer in training',
      bannerImage: null,
      siteUrl: 'https://anilist.co/user/ahm4dd',
      createdAt: 1_711_630_400,
      avatar: {
        large: 'https://example.com/avatar.png',
      },
      favourites: {
        manga: [],
      },
    };

    mockAnilistClient.getViewerProfile.mockResolvedValueOnce(profile);

    await request(httpServer)
      .get(apiPath('/anilist/viewer'))
      .set('cookie', cookie)
      .expect(200)
      .expect(({ body }) => {
        expect(mockAnilistClient.getViewerProfile).toHaveBeenCalledWith(
          accessToken,
        );
        expect(body).toEqual(profile);
      });
  });

  it('GET /api/v1/anilist/viewer returns 401 without a session cookie', async () => {
    await request(httpServer)
      .get(apiPath('/anilist/viewer'))
      .expect(401)
      .expect(() => {
        expect(mockAnilistClient.getViewerProfile).not.toHaveBeenCalled();
      });
  });

  it('GET /api/v1/anilist/viewer returns 404 when the authenticated user has no linked AniList account', async () => {
    const user = await authTest.saveUser(authTest.createUser());
    createdUserIds.push(user.id);

    const session = await authTest.login({ userId: user.id });
    const cookie = session.headers.get('cookie');

    if (!cookie) {
      throw new Error('Expected Better Auth test login to produce a cookie');
    }

    await request(httpServer)
      .get(apiPath('/anilist/viewer'))
      .set('cookie', cookie)
      .expect(404)
      .expect(({ body }) => {
        expect(mockAnilistClient.getViewerProfile).not.toHaveBeenCalled();
        const parsedBody = errorMessageBodySchema.parse(body);

        expect(parsedBody.message).toBe(ANILIST_ACCOUNT_NOT_LINKED_MESSAGE);
      });
  });

  it('GET /api/v1/anilist/viewer returns 404 when the AniList account must be relinked', async () => {
    const { cookie } = await createAuthenticatedAniListUser({
      accessToken: '$ba$corrupted-encrypted-token',
    });

    await request(httpServer)
      .get(apiPath('/anilist/viewer'))
      .set('cookie', cookie)
      .expect(404)
      .expect(({ body }) => {
        expect(mockAnilistClient.getViewerProfile).not.toHaveBeenCalled();
        const parsedBody = errorMessageBodySchema.parse(body);

        expect(parsedBody.message).toBe(ANILIST_RELINK_REQUIRED_MESSAGE);
      });
  });

  it('stores AniList OAuth access tokens encrypted when Better Auth persists the OAuth account through the callback flow', async () => {
    const callbackURL = 'http://localhost:3000/oauth-complete';
    const plaintextAccessToken = 'anilist-access-token-from-oauth';
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

  it('GET /api/v1/anilist/viewer/manga-lists returns the linked AniList manga lists for the authenticated user', async () => {
    const query = {
      chunk: 2,
      perChunk: 50,
    };
    const { cookie, accessToken } = await createAuthenticatedAniListUser();
    const collection = {
      hasNextChunk: true,
      lists: [
        {
          name: 'Current',
          isCustomList: false,
          isSplitCompletedList: false,
          status: 'CURRENT',
          entries: [
            {
              id: 71,
              mediaId: 151807,
              status: 'CURRENT',
              score: 8.5,
              progress: 120,
              progressVolumes: 12,
              repeat: 0,
              priority: 1,
              private: false,
              hiddenFromStatusLists: false,
              notes: 'Waiting for the next chapter',
              updatedAt: 1_712_345_678,
              startedAt: {
                year: 2024,
                month: 1,
                day: 1,
              },
              completedAt: null,
              media: {
                id: 151807,
                idMal: null,
                title: {
                  romaji: 'Solo Leveling',
                  english: 'Solo Leveling',
                  native: 'Na Honjaman Level Up',
                  userPreferred: 'Solo Leveling',
                },
                coverImage: {
                  extraLarge: 'https://example.com/cover-xl.jpg',
                  large: 'https://example.com/cover-lg.jpg',
                  medium: 'https://example.com/cover-md.jpg',
                  color: '#0f172a',
                },
                format: 'NOVEL',
                status: 'RELEASING',
                chapters: null,
                volumes: null,
                countryOfOrigin: 'KR',
                siteUrl: 'https://anilist.co/manga/151807',
              },
            },
          ],
        },
      ],
    };

    mockAnilistClient.getViewerMangaLists.mockResolvedValueOnce(collection);

    await request(httpServer)
      .get(apiPath('/anilist/viewer/manga-lists'))
      .set('cookie', cookie)
      .query(query)
      .expect(200)
      .expect(({ body }) => {
        expect(mockAnilistClient.getViewerMangaLists).toHaveBeenCalledWith(
          accessToken,
          query,
        );
        expect(body).toEqual(collection);
      });
  });

  it('GET /api/v1/anilist/viewer/manga-lists returns an empty response body when AniList has no manga list collection', async () => {
    const { cookie, accessToken } = await createAuthenticatedAniListUser();

    mockAnilistClient.getViewerMangaLists.mockResolvedValueOnce(null);

    await request(httpServer)
      .get(apiPath('/anilist/viewer/manga-lists'))
      .set('cookie', cookie)
      .expect(200)
      .expect(({ body }) => {
        expect(mockAnilistClient.getViewerMangaLists).toHaveBeenCalledWith(
          accessToken,
          {},
        );
        expect(body).toEqual({});
      });
  });

  it('GET /api/v1/anilist/viewer/manga-lists fails closed when AniList returns malformed nested payload data', async () => {
    const { cookie, accessToken } = await createAuthenticatedAniListUser();

    mockAnilistClient.getViewerMangaLists.mockResolvedValueOnce({
      hasNextChunk: true,
      lists: [
        {
          name: 'Current',
          isCustomList: false,
          isSplitCompletedList: false,
          status: 'CURRENT',
          entries: [
            {
              id: 'not-a-number',
              mediaId: 151807,
            },
          ],
        },
      ],
    });

    await request(httpServer)
      .get(apiPath('/anilist/viewer/manga-lists'))
      .set('cookie', cookie)
      .expect(500)
      .expect(({ body }) => {
        expect(mockAnilistClient.getViewerMangaLists).toHaveBeenCalledWith(
          accessToken,
          {},
        );
        expect(body).toEqual({
          message: 'Internal Server Error',
          statusCode: 500,
        });
      });
  });

  it('GET /api/v1/anilist/viewer/manga-lists returns 401 without a session cookie', async () => {
    await request(httpServer)
      .get(apiPath('/anilist/viewer/manga-lists'))
      .expect(401)
      .expect(() => {
        expect(mockAnilistClient.getViewerMangaLists).not.toHaveBeenCalled();
      });
  });

  it('GET /api/v1/anilist/viewer/manga-lists returns 404 when the linked AniList account must be relinked', async () => {
    const { cookie } = await createAuthenticatedAniListUser({
      accessToken: null,
    });

    await request(httpServer)
      .get(apiPath('/anilist/viewer/manga-lists'))
      .set('cookie', cookie)
      .expect(404)
      .expect(({ body }) => {
        expect(mockAnilistClient.getViewerMangaLists).not.toHaveBeenCalled();
        const parsedBody = errorMessageBodySchema.parse(body);

        expect(parsedBody.message).toBe(ANILIST_RELINK_REQUIRED_MESSAGE);
      });
  });

  it('GET /api/v1/anilist/search-media returns search results for the given query', async () => {
    const query = {
      search: 'solo leveling',
      page: 2,
      perPage: 5,
      isAdult: false,
    };
    const searchResults = {
      pageInfo: {
        currentPage: 2,
        hasNextPage: true,
        lastPage: 12,
        perPage: 5,
        total: 60,
      },
      media: [
        {
          id: 151807,
          idMal: null,
          type: 'MANGA',
          format: 'NOVEL',
          status: 'RELEASING',
          description: 'A hunter grows stronger through dangerous dungeons.',
          startDate: {
            year: 2023,
            month: 4,
            day: 10,
          },
          endDate: {
            year: null,
            month: null,
            day: null,
          },
          season: 'SPRING',
          seasonYear: 2023,
          chapters: null,
          volumes: null,
          countryOfOrigin: 'KR',
          source: 'LIGHT_NOVEL',
          coverImage: {
            extraLarge: 'https://example.com/cover-xl.jpg',
            large: 'https://example.com/cover-lg.jpg',
            medium: 'https://example.com/cover-md.jpg',
            color: '#0f172a',
          },
          bannerImage: 'https://example.com/banner.jpg',
          title: {
            romaji: 'Solo Leveling',
            english: 'Solo Leveling',
            native: 'Na Honjaman Level Up',
            userPreferred: 'Solo Leveling',
          },
          synonyms: ['Only I Level Up'],
          genres: ['Action', 'Fantasy'],
          tags: [
            {
              id: 1,
              name: 'Dungeon',
              rank: 90,
              isGeneralSpoiler: false,
              isMediaSpoiler: false,
              category: 'Setting',
            },
          ],
          averageScore: 86,
          meanScore: 85,
          popularity: 120000,
          favourites: 15000,
          trending: 230,
          isAdult: false,
          siteUrl: 'https://anilist.co/manga/151807',
          relations: {
            edges: [
              {
                relationType: 'ADAPTATION',
                node: {
                  id: 127760,
                  type: 'ANIME',
                  format: 'TV',
                  status: 'FINISHED',
                  chapters: null,
                  volumes: null,
                  countryOfOrigin: 'JP',
                  title: {
                    romaji: 'Ore dake Level Up na Ken',
                    english: 'Solo Leveling',
                    native: '俺だけレベルアップな件',
                    userPreferred: 'Solo Leveling',
                  },
                  coverImage: {
                    large: 'https://example.com/anime-cover-lg.jpg',
                    medium: 'https://example.com/anime-cover-md.jpg',
                  },
                  siteUrl: 'https://anilist.co/anime/127760',
                },
              },
            ],
          },
        },
      ],
    };

    mockAnilistClient.searchMedia.mockResolvedValueOnce(searchResults);

    await request(httpServer)
      .get(apiPath('/anilist/search-media'))
      .query(query)
      .expect(200)
      .expect(({ body }) => {
        expect(mockAnilistClient.searchMedia).toHaveBeenCalledWith(query);
        expect(body).toEqual(searchResults);
      });
  });

  it('GET /api/v1/users/me returns 401 without a session cookie', async () => {
    await request(httpServer).get(apiPath('/users/me')).expect(401);
  });

  it('GET /api/v1/users/accounts returns 401 without a session cookie', async () => {
    await request(httpServer).get(apiPath('/users/accounts')).expect(401);
  });

  it('GET /api/v1/anilist/users returns 429 after 60 anonymous requests from the same IP', async () => {
    mockAnilistClient.getUserProfile.mockResolvedValue({
      id: 7_407_199,
      name: 'ahm4dd',
      about: null,
      bannerImage: null,
      siteUrl: 'https://anilist.co/user/ahm4dd',
      createdAt: 1_711_630_400,
      avatar: null,
      favourites: null,
    });

    await expectSuccessfulAnonymousGet(
      '/anilist/users',
      { name: 'ahm4dd' },
      60,
    );

    await request(httpServer)
      .get(apiPath('/anilist/users'))
      .query({ name: 'ahm4dd' })
      .expect(429);

    expect(mockAnilistClient.getUserProfile).toHaveBeenCalledTimes(60);
  });

  it('GET /api/v1/anilist/search-media returns 429 after 30 anonymous requests from the same IP', async () => {
    mockAnilistClient.searchMedia.mockResolvedValue({
      pageInfo: {
        currentPage: 1,
        hasNextPage: false,
        lastPage: 1,
        perPage: 5,
        total: 1,
      },
      media: [],
    });

    await expectSuccessfulAnonymousGet(
      '/anilist/search-media',
      { search: 'solo leveling', page: 1, perPage: 5, isAdult: false },
      30,
    );

    await request(httpServer)
      .get(apiPath('/anilist/search-media'))
      .query({ search: 'solo leveling', page: 1, perPage: 5, isAdult: false })
      .expect(429);

    expect(mockAnilistClient.searchMedia).toHaveBeenCalledTimes(30);
  });
});
