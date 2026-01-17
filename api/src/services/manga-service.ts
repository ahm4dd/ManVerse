import { AniListService } from './anilist-service.ts';
import { ScraperService } from './scraper-service.ts';
import { Providers } from '@manverse/core';

export type MangaSource = 'anilist' | 'asura' | 'toonily' | 'mangagg' | 'mangafire' | 'both';

export class MangaService {
  constructor(
    private anilist = new AniListService(),
    private scraper = new ScraperService(),
  ) {}

  async search(
    query: string,
    source: MangaSource = 'anilist',
    filters?: { sort?: string[]; format?: string; status?: string; genre?: string; country?: string },
    page = 1,
  ) {
    if (source === 'asura') {
      return this.scraper.search(query, page, Providers.AsuraScans);
    }

    if (source === 'toonily') {
      return this.scraper.search(query, page, Providers.Toonily);
    }

    if (source === 'mangagg') {
      return this.scraper.search(query, page, Providers.MangaGG);
    }

    if (source === 'mangafire') {
      return this.scraper.search(query, page, Providers.MangaFire);
    }

    if (source === 'both') {
      const [anilist, provider] = await Promise.all([
        this.anilist.searchMangaWithFilters(query, page, filters || {}),
        this.scraper.search(query, page, Providers.AsuraScans).catch(() => null),
      ]);

      return {
        anilist,
        provider,
      };
    }

    return this.anilist.searchMangaWithFilters(query, page, filters || {});
  }

  async getMangaDetails(anilistId: number) {
    return this.anilist.getMangaDetails(anilistId);
  }
}
