import { Inject, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import {
  ThrottlerModule,
  type ThrottlerModuleOptions,
} from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { Redis } from 'ioredis';
import { ConfigModule } from '../../config/config.module.js';
import { ENV_TOKEN, type EnvironmentVariables } from '../../config/env.js';
import { AppThrottleGuard } from './app-throttle.guard.js';
import { createNamedThrottlePolicies } from './throttle-policies.js';

export function shouldUseRedisThrottleStorage(
  env: EnvironmentVariables,
): boolean {
  return env.NODE_ENV === 'production' && env.THROTTLE_STORAGE === 'redis';
}

function createRedisThrottleStorage(
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

export function createThrottlerModuleOptions(
  env: EnvironmentVariables,
): ThrottlerModuleOptions {
  return {
    throttlers: createNamedThrottlePolicies(env),
    storage: shouldUseRedisThrottleStorage(env)
      ? createRedisThrottleStorage(env)
      : undefined,
  };
}

@Module({
  imports: [
    ConfigModule,
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ENV_TOKEN],
      useFactory: (env: EnvironmentVariables) =>
        createThrottlerModuleOptions(env),
    }),
  ],
  providers: [
    AppThrottleGuard,
    { provide: APP_GUARD, useExisting: AppThrottleGuard },
  ],
})
export class ThrottlingModule {
  constructor(@Inject(ENV_TOKEN) private readonly env: EnvironmentVariables) {
    if (shouldUseRedisThrottleStorage(this.env) && !this.env.REDIS_URL) {
      throw new Error(
        'REDIS_URL is required when Redis-backed throttling is enabled.',
      );
    }
  }
}
