import type { AnilistClientConfig } from '../types/client.js';
import {
  getUserProfile,
  getViewerProfile,
  type ProfileUser,
  type UserProfileInput,
} from '../features/profile/index.js';
import {
  getViewerMangaLists,
  type ViewerMangaListCollection,
  type ViewerMangaListsInput,
} from '../features/media-list/index.js';
import {
  searchMedia,
  type SearchMediaInput,
  type SearchMediaPage,
} from '../features/search/index.js';
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

  async searchMedia(input: SearchMediaInput): Promise<SearchMediaPage | null> {
    return searchMedia(this.httpClient, input);
  }

  async search(input: SearchMediaInput): Promise<SearchMediaPage | null> {
    return this.searchMedia(input);
  }

  async getViewerMangaLists(
    accessToken: string,
    input?: ViewerMangaListsInput,
  ): Promise<ViewerMangaListCollection | null> {
    return getViewerMangaLists(this.httpClient, accessToken, input);
  }

  async viewerMangaLists(
    accessToken: string,
    input?: ViewerMangaListsInput,
  ): Promise<ViewerMangaListCollection | null> {
    return this.getViewerMangaLists(accessToken, input);
  }
}
