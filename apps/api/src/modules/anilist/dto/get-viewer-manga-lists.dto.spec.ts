import { describe, expect, it } from 'vitest';

import { getViewerMangaListsQueryDtoSchema } from './get-viewer-manga-lists.dto.js';

describe('getViewerMangaListsQueryDtoSchema', () => {
  it('should coerce pagination query string values into the AniList viewer manga lists input shape', () => {
    const result = getViewerMangaListsQueryDtoSchema.parse({
      chunk: '2',
      perChunk: '50',
    });

    expect(result).toEqual({
      chunk: 2,
      perChunk: 50,
    });
  });

  it('should allow omitted pagination query values', () => {
    const result = getViewerMangaListsQueryDtoSchema.parse({});

    expect(result).toEqual({});
  });

  it('should reject invalid pagination values', () => {
    expect(() =>
      getViewerMangaListsQueryDtoSchema.parse({
        chunk: '0',
        perChunk: '501',
      }),
    ).toThrow();
  });
});
