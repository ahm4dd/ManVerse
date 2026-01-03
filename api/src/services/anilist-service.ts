import {
  AniListAuth,
  AniListClient,
  type AuthToken,
  type MediaListStatus,
} from '@manverse/anilist';

function requireEnv(name: string): string {
  const value = Bun.env[name];
  if (!value) {
    throw new Error(`${name} is not configured`);
  }

  return value;
}

export class AniListService {
  private guestClient = AniListClient.create();

  private getClientWithToken(accessToken: string): AniListClient {
    return AniListClient.create({
      token: {
        accessToken,
        tokenType: 'Bearer',
        expiresIn: 0,
        expiresAt: Date.now(),
      },
    });
  }

  private getAuthClient(): AniListAuth {
    return new AniListAuth({
      clientId: requireEnv('ANILIST_CLIENT_ID'),
      clientSecret: requireEnv('ANILIST_CLIENT_SECRET'),
      redirectUri: Bun.env.ANILIST_REDIRECT_URI,
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
    return this.getClientWithToken(accessToken).getUserStats(userId);
  }

  async getUserActivity(userId: number, accessToken: string) {
    return this.getClientWithToken(accessToken).getUserActivity(userId);
  }

  async getNotifications(accessToken: string) {
    return this.getClientWithToken(accessToken).getNotifications();
  }

  async searchManga(query: string, page = 1) {
    return this.guestClient.searchManga(query, page);
  }

  async searchMangaWithFilters(
    query: string,
    page = 1,
    filters: { sort?: string[]; format?: string; status?: string; genre?: string; country?: string },
  ) {
    return this.guestClient.searchManga(query, page, filters);
  }

  async getTrending(page = 1) {
    return this.guestClient.getTrendingManga(page);
  }

  async getPopular(page = 1) {
    return this.guestClient.getPopularManga(page);
  }

  async getTopRated(page = 1) {
    return this.guestClient.getTopRatedManga(page);
  }

  async getMangaDetails(id: number) {
    return this.guestClient.getMangaDetails(id);
  }

  async getUserLibrary(userId: number, accessToken: string, status?: MediaListStatus) {
    return this.getClientWithToken(accessToken).getUserMangaCollection(userId, status);
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
