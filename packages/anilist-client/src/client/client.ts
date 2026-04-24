import type { AnilistClientConfig } from '../types/client.js';
import {
  getUserProfile,
  getViewerProfile,
  type ProfileUser,
  type UserProfileInput,
} from '../features/profile/index.js';
import {
  deleteMediaListEntry,
  getViewerMangaLists,
  saveMediaListEntry,
  type DeleteMediaListEntryInput,
  type DeleteMediaListEntryResult,
  type SaveMediaListEntry,
  type SaveMediaListEntryInput,
  type ViewerMangaListCollection,
  type ViewerMangaListsInput,
} from '../features/media-list/index.js';
import {
  searchMedia,
  type SearchMediaInput,
  type SearchMediaPage,
} from '../features/search/index.js';
import {
  toggleFavourite,
  type ToggleFavouriteInput,
  type ToggleFavouriteResult,
} from '../features/toggle-favourite/index.js';
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

  async getUserProfile(input: UserProfileInput): Promise<ProfileUser | null> {
    return getUserProfile(this.httpClient, input);
  }

  async searchMedia(input: SearchMediaInput): Promise<SearchMediaPage | null> {
    return searchMedia(this.httpClient, input);
  }

  async getViewerMangaLists(
    accessToken: string,
    input?: ViewerMangaListsInput,
  ): Promise<ViewerMangaListCollection | null> {
    return getViewerMangaLists(this.httpClient, accessToken, input);
  }

  async saveMediaListEntry(
    accessToken: string,
    input: SaveMediaListEntryInput,
  ): Promise<SaveMediaListEntry | null> {
    return saveMediaListEntry(this.httpClient, accessToken, input);
  }

  async deleteMediaListEntry(
    accessToken: string,
    input: DeleteMediaListEntryInput,
  ): Promise<DeleteMediaListEntryResult> {
    return deleteMediaListEntry(this.httpClient, accessToken, input);
  }

  async toggleFavourite(
    accessToken: string,
    input: ToggleFavouriteInput,
  ): Promise<ToggleFavouriteResult> {
    return toggleFavourite(this.httpClient, accessToken, input);
  }
}
