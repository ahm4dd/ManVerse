import type { ExecutionContext } from '@nestjs/common';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { describe, expect, it } from 'vitest';
import type { EnvironmentVariables } from '../../config/env.js';
import { parseEnvironmentVariables } from '../../config/env.js';
import { UseThrottlePolicy } from './decorators/throttle.decorator.js';
import {
  createPolicies,
  createRedisStorage,
  createThrottleConfig,
  shouldUseRedisStorage,
} from './throttle-initializer.js';

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

class PlainController {
  getPlain() {}
}

class AuthSensitiveController {
  @UseThrottlePolicy('authSensitive')
  getSensitive() {}
}

function getMethod(target: object, methodName: string): object {
  const descriptor = Reflect.getOwnPropertyDescriptor(target, methodName);

  if (!descriptor?.value) {
    throw new Error(`Expected ${methodName} to be defined.`);
  }

  return descriptor.value as object;
}

function createHttpExecutionContext(
  classRef: object,
  handler: object,
): ExecutionContext {
  return {
    getClass: () => classRef as never,
    getHandler: () => handler as never,
  } as unknown as ExecutionContext;
}

describe('throttle initializer', () => {
  it('creates named policies from env including authSensitive', () => {
    const env = parseEnvironmentVariables({
      ...baseEnv,
      THROTTLE_AUTH_SENSITIVE_LIMIT: '4',
      THROTTLE_AUTH_SENSITIVE_TTL_MS: '300000',
    });

    expect(createPolicies(env)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'global',
          limit: 100,
          ttl: 60_000,
        }),
        expect.objectContaining({
          name: 'authSensitive',
          limit: 4,
          ttl: 300_000,
        }),
      ]),
    );
  });

  it('uses redis storage only in production when redis is selected', () => {
    const developmentRedisEnv = parseEnvironmentVariables({
      ...baseEnv,
      THROTTLE_STORAGE: 'redis',
      REDIS_URL: 'redis://localhost:6379/0',
    });
    const productionRedisEnv = parseEnvironmentVariables({
      ...baseEnv,
      NODE_ENV: 'production',
      BETTER_AUTH_URL: 'https://api.manverse.com',
      TRUSTED_ORIGINS: 'https://api.manverse.com',
      THROTTLE_STORAGE: 'redis',
      REDIS_URL: 'redis://localhost:6379/0',
    });

    expect(shouldUseRedisStorage(developmentRedisEnv)).toBe(false);
    expect(shouldUseRedisStorage(productionRedisEnv)).toBe(true);
  });

  it('requires REDIS_URL when creating redis storage', () => {
    const env = {
      ...parseEnvironmentVariables(baseEnv),
      NODE_ENV: 'production',
      THROTTLE_STORAGE: 'redis',
      REDIS_URL: undefined,
    } satisfies EnvironmentVariables;

    expect(() => createRedisStorage(env)).toThrowError(
      'REDIS_URL is required when Redis-backed throttling is enabled.',
    );
  });

  it('creates a redis-backed storage adapter when redis throttling is enabled', () => {
    const env = parseEnvironmentVariables({
      ...baseEnv,
      NODE_ENV: 'production',
      BETTER_AUTH_URL: 'https://api.manverse.com',
      TRUSTED_ORIGINS: 'https://api.manverse.com',
      THROTTLE_STORAGE: 'redis',
      REDIS_URL: 'redis://localhost:6379/0',
    });

    expect(createRedisStorage(env)).toBeInstanceOf(
      ThrottlerStorageRedisService,
    );
  });

  it('builds skip handlers that keep baselines and the selected route policy active', () => {
    const env = parseEnvironmentVariables(baseEnv);
    const config = createThrottleConfig(env);

    if (Array.isArray(config)) {
      throw new Error('Expected object-based throttler options.');
    }

    const authSensitiveThrottler = config.throttlers.find(
      ({ name }) => name === 'authSensitive',
    );
    const globalThrottler = config.throttlers.find(
      ({ name }) => name === 'global',
    );
    const burstThrottler = config.throttlers.find(
      ({ name }) => name === 'burst',
    );

    if (
      !authSensitiveThrottler?.skipIf ||
      !globalThrottler?.skipIf ||
      !burstThrottler?.skipIf
    ) {
      throw new Error('Expected named throttlers to define skipIf handlers.');
    }

    const authSensitiveContext = createHttpExecutionContext(
      AuthSensitiveController,
      getMethod(AuthSensitiveController.prototype, 'getSensitive'),
    );
    const plainContext = createHttpExecutionContext(
      PlainController,
      getMethod(PlainController.prototype, 'getPlain'),
    );

    expect(authSensitiveThrottler.skipIf(authSensitiveContext)).toBe(false);
    expect(globalThrottler.skipIf(authSensitiveContext)).toBe(false);
    expect(burstThrottler.skipIf(authSensitiveContext)).toBe(false);
    expect(globalThrottler.skipIf(plainContext)).toBe(false);
    expect(burstThrottler.skipIf(plainContext)).toBe(false);
    expect(authSensitiveThrottler.skipIf(plainContext)).toBe(true);
  });

  it('uses in-memory storage outside the production redis case', () => {
    const env = parseEnvironmentVariables({
      ...baseEnv,
      THROTTLE_STORAGE: 'redis',
      REDIS_URL: 'redis://localhost:6379/0',
    });
    const config = createThrottleConfig(env);

    if (Array.isArray(config)) {
      throw new Error('Expected object-based throttler options.');
    }

    expect(config.storage).toBeUndefined();
  });
});
