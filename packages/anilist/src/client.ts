import { GraphQLClient, ClientError } from 'graphql-request';
import { AniListAuth, type AuthOptions } from './auth.js';
import type {
  AuthToken,
  AniListUser,
  AniListManga,
  MediaListEntry,
  MediaListCollection,
  MediaListStatus,
  SearchResult,
  AniListUserStats,
  AniListActivity,
  AniListNotification,
} from './types.js';
import {
  AniListAuthError,
  AniListError,
  AniListRateLimitError,
  SearchResultSchema,
  AniListUserSchema,
  AniListMangaSchema,
  MediaListEntrySchema,
  MediaListCollectionSchema,
  AniListUserStatsSchema,
  AniListActivitySchema,
  AniListNotificationSchema,
} from './types.js';
import { anilistConfig } from './config/anilist.config.js';
import { RateLimiter } from './utils/rate-limiter.js';
import { retryWithBackoff } from './utils/retry.js';
import * as queries from './graphql/queries.js';
import * as mutations from './graphql/mutations.js';

/**
 * Main AniList API client interface
 * Supports both authenticated and guest modes
 */
interface SearchOptions {
  sort?: string[];
  format?: string;
  status?: string;
  genre?: string;
  country?: string;
}

interface FuzzyDateInput {
  year?: number | null;
  month?: number | null;
  day?: number | null;
}

interface UpdateEntryInput {
  mediaId: number;
  status?: MediaListStatus;
  score?: number;
  progress?: number;
  progressVolumes?: number;
  repeat?: number;
  priority?: number;
  private?: boolean;
  notes?: string;
  startedAt?: FuzzyDateInput;
  completedAt?: FuzzyDateInput;
}

export interface IAniListClient {
  // Authentication
  isAuthenticated(): boolean;
  authenticate(): Promise<AuthToken>;
  setToken(token: AuthToken): void;

  // User
  getCurrentUser(): Promise<AniListUser>;
  getUserStats(userId: number): Promise<AniListUserStats>;
  getUserActivity(userId: number): Promise<AniListActivity[]>;
  getNotifications(): Promise<AniListNotification[]>;

  // Search (guest mode compatible)
  searchManga(query: string, page?: number, options?: SearchOptions): Promise<SearchResult>;
  getTrendingManga(page?: number): Promise<SearchResult>;
  getPopularManga(page?: number): Promise<SearchResult>;
  getTopRatedManga(page?: number): Promise<SearchResult>;
  getMangaDetails(id: number): Promise<AniListManga>;

  // Lists (authenticated only)
  getUserMangaList(userId: number, status?: MediaListStatus): Promise<MediaListEntry[]>;
  getUserMangaCollection(
    userId: number,
    status?: MediaListStatus,
  ): Promise<MediaListCollection>;
  addToList(mediaId: number, status: MediaListStatus): Promise<MediaListEntry>;
  updateProgress(mediaId: number, progress: number): Promise<MediaListEntry>;
  updateStatus(mediaId: number, status: MediaListStatus): Promise<MediaListEntry>;
  updateScore(mediaId: number, score: number): Promise<MediaListEntry>;
  updateEntry(input: UpdateEntryInput): Promise<MediaListEntry>;
  removeFromList(entryId: number): Promise<boolean>;

  // Favorites (authenticated only)
  toggleFavorite(mangaId: number): Promise<boolean>;
  getFavorites(): Promise<AniListManga[]>;
}

interface AniListClientConfig {
  clientId?: string;
  clientSecret?: string;
  token?: AuthToken;
  enableRateLimit?: boolean;
  rateLimiter?: RateLimiter;
}

/**
 * AniList API client implementation
 * Following ManVerse patterns: interface-based, Zod validation, error handling
 */
export class AniListClient implements IAniListClient {
  private graphql: GraphQLClient;
  private token?: AuthToken;
  private auth?: AniListAuth;
  private rateLimiter?: RateLimiter;
  private static sharedRateLimiter = new RateLimiter();

  private constructor(config: AniListClientConfig) {
    this.graphql = new GraphQLClient(anilistConfig.apiUrl, {
      headers: config.token
        ? {
            Authorization: `Bearer ${config.token.accessToken}`,
          }
        : {},
    });

    if (config.token) {
      this.token = config.token;
    }

    if (config.enableRateLimit !== false) {
      this.rateLimiter = config.rateLimiter ?? AniListClient.sharedRateLimiter;
    }

    if (config.clientId && config.clientSecret) {
      this.auth = new AniListAuth({
        clientId: config.clientId,
        clientSecret: config.clientSecret,
      });
    }
  }

  /**
   * Create a new AniList client instance
   * @param config Configuration options
   */
  static create(config: AniListClientConfig = {}): AniListClient {
    return new AniListClient(config);
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.token;
  }

  /**
   * Start OAuth authentication flow
   * @returns Access token
   */
  async authenticate(): Promise<AuthToken> {
    if (!this.auth) {
      throw new AniListAuthError(
        'Authentication not configured - provide clientId and clientSecret',
      );
    }

    const token = await this.auth.authenticate();
    this.setToken(token);

    return token;
  }

  /**
   * Set access token manually
   * @param token Access token
   */
  setToken(token: AuthToken): void {
    this.token = token;
    this.graphql = new GraphQLClient(anilistConfig.apiUrl, {
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
      },
    });
  }

  /**
   * Require authentication for operation
   * @throws AniListAuthError if not authenticated
   */
  private requireAuth(): void {
    if (!this.isAuthenticated()) {
      throw new AniListAuthError(
        'This operation requires authentication. Call authenticate() first.',
      );
    }
  }

  /**
   * Execute GraphQL request with rate limiting and retry
   */
  private async request<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    // Wait for rate limit slot
    if (this.rateLimiter) {
      await this.rateLimiter.waitForSlot();
    }

    // Execute with retry
    return retryWithBackoff(async () => {
      try {
        return await this.graphql.request<T>(query, variables);
      } catch (error) {
        if (error instanceof ClientError) {
          const status = error.response.status;
          const retryAfterRaw = error.response.headers.get('retry-after');
          const retryAfter = retryAfterRaw ? Number.parseInt(retryAfterRaw, 10) : undefined;
          if (status === 429) {
            throw new AniListRateLimitError(error.message, Number.isFinite(retryAfter) ? retryAfter : undefined);
          }
          throw new AniListError(error.message, 'HTTP_ERROR', status);
        }
        // Wrap errors in AniListError
        if (error instanceof AniListError) {
          throw error;
        }
        if (error instanceof Error) {
          throw new AniListError(error.message);
        }
        throw error;
      }
    });
  }

  /**
   * Get current authenticated user
   */
  async getCurrentUser(): Promise<AniListUser> {
    this.requireAuth();

    const response = await this.request<{ Viewer: unknown }>(queries.GET_CURRENT_USER);

    return AniListUserSchema.parse(response.Viewer);
  }

  async getUserStats(userId: number): Promise<AniListUserStats> {
    this.requireAuth();

    const response = await this.request<{ User: unknown }>(queries.GET_USER_STATS, { userId });
    return AniListUserStatsSchema.parse(response.User);
  }

  async getUserActivity(userId: number): Promise<AniListActivity[]> {
    this.requireAuth();

    const response = await this.request<{ Page: { activities: unknown[] } }>(
      queries.GET_USER_ACTIVITY,
      { userId },
    );

    const activities = response.Page.activities ?? [];
    const parsed: AniListActivity[] = [];
    for (const activity of activities) {
      const result = AniListActivitySchema.safeParse(activity);
      if (result.success) {
        parsed.push(result.data);
      }
    }
    return parsed;
  }

  async getNotifications(): Promise<AniListNotification[]> {
    this.requireAuth();

    const response = await this.request<{ Page: { notifications: unknown[] } }>(
      queries.GET_NOTIFICATIONS,
    );

    return response.Page.notifications.map((notification) =>
      AniListNotificationSchema.parse(notification),
    );
  }

  /**
   * Search for manga (guest-compatible)
   * @param query Search term
   * @param page Page number (default: 1)
   */
  async searchManga(
    query: string,
    page = 1,
    options: SearchOptions = {},
  ): Promise<SearchResult> {
    const response = await this.request<{ Page: unknown }>(queries.SEARCH_MANGA, {
      search: query || undefined,
      page,
      perPage: anilistConfig.defaults.searchPerPage,
      sort: options.sort ?? anilistConfig.defaults.searchSort,
      format: options.format || undefined,
      status: options.status || undefined,
      genre: options.genre || undefined,
      countryOfOrigin: options.country || undefined,
    });

    return SearchResultSchema.parse(response.Page);
  }

  async getTrendingManga(page = 1): Promise<SearchResult> {
    return this.searchManga('', page, { sort: ['TRENDING_DESC'] });
  }

  async getPopularManga(page = 1): Promise<SearchResult> {
    return this.searchManga('', page, { sort: ['POPULARITY_DESC'] });
  }

  async getTopRatedManga(page = 1): Promise<SearchResult> {
    return this.searchManga('', page, { sort: ['SCORE_DESC'] });
  }

  /**
   * Get detailed manga information (guest-compatible)
   * @param id AniList media ID
   */
  async getMangaDetails(id: number): Promise<AniListManga> {
    const response = await this.request<{ Media: unknown }>(queries.GET_MANGA_DETAILS, { id });

    return AniListMangaSchema.parse(response.Media);
  }

  /**
   * Get user's manga list
   * @param userId User ID
   * @param status Optional filter by status
   */
  async getUserMangaCollection(
    userId: number,
    status?: MediaListStatus,
  ): Promise<MediaListCollection> {
    this.requireAuth();

    const response = await this.request<{ MediaListCollection: unknown }>(
      queries.GET_USER_MANGA_LIST,
      { userId, status },
    );

    return MediaListCollectionSchema.parse(response.MediaListCollection);
  }

  async getUserMangaList(userId: number, status?: MediaListStatus): Promise<MediaListEntry[]> {
    this.requireAuth();

    const collection = await this.getUserMangaCollection(userId, status);
    const allEntries = collection.lists.flatMap((list) => list.entries);

    return allEntries.map((entry) => MediaListEntrySchema.parse(entry));
  }

  /**
   * Add manga to user's list
   * @param mediaId AniList media ID
   * @param status List status
   */
  async addToList(mediaId: number, status: MediaListStatus): Promise<MediaListEntry> {
    this.requireAuth();

    const response = await this.request<{ SaveMediaListEntry: unknown }>(
      mutations.SAVE_MEDIA_LIST_ENTRY,
      { mediaId, status },
    );

    return MediaListEntrySchema.parse(response.SaveMediaListEntry);
  }

  /**
   * Update reading progress
   * @param mediaId AniList media ID
   * @param progress Number of chapters read
   */
  async updateProgress(mediaId: number, progress: number): Promise<MediaListEntry> {
    this.requireAuth();

    const response = await this.request<{ SaveMediaListEntry: unknown }>(
      mutations.SAVE_MEDIA_LIST_ENTRY,
      { mediaId, progress },
    );

    return MediaListEntrySchema.parse(response.SaveMediaListEntry);
  }

  /**
   * Update list status
   * @param mediaId AniList media ID
   * @param status New status
   */
  async updateStatus(mediaId: number, status: MediaListStatus): Promise<MediaListEntry> {
    this.requireAuth();

    const response = await this.request<{ SaveMediaListEntry: unknown }>(
      mutations.SAVE_MEDIA_LIST_ENTRY,
      { mediaId, status },
    );

    return MediaListEntrySchema.parse(response.SaveMediaListEntry);
  }

  /**
   * Update user score/rating
   * @param mediaId AniList media ID
   * @param score Score (0-100)
   */
  async updateScore(mediaId: number, score: number): Promise<MediaListEntry> {
    this.requireAuth();

    const response = await this.request<{ SaveMediaListEntry: unknown }>(
      mutations.SAVE_MEDIA_LIST_ENTRY,
      { mediaId, score },
    );

    return MediaListEntrySchema.parse(response.SaveMediaListEntry);
  }

  /**
   * Update list entry with multiple fields
   */
  async updateEntry(input: UpdateEntryInput): Promise<MediaListEntry> {
    this.requireAuth();

    const response = await this.request<{ SaveMediaListEntry: unknown }>(
      mutations.SAVE_MEDIA_LIST_ENTRY,
      input,
    );

    return MediaListEntrySchema.parse(response.SaveMediaListEntry);
  }

  /**
   * Remove manga from user's list
   * @param entryId List entry ID
   */
  async removeFromList(entryId: number): Promise<boolean> {
    this.requireAuth();

    const response = await this.request<{ DeleteMediaListEntry: { deleted: boolean } }>(
      mutations.DELETE_MEDIA_LIST_ENTRY,
      { id: entryId },
    );

    return response.DeleteMediaListEntry.deleted;
  }

  /**
   * Toggle manga favorite status
   * @param mangaId AniList media ID
   */
  async toggleFavorite(mangaId: number): Promise<boolean> {
    this.requireAuth();

    await this.request(mutations.TOGGLE_FAVOURITE, { mangaId });

    return true; // AniList doesn't return the new state, just success
  }

  /**
   * Get user's favorite manga
   */
  async getFavorites(): Promise<AniListManga[]> {
    this.requireAuth();

    const user = await this.getCurrentUser();

    const response = await this.request<{ User: { favourites: { manga: { nodes: unknown[] } } } }>(
      queries.GET_FAVORITES,
      { userId: user.id },
    );

    return response.User.favourites.manga.nodes.map((node) => AniListMangaSchema.parse(node));
  }
}
