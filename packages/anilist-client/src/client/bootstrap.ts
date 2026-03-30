import {
  DEFAULT_ANILIST_GRAPHQL_ENDPOINT,
  DEFAULT_HTTP_HEADERS,
  DEFAULT_HTTP_TIMEOUT_MS,
} from '../constants/http.js';
import type {
  AnilistClientConfig,
  ResolvedAnilistClientConfig,
} from '../types/client.js';

export function resolveAnilistClientConfig(
  config: AnilistClientConfig = {},
): ResolvedAnilistClientConfig {
  return {
    logger: config.logger,
    httpConfig: {
      endpoint: DEFAULT_ANILIST_GRAPHQL_ENDPOINT,
      timeoutMs: DEFAULT_HTTP_TIMEOUT_MS,
      ...(config.httpConfig ?? {}),
      headers: {
        ...DEFAULT_HTTP_HEADERS,
        ...(config.httpConfig?.headers ?? {}),
      },
      logger: config.logger,
    },
  };
}
