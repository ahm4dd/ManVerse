import { describe, expect, it } from 'vitest';

import { saveMediaListEntryDtoSchema } from './save-media-list-entry.dto.js';

describe('saveMediaListEntryDtoSchema', () => {
  it('should parse a valid AniList save media list entry body', () => {
    const result = saveMediaListEntryDtoSchema.parse({
      mediaId: 151807,
      status: 'CURRENT',
      progress: 120,
      score: 8.5,
    });

    expect(result).toEqual({
      mediaId: 151807,
      status: 'CURRENT',
      progress: 120,
      score: 8.5,
    });
  });

  it('should require the minimum save media list entry fields', () => {
    const result = saveMediaListEntryDtoSchema.parse({
      mediaId: 151807,
      status: 'CURRENT',
    });

    expect(result).toEqual({
      mediaId: 151807,
      status: 'CURRENT',
    });
  });

  it('should reject invalid field values', () => {
    expect(() =>
      saveMediaListEntryDtoSchema.parse({
        mediaId: 0,
        status: 'INVALID',
        progress: -1,
      }),
    ).toThrow();
  });

  it('should reject scores outside the AniList 10-point decimal range', () => {
    expect(() =>
      saveMediaListEntryDtoSchema.parse({
        mediaId: 151807,
        status: 'CURRENT',
        score: 10.1,
      }),
    ).toThrow();
  });

  it('should not coerce JSON body values', () => {
    expect(() =>
      saveMediaListEntryDtoSchema.parse({
        mediaId: '151807',
        status: 'CURRENT',
        progress: '120',
      }),
    ).toThrow();
  });
});
