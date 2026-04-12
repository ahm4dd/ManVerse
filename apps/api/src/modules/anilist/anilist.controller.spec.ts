import 'reflect-metadata';
import { faker } from '@faker-js/faker';
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SearchMediaPage } from '@manverse/anilist-client';
import { ANILIST_PROVIDER_ID } from '../../common/constants/provider.constants.js';
import { PrismaClient } from '../../generated/prisma/client.js';
import { AnilistController } from './anilist.controller.js';
import type { SearchMediaDto } from './dto/search-media.dto.js';

describe('AnilistController', () => {
  let anilistController: AnilistController;

  const mockAnilistClient = {
    getUserProfile: vi.fn(),
    getViewerProfile: vi.fn(),
    searchMedia: vi.fn(),
  };

  const mockPrismaClient = {
    account: {
      findFirst: vi.fn(),
    },
  };

  beforeAll(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AnilistController],
      providers: [
        { provide: 'ANILIST_CLIENT', useValue: mockAnilistClient },
        { provide: PrismaClient, useValue: mockPrismaClient },
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

    mockPrismaClient.account.findFirst.mockResolvedValueOnce({
      accessToken,
    });
    mockAnilistClient.getViewerProfile.mockResolvedValueOnce(profile);

    await expect(anilistController.getViewer(session)).resolves.toEqual(
      profile,
    );

    expect(mockPrismaClient.account.findFirst).toHaveBeenCalledWith({
      where: {
        userId: session.user.id,
        providerId: ANILIST_PROVIDER_ID,
      },
      select: {
        accessToken: true,
      },
    });
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

    mockPrismaClient.account.findFirst.mockResolvedValueOnce(null);

    await expect(anilistController.getViewer(session)).rejects.toThrow(
      new NotFoundException(
        'AniList account is not linked for the current user',
      ),
    );

    expect(mockAnilistClient.getViewerProfile).not.toHaveBeenCalled();
  });

  it('getViewer() should throw when the linked AniList account has no access token', async () => {
    const session = {
      user: {
        id: faker.string.nanoid(),
      },
    } as UserSession;

    mockPrismaClient.account.findFirst.mockResolvedValueOnce({
      accessToken: null,
    });

    await expect(anilistController.getViewer(session)).rejects.toThrow(
      new NotFoundException(
        'AniList access token is not available for the current user',
      ),
    );

    expect(mockAnilistClient.getViewerProfile).not.toHaveBeenCalled();
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
