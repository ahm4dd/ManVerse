import 'reflect-metadata';
import { faker } from '@faker-js/faker';
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ANILIST_PROVIDER_ID } from '../../common/constants/provider.constants.js';
import { PrismaClient } from '../../generated/prisma/client.js';
import { AnilistController } from './anilist.controller.js';

describe('AnilistController', () => {
  let anilistController: AnilistController;

  const mockAnilistClient = {
    getUserProfile: vi.fn(),
    getViewerProfile: vi.fn(),
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
});
