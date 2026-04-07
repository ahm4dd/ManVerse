import 'reflect-metadata';
import { faker } from '@faker-js/faker';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService, type UserSession } from '@thallesp/nestjs-better-auth';
import type { Request } from 'express';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ANILIST_PROVIDER_ID } from '../../common/constants/provider.constants.js';
import { UsersController } from './users.controller.js';

describe('UsersController', () => {
  let usersController: UsersController;

  const mockAuthService = {
    api: {
      listUserAccounts: vi.fn(),
    },
  };

  beforeAll(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    usersController = app.get<UsersController>(UsersController);
  });

  beforeEach(() => {
    faker.seed(42);
    vi.clearAllMocks();
  });

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
});
