import { describe, expect, it } from 'vitest';
import { envSchema, parseEnvironmentVariables } from './env.js';

const baseEnv = {
  NODE_ENV: 'development',
  PORT: '3000',
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/manverse',
  BETTER_AUTH_SECRET: Buffer.from('test-secret').toString('base64'),
  BETTER_AUTH_URL: 'http://localhost:3000',
  ANILIST_IDENTITY_SALT: 'anilist-identity-salt-with-32-plus-chars',
  TRUSTED_ORIGINS: 'http://localhost:3000,http://localhost:5173',
  ANILIST_OAUTH_ENABLED: 'false',
};

describe('parseEnvironmentVariables', () => {
  it('normalizes Better Auth URLs and trusted origins', () => {
    const env = parseEnvironmentVariables({
      ...baseEnv,
      BETTER_AUTH_URL: 'https://api.manverse.local/',
      TRUSTED_ORIGINS:
        'https://api.manverse.local/,https://app.manverse.local,https://app.manverse.local/',
    });

    expect(env.BETTER_AUTH_URL).toBe('https://api.manverse.local');
    expect(env.TRUSTED_ORIGINS).toEqual([
      'https://api.manverse.local',
      'https://app.manverse.local',
    ]);
  });

  it('rejects trusted origins that include paths', () => {
    expect(() =>
      parseEnvironmentVariables({
        ...baseEnv,
        TRUSTED_ORIGINS: 'https://app.manverse.local/callback',
      }),
    ).toThrowError(/TRUSTED_ORIGINS entries must be origins only/i);
  });

  it('requires an https Better Auth URL in production', () => {
    const result = envSchema.safeParse({
      ...baseEnv,
      NODE_ENV: 'production',
      BETTER_AUTH_URL: 'http://api.manverse.com',
      TRUSTED_ORIGINS: 'https://api.manverse.com',
    });

    expect(result.success).toBe(false);

    if (result.success) {
      return;
    }

    expect(result.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ['BETTER_AUTH_URL'],
          message: 'BETTER_AUTH_URL must use https in production.',
        }),
      ]),
    );
  });

  it('requires secure trusted origins that include the Better Auth origin in production', () => {
    const result = envSchema.safeParse({
      ...baseEnv,
      NODE_ENV: 'production',
      BETTER_AUTH_URL: 'https://api.manverse.com',
      TRUSTED_ORIGINS: 'https://app.manverse.com,http://localhost:5173',
    });

    expect(result.success).toBe(false);

    if (result.success) {
      return;
    }

    expect(result.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ['TRUSTED_ORIGINS'],
          message:
            'TRUSTED_ORIGINS must include the BETTER_AUTH_URL origin in production.',
        }),
        expect.objectContaining({
          path: ['TRUSTED_ORIGINS', 1],
          message: 'TRUSTED_ORIGINS entries must use https in production.',
        }),
      ]),
    );
  });

  it('requires a non-empty AniList identity salt when AniList OAuth is enabled', () => {
    expect(() =>
      parseEnvironmentVariables({
        ...baseEnv,
        ANILIST_OAUTH_ENABLED: 'true',
        ANILIST_CLIENT_ID: 'anilist-client-id',
        ANILIST_CLIENT_SECRET: 'anilist-client-secret',
        ANILIST_IDENTITY_SALT: 'short-salt',
      }),
    ).toThrowError(/ANILIST_IDENTITY_SALT must be at least 32 characters/i);
  });

  it('rejects reusing BETTER_AUTH_SECRET as the AniList identity salt', () => {
    const betterAuthSecret = Buffer.from(
      'shared-secret-that-is-definitely-long-enough',
    ).toString('base64');

    const result = envSchema.safeParse({
      ...baseEnv,
      BETTER_AUTH_SECRET: betterAuthSecret,
      ANILIST_OAUTH_ENABLED: 'true',
      ANILIST_CLIENT_ID: 'anilist-client-id',
      ANILIST_CLIENT_SECRET: 'anilist-client-secret',
      ANILIST_IDENTITY_SALT: betterAuthSecret,
    });

    expect(result.success).toBe(false);

    if (result.success) {
      return;
    }

    expect(result.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ['ANILIST_IDENTITY_SALT'],
          message:
            'ANILIST_IDENTITY_SALT must be distinct from BETTER_AUTH_SECRET.',
        }),
      ]),
    );
  });

  it('requires a stable AniList identity salt when AniList OAuth is enabled', () => {
    expect(() =>
      parseEnvironmentVariables({
        ...baseEnv,
        ANILIST_OAUTH_ENABLED: 'true',
        ANILIST_CLIENT_ID: 'anilist-client-id',
        ANILIST_CLIENT_SECRET: 'anilist-client-secret',
        ANILIST_IDENTITY_SALT: '   ',
      }),
    ).toThrowError(/ANILIST_IDENTITY_SALT is required/i);
  });

  it('trims the AniList identity salt when it is configured', () => {
    const env = parseEnvironmentVariables({
      ...baseEnv,
      ANILIST_OAUTH_ENABLED: 'true',
      ANILIST_CLIENT_ID: 'anilist-client-id',
      ANILIST_CLIENT_SECRET: 'anilist-client-secret',
      ANILIST_IDENTITY_SALT:
        '  stable-anilist-identity-salt-with-32-plus-chars  ',
    });

    expect(env.ANILIST_IDENTITY_SALT).toBe(
      'stable-anilist-identity-salt-with-32-plus-chars',
    );
  });
});
