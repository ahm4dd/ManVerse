import { describe, expect, it } from 'vitest';

import { deleteMediaListEntryParamsDtoSchema } from './delete-media-list-entry.dto.js';

describe('deleteMediaListEntryParamsDtoSchema', () => {
  it('should coerce the route param into the AniList delete input shape', () => {
    const result = deleteMediaListEntryParamsDtoSchema.parse({
      entryId: '71',
    });

    expect(result).toEqual({
      entryId: 71,
    });
  });

  it('should reject an invalid entry id', () => {
    expect(() =>
      deleteMediaListEntryParamsDtoSchema.parse({
        entryId: '0',
      }),
    ).toThrow();
  });
});
