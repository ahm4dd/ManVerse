import type { NestExpressApplication } from '@nestjs/platform-express';
import { describe, expect, it, vi } from 'vitest';
import { configureApp } from './configure-app.js';
import type { EnvironmentVariables } from '../config/env.js';

const baseEnv = {
  NODE_ENV: 'development',
  PORT: 3000,
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/manverse',
  BETTER_AUTH_SECRET: Buffer.from('test-secret').toString('base64'),
  BETTER_AUTH_URL: 'http://localhost:3000',
  ANILIST_IDENTITY_SALT: 'anilist-identity-salt-with-32-plus-chars',
  TRUST_PROXY: undefined,
  TRUSTED_ORIGINS: ['http://localhost:3000', 'http://localhost:5173'],
  ANILIST_OAUTH_ENABLED: false,
  THROTTLE_STORAGE: 'memory',
  REDIS_URL: undefined,
  REDIS_THROTTLE_KEY_PREFIX: undefined,
  THROTTLE_GLOBAL_LIMIT: 100,
  THROTTLE_GLOBAL_TTL_MS: 60_000,
  THROTTLE_BURST_LIMIT: 10,
  THROTTLE_BURST_TTL_MS: 1_000,
  THROTTLE_AUTHENTICATED_READ_LIMIT: 30,
  THROTTLE_AUTHENTICATED_READ_TTL_MS: 60_000,
  THROTTLE_SECRET_LIMIT: 10,
  THROTTLE_SECRET_TTL_MS: 60_000,
  THROTTLE_AUTH_SENSITIVE_LIMIT: 5,
  THROTTLE_AUTH_SENSITIVE_TTL_MS: 60_000,
  ANILIST_CLIENT_ID: undefined,
  ANILIST_CLIENT_SECRET: undefined,
} satisfies EnvironmentVariables;

function createAppMock() {
  return {
    setGlobalPrefix: vi.fn(),
    set: vi.fn(),
    enableCors: vi.fn(),
    enableVersioning: vi.fn(),
  };
}

describe('configureApp', () => {
  it('applies trust proxy when configured', () => {
    const app = createAppMock();

    configureApp(app as unknown as NestExpressApplication, {
      ...baseEnv,
      TRUST_PROXY: 2,
    });

    expect(app.setGlobalPrefix).toHaveBeenCalledWith('/api');
    expect(app.set).toHaveBeenCalledWith('trust proxy', 2);
    expect(app.enableCors).toHaveBeenCalledWith({
      origin: baseEnv.TRUSTED_ORIGINS,
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
      credentials: true,
    });
  });

  it('does not trust proxy headers when disabled', () => {
    const app = createAppMock();

    configureApp(app as unknown as NestExpressApplication, {
      ...baseEnv,
      TRUST_PROXY: false,
    });

    expect(app.set).toHaveBeenCalledWith('query parser', 'extended');
    expect(app.set).not.toHaveBeenCalledWith('trust proxy', expect.anything());
  });
});
