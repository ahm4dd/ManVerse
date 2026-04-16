import 'reflect-metadata';
import { faker } from '@faker-js/faker';
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '@thallesp/nestjs-better-auth';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ANILIST_ACCOUNT_NOT_LINKED_MESSAGE,
  ANILIST_RELINK_REQUIRED_MESSAGE,
} from '../../lib/anilist-oauth.js';
import { AnilistAccountService } from './anilist-account.service.js';

describe('AnilistAccountService', () => {
  let service: AnilistAccountService;

  const mockAuthService = {
    api: {
      getAccessToken: vi.fn(),
    },
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        AnilistAccountService,
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compile();

    service = moduleRef.get(AnilistAccountService);
  });

  beforeEach(() => {
    faker.seed(42);
    vi.clearAllMocks();
  });

  it('returns the AniList access token when Better Auth resolves it', async () => {
    const userId = faker.string.nanoid();
    const accessToken = faker.string.alphanumeric(32);

    mockAuthService.api.getAccessToken.mockResolvedValueOnce({
      accessToken,
      accessTokenExpiresAt: undefined,
      scopes: [],
      idToken: undefined,
    });

    await expect(service.getCurrentUserAccessToken(userId)).resolves.toBe(
      accessToken,
    );
  });

  it('throws the not-linked 404 when Better Auth cannot find an AniList account', async () => {
    mockAuthService.api.getAccessToken.mockRejectedValueOnce({
      body: {
        code: 'ACCOUNT_NOT_FOUND',
      },
    });

    await expect(
      service.getCurrentUserAccessToken(faker.string.nanoid()),
    ).rejects.toThrow(
      new NotFoundException(ANILIST_ACCOUNT_NOT_LINKED_MESSAGE),
    );
  });

  it('throws the relink-required 404 when Better Auth cannot retrieve the token', async () => {
    mockAuthService.api.getAccessToken.mockRejectedValueOnce({
      body: {
        code: 'FAILED_TO_GET_ACCESS_TOKEN',
      },
    });

    await expect(
      service.getCurrentUserAccessToken(faker.string.nanoid()),
    ).rejects.toThrow(new NotFoundException(ANILIST_RELINK_REQUIRED_MESSAGE));
  });

  it('throws the relink-required 404 when Better Auth returns an empty access token', async () => {
    mockAuthService.api.getAccessToken.mockResolvedValueOnce({
      accessToken: '',
      accessTokenExpiresAt: undefined,
      scopes: [],
      idToken: undefined,
    });

    await expect(
      service.getCurrentUserAccessToken(faker.string.nanoid()),
    ).rejects.toThrow(new NotFoundException(ANILIST_RELINK_REQUIRED_MESSAGE));
  });
});
