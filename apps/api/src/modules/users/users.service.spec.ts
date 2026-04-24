import 'reflect-metadata';
import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ANILIST_ACCOUNT_NOT_LINKED_MESSAGE,
  ANILIST_RELINK_REQUIRED_MESSAGE,
  AnilistAccessTokenRelinkRequiredError,
  AnilistAccountNotLinkedError,
} from '../../common/errors/anilist.errors.js';
import { UsersRepository } from './users.repository.js';
import { UsersService } from './users.service.js';

describe('UsersService', () => {
  const mockUsersRepository = {
    getCurrentUserAnilistAccessToken: vi.fn(),
  } as unknown as UsersRepository;

  const usersService = new UsersService(mockUsersRepository);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the AniList provider access token payload', async () => {
    mockUsersRepository.getCurrentUserAnilistAccessToken = vi
      .fn()
      .mockResolvedValueOnce('anilist-access-token');

    await expect(
      usersService.getCurrentUserAnilistAccessToken('user-123'),
    ).resolves.toEqual({
      providerId: 'anilist',
      accessToken: 'anilist-access-token',
    });
  });

  it('maps a missing AniList link to NotFoundException', async () => {
    mockUsersRepository.getCurrentUserAnilistAccessToken = vi
      .fn()
      .mockRejectedValueOnce(new AnilistAccountNotLinkedError());

    await expect(
      usersService.getCurrentUserAnilistAccessToken('user-123'),
    ).rejects.toEqual(
      new NotFoundException(ANILIST_ACCOUNT_NOT_LINKED_MESSAGE),
    );
  });

  it('maps a relink-required AniList token failure to NotFoundException', async () => {
    mockUsersRepository.getCurrentUserAnilistAccessToken = vi
      .fn()
      .mockRejectedValueOnce(new AnilistAccessTokenRelinkRequiredError());

    await expect(
      usersService.getCurrentUserAnilistAccessToken('user-123'),
    ).rejects.toEqual(new NotFoundException(ANILIST_RELINK_REQUIRED_MESSAGE));
  });
});
