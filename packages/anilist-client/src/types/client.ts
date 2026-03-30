import type { HTTPConfig, ResolvedHTTPConfig } from './httpclient.js';
import type { AnilistClientLogger } from './logger.js';

export type AnilistClientConfig = {
  logger?: AnilistClientLogger;
  httpConfig?: Omit<HTTPConfig, 'logger'>;
};

export type ResolvedAnilistClientConfig = {
  logger?: AnilistClientLogger;
  httpConfig: ResolvedHTTPConfig;
};
