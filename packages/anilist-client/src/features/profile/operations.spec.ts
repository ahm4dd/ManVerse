import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';

import { AnilistClientAuthError } from '../../client/errors.js';
import type { GraphQLExecutor } from '../../types/httpclient.js';
import { getUserProfile, getViewerProfile } from './operations.js';
import { USER_PROFILE_QUERY, VIEWER_PROFILE_QUERY } from './queries.js';
import type { ProfileUser } from './schemas.js';

type MockExecutor = GraphQLExecutor & {
  req: ReturnType<typeof vi.fn>;
};

function createProfileUser(): ProfileUser {
  return {
    id: 1,
    name: 'ahm4dd',
    about: 'About text',
    bannerImage: 'https://example.com/banner.jpg',
    siteUrl: 'https://anilist.co/user/ahm4dd',
    createdAt: 1_712_345_678,
    avatar: {
      large: 'https://example.com/avatar.jpg',
    },
    favourites: {
      manga: {
        nodes: [
          {
            id: 101,
            chapters: 125,
            title: {
              romaji: 'Solo Leveling',
              english: 'Solo Leveling',
              native: null,
            },
            coverImage: {
              large: 'https://example.com/cover.jpg',
            },
          },
        ],
      },
    },
  };
}

describe('profile operations', () => {
  let executor: MockExecutor;

  beforeEach(() => {
    executor = {
      req: vi.fn(),
    } as MockExecutor;
  });

  it('should request and return the viewer profile', async () => {
    const viewer = createProfileUser();

    executor.req.mockResolvedValue({
      Viewer: viewer,
    });

    const result = await getViewerProfile(executor, 'viewer-token');

    expect(executor.req).toHaveBeenCalledTimes(1);
    expect(executor.req).toHaveBeenCalledWith({
      query: VIEWER_PROFILE_QUERY,
      operationName: 'ViewerProfile',
      accessToken: 'viewer-token',
    });
    expect(result).toEqual(viewer);
  });

  it('should return null when AniList returns no viewer', async () => {
    executor.req.mockResolvedValue({
      Viewer: null,
    });

    const result = await getViewerProfile(executor, 'viewer-token');

    expect(result).toBeNull();
  });

  it('should reject missing viewer access token before calling the executor', async () => {
    await expect(getViewerProfile(executor, '')).rejects.toBeInstanceOf(
      AnilistClientAuthError,
    );

    expect(executor.req).not.toHaveBeenCalled();
  });

  it('should reject an invalid viewer payload', async () => {
    executor.req.mockResolvedValue({
      Viewer: {
        id: 'not-a-number',
      },
    });

    await expect(
      getViewerProfile(executor, 'viewer-token'),
    ).rejects.toBeInstanceOf(ZodError);
  });

  it('should request and return a user profile by name', async () => {
    const user = createProfileUser();

    executor.req.mockResolvedValue({
      User: user,
    });

    const result = await getUserProfile(executor, {
      name: 'ahm4dd',
    });

    expect(executor.req).toHaveBeenCalledTimes(1);
    expect(executor.req).toHaveBeenCalledWith({
      query: USER_PROFILE_QUERY,
      operationName: 'UserProfile',
      variables: {
        id: undefined,
        name: 'ahm4dd',
      },
    });
    expect(result).toEqual(user);
  });

  it('should request and return a user profile by id', async () => {
    const user = createProfileUser();

    executor.req.mockResolvedValue({
      User: user,
    });

    const result = await getUserProfile(executor, {
      id: 42,
    });

    expect(executor.req).toHaveBeenCalledWith({
      query: USER_PROFILE_QUERY,
      operationName: 'UserProfile',
      variables: {
        id: 42,
        name: undefined,
      },
    });
    expect(result).toEqual(user);
  });

  it('should reject invalid input before calling the executor', async () => {
    await expect(getUserProfile(executor, {} as never)).rejects.toBeInstanceOf(
      ZodError,
    );

    expect(executor.req).not.toHaveBeenCalled();
  });

  it('should reject an invalid user payload', async () => {
    executor.req.mockResolvedValue({
      User: {
        id: 1,
        name: 'ahm4dd',
      },
    });

    await expect(
      getUserProfile(executor, { name: 'ahm4dd' }),
    ).rejects.toBeInstanceOf(ZodError);
  });
});
