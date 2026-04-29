import { describe, expect, it } from 'vitest';

import { AnilistClientAuthError } from './errors.js';
import { requireAccessToken } from './auth.js';

describe('requireAccessToken', () => {
  it('trims surrounding whitespace from the access token', () => {
    expect(requireAccessToken('  session-token  ')).toBe('session-token');
  });

  it('rejects tokens that become empty after trimming', () => {
    expect(() => requireAccessToken('   ')).toThrow(AnilistClientAuthError);
  });
});
