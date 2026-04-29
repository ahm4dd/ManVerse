import { Module } from '@nestjs/common';
import { ConfigModule } from '../../config/config.module.js';
import { ENV_TOKEN, EnvironmentVariables } from '../../config/env.js';
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
  providers: [AppThrottleGuard],
  exports: [AppThrottleGuard],
})
export class ThrottlingModule {}
