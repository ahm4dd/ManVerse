import 'reflect-metadata';
import type {
  SearchMediaPage,
  ViewerMangaListCollection,
} from '@manverse/anilist-client';
import { faker } from '@faker-js/faker';
import { NotFoundException } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { Test, TestingModule } from '@nestjs/testing';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ANILIST_ACCOUNT_NOT_LINKED_MESSAGE,
  ANILIST_RELINK_REQUIRED_MESSAGE,
} from '../../lib/anilist-oauth.js';
import { AnilistAccountService } from './anilist-account.service.js';
import { ANILIST_CLIENT_TOKEN } from './anilist.constants.js';
import { AnilistController } from './anilist.controller.js';
import type { GetViewerMangaListsQueryDto } from './dto/get-viewer-manga-lists.dto.js';
import type { SearchMediaDto } from './dto/search-media.dto.js';

describe('AnilistController', () => {
  let anilistController: AnilistController;

  const mockAnilistClient = {
    getUserProfile: vi.fn(),
    getViewerProfile: vi.fn(),
    getViewerMangaLists: vi.fn(),
    searchMedia: vi.fn(),
  };
  const mockAnilistAccountService = {
    getCurrentUserAccessToken: vi.fn(),
  };

  beforeAll(async () => {
    const app: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([
          {
            ttl: 60_000,
            limit: 60,
          },
        ]),
      ],
      controllers: [AnilistController],
      providers: [
        { provide: ANILIST_CLIENT_TOKEN, useValue: mockAnilistClient },
        {
          provide: AnilistAccountService,
          useValue: mockAnilistAccountService,
        },
      ],
    }).compile();

    anilistController = app.get<AnilistController>(AnilistController);
  });

  beforeEach(() => {
    faker.seed(42);
    vi.clearAllMocks();
  });

  it('getUser() should return a user profile by query params', async () => {
    const profile = {
      id: 123,
      name: faker.internet.username(),
      about: faker.lorem.sentence(),
      bannerImage: faker.image.url(),
      siteUrl: faker.internet.url(),
      createdAt: 1_712_345_678,
      avatar: {
        large: faker.image.url(),
      },
      favourites: null,
    };

    mockAnilistClient.getUserProfile.mockResolvedValueOnce(profile);

    await expect(
      anilistController.getUser({
        id: profile.id,
        name: profile.name,
      }),
    ).resolves.toEqual(profile);

    expect(mockAnilistClient.getUserProfile).toHaveBeenCalledWith({
      id: profile.id,
      name: profile.name,
    });
  });

  it('getViewer() should return the current linked AniList viewer profile', async () => {
    const session = {
      user: {
        id: faker.string.nanoid(),
      },
    } as UserSession;
    const accessToken = faker.string.alphanumeric(32);
    const profile = {
      id: 999,
      name: faker.internet.username(),
      about: null,
      bannerImage: null,
      siteUrl: faker.internet.url(),
      createdAt: 1_712_345_678,
      avatar: null,
      favourites: null,
    };

    mockAnilistAccountService.getCurrentUserAccessToken.mockResolvedValueOnce(
      accessToken,
    );
    mockAnilistClient.getViewerProfile.mockResolvedValueOnce(profile);

    await expect(anilistController.getViewer(session)).resolves.toEqual(
      profile,
    );

    expect(
      mockAnilistAccountService.getCurrentUserAccessToken,
    ).toHaveBeenCalledWith(session.user.id);
    expect(mockAnilistClient.getViewerProfile).toHaveBeenCalledWith(
      accessToken,
    );
  });

  it('getViewer() should throw when the current user has no linked AniList account', async () => {
    const session = {
      user: {
        id: faker.string.nanoid(),
      },
    } as UserSession;

    mockAnilistAccountService.getCurrentUserAccessToken.mockRejectedValueOnce(
      new NotFoundException(ANILIST_ACCOUNT_NOT_LINKED_MESSAGE),
    );

    await expect(anilistController.getViewer(session)).rejects.toThrow(
      new NotFoundException(ANILIST_ACCOUNT_NOT_LINKED_MESSAGE),
    );

    expect(mockAnilistClient.getViewerProfile).not.toHaveBeenCalled();
  });

  it('getViewer() should throw when the linked AniList account must be relinked', async () => {
    const session = {
      user: {
        id: faker.string.nanoid(),
      },
    } as UserSession;

    mockAnilistAccountService.getCurrentUserAccessToken.mockRejectedValueOnce(
      new NotFoundException(ANILIST_RELINK_REQUIRED_MESSAGE),
    );

    await expect(anilistController.getViewer(session)).rejects.toThrow(
      new NotFoundException(ANILIST_RELINK_REQUIRED_MESSAGE),
    );

    expect(mockAnilistClient.getViewerProfile).not.toHaveBeenCalled();
  });

  it('getViewerMangaLists() should return the current linked AniList viewer manga lists', async () => {
    const session = {
      user: {
        id: faker.string.nanoid(),
      },
    } as UserSession;
    const accessToken = faker.string.alphanumeric(32);
    const query: GetViewerMangaListsQueryDto = {
      chunk: 2,
      perChunk: 50,
    };
    const collection: ViewerMangaListCollection = {
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
              notes: faker.lorem.words(3),
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
                  extraLarge: faker.image.url(),
                  large: faker.image.url(),
                  medium: faker.image.url(),
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

    mockAnilistAccountService.getCurrentUserAccessToken.mockResolvedValueOnce(
      accessToken,
    );
    mockAnilistClient.getViewerMangaLists.mockResolvedValueOnce(collection);

    await expect(
      anilistController.getViewerMangaLists(session, query),
    ).resolves.toEqual(collection);

    expect(
      mockAnilistAccountService.getCurrentUserAccessToken,
    ).toHaveBeenCalledWith(session.user.id);
    expect(mockAnilistClient.getViewerMangaLists).toHaveBeenCalledWith(
      accessToken,
      query,
    );
  });

  it('getViewerMangaLists() should return null when AniList has no manga list collection', async () => {
    const session = {
      user: {
        id: faker.string.nanoid(),
      },
    } as UserSession;
    const accessToken = faker.string.alphanumeric(32);

    mockAnilistAccountService.getCurrentUserAccessToken.mockResolvedValueOnce(
      accessToken,
    );
    mockAnilistClient.getViewerMangaLists.mockResolvedValueOnce(null);

    await expect(
      anilistController.getViewerMangaLists(session, {}),
    ).resolves.toBeNull();

    expect(mockAnilistClient.getViewerMangaLists).toHaveBeenCalledWith(
      accessToken,
      {},
    );
  });

  it('getViewerMangaLists() should throw when the current user has no linked AniList account', async () => {
    const session = {
      user: {
        id: faker.string.nanoid(),
      },
    } as UserSession;

    mockAnilistAccountService.getCurrentUserAccessToken.mockRejectedValueOnce(
      new NotFoundException(ANILIST_ACCOUNT_NOT_LINKED_MESSAGE),
    );

    await expect(
      anilistController.getViewerMangaLists(session, {}),
    ).rejects.toThrow(
      new NotFoundException(ANILIST_ACCOUNT_NOT_LINKED_MESSAGE),
    );

    expect(mockAnilistClient.getViewerMangaLists).not.toHaveBeenCalled();
  });

  it('getViewerMangaLists() should throw when the linked AniList account must be relinked', async () => {
    const session = {
      user: {
        id: faker.string.nanoid(),
      },
    } as UserSession;

    mockAnilistAccountService.getCurrentUserAccessToken.mockRejectedValueOnce(
      new NotFoundException(ANILIST_RELINK_REQUIRED_MESSAGE),
    );

    await expect(
      anilistController.getViewerMangaLists(session, {}),
    ).rejects.toThrow(new NotFoundException(ANILIST_RELINK_REQUIRED_MESSAGE));

    expect(mockAnilistClient.getViewerMangaLists).not.toHaveBeenCalled();
  });

  it('searchMedia() should return AniList search results for the provided query', async () => {
    const query: SearchMediaDto = {
      search: 'solo leveling',
      page: 2,
      perPage: 5,
      isAdult: false,
    };
    const result: SearchMediaPage = {
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
          description: faker.lorem.sentence(),
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
            extraLarge: faker.image.url(),
            large: faker.image.url(),
            medium: faker.image.url(),
            color: '#0f172a',
          },
          bannerImage: faker.image.url(),
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
                    large: faker.image.url(),
                    medium: faker.image.url(),
                  },
                  siteUrl: 'https://anilist.co/anime/127760',
                },
              },
            ],
          },
        },
      ],
    };

    mockAnilistClient.searchMedia.mockResolvedValueOnce(result);

    await expect(anilistController.searchMedia(query)).resolves.toEqual(result);

    expect(mockAnilistClient.searchMedia).toHaveBeenCalledWith(query);
  });
});
