import { describe, expect, it } from 'vitest';

import { searchMediaQueryDtoSchema } from './search-media.dto.js';

describe('searchMediaQueryDtoSchema', () => {
  it('should coerce query string values into the AniList search input shape', () => {
    const result = searchMediaQueryDtoSchema.parse({
      search: 'solo leveling',
      page: '2',
      perPage: '5',
      isAdult: 'false',
    });

    expect(result).toEqual({
      search: 'solo leveling',
      page: 2,
      perPage: 5,
      isAdult: false,
    });
  });

  it('should apply shared defaults when optional query values are omitted', () => {
    const result = searchMediaQueryDtoSchema.parse({
      search: 'solo leveling',
    });

    expect(result).toEqual({
      search: 'solo leveling',
      page: 1,
      perPage: 10,
      isAdult: false,
    });
  });
});
