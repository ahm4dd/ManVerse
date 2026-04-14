import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test, TestingModule } from '@nestjs/testing';
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
import { z } from 'zod';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/bootstrap/configure-app.js';
import { ANILIST_PROVIDER_ID } from '../../src/common/constants/provider.constants.js';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import { test as authTest } from '../../src/lib/auth.js';
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

describe('AnilistController (e2e)', () => {
  let app: NestExpressApplication;
  let httpServer: ReturnType<NestExpressApplication['getHttpServer']>;
  let prisma: PrismaClient;
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
      .overrideProvider('ANILIST_CLIENT')
      .useValue(mockAnilistClient)
      .compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();
    httpServer = app.getHttpServer();
    prisma = app.get(PrismaClient);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
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

        expect(parsedBody.message).toBe(
          'AniList account is not linked for the current user',
        );
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

  it('GET /api/v1/anilist/viewer/manga-lists returns 404 when the linked AniList account has no access token', async () => {
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

        expect(parsedBody.message).toBe(
          'AniList access token is not available for the current user',
        );
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
});
