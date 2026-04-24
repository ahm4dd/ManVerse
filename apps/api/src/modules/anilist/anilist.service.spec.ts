import 'reflect-metadata';
import type {
  DeleteMediaListEntryResult,
  SearchMediaPage,
  SaveMediaListEntry,
  ToggleFavouriteResult,
  ViewerMangaListCollection,
} from '@manverse/anilist-client';
import { faker } from '@faker-js/faker';
import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';
import {
  ANILIST_ACCOUNT_NOT_LINKED_MESSAGE,
  ANILIST_RELINK_REQUIRED_MESSAGE,
} from '../../lib/anilist-oauth.js';
import {
  AnilistAccountNotLinkedError,
  AnilistAccessTokenRelinkRequiredError,
} from './anilist.errors.js';
import { AnilistRepository } from './anilist.repository.js';
import { AnilistClient } from '@manverse/anilist-client';
import { AnilistService } from './anilist.service.js';
import type { SaveMediaListEntryDto } from './dto/save-media-list-entry.dto.js';
import type { GetViewerMangaListsQueryDto } from './dto/get-viewer-manga-lists.dto.js';
import type { GetUserQueryDto } from './dto/get-user.dto.js';
import type { SearchMediaDto } from './dto/search-media.dto.js';
import type { ToggleFavouriteDto } from './dto/toggle-favourite.dto.js';

describe('AnilistService', () => {
  let service: AnilistService;

  const mockAnilistClient = {
    getUserProfile: vi.fn(),
    getViewerProfile: vi.fn(),
    getViewerMangaLists: vi.fn(),
    saveMediaListEntry: vi.fn(),
    deleteMediaListEntry: vi.fn(),
    toggleFavourite: vi.fn(),
    searchMedia: vi.fn(),
  };
  const mockAnilistRepository = {
    getCurrentUserAccessToken: vi.fn(),
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        AnilistService,
        { provide: AnilistClient, useValue: mockAnilistClient },
        { provide: AnilistRepository, useValue: mockAnilistRepository },
      ],
    }).compile();

    service = moduleRef.get(AnilistService);
  });

  beforeEach(() => {
    faker.seed(42);
    vi.clearAllMocks();
  });

  it('getUser() should delegate a public AniList user lookup to the client', async () => {
    const query: GetUserQueryDto = {
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

    mockAnilistClient.getUserProfile.mockResolvedValueOnce(profile);

    await expect(service.getUser(query)).resolves.toEqual(profile);

    expect(mockAnilistClient.getUserProfile).toHaveBeenCalledWith(query);
    expect(
      mockAnilistRepository.getCurrentUserAccessToken,
    ).not.toHaveBeenCalled();
  });

  it('searchMedia() should delegate a public AniList search to the client', async () => {
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

    mockAnilistClient.searchMedia.mockResolvedValueOnce(result);

    await expect(service.searchMedia(query)).resolves.toEqual(result);

    expect(mockAnilistClient.searchMedia).toHaveBeenCalledWith(query);
    expect(
      mockAnilistRepository.getCurrentUserAccessToken,
    ).not.toHaveBeenCalled();
  });

  it('getViewer() should resolve the current user access token before calling the client', async () => {
    const userId = faker.string.nanoid();
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

    mockAnilistRepository.getCurrentUserAccessToken.mockResolvedValueOnce(
      accessToken,
    );
    mockAnilistClient.getViewerProfile.mockResolvedValueOnce(profile);

    await expect(service.getViewer(userId)).resolves.toEqual(profile);

    expect(
      mockAnilistRepository.getCurrentUserAccessToken,
    ).toHaveBeenCalledWith(userId);
    expect(mockAnilistClient.getViewerProfile).toHaveBeenCalledWith(
      accessToken,
    );
  });

  it('getViewerMangaLists() should resolve the current user access token before calling the client', async () => {
    const userId = faker.string.nanoid();
    const accessToken = faker.string.alphanumeric(32);
    const query: GetViewerMangaListsQueryDto = {
      chunk: 2,
      perChunk: 50,
    };
    const collection: ViewerMangaListCollection = {
      hasNextChunk: true,
      lists: [],
    };

    mockAnilistRepository.getCurrentUserAccessToken.mockResolvedValueOnce(
      accessToken,
    );
    mockAnilistClient.getViewerMangaLists.mockResolvedValueOnce(collection);

    await expect(service.getViewerMangaLists(userId, query)).resolves.toEqual(
      collection,
    );

    expect(
      mockAnilistRepository.getCurrentUserAccessToken,
    ).toHaveBeenCalledWith(userId);
    expect(mockAnilistClient.getViewerMangaLists).toHaveBeenCalledWith(
      accessToken,
      query,
    );
  });

  it('getViewerMangaLists() should preserve null when AniList has no manga list collection', async () => {
    const userId = faker.string.nanoid();
    const accessToken = faker.string.alphanumeric(32);

    mockAnilistRepository.getCurrentUserAccessToken.mockResolvedValueOnce(
      accessToken,
    );
    mockAnilistClient.getViewerMangaLists.mockResolvedValueOnce(null);

    await expect(service.getViewerMangaLists(userId, {})).resolves.toBeNull();
  });

  it('getViewerMangaLists() should reject malformed manga list payloads from the client', async () => {
    const userId = faker.string.nanoid();
    const accessToken = faker.string.alphanumeric(32);

    mockAnilistRepository.getCurrentUserAccessToken.mockResolvedValueOnce(
      accessToken,
    );
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
            },
          ],
        },
      ],
    });

    await expect(
      service.getViewerMangaLists(userId, {}),
    ).rejects.toBeInstanceOf(ZodError);
  });

  it('saveMediaListEntry() should resolve the current user access token before calling the client', async () => {
    const userId = faker.string.nanoid();
    const accessToken = faker.string.alphanumeric(32);
    const input: SaveMediaListEntryDto = {
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

    mockAnilistRepository.getCurrentUserAccessToken.mockResolvedValueOnce(
      accessToken,
    );
    mockAnilistClient.saveMediaListEntry.mockResolvedValueOnce(result);

    await expect(service.saveMediaListEntry(userId, input)).resolves.toEqual(
      result,
    );

    expect(
      mockAnilistRepository.getCurrentUserAccessToken,
    ).toHaveBeenCalledWith(userId);
    expect(mockAnilistClient.saveMediaListEntry).toHaveBeenCalledWith(
      accessToken,
      input,
    );
  });

  it('deleteMediaListEntry() should resolve the current user access token before calling the client', async () => {
    const userId = faker.string.nanoid();
    const accessToken = faker.string.alphanumeric(32);
    const result: DeleteMediaListEntryResult = {
      entryId: 71,
      deleted: true,
    };

    mockAnilistRepository.getCurrentUserAccessToken.mockResolvedValueOnce(
      accessToken,
    );
    mockAnilistClient.deleteMediaListEntry.mockResolvedValueOnce(result);

    await expect(service.deleteMediaListEntry(userId, 71)).resolves.toEqual(
      result,
    );

    expect(
      mockAnilistRepository.getCurrentUserAccessToken,
    ).toHaveBeenCalledWith(userId);
    expect(mockAnilistClient.deleteMediaListEntry).toHaveBeenCalledWith(
      accessToken,
      { entryId: 71 },
    );
  });

  it('toggleFavourite() should resolve the current user access token before calling the client', async () => {
    const userId = faker.string.nanoid();
    const accessToken = faker.string.alphanumeric(32);
    const input: ToggleFavouriteDto = {
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

    mockAnilistRepository.getCurrentUserAccessToken.mockResolvedValueOnce(
      accessToken,
    );
    mockAnilistClient.toggleFavourite.mockResolvedValueOnce(result);

    await expect(service.toggleFavourite(userId, input)).resolves.toEqual(
      result,
    );

    expect(
      mockAnilistRepository.getCurrentUserAccessToken,
    ).toHaveBeenCalledWith(userId);
    expect(mockAnilistClient.toggleFavourite).toHaveBeenCalledWith(
      accessToken,
      input,
    );
  });

  it('getViewer() should translate a missing AniList account into a 404', async () => {
    mockAnilistRepository.getCurrentUserAccessToken.mockRejectedValueOnce(
      new AnilistAccountNotLinkedError(),
    );

    await expect(service.getViewer(faker.string.nanoid())).rejects.toThrow(
      new NotFoundException(ANILIST_ACCOUNT_NOT_LINKED_MESSAGE),
    );

    expect(mockAnilistClient.getViewerProfile).not.toHaveBeenCalled();
  });

  it('getViewerMangaLists() should translate a relink-required repository error into a 404', async () => {
    mockAnilistRepository.getCurrentUserAccessToken.mockRejectedValueOnce(
      new AnilistAccessTokenRelinkRequiredError(),
    );

    await expect(
      service.getViewerMangaLists(faker.string.nanoid(), {}),
    ).rejects.toThrow(new NotFoundException(ANILIST_RELINK_REQUIRED_MESSAGE));

    expect(mockAnilistClient.getViewerMangaLists).not.toHaveBeenCalled();
  });

  it('saveMediaListEntry() should translate a relink-required repository error into a 404', async () => {
    mockAnilistRepository.getCurrentUserAccessToken.mockRejectedValueOnce(
      new AnilistAccessTokenRelinkRequiredError(),
    );

    await expect(
      service.saveMediaListEntry(faker.string.nanoid(), {
        mediaId: 151807,
        status: 'CURRENT',
        progress: 120,
      }),
    ).rejects.toThrow(new NotFoundException(ANILIST_RELINK_REQUIRED_MESSAGE));

    expect(mockAnilistClient.saveMediaListEntry).not.toHaveBeenCalled();
  });

  it('deleteMediaListEntry() should translate a missing AniList account into a 404', async () => {
    mockAnilistRepository.getCurrentUserAccessToken.mockRejectedValueOnce(
      new AnilistAccountNotLinkedError(),
    );

    await expect(
      service.deleteMediaListEntry(faker.string.nanoid(), 71),
    ).rejects.toThrow(
      new NotFoundException(ANILIST_ACCOUNT_NOT_LINKED_MESSAGE),
    );

    expect(mockAnilistClient.deleteMediaListEntry).not.toHaveBeenCalled();
  });

  it('toggleFavourite() should translate a relink-required repository error into a 404', async () => {
    mockAnilistRepository.getCurrentUserAccessToken.mockRejectedValueOnce(
      new AnilistAccessTokenRelinkRequiredError(),
    );

    await expect(
      service.toggleFavourite(faker.string.nanoid(), { mediaId: 151807 }),
    ).rejects.toThrow(new NotFoundException(ANILIST_RELINK_REQUIRED_MESSAGE));

    expect(mockAnilistClient.toggleFavourite).not.toHaveBeenCalled();
  });
});
