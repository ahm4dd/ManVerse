import type { AniListClient } from '@manverse/anilist';
import {
  saveAnilistManga,
  getAnilistManga,
  isAnilistDataStale,
  bulkInsertAnilist,
  type AniListMangaInput,
} from '../operations/anilist.js';
import { getAnilistTTL } from '../config/cache.config.js';

/**
 * Cached wrapper for AniList client
 * Checks database before hitting API
 */
export class CachedAniListClient {
  constructor(private client: AniListClient) {}

  /**
   * Get manga by ID with caching
   * Checks DB first, fetches from API if stale/missing
   */
  async getManga(id: number): Promise<any> {
    // Check cache
    const cached = getAnilistManga(id);

    if (cached) {
      const ttl = getAnilistTTL(cached.status);
      const isStale = isAnilistDataStale(id, ttl);

      if (!isStale) {
        return this.transformToClientFormat(cached);
      }
    }

    // Cache miss or stale - fetch from API
    const fresh = await this.client.getManga(id);

    // Save to cache
    saveAnilistManga(this.transformToDbFormat(fresh));

    return fresh;
  }

  /**
   * Search with caching
   * Always hits API (search results change frequently)
   * But caches individual manga entries
   */
  async search(query: string, page = 1, perPage = 20): Promise<any> {
    const results = await this.client.search(query, page, perPage);

    // Cache each result
    for (const manga of results.media || []) {
      saveAnilistManga(this.transformToDbFormat(manga));
    }

    return results;
  }

  /**
   * Warm cache by fetching user's manga list
   * Bulk saves to database for fast subsequent lookups
   */
  async warmCacheFromUserList(userId: number): Promise<number> {
    const lists = await this.client.getUserList(userId);
    const allManga: AniListMangaInput[] = [];

    // Extract manga from all list entries
    for (const entry of lists.lists || []) {
      for (const item of entry.entries || []) {
        if (item.media) {
          allManga.push(this.transformToDbFormat(item.media));
        }
      }
    }

    // Bulk insert
    if (allManga.length > 0) {
      bulkInsertAnilist(allManga);
    }

    console.log(`✅ Cached ${allManga.length} manga from user list`);
    return allManga.length;
  }

  /**
   * Transform AniList API response to DB format
   */
  private transformToDbFormat(apiManga: any): AniListMangaInput {
    return {
      id: apiManga.id,
      title_romaji: apiManga.title.romaji,
      title_english: apiManga.title.english,
      title_native: apiManga.title.native,
      synonyms: apiManga.synonyms ? JSON.stringify(apiManga.synonyms) : null,
      description: apiManga.description,
      cover_image_url: apiManga.coverImage?.large || apiManga.coverImage?.medium,
      banner_image_url: apiManga.bannerImage,
      status: apiManga.status,
      format: apiManga.format,
      chapters: apiManga.chapters,
      volumes: apiManga.volumes,
      start_date: apiManga.startDate ? this.formatDate(apiManga.startDate) : null,
      end_date: apiManga.endDate ? this.formatDate(apiManga.endDate) : null,
      genres: JSON.stringify(apiManga.genres || []),
      tags: apiManga.tags ? JSON.stringify(apiManga.tags) : null,
      average_score: apiManga.averageScore,
      mean_score: apiManga.meanScore,
      popularity: apiManga.popularity,
      favorites: apiManga.favourites,
      is_adult: apiManga.isAdult ? 1 : 0,
      site_url: apiManga.siteUrl,
      last_updated: Date.now(),
    };
  }

  /**
   * Transform DB format back to client format
   */
  private transformToClientFormat(dbManga: any): any {
    return {
      id: dbManga.id,
      title: {
        romaji: dbManga.title_romaji,
        english: dbManga.title_english,
        native: dbManga.title_native,
      },
      synonyms: dbManga.synonyms ? JSON.parse(dbManga.synonyms) : [],
      description: dbManga.description,
      coverImage: {
        large: dbManga.cover_image_url,
        medium: dbManga.cover_image_url,
      },
      bannerImage: dbManga.banner_image_url,
      status: dbManga.status,
      format: dbManga.format,
      chapters: dbManga.chapters,
      volumes: dbManga.volumes,
      genres: JSON.parse(dbManga.genres),
      tags: dbManga.tags ? JSON.parse(dbManga.tags) : null,
      averageScore: dbManga.average_score,
      meanScore: dbManga.mean_score,
      popularity: dbManga.popularity,
      favourites: dbManga.favorites,
      isAdult: dbManga.is_adult === 1,
      siteUrl: dbManga.site_url,
    };
  }

  /**
   * Format AniList date object to ISO string
   */
  private formatDate(date: { year?: number; month?: number; day?: number }): string | null {
    if (!date.year) return null;

    const year = date.year;
    const month = (date.month || 1).toString().padStart(2, '0');
    const day = (date.day || 1).toString().padStart(2, '0');

    return `${year}-${month}-${day}`;
  }
}
