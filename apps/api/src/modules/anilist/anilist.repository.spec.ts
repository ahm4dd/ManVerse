import 'reflect-metadata';
import { faker } from '@faker-js/faker';
import { Test, type TestingModule } from '@nestjs/testing';
import { AuthService } from '@thallesp/nestjs-better-auth';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AnilistAccountNotLinkedError,
  AnilistAccessTokenRelinkRequiredError,
} from './anilist.errors.js';
import { AnilistRepository } from './anilist.repository.js';

describe('AnilistRepository', () => {
  let repository: AnilistRepository;

  const mockAuthService = {
    api: {
      getAccessToken: vi.fn(),
    },
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        AnilistRepository,
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compile();

    repository = moduleRef.get(AnilistRepository);
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

    await expect(repository.getCurrentUserAccessToken(userId)).resolves.toBe(
      accessToken,
    );
  });

  it('throws the not-linked error when Better Auth cannot find an AniList account', async () => {
    mockAuthService.api.getAccessToken.mockRejectedValueOnce({
      body: {
        code: 'ACCOUNT_NOT_FOUND',
      },
    });

    await expect(
      repository.getCurrentUserAccessToken(faker.string.nanoid()),
    ).rejects.toBeInstanceOf(AnilistAccountNotLinkedError);
  });

  it('throws the relink-required error when Better Auth cannot retrieve the token', async () => {
    mockAuthService.api.getAccessToken.mockRejectedValueOnce({
      body: {
        code: 'FAILED_TO_GET_ACCESS_TOKEN',
      },
    });

    await expect(
      repository.getCurrentUserAccessToken(faker.string.nanoid()),
    ).rejects.toBeInstanceOf(AnilistAccessTokenRelinkRequiredError);
  });

  it.each(['', '   '])(
    'throws the relink-required error when Better Auth returns an empty access token: %p',
    async (accessToken) => {
      mockAuthService.api.getAccessToken.mockResolvedValueOnce({
        accessToken,
        accessTokenExpiresAt: undefined,
        scopes: [],
        idToken: undefined,
      });

      await expect(
        repository.getCurrentUserAccessToken(faker.string.nanoid()),
      ).rejects.toBeInstanceOf(AnilistAccessTokenRelinkRequiredError);
    },
  );
});
