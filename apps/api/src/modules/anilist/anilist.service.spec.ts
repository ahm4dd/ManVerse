import 'reflect-metadata';
import type {
  SearchMediaPage,
  ViewerMangaListCollection,
} from '@manverse/anilist-client';
import { faker } from '@faker-js/faker';
import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
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
import type { GetViewerMangaListsQueryDto } from './dto/get-viewer-manga-lists.dto.js';
import type { GetUserQueryDto } from './dto/get-user.dto.js';
import type { SearchMediaDto } from './dto/search-media.dto.js';

describe('AnilistService', () => {
  let service: AnilistService;

  const mockAnilistClient = {
    getUserProfile: vi.fn(),
    getViewerProfile: vi.fn(),
    getViewerMangaLists: vi.fn(),
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
});
