import type { Manhwa, ManhwaChapter, SearchResult } from '@manverse/core';

export class ScraperService {
  async search(_query: string, _page = 1): Promise<SearchResult> {
    throw new Error('Scraper service is not configured yet');
  }

  async getSeriesDetails(_id: string): Promise<Manhwa> {
    throw new Error('Scraper service is not configured yet');
  }

  async getChapterImages(_id: string): Promise<ManhwaChapter> {
    throw new Error('Scraper service is not configured yet');
  }
}
