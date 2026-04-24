import 'reflect-metadata';
import { AuthService } from '@thallesp/nestjs-better-auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AnilistAccessTokenRelinkRequiredError,
  AnilistAccountNotLinkedError,
} from '../../common/errors/anilist.errors.js';
import auth from '../../lib/auth.js';
import { UsersRepository } from './users.repository.js';

describe('UsersRepository', () => {
  const mockGetAccessToken = vi.fn();
  const mockAuthService = {
    api: {
      getAccessToken: mockGetAccessToken,
    },
  } as unknown as AuthService<typeof auth>;

  const repository = new UsersRepository(mockAuthService);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the current user AniList access token when Better Auth resolves it', async () => {
    mockGetAccessToken.mockResolvedValueOnce({
      accessToken: 'anilist-access-token',
    });

    await expect(
      repository.getCurrentUserAnilistAccessToken('user-123'),
    ).resolves.toBe('anilist-access-token');
    expect(mockGetAccessToken).toHaveBeenCalledWith({
      body: {
        providerId: 'anilist',
        userId: 'user-123',
      },
    });
  });

  it('throws AnilistAccountNotLinkedError when Better Auth reports ACCOUNT_NOT_FOUND', async () => {
    mockGetAccessToken.mockRejectedValueOnce({
      body: {
        code: 'ACCOUNT_NOT_FOUND',
      },
    });

    await expect(
      repository.getCurrentUserAnilistAccessToken('user-123'),
    ).rejects.toBeInstanceOf(AnilistAccountNotLinkedError);
  });

  it('throws AnilistAccessTokenRelinkRequiredError when Better Auth reports FAILED_TO_GET_ACCESS_TOKEN', async () => {
    mockGetAccessToken.mockRejectedValueOnce({
      body: {
        code: 'FAILED_TO_GET_ACCESS_TOKEN',
      },
    });

    await expect(
      repository.getCurrentUserAnilistAccessToken('user-123'),
    ).rejects.toBeInstanceOf(AnilistAccessTokenRelinkRequiredError);
  });

  it('throws AnilistAccessTokenRelinkRequiredError when Better Auth returns a blank access token', async () => {
    mockGetAccessToken.mockResolvedValueOnce({
      accessToken: '   ',
    });

    await expect(
      repository.getCurrentUserAnilistAccessToken('user-123'),
    ).rejects.toBeInstanceOf(AnilistAccessTokenRelinkRequiredError);
  });
});
