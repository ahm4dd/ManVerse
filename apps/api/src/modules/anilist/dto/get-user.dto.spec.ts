import { describe, expect, it } from 'vitest';
import { getUserQueryDtoSchema } from './get-user.dto.js';

describe('getUserQueryDtoSchema', () => {
  it('parses a lookup by id', () => {
    const result = getUserQueryDtoSchema.parse({
      id: '7407199',
    });

    expect(result).toEqual({
      id: 7_407_199,
    });
  });

  it('parses a lookup by name', () => {
    const result = getUserQueryDtoSchema.parse({
      name: 'ahm4dd',
    });

    expect(result).toEqual({
      name: 'ahm4dd',
    });
  });

  it('trims surrounding whitespace from the lookup name', () => {
    const result = getUserQueryDtoSchema.parse({
      name: '  ahm4dd  ',
    });

    expect(result).toEqual({
      name: 'ahm4dd',
    });
  });

  it('fails when neither id nor name is provided', () => {
    const result = getUserQueryDtoSchema.safeParse({});

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.issues[0]?.code).toBe('custom');
      expect(result.error.issues[0]?.message).toBe(
        'AniList requires at least one query argument: id or name.',
      );
    }
  });

  it('fails when the provided lookup name is only whitespace', () => {
    const result = getUserQueryDtoSchema.safeParse({
      name: '   ',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        'AniList requires at least one query argument: id or name.',
      );
    }
  });
});
