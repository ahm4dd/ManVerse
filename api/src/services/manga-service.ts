import { AniListService } from './anilist-service.ts';
import { ScraperService } from './scraper-service.ts';

export type MangaSource = 'anilist' | 'asura' | 'both';

export class MangaService {
  constructor(
    private anilist = new AniListService(),
    private scraper = new ScraperService(),
  ) {}

  async search(
    query: string,
    source: MangaSource = 'anilist',
    filters?: { sort?: string[]; format?: string; status?: string; genre?: string; country?: string },
  ) {
    if (source === 'asura') {
      return this.scraper.search(query);
    }

    if (source === 'both') {
      const [anilist, provider] = await Promise.all([
        this.anilist.searchMangaWithFilters(query, 1, filters || {}),
        this.scraper.search(query).catch(() => null),
      ]);

      return {
        anilist,
        provider,
      };
    }

    return this.anilist.searchMangaWithFilters(query, 1, filters || {});
  }

  async getMangaDetails(anilistId: number) {
    return this.anilist.getMangaDetails(anilistId);
  }
}
