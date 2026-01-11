import {
  AniListAuth,
  AniListClient,
  anilistConfig,
  type AuthToken,
  type MediaListStatus,
} from '@manverse/anilist';
import { MemoryCache } from '../utils/cache.ts';

function requireEnv(name: string): string {
  const value = Bun.env[name];
  if (!value) {
    throw new Error(`${name} is not configured`);
  }

  return value;
}

export class AniListService {
  private guestClient = AniListClient.create();
  private cache = new MemoryCache();
  private userClients = new Map<string, AniListClient>();
  private userCacheTtl = {
    library: 60,
    stats: 120,
    activity: 60,
    notifications: 60,
  };

  private async cached<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
    const ttlMs = Math.max(0, ttlSeconds) * 1000;
    return this.cache.getOrLoad(key, ttlMs, loader);
  }

  private getClientWithToken(accessToken: string): AniListClient {
    const cached = this.userClients.get(accessToken);
    if (cached) return cached;

    const client = AniListClient.create({
      token: {
        accessToken,
        tokenType: 'Bearer',
        expiresIn: 0,
        expiresAt: Date.now(),
      },
    });
    this.userClients.set(accessToken, client);
    return client;
  }

  private getAuthClient(): AniListAuth {
    const port = Bun.env.PORT || '3001';
    const defaultRedirectUri = `http://localhost:${port}/api/auth/anilist/callback`;
    return new AniListAuth({
      clientId: requireEnv('ANILIST_CLIENT_ID'),
      clientSecret: requireEnv('ANILIST_CLIENT_SECRET'),
      redirectUri: Bun.env.ANILIST_REDIRECT_URI || defaultRedirectUri,
    });
  }

  getAuthorizationUrl(): string {
    return this.getAuthClient().getAuthorizationUrl();
  }

  async exchangeCodeForToken(code: string): Promise<AuthToken> {
    const auth = this.getAuthClient();
    return auth.exchangeCodeForToken(code);
  }

  async getCurrentUser(token: AuthToken) {
    const client = AniListClient.create({ token });
    return client.getCurrentUser();
  }

  async getUserStats(userId: number, accessToken: string) {
    const key = `user:${userId}:stats`;
    return this.cached(key, this.userCacheTtl.stats, () =>
      this.getClientWithToken(accessToken).getUserStats(userId),
    );
  }

  async getUserActivity(userId: number, accessToken: string) {
    const key = `user:${userId}:activity`;
    return this.cached(key, this.userCacheTtl.activity, () =>
      this.getClientWithToken(accessToken).getUserActivity(userId),
    );
  }

  async getNotifications(accessToken: string) {
    const key = `user:${accessToken}:notifications`;
    return this.cached(key, this.userCacheTtl.notifications, () =>
      this.getClientWithToken(accessToken).getNotifications(),
    );
  }

  async searchManga(query: string, page = 1) {
    const key = `search:${JSON.stringify({ query, page })}`;
    return this.cached(key, anilistConfig.cache.searchResults, () =>
      this.guestClient.searchManga(query, page),
    );
  }

  async searchMangaWithFilters(
    query: string,
    page = 1,
    filters: { sort?: string[]; format?: string; status?: string; genre?: string; country?: string },
  ) {
    const key = `search:${JSON.stringify({ query, page, filters })}`;
    return this.cached(key, anilistConfig.cache.searchResults, () =>
      this.guestClient.searchManga(query, page, filters),
    );
  }

  async getTrending(page = 1) {
    const key = `trending:${page}`;
    return this.cached(key, anilistConfig.cache.searchResults, () =>
      this.guestClient.getTrendingManga(page),
    );
  }

  async getPopular(page = 1) {
    const key = `popular:${page}`;
    return this.cached(key, anilistConfig.cache.searchResults, () =>
      this.guestClient.getPopularManga(page),
    );
  }

  async getTopRated(page = 1) {
    const key = `top-rated:${page}`;
    return this.cached(key, anilistConfig.cache.searchResults, () =>
      this.guestClient.getTopRatedManga(page),
    );
  }

  async getMangaDetails(id: number) {
    const key = `media:${id}`;
    return this.cached(key, anilistConfig.cache.mediaDetails, () =>
      this.guestClient.getMangaDetails(id),
    );
  }

  async getMangaDetailsForUser(accessToken: string, id: number) {
    return this.getClientWithToken(accessToken).getMangaDetails(id);
  }

  async getUserLibrary(userId: number, accessToken: string, status?: MediaListStatus) {
    const statusKey = status ?? 'ALL';
    const key = `user:${userId}:library:${statusKey}`;
    return this.cached(key, this.userCacheTtl.library, () =>
      this.getClientWithToken(accessToken).getUserMangaCollection(userId, status),
    );
  }

  async updateProgress(accessToken: string, mediaId: number, progress: number) {
    return this.getClientWithToken(accessToken).updateProgress(mediaId, progress);
  }

  async updateStatus(accessToken: string, mediaId: number, status: MediaListStatus) {
    return this.getClientWithToken(accessToken).updateStatus(mediaId, status);
  }

  async updateEntry(accessToken: string, input: {
    mediaId: number;
    status?: MediaListStatus;
    score?: number;
    progress?: number;
    notes?: string;
  }) {
    return this.getClientWithToken(accessToken).updateEntry(input);
  }

  async addToList(accessToken: string, mediaId: number, status: MediaListStatus) {
    return this.getClientWithToken(accessToken).addToList(mediaId, status);
  }

  async removeFromList(accessToken: string, entryId: number) {
    return this.getClientWithToken(accessToken).removeFromList(entryId);
  }
}
