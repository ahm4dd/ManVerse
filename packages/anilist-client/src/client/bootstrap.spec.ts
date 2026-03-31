import { describe, expect, it } from 'vitest';

import {
  DEFAULT_ANILIST_GRAPHQL_ENDPOINT,
  DEFAULT_HTTP_HEADERS,
  DEFAULT_HTTP_TIMEOUT_MS,
} from '../constants/http.js';
import { resolveAnilistClientConfig } from './bootstrap.js';

describe('resolveAnilistClientConfig', () => {
  it('should resolve config with default constants', () => {
    const actualConfig = resolveAnilistClientConfig({
      logger: undefined,
      httpConfig: {},
    });

    expect(actualConfig).toEqual({
      logger: undefined,
      httpConfig: {
        endpoint: DEFAULT_ANILIST_GRAPHQL_ENDPOINT,
        timeoutMs: DEFAULT_HTTP_TIMEOUT_MS,
        headers: {
          ...DEFAULT_HTTP_HEADERS,
        },
        logger: undefined,
      },
    });
  });

  it('should allow explicit config to override defaults and merge headers', () => {
    const logger = {
      debug: () => undefined,
    };

    const actualConfig = resolveAnilistClientConfig({
      logger,
      httpConfig: {
        endpoint: 'https://example.com/graphql',
        timeoutMs: 2_500,
        headers: {
          Authorization: 'Bearer token',
          Accept: 'application/graphql-response+json',
        },
      },
    });

    expect(actualConfig).toEqual({
      logger,
      httpConfig: {
        endpoint: 'https://example.com/graphql',
        timeoutMs: 2_500,
        headers: {
          ...DEFAULT_HTTP_HEADERS,
          Authorization: 'Bearer token',
          Accept: 'application/graphql-response+json',
        },
        logger,
      },
    });
  });
});
