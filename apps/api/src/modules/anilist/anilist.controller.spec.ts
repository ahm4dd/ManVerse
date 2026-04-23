import 'reflect-metadata';
import type {
  SearchMediaPage,
  ViewerMangaListCollection,
} from '@manverse/anilist-client';
import { faker } from '@faker-js/faker';
import { Test, type TestingModule } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnilistService } from './anilist.service.js';
import { AnilistController } from './anilist.controller.js';
import type { GetViewerMangaListsQueryDto } from './dto/get-viewer-manga-lists.dto.js';
import type { SearchMediaDto } from './dto/search-media.dto.js';

describe('AnilistController', () => {
  let anilistController: AnilistController;

  const mockAnilistService = {
    getUser: vi.fn(),
    getViewer: vi.fn(),
    getViewerMangaLists: vi.fn(),
    searchMedia: vi.fn(),
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
      providers: [{ provide: AnilistService, useValue: mockAnilistService }],
    }).compile();

    anilistController = app.get<AnilistController>(AnilistController);
  });

  beforeEach(() => {
    faker.seed(42);
    vi.clearAllMocks();
  });

  it('getUser() should delegate AniList user lookup to the service', async () => {
    const query = {
      id: 7407199,
      name: 'ahm4dd',
    };
    const profile = {
      id: 7407199,
      name: 'ahm4dd',
      about: 'Backend engineer in training',
      bannerImage: null,
      siteUrl: 'https://anilist.co/user/ahm4dd',
      createdAt: 1_711_630_400,
      avatar: {
        large: faker.image.url(),
      },
      favourites: {
        manga: [],
      },
    };

    mockAnilistService.getUser.mockResolvedValueOnce(profile);

    await expect(anilistController.getUser(query)).resolves.toEqual(profile);

    expect(mockAnilistService.getUser).toHaveBeenCalledWith(query);
  });

  it('getViewer() should delegate the authenticated AniList viewer lookup to the service', async () => {
    const session = {
      user: {
        id: faker.string.nanoid(),
      },
    } as UserSession;
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

    mockAnilistService.getViewer.mockResolvedValueOnce(profile);

    await expect(anilistController.getViewer(session)).resolves.toEqual(
      profile,
    );

    expect(mockAnilistService.getViewer).toHaveBeenCalledWith(session.user.id);
  });

  it('getViewerMangaLists() should delegate the authenticated manga list lookup to the service', async () => {
    const session = {
      user: {
        id: faker.string.nanoid(),
      },
    } as UserSession;
    const query: GetViewerMangaListsQueryDto = {
      chunk: 2,
      perChunk: 50,
    };
    const collection: ViewerMangaListCollection = {
      hasNextChunk: true,
      lists: [],
    };

    mockAnilistService.getViewerMangaLists.mockResolvedValueOnce(collection);

    await expect(
      anilistController.getViewerMangaLists(session, query),
    ).resolves.toEqual(collection);

    expect(mockAnilistService.getViewerMangaLists).toHaveBeenCalledWith(
      session.user.id,
      query,
    );
  });

  it('searchMedia() should delegate AniList search to the service', async () => {
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
      media: [],
    };

    mockAnilistService.searchMedia.mockResolvedValueOnce(result);

    await expect(anilistController.searchMedia(query)).resolves.toEqual(result);

    expect(mockAnilistService.searchMedia).toHaveBeenCalledWith(query);
  });
});
