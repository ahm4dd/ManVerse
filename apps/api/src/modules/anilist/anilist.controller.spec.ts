import 'reflect-metadata';
import type {
  DeleteMediaListEntryResult,
  SearchMediaPage,
  SaveMediaListEntry,
  ToggleFavouriteResult,
  ViewerMangaListCollection,
} from '@manverse/anilist-client';
import { faker } from '@faker-js/faker';
import { Test, type TestingModule } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnilistService } from './anilist.service.js';
import { AnilistController } from './anilist.controller.js';
import type { DeleteMediaListEntryParamsDto } from './dto/delete-media-list-entry.dto.js';
import type { GetViewerMangaListsQueryDto } from './dto/get-viewer-manga-lists.dto.js';
import type { SaveMediaListEntryDto } from './dto/save-media-list-entry.dto.js';
import type { SearchMediaDto } from './dto/search-media.dto.js';
import type { ToggleFavouriteDto } from './dto/toggle-favourite.dto.js';

describe('AnilistController', () => {
  let anilistController: AnilistController;

  const mockAnilistService = {
    getUser: vi.fn(),
    getViewer: vi.fn(),
    getViewerMangaLists: vi.fn(),
    saveMediaListEntry: vi.fn(),
    deleteMediaListEntry: vi.fn(),
    toggleFavourite: vi.fn(),
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
    const response = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    mockAnilistService.getViewerMangaLists.mockResolvedValueOnce(collection);

    await expect(
      anilistController.getViewerMangaLists(session, query, response as never),
    ).resolves.toBeUndefined();

    expect(mockAnilistService.getViewerMangaLists).toHaveBeenCalledWith(
      session.user.id,
      query,
    );
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith(collection);
  });

  it('saveMediaListEntry() should delegate the authenticated library write to the service', async () => {
    const session = {
      user: {
        id: faker.string.nanoid(),
      },
    } as UserSession;
    const body: SaveMediaListEntryDto = {
      mediaId: 151807,
      status: 'CURRENT',
      progress: 120,
      score: 8.5,
    };
    const result: SaveMediaListEntry = {
      id: 71,
      mediaId: 151807,
      status: 'CURRENT',
      score: 8.5,
      progress: 120,
      media: null,
    };

    mockAnilistService.saveMediaListEntry.mockResolvedValueOnce(result);

    await expect(
      anilistController.saveMediaListEntry(session, body),
    ).resolves.toEqual(result);

    expect(mockAnilistService.saveMediaListEntry).toHaveBeenCalledWith(
      session.user.id,
      body,
    );
  });

  it('deleteMediaListEntry() should delegate the authenticated library deletion to the service', async () => {
    const session = {
      user: {
        id: faker.string.nanoid(),
      },
    } as UserSession;
    const params: DeleteMediaListEntryParamsDto = {
      entryId: 71,
    };
    const result: DeleteMediaListEntryResult = {
      entryId: 71,
      deleted: true,
    };

    mockAnilistService.deleteMediaListEntry.mockResolvedValueOnce(result);

    await expect(
      anilistController.deleteMediaListEntry(session, params),
    ).resolves.toEqual(result);

    expect(mockAnilistService.deleteMediaListEntry).toHaveBeenCalledWith(
      session.user.id,
      params.entryId,
    );
  });

  it('toggleFavourite() should delegate the authenticated favourite toggle to the service', async () => {
    const session = {
      user: {
        id: faker.string.nanoid(),
      },
    } as UserSession;
    const body: ToggleFavouriteDto = {
      mediaId: 151807,
    };
    const result: ToggleFavouriteResult = {
      mediaId: 151807,
      isFavourite: true,
      media: {
        id: 151807,
        title: {
          romaji: 'Solo Leveling',
          english: 'Solo Leveling',
          native: 'Na Honjaman Level Up',
          userPreferred: 'Solo Leveling',
        },
      },
    };

    mockAnilistService.toggleFavourite.mockResolvedValueOnce(result);

    await expect(
      anilistController.toggleFavourite(session, body),
    ).resolves.toEqual(result);

    expect(mockAnilistService.toggleFavourite).toHaveBeenCalledWith(
      session.user.id,
      body,
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
