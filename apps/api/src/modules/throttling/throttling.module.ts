import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from 'src/config/config.module.js';
import { ENV_TOKEN, EnvironmentVariables } from 'src/config/env.js';
import { createThrottleConfig } from './throttle-initializer.js';
import { AppThrottleGuard } from './guards/app-throttle.guard.js';
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    ConfigModule,
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ENV_TOKEN],
      useFactory: (env: EnvironmentVariables) => createThrottleConfig(env),
    }),
  ],
  providers: [
    AppThrottleGuard,
    { provide: APP_GUARD, useExisting: AppThrottleGuard },
  ],
})
export class ThrottlingModule {}
