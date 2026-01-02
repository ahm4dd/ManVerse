import { useAppStore } from '../state/store.js';
import { AsuraScansScarper } from '@manverse/scrapers';
import { searchLocalAnilist } from '@manverse/database';
import type { SearchedManhwa } from '@manverse/core';

export interface UnifiedSearchResults {
  anilist: Array<{ id: number; title: string; coverImage?: string }>;
  provider: SearchedManhwa[];
}

export class SearchService {
  private static instance: SearchService;
  private providerScraper: AsuraScansScarper;

  private constructor() {
    this.providerScraper = new AsuraScansScarper();
  }

  public static getInstance(): SearchService {
    if (!SearchService.instance) {
      SearchService.instance = new SearchService();
    }
    return SearchService.instance;
  }

  public async search(query: string): Promise<UnifiedSearchResults> {
    const results: UnifiedSearchResults = {
      anilist: [],
      provider: [],
    };

    if (!query.trim()) return results;

    const promises: Promise<void>[] = [];

    // 1. AniList Search
    promises.push(
      (async () => {
        try {
          // Local database search first
          const localResults = searchLocalAnilist(query);
          results.anilist = localResults.map((m) => ({
            id: m.id,
            title: m.title_romaji,
            coverImage: m.cover_image_url || undefined,
          }));
        } catch (e) {
          console.error('AniList search failed:', e);
        }
      })(),
    );

    // 2. Provider Search
    promises.push(
      (async () => {
        try {
          const browser = useAppStore.getState().browser;
          if (browser) {
            const page = await browser.newPage();
            try {
              const searchResult = await this.providerScraper.search(false, page, query, 1);
              if (searchResult && searchResult.results) {
                results.provider = searchResult.results;
              }
            } finally {
              await page.close();
            }
          }
        } catch (e) {
          console.error('Provider search failed:', e);
        }
      })(),
    );

    await Promise.allSettled(promises);
    return results;
  }
}
