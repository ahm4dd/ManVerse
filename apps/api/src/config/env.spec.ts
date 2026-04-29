import { describe, expect, it } from 'vitest';
import { envSchema, parseEnvironmentVariables } from './env.js';

const baseEnv = {
  NODE_ENV: 'development',
  PORT: '3000',
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/manverse',
  BETTER_AUTH_SECRET: Buffer.from(
    'test-secret-that-decodes-to-at-least-32-bytes',
  ).toString('base64'),
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

  it('parses trust proxy and throttle policy overrides', () => {
    const env = parseEnvironmentVariables({
      ...baseEnv,
      TRUST_PROXY: '2',
      THROTTLE_STORAGE: 'redis',
      REDIS_URL: 'redis://user:password@localhost:6379/0',
      REDIS_THROTTLE_KEY_PREFIX: '  manverse:throttle:  ',
      THROTTLE_GLOBAL_LIMIT: '120',
      THROTTLE_BURST_TTL_MS: '1500',
      THROTTLE_AUTHENTICATED_READ_LIMIT: '40',
      THROTTLE_SECRET_LIMIT: '12',
      THROTTLE_AUTH_SENSITIVE_TTL_MS: '300000',
    });

    expect(env.TRUST_PROXY).toBe(2);
    expect(env.THROTTLE_STORAGE).toBe('redis');
    expect(env.REDIS_URL).toBe('redis://user:password@localhost:6379/0');
    expect(env.REDIS_THROTTLE_KEY_PREFIX).toBe('manverse:throttle:');
    expect(env.THROTTLE_GLOBAL_LIMIT).toBe(120);
    expect(env.THROTTLE_BURST_TTL_MS).toBe(1500);
    expect(env.THROTTLE_AUTHENTICATED_READ_LIMIT).toBe(40);
    expect(env.THROTTLE_SECRET_LIMIT).toBe(12);
    expect(env.THROTTLE_AUTH_SENSITIVE_TTL_MS).toBe(300000);
  });

  it('requires explicit opt-in for Prisma query logging', () => {
    expect(parseEnvironmentVariables(baseEnv).PRISMA_LOG_QUERIES).toBe(false);

    expect(
      parseEnvironmentVariables({
        ...baseEnv,
        PRISMA_LOG_QUERIES: 'true',
      }).PRISMA_LOG_QUERIES,
    ).toBe(true);
  });

  it('rejects trusted origins that include paths', () => {
    expect(() =>
      parseEnvironmentVariables({
        ...baseEnv,
        TRUSTED_ORIGINS: 'https://app.manverse.local/callback',
      }),
    ).toThrowError(/TRUSTED_ORIGINS entries must be origins only/i);
  });

  it('rejects invalid trust proxy configuration', () => {
    expect(() =>
      parseEnvironmentVariables({
        ...baseEnv,
        TRUST_PROXY: 'loopback',
      }),
    ).toThrowError(/TRUST_PROXY must be set to true, false, or a positive/i);
  });

  it('rejects Better Auth secrets shorter than 32 decoded bytes', () => {
    expect(() =>
      parseEnvironmentVariables({
        ...baseEnv,
        BETTER_AUTH_SECRET: Buffer.from('short-secret').toString('base64'),
      }),
    ).toThrowError(/BETTER_AUTH_SECRET must decode to at least 32 bytes/i);
  });

  it('rejects obvious Better Auth placeholder secrets', () => {
    expect(() =>
      parseEnvironmentVariables({
        ...baseEnv,
        BETTER_AUTH_SECRET: Buffer.from('password123').toString('base64'),
      }),
    ).toThrowError(/must not use an obvious placeholder or default value/i);
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

  it('rejects boolean true trust proxy configuration in production', () => {
    const result = envSchema.safeParse({
      ...baseEnv,
      NODE_ENV: 'production',
      BETTER_AUTH_URL: 'https://api.manverse.com',
      TRUSTED_ORIGINS: 'https://api.manverse.com',
      TRUST_PROXY: 'true',
    });

    expect(result.success).toBe(false);

    if (result.success) {
      return;
    }

    expect(result.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ['TRUST_PROXY'],
          message:
            'TRUST_PROXY must be false or a positive proxy hop count in production.',
        }),
      ]),
    );
  });

  it('allows false and positive hop count trust proxy configuration in production', () => {
    expect(() =>
      parseEnvironmentVariables({
        ...baseEnv,
        NODE_ENV: 'production',
        BETTER_AUTH_URL: 'https://api.manverse.com',
        TRUSTED_ORIGINS: 'https://api.manverse.com',
        TRUST_PROXY: 'false',
      }),
    ).not.toThrow();

    expect(() =>
      parseEnvironmentVariables({
        ...baseEnv,
        NODE_ENV: 'production',
        BETTER_AUTH_URL: 'https://api.manverse.com',
        TRUSTED_ORIGINS: 'https://api.manverse.com',
        TRUST_PROXY: '2',
      }),
    ).not.toThrow();
  });

  it('requires REDIS_URL when production throttling uses redis storage', () => {
    const result = envSchema.safeParse({
      ...baseEnv,
      NODE_ENV: 'production',
      BETTER_AUTH_URL: 'https://api.manverse.com',
      TRUSTED_ORIGINS: 'https://api.manverse.com',
      THROTTLE_STORAGE: 'redis',
    });

    expect(result.success).toBe(false);

    if (result.success) {
      return;
    }

    expect(result.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ['REDIS_URL'],
          message:
            'REDIS_URL is required when THROTTLE_STORAGE is set to redis in production.',
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
