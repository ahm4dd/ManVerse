import { ThrottlerModuleOptions, ThrottlerOptions } from '@nestjs/throttler';
import { type ThrottlePolicyName } from './throttle.constants.js';
import { EnvironmentVariables } from 'src/config/env.js';
import { shouldSkipPolicy } from './utility.js';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { Redis } from 'ioredis';

type ThrottlerPoliciesConfig = Pick<ThrottlerOptions, 'limit' | 'ttl'> & {
  name: ThrottlePolicyName;
};

export function createPolicies(
  env: EnvironmentVariables,
): ThrottlerPoliciesConfig[] {
  return [
    {
      name: 'global',
      limit: env.THROTTLE_GLOBAL_LIMIT,
      ttl: env.THROTTLE_GLOBAL_TTL_MS,
    },
    {
      name: 'burst',
      limit: env.THROTTLE_BURST_LIMIT,
      ttl: env.THROTTLE_BURST_TTL_MS,
    },
    {
      name: 'authenticatedRead',
      limit: env.THROTTLE_AUTHENTICATED_READ_LIMIT,
      ttl: env.THROTTLE_AUTHENTICATED_READ_TTL_MS,
    },
    {
      name: 'secret',
      limit: env.THROTTLE_SECRET_LIMIT,
      ttl: env.THROTTLE_SECRET_TTL_MS,
    },
    {
      name: 'authSensitive',
      limit: env.THROTTLE_AUTH_SENSITIVE_LIMIT,
      ttl: env.THROTTLE_AUTH_SENSITIVE_TTL_MS,
    },
  ];
}

export function shouldUseRedisStorage(env: EnvironmentVariables): boolean {
  return env.NODE_ENV === 'production' && env.THROTTLE_STORAGE === 'redis';
}

export function createRedisStorage(
  env: EnvironmentVariables,
): ThrottlerStorageRedisService {
  if (!env.REDIS_URL) {
    throw new Error(
      'REDIS_URL is required when Redis-backed throttling is enabled.',
    );
  }

  const redis = new Redis(env.REDIS_URL, {
    keyPrefix: env.REDIS_THROTTLE_KEY_PREFIX,
    lazyConnect: true,
  });

  return new ThrottlerStorageRedisService(redis);
}

export function createThrottleConfig(
  env: EnvironmentVariables,
): ThrottlerModuleOptions {
  const policies = createPolicies(env);
  return {
    throttlers: policies.map((policy) => ({
      name: policy.name,
      limit: policy.limit,
      ttl: policy.ttl,
      skipIf: (context) => shouldSkipPolicy(policy.name, context),
    })),
    storage: shouldUseRedisStorage(env) ? createRedisStorage(env) : undefined,
  };
}
