import { beforeEach, describe, expect, expectTypeOf, it } from 'vitest';
import { ZodError } from 'zod';

import {
  createMockGraphQLExecutor,
  type MockGraphQLExecutor,
} from '../../test-utils/graphql-executor.mock.js';
import { searchMedia } from './operations.js';
import { SEARCH_MEDIA_QUERY } from './queries.js';
import type { SearchMediaInput, SearchMediaPage } from './schemas.js';

function createSearchMediaPage(): SearchMediaPage {
  return {
    pageInfo: {
      currentPage: 1,
      hasNextPage: true,
      lastPage: 10,
      perPage: 10,
      total: 100,
    },
    media: [
      {
        id: 1,
        idMal: 12345,
        type: 'MANGA',
        format: 'MANGA',
        status: 'RELEASING',
        description: 'A sample manga',
        startDate: {
          year: 2018,
          month: 1,
          day: 1,
        },
        endDate: {
          year: null,
          month: null,
          day: null,
        },
        season: null,
        seasonYear: 2018,
        chapters: 100,
        volumes: 10,
        countryOfOrigin: 'JP',
        source: 'MANGA',
        coverImage: {
          extraLarge: 'https://example.com/cover-xl.jpg',
          large: 'https://example.com/cover-lg.jpg',
          medium: 'https://example.com/cover-md.jpg',
          color: '#ffffff',
        },
        bannerImage: 'https://example.com/banner.jpg',
        title: {
          romaji: 'Sample Manga',
          english: 'Sample Manga',
          native: 'サンプル漫画',
          userPreferred: 'Sample Manga',
        },
        synonyms: ['Sample'],
        genres: ['Action', 'Drama'],
        tags: [
          {
            id: 1,
            name: 'Martial Arts',
            rank: 80,
            isGeneralSpoiler: false,
            isMediaSpoiler: false,
            category: 'Theme',
          },
        ],
        averageScore: 85,
        meanScore: 84,
        popularity: 1000,
        favourites: 50,
        trending: 12,
        isAdult: false,
        siteUrl: 'https://anilist.co/manga/1',
        relations: {
          edges: [
            {
              relationType: 'SEQUEL',
              node: {
                id: 2,
                type: 'MANGA',
                format: 'MANGA',
                status: 'NOT_YET_RELEASED',
                chapters: null,
                volumes: null,
                countryOfOrigin: 'JP',
                title: {
                  romaji: 'Sample Manga 2',
                  english: 'Sample Manga 2',
                  native: 'サンプル漫画2',
                  userPreferred: 'Sample Manga 2',
                },
                coverImage: {
                  large: 'https://example.com/cover-2-lg.jpg',
                  medium: 'https://example.com/cover-2-md.jpg',
                },
                siteUrl: 'https://anilist.co/manga/2',
              },
            },
          ],
        },
      },
    ],
  };
}

describe('search operations', () => {
  let executor: MockGraphQLExecutor;

  beforeEach(() => {
    executor = createMockGraphQLExecutor();
  });

  it('should allow callers to omit defaulted pagination inputs', () => {
    expectTypeOf<SearchMediaInput>().toMatchTypeOf<{
      search: string;
      page?: number;
      perPage?: number;
      isAdult?: boolean;
    }>();
  });

  it('should request and return search media results', async () => {
    const page = createSearchMediaPage();

    executor.req.mockResolvedValue({
      Page: page,
    });

    const result = await searchMedia(executor, {
      search: 'solo leveling',
      page: 2,
      perPage: 5,
      isAdult: true,
    });

    expect(executor.req).toHaveBeenCalledTimes(1);
    expect(executor.req).toHaveBeenCalledWith({
      query: SEARCH_MEDIA_QUERY,
      operationName: 'SearchMedia',
      variables: {
        search: 'solo leveling',
        page: 2,
        perPage: 5,
        isAdult: true,
      },
    });
    expect(result).toEqual(page);
  });

  it('should apply default pagination values', async () => {
    executor.req.mockResolvedValue({
      Page: createSearchMediaPage(),
    });

    await searchMedia(executor, {
      search: 'solo leveling',
    });

    expect(executor.req).toHaveBeenCalledWith({
      query: SEARCH_MEDIA_QUERY,
      operationName: 'SearchMedia',
      variables: {
        search: 'solo leveling',
        page: 1,
        perPage: 10,
        isAdult: false,
      },
    });
  });

  it('should return null when AniList returns no page', async () => {
    executor.req.mockResolvedValue({
      Page: null,
    });

    const result = await searchMedia(executor, {
      search: 'solo leveling',
    });

    expect(result).toBeNull();
  });

  it('should reject invalid input before calling the executor', async () => {
    await expect(searchMedia(executor, {} as never)).rejects.toBeInstanceOf(
      ZodError,
    );

    expect(executor.req).not.toHaveBeenCalled();
  });

  it('should reject an invalid search payload', async () => {
    executor.req.mockResolvedValue({
      Page: {
        pageInfo: {
          currentPage: 1,
          hasNextPage: true,
          lastPage: 10,
          perPage: 10,
          total: 100,
        },
        media: [
          {
            id: 'not-a-number',
          },
        ],
      },
    });

    await expect(
      searchMedia(executor, {
        search: 'solo leveling',
      }),
    ).rejects.toBeInstanceOf(ZodError);
  });
});
