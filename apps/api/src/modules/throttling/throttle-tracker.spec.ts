import { describe, expect, it } from 'vitest';
import {
  getAuthenticatedThrottleSubject,
  getResolvedClientIp,
  getThrottleTrackerKey,
} from './throttle-tracker.js';

describe('throttle tracker', () => {
  it('prefers the authenticated request user id', () => {
    expect(
      getAuthenticatedThrottleSubject({
        user: { id: 'user-123' },
        session: { user: { id: 'session-user-123' } },
      }),
    ).toBe('user-123');
  });

  it('falls back to the authenticated session user id', () => {
    expect(
      getAuthenticatedThrottleSubject({
        session: { user: { id: 'session-user-123' } },
      }),
    ).toBe('session-user-123');
  });

  it('returns the resolved request ip when present', () => {
    expect(
      getResolvedClientIp({
        ip: '198.51.100.24',
        ips: ['198.51.100.24', '10.0.0.5'],
      }),
    ).toBe('198.51.100.24');
  });

  it('falls back to the first forwarded ip when direct ip is unavailable', () => {
    expect(
      getResolvedClientIp({
        ips: ['198.51.100.24', '10.0.0.5'],
      }),
    ).toBe('198.51.100.24');
  });

  it('builds the tracker key from the authenticated user before ip', () => {
    expect(
      getThrottleTrackerKey({
        user: { id: 'user-123' },
        ip: '198.51.100.24',
      }),
    ).toBe('user:user-123');
  });

  it('builds the tracker key from the resolved ip when unauthenticated', () => {
    expect(
      getThrottleTrackerKey({
        ip: '198.51.100.24',
      }),
    ).toBe('ip:198.51.100.24');
  });

  it('returns undefined when it cannot resolve a user or ip', () => {
    expect(getThrottleTrackerKey({})).toBeUndefined();
  });
});
