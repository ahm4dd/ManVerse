import type { AnilistClientConfig } from '../types/client.js';
import { HTTPClient } from './httpclient.js';
import { resolveAnilistClientConfig } from './bootstrap.js';

export class AnilistClient {
  // TODO: Add cache adapter
  // TODO: Add rate limiter
  protected readonly httpClient: HTTPClient;
  protected readonly logger?: AnilistClientConfig['logger'];

  constructor(config: AnilistClientConfig = {}) {
    const resolvedConfig = resolveAnilistClientConfig(config);

    this.logger = resolvedConfig.logger;
    this.httpClient = new HTTPClient(resolvedConfig.httpConfig);
  }
}
