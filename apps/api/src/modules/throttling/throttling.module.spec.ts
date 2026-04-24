import { APP_GUARD } from '@nestjs/core';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { describe, expect, it } from 'vitest';
import { parseEnvironmentVariables } from '../../config/env.js';
import { AppThrottleGuard } from './app-throttle.guard.js';
import { THROTTLE_POLICY_NAMES } from './throttle.constants.js';
import {
  ThrottlingModule,
  createThrottlerModuleOptions,
} from './throttling.module.js';

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

describe('ThrottlingModule', () => {
  it('builds named throttler config from env', () => {
    const env = parseEnvironmentVariables({
      ...baseEnv,
      THROTTLE_GLOBAL_LIMIT: '120',
      THROTTLE_BURST_LIMIT: '8',
      THROTTLE_AUTHENTICATED_READ_LIMIT: '40',
      THROTTLE_SECRET_LIMIT: '12',
      THROTTLE_AUTH_SENSITIVE_TTL_MS: '300000',
    });
    const options = createThrottlerModuleOptions(env);

    if (Array.isArray(options)) {
      throw new Error('Expected object-based throttler options.');
    }

    expect(options.throttlers.map(({ name }) => name)).toEqual(
      THROTTLE_POLICY_NAMES,
    );
    expect(options.throttlers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'global',
          limit: 120,
          ttl: 60_000,
        }),
        expect.objectContaining({
          name: 'authenticatedRead',
          limit: 40,
          ttl: 60_000,
        }),
        expect.objectContaining({
          name: 'secret',
          limit: 12,
          ttl: 60_000,
        }),
        expect.objectContaining({
          name: 'authSensitive',
          limit: 5,
          ttl: 300_000,
        }),
      ]),
    );
  });

  it('uses in-memory storage outside production even when redis is configured', () => {
    const env = parseEnvironmentVariables({
      ...baseEnv,
      THROTTLE_STORAGE: 'redis',
      REDIS_URL: 'redis://localhost:6379/0',
    });
    const options = createThrottlerModuleOptions(env);

    if (Array.isArray(options)) {
      throw new Error('Expected object-based throttler options.');
    }

    expect(options.storage).toBeUndefined();
  });

  it('uses redis storage only for production redis throttling', () => {
    const env = parseEnvironmentVariables({
      ...baseEnv,
      NODE_ENV: 'production',
      BETTER_AUTH_URL: 'https://api.manverse.com',
      TRUSTED_ORIGINS: 'https://api.manverse.com',
      THROTTLE_STORAGE: 'redis',
      REDIS_URL: 'redis://localhost:6379/0',
    });
    const options = createThrottlerModuleOptions(env);

    if (Array.isArray(options)) {
      throw new Error('Expected object-based throttler options.');
    }

    expect(options.storage).toBeInstanceOf(ThrottlerStorageRedisService);
  });

  it('registers the global throttle guard through ThrottlingModule', () => {
    const providers = Reflect.getMetadata('providers', ThrottlingModule) as
      | Array<Record<string, unknown>>
      | undefined;

    expect(providers).toEqual(
      expect.arrayContaining([
        AppThrottleGuard,
        expect.objectContaining({
          provide: APP_GUARD,
          useExisting: AppThrottleGuard,
        }),
      ]),
    );
  });
});
