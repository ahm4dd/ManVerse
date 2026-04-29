import { beforeEach, describe, expect, it } from 'vitest';
import { ZodError } from 'zod';

import { AnilistClientAuthError } from '../../client/errors.js';
import {
  createMockGraphQLExecutor,
  type MockGraphQLExecutor,
} from '../../test-utils/graphql-executor.mock.js';
import { toggleFavourite } from './operations.js';
import { TOGGLE_FAVOURITE_MUTATION } from './queries.js';

describe('toggle-favourite operations', () => {
  let executor: MockGraphQLExecutor;

  beforeEach(() => {
    executor = createMockGraphQLExecutor();
  });

  it('should toggle and return a favourite result when the media is now favourited', async () => {
    executor.req.mockResolvedValueOnce({
      ToggleFavourite: {
        manga: {
          nodes: [
            {
              id: 151807,
              title: {
                romaji: 'Solo Leveling',
                english: 'Solo Leveling',
                native: 'Na Honjaman Level Up',
                userPreferred: 'Solo Leveling',
              },
            },
          ],
        },
      },
    });

    const result = await toggleFavourite(executor, 'viewer-token', {
      mediaId: 151807,
    });

    expect(executor.req).toHaveBeenCalledWith({
      query: TOGGLE_FAVOURITE_MUTATION,
      operationName: 'ToggleFavourite',
      accessToken: 'viewer-token',
      variables: {
        mangaId: 151807,
      },
    });
    expect(result).toEqual({
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
    });
  });

  it('should return an unfavourited result when the media is absent from the returned favourites list', async () => {
    executor.req.mockResolvedValueOnce({
      ToggleFavourite: {
        manga: {
          nodes: [],
        },
      },
    });

    const result = await toggleFavourite(executor, 'viewer-token', {
      mediaId: 151807,
    });

    expect(result).toEqual({
      mediaId: 151807,
      isFavourite: false,
      media: null,
    });
  });

  it('should reject a missing access token before calling the executor', async () => {
    await expect(
      toggleFavourite(executor, '', {
        mediaId: 151807,
      }),
    ).rejects.toBeInstanceOf(AnilistClientAuthError);

    expect(executor.req).not.toHaveBeenCalled();
  });

  it('should reject invalid input before calling the executor', async () => {
    await expect(
      toggleFavourite(executor, 'viewer-token', {
        mediaId: 0,
      }),
    ).rejects.toBeInstanceOf(ZodError);

    expect(executor.req).not.toHaveBeenCalled();
  });

  it('should reject an invalid toggle favourite payload', async () => {
    executor.req.mockResolvedValueOnce({
      ToggleFavourite: {
        manga: {
          nodes: [
            {
              id: 'not-a-number',
            },
          ],
        },
      },
    });

    await expect(
      toggleFavourite(executor, 'viewer-token', {
        mediaId: 151807,
      }),
    ).rejects.toBeInstanceOf(ZodError);
  });
});
