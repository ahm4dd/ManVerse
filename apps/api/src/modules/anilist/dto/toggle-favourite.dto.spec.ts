import { describe, expect, it } from 'vitest';

import { toggleFavouriteDtoSchema } from './toggle-favourite.dto.js';

describe('toggleFavouriteDtoSchema', () => {
  it('should parse a valid AniList toggle favourite body', () => {
    const result = toggleFavouriteDtoSchema.parse({
      mediaId: 151807,
    });

    expect(result).toEqual({
      mediaId: 151807,
    });
  });

  it('should require a positive media id', () => {
    expect(() =>
      toggleFavouriteDtoSchema.parse({
        mediaId: 0,
      }),
    ).toThrow();
  });

  it('should not coerce JSON body values', () => {
    expect(() =>
      toggleFavouriteDtoSchema.parse({
        mediaId: '151807',
      }),
    ).toThrow();
  });
});
