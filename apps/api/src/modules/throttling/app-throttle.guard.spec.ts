import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { AppThrottleGuard } from './app-throttle.guard.js';

class TestAppThrottleGuard extends AppThrottleGuard {
  async resolveTracker(req: Record<string, unknown>) {
    return this.getTracker(req);
  }
}

describe('AppThrottleGuard', () => {
  const guard = new TestAppThrottleGuard(
    [{ limit: 100, ttl: 60_000 }],
    {
      increment: () =>
        Promise.resolve({
          totalHits: 0,
          timeToExpire: 0,
          isBlocked: false,
          timeToBlockExpire: 0,
        }),
    },
    new Reflector(),
  );

  it('prefers the authenticated user id over the client IP', async () => {
    await expect(
      guard.resolveTracker({
        user: { id: 'user-123' },
        ip: '203.0.113.10',
      }),
    ).resolves.toBe('user:user-123');
  });

  it('falls back to the session user id when request.user is unavailable', async () => {
    await expect(
      guard.resolveTracker({
        session: {
          user: { id: 'session-user-123' },
        },
        ip: '203.0.113.10',
      }),
    ).resolves.toBe('user:session-user-123');
  });

  it('falls back to the resolved client IP', async () => {
    await expect(
      guard.resolveTracker({
        ip: '198.51.100.24',
      }),
    ).resolves.toBe('ip:198.51.100.24');
  });

  it('works with trust-proxy resolved requests', async () => {
    await expect(
      guard.resolveTracker({
        ip: '198.51.100.24',
        ips: ['198.51.100.24', '10.0.0.5'],
      }),
    ).resolves.toBe('ip:198.51.100.24');
  });
});
