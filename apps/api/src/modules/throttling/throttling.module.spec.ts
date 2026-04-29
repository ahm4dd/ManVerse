import { describe, expect, it } from 'vitest';
import { AppThrottleGuard } from './guards/app-throttle.guard.js';
import { ThrottlingModule } from './throttling.module.js';

describe('ThrottlingModule', () => {
  it('exports the app throttle guard for ordered global registration', () => {
    const providers = Reflect.getMetadata('providers', ThrottlingModule) as
      | Array<Record<string, unknown>>
      | undefined;
    const exports = Reflect.getMetadata('exports', ThrottlingModule) as
      | Array<Record<string, unknown>>
      | undefined;

    expect(providers).toEqual(expect.arrayContaining([AppThrottleGuard]));
    expect(exports).toEqual(expect.arrayContaining([AppThrottleGuard]));
  });
});
