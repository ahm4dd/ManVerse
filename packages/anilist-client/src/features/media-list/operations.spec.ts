import { beforeEach, describe, expect, it } from 'vitest';
import { ZodError } from 'zod';

import { AnilistClientAuthError } from '../../client/errors.js';
import {
  createMockGraphQLExecutor,
  type MockGraphQLExecutor,
} from '../../test-utils/graphql-executor.mock.js';
import {
  deleteMediaListEntry,
  getViewerMangaLists,
  saveMediaListEntry,
} from './operations.js';
import {
  DELETE_MEDIA_LIST_ENTRY_MUTATION,
  SAVE_MEDIA_LIST_ENTRY_MUTATION,
  VIEWER_MANGA_LISTS_QUERY,
  VIEWER_MANGA_LISTS_VIEWER_QUERY,
} from './queries.js';
import type {
  SaveMediaListEntry as SaveMediaListEntryResult,
  ViewerMangaListCollection,
} from './schemas.js';

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

function createSaveMediaListEntryResult(): SaveMediaListEntryResult {
  return {
    id: 71,
    mediaId: 151807,
    status: 'CURRENT',
    score: 8.5,
    progress: 120,
    media: {
      id: 151807,
      title: {
        romaji: 'Solo Leveling',
        english: 'Solo Leveling',
        native: 'Na Honjaman Level Up',
        userPreferred: 'Solo Leveling',
      },
    },
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

  it('should save and return the media list entry', async () => {
    const entry = createSaveMediaListEntryResult();

    executor.req.mockResolvedValueOnce({
      SaveMediaListEntry: entry,
    });

    const result = await saveMediaListEntry(executor, 'viewer-token', {
      mediaId: 151807,
      status: 'CURRENT',
      progress: 120,
      score: 8.5,
    });

    expect(executor.req).toHaveBeenCalledWith({
      query: SAVE_MEDIA_LIST_ENTRY_MUTATION,
      operationName: 'SaveMediaListEntry',
      accessToken: 'viewer-token',
      variables: {
        mediaId: 151807,
        status: 'CURRENT',
        progress: 120,
        score: 8.5,
      },
    });
    expect(result).toEqual(entry);
  });

  it('should allow an omitted score when saving a media list entry', async () => {
    executor.req.mockResolvedValueOnce({
      SaveMediaListEntry: createSaveMediaListEntryResult(),
    });

    await saveMediaListEntry(executor, 'viewer-token', {
      mediaId: 151807,
      status: 'CURRENT',
      progress: 120,
    });

    expect(executor.req).toHaveBeenCalledWith({
      query: SAVE_MEDIA_LIST_ENTRY_MUTATION,
      operationName: 'SaveMediaListEntry',
      accessToken: 'viewer-token',
      variables: {
        mediaId: 151807,
        status: 'CURRENT',
        progress: 120,
        score: undefined,
      },
    });
  });

  it('should allow omitted progress when saving a media list entry', async () => {
    executor.req.mockResolvedValueOnce({
      SaveMediaListEntry: {
        ...createSaveMediaListEntryResult(),
        progress: null,
      },
    });

    await saveMediaListEntry(executor, 'viewer-token', {
      mediaId: 151807,
      status: 'CURRENT',
      score: 8.5,
    });

    expect(executor.req).toHaveBeenCalledWith({
      query: SAVE_MEDIA_LIST_ENTRY_MUTATION,
      operationName: 'SaveMediaListEntry',
      accessToken: 'viewer-token',
      variables: {
        mediaId: 151807,
        status: 'CURRENT',
        progress: undefined,
        score: 8.5,
      },
    });
  });

  it('should return null when AniList returns no saved entry', async () => {
    executor.req.mockResolvedValueOnce({
      SaveMediaListEntry: null,
    });

    const result = await saveMediaListEntry(executor, 'viewer-token', {
      mediaId: 151807,
      status: 'CURRENT',
      progress: 120,
    });

    expect(result).toBeNull();
  });

  it('should reject a missing access token before saving a media list entry', async () => {
    await expect(
      saveMediaListEntry(executor, '', {
        mediaId: 151807,
        status: 'CURRENT',
        progress: 120,
      }),
    ).rejects.toBeInstanceOf(AnilistClientAuthError);

    expect(executor.req).not.toHaveBeenCalled();
  });

  it('should reject invalid save-media-list-entry input before calling the executor', async () => {
    await expect(
      saveMediaListEntry(executor, 'viewer-token', {
        mediaId: 0,
        status: 'CURRENT',
        progress: -1,
      }),
    ).rejects.toBeInstanceOf(ZodError);

    expect(executor.req).not.toHaveBeenCalled();
  });

  it('should reject scores outside the AniList POINT_10_DECIMAL range', async () => {
    await expect(
      saveMediaListEntry(executor, 'viewer-token', {
        mediaId: 151807,
        status: 'CURRENT',
        score: 10.1,
      }),
    ).rejects.toBeInstanceOf(ZodError);

    expect(executor.req).not.toHaveBeenCalled();
  });

  it('should reject an invalid saved entry payload', async () => {
    executor.req.mockResolvedValueOnce({
      SaveMediaListEntry: {
        id: 'not-a-number',
      },
    });

    await expect(
      saveMediaListEntry(executor, 'viewer-token', {
        mediaId: 151807,
        status: 'CURRENT',
        progress: 120,
      }),
    ).rejects.toBeInstanceOf(ZodError);
  });

  it('should delete and return the entry deletion result', async () => {
    executor.req.mockResolvedValueOnce({
      DeleteMediaListEntry: {
        deleted: true,
      },
    });

    const result = await deleteMediaListEntry(executor, 'viewer-token', {
      entryId: 71,
    });

    expect(executor.req).toHaveBeenCalledWith({
      query: DELETE_MEDIA_LIST_ENTRY_MUTATION,
      operationName: 'DeleteMediaListEntry',
      accessToken: 'viewer-token',
      variables: {
        id: 71,
      },
    });
    expect(result).toEqual({
      entryId: 71,
      deleted: true,
    });
  });

  it('should reject a missing access token before deleting a media list entry', async () => {
    await expect(
      deleteMediaListEntry(executor, '', {
        entryId: 71,
      }),
    ).rejects.toBeInstanceOf(AnilistClientAuthError);

    expect(executor.req).not.toHaveBeenCalled();
  });

  it('should reject invalid delete-media-list-entry input before calling the executor', async () => {
    await expect(
      deleteMediaListEntry(executor, 'viewer-token', {
        entryId: 0,
      }),
    ).rejects.toBeInstanceOf(ZodError);

    expect(executor.req).not.toHaveBeenCalled();
  });

  it('should reject an invalid deletion payload', async () => {
    executor.req.mockResolvedValueOnce({
      DeleteMediaListEntry: {
        deleted: 'yes',
      },
    });

    await expect(
      deleteMediaListEntry(executor, 'viewer-token', {
        entryId: 71,
      }),
    ).rejects.toBeInstanceOf(ZodError);
  });
});
