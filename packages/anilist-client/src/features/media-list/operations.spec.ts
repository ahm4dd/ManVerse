import { beforeEach, describe, expect, it } from 'vitest';
import { ZodError } from 'zod';

import { AnilistClientAuthError } from '../../client/errors.js';
import {
  createMockGraphQLExecutor,
  type MockGraphQLExecutor,
} from '../../test-utils/graphql-executor.mock.js';
import { getViewerMangaLists } from './operations.js';
import {
  VIEWER_MANGA_LISTS_QUERY,
  VIEWER_MANGA_LISTS_VIEWER_QUERY,
} from './queries.js';
import type { ViewerMangaListCollection } from './schemas.js';

function createViewerMangaListCollection(): ViewerMangaListCollection {
  return {
    hasNextChunk: true,
    lists: [
      {
        name: 'Current',
        isCustomList: false,
        isSplitCompletedList: false,
        status: 'CURRENT',
        entries: [
          {
            id: 71,
            mediaId: 151807,
            status: 'CURRENT',
            score: 8.5,
            progress: 120,
            progressVolumes: 12,
            repeat: 0,
            priority: 1,
            private: false,
            hiddenFromStatusLists: false,
            notes: 'Caught up',
            updatedAt: 1_712_345_678,
            startedAt: {
              year: 2024,
              month: 1,
              day: 1,
            },
            completedAt: null,
            media: {
              id: 151807,
              idMal: null,
              title: {
                romaji: 'Solo Leveling',
                english: 'Solo Leveling',
                native: 'Na Honjaman Level Up',
                userPreferred: 'Solo Leveling',
              },
              coverImage: {
                extraLarge: 'https://example.com/cover-xl.jpg',
                large: 'https://example.com/cover-lg.jpg',
                medium: 'https://example.com/cover-md.jpg',
                color: '#0f172a',
              },
              format: 'NOVEL',
              status: 'RELEASING',
              chapters: null,
              volumes: null,
              countryOfOrigin: 'KR',
              siteUrl: 'https://anilist.co/manga/151807',
            },
          },
        ],
      },
      {
        name: 'All-Time Favorites',
        isCustomList: true,
        isSplitCompletedList: false,
        status: null,
        entries: [],
      },
    ],
  };
}

describe('media-list operations', () => {
  let executor: MockGraphQLExecutor;

  beforeEach(() => {
    executor = createMockGraphQLExecutor();
  });

  it('should request and return the viewer manga lists', async () => {
    const collection = createViewerMangaListCollection();

    executor.req
      .mockResolvedValueOnce({
        Viewer: {
          id: 42,
        },
      })
      .mockResolvedValueOnce({
        MediaListCollection: collection,
      });

    const result = await getViewerMangaLists(executor, 'viewer-token', {
      chunk: 2,
      perChunk: 50,
    });

    expect(executor.req).toHaveBeenCalledTimes(2);
    expect(executor.req).toHaveBeenNthCalledWith(1, {
      query: VIEWER_MANGA_LISTS_VIEWER_QUERY,
      operationName: 'ViewerId',
      accessToken: 'viewer-token',
    });
    expect(executor.req).toHaveBeenNthCalledWith(2, {
      query: VIEWER_MANGA_LISTS_QUERY,
      operationName: 'ViewerMangaLists',
      accessToken: 'viewer-token',
      variables: {
        userId: 42,
        chunk: 2,
        perChunk: 50,
      },
    });
    expect(result).toEqual(collection);
  });

  it('should allow omitted pagination input', async () => {
    executor.req
      .mockResolvedValueOnce({
        Viewer: {
          id: 42,
        },
      })
      .mockResolvedValueOnce({
        MediaListCollection: createViewerMangaListCollection(),
      });

    await getViewerMangaLists(executor, 'viewer-token');

    expect(executor.req).toHaveBeenNthCalledWith(2, {
      query: VIEWER_MANGA_LISTS_QUERY,
      operationName: 'ViewerMangaLists',
      accessToken: 'viewer-token',
      variables: {
        userId: 42,
        chunk: undefined,
        perChunk: undefined,
      },
    });
  });

  it('should return null when AniList returns no authenticated viewer', async () => {
    executor.req.mockResolvedValueOnce({
      Viewer: null,
    });

    const result = await getViewerMangaLists(executor, 'viewer-token', {
      chunk: 1,
      perChunk: 25,
    });

    expect(result).toBeNull();
    expect(executor.req).toHaveBeenCalledTimes(1);
  });

  it('should return null when AniList returns no manga list collection', async () => {
    executor.req
      .mockResolvedValueOnce({
        Viewer: {
          id: 42,
        },
      })
      .mockResolvedValueOnce({
        MediaListCollection: null,
      });

    const result = await getViewerMangaLists(executor, 'viewer-token');

    expect(result).toBeNull();
  });

  it('should reject missing viewer access token before calling the executor', async () => {
    await expect(getViewerMangaLists(executor, '')).rejects.toBeInstanceOf(
      AnilistClientAuthError,
    );

    expect(executor.req).not.toHaveBeenCalled();
  });

  it('should reject invalid pagination input before calling AniList list retrieval', async () => {
    await expect(
      getViewerMangaLists(executor, 'viewer-token', {
        chunk: 0,
      }),
    ).rejects.toBeInstanceOf(ZodError);

    expect(executor.req).not.toHaveBeenCalled();
  });

  it('should reject an invalid manga list payload', async () => {
    executor.req
      .mockResolvedValueOnce({
        Viewer: {
          id: 42,
        },
      })
      .mockResolvedValueOnce({
        MediaListCollection: {
          hasNextChunk: true,
          lists: [
            {
              name: 'Current',
              isCustomList: false,
              isSplitCompletedList: false,
              status: 'CURRENT',
              entries: [
                {
                  id: 'not-a-number',
                },
              ],
            },
          ],
        },
      });

    await expect(
      getViewerMangaLists(executor, 'viewer-token'),
    ).rejects.toBeInstanceOf(ZodError);
  });
});
