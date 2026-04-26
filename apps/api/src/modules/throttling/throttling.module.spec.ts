import { APP_GUARD } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { AppThrottleGuard } from './guards/app-throttle.guard.js';
import { ThrottlingModule } from './throttling.module.js';

describe('ThrottlingModule', () => {
  it('registers the global throttle guard through APP_GUARD', () => {
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
