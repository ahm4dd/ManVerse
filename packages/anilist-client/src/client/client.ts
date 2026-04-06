import type { AnilistClientConfig } from '../types/client.js';
import {
  getUserProfile,
  getViewerProfile,
  type ProfileUser,
  type UserProfileInput,
} from '../features/profile/index.js';
import { HTTPClient } from './httpclient.js';
import { resolveAnilistClientConfig } from './bootstrap.js';

export class AnilistClient {
  // TODO: Add cache adapter
  protected readonly httpClient: HTTPClient;
  protected readonly logger?: AnilistClientConfig['logger'];

  constructor(config: AnilistClientConfig = {}) {
    const resolvedConfig = resolveAnilistClientConfig(config);

    this.logger = resolvedConfig.logger;
    this.httpClient = new HTTPClient(resolvedConfig.httpConfig);
  }

  async getViewerProfile(accessToken: string): Promise<ProfileUser | null> {
    return getViewerProfile(this.httpClient, accessToken);
  }

  async viewer(accessToken: string): Promise<ProfileUser | null> {
    return this.getViewerProfile(accessToken);
  }

  async getUserProfile(input: UserProfileInput): Promise<ProfileUser | null> {
    return getUserProfile(this.httpClient, input);
  }

  async user(input: UserProfileInput): Promise<ProfileUser | null> {
    return this.getUserProfile(input);
  }
}
