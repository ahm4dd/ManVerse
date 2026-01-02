import { AniListService } from './anilist-service.ts';
import { ScraperService } from './scraper-service.ts';

export type MangaSource = 'anilist' | 'asura' | 'both';

export class MangaService {
  constructor(
    private anilist = new AniListService(),
    private scraper = new ScraperService(),
  ) {}

  async search(query: string, source: MangaSource = 'anilist') {
    if (source === 'asura') {
      return this.scraper.search();
    }

    if (source === 'both') {
      const [anilist, provider] = await Promise.all([
        this.anilist.searchManga(query, 1),
        this.scraper.search().catch(() => null),
      ]);

      return {
        anilist,
        provider,
      };
    }

    return this.anilist.searchManga(query, 1);
  }

  async getMangaDetails(anilistId: number) {
    return this.anilist.getMangaDetails(anilistId);
  }
}
