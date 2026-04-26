import 'reflect-metadata';
import { faker } from '@faker-js/faker';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService, type UserSession } from '@thallesp/nestjs-better-auth';
import type { Request } from 'express';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ANILIST_PROVIDER_ID } from '../../common/constants/provider.constants.js';
import { getThrottlePolicyMetadata } from '../throttling/decorators/throttle.decorator.js';
import { UsersService } from './users.service.js';
import { UsersController } from './users.controller.js';

describe('UsersController', () => {
  let usersController: UsersController;

  const mockAuthService = {
    api: {
      listUserAccounts: vi.fn(),
    },
  };
  const mockUsersService = {
    getCurrentUserAnilistAccessToken: vi.fn(),
  };

  beforeAll(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: UsersService, useValue: mockUsersService },
      ],
    }).compile();

    usersController = app.get<UsersController>(UsersController);
  });

  beforeEach(() => {
    faker.seed(42);
    vi.clearAllMocks();
  });

  const getControllerHandler = (
    name: 'getProfile' | 'getAccounts' | 'getAnilistAccessToken',
  ) => {
    const descriptor = Reflect.getOwnPropertyDescriptor(
      UsersController.prototype,
      name,
    );

    if (!descriptor?.value) {
      throw new Error(`Expected UsersController.${name} handler`);
    }

    return descriptor.value as (...args: never[]) => unknown;
  };

  it('getProfile() should return session information', () => {
    const sessionId = faker.string.nanoid();
    const userId = faker.string.nanoid();
    const createdAt = new Date('2026-03-27T10:51:49.005Z');
    const updatedAt = new Date('2026-03-28T11:06:32.881Z');
    const expiresAt = new Date('2026-04-04T11:06:32.881Z');
    const userSession = {
      session: {
        id: sessionId,
        userId,
        userAgent: faker.internet.userAgent(),
        expiresAt,
        createdAt,
        updatedAt,
      },
      user: {
        id: userId,
        name: faker.internet.username(),
        email: faker.internet.email(),
        emailVerified: true,
        createdAt,
        updatedAt,
      },
    } as UserSession;

    expect(usersController.getProfile(userSession)).toEqual({
      session: {
        id: sessionId,
        userId,
        userAgent: userSession.session.userAgent,
        expiresAt,
        createdAt,
        updatedAt,
      },
      user: {
        id: userId,
        name: userSession.user.name,
        email: userSession.user.email,
        emailVerified: true,
        createdAt,
        updatedAt,
        image: undefined,
      },
    });
  });

  it('getAccounts() should return accounts linked to user', async () => {
    const accountRecordId = faker.string.nanoid();
    const providerAccountId = faker.string.nanoid();
    const userId = faker.string.nanoid();
    const createdAt = new Date('2026-03-27T10:51:49.005Z');
    const updatedAt = new Date('2026-03-28T11:06:32.881Z');

    const req = {
      headers: {
        cookie: `better-auth.session_token=${faker.string.alphanumeric(32)}`,
      },
    } as Request;

    mockAuthService.api.listUserAccounts.mockResolvedValueOnce([
      {
        id: accountRecordId,
        providerId: ANILIST_PROVIDER_ID,
        accountId: providerAccountId,
        userId,
        createdAt,
        updatedAt,
        scopes: ['profile', 'list'],
      },
    ]);

    await expect(usersController.getAccounts(req)).resolves.toEqual({
      accounts: [
        {
          id: accountRecordId,
          providerId: ANILIST_PROVIDER_ID,
          accountId: providerAccountId,
          userId,
          createdAt,
          updatedAt,
          scopes: ['profile', 'list'],
        },
      ],
    });
  });

  it('getAnilistAccessToken() should delegate to UsersService with the current user id', async () => {
    const userId = faker.string.nanoid();
    const session = {
      user: {
        id: userId,
      },
    } as UserSession;

    mockUsersService.getCurrentUserAnilistAccessToken.mockResolvedValueOnce({
      providerId: ANILIST_PROVIDER_ID,
      accessToken: 'anilist-access-token',
    });

    await expect(
      usersController.getAnilistAccessToken(session),
    ).resolves.toEqual({
      providerId: ANILIST_PROVIDER_ID,
      accessToken: 'anilist-access-token',
    });
    expect(
      mockUsersService.getCurrentUserAnilistAccessToken,
    ).toHaveBeenCalledWith(userId);
  });

  it('applies named throttle policies to the protected routes', () => {
    expect(getThrottlePolicyMetadata(getControllerHandler('getProfile'))).toBe(
      'authenticatedRead',
    );
    expect(getThrottlePolicyMetadata(getControllerHandler('getAccounts'))).toBe(
      'authenticatedRead',
    );
    expect(
      getThrottlePolicyMetadata(getControllerHandler('getAnilistAccessToken')),
    ).toBe('secret');
  });
});
