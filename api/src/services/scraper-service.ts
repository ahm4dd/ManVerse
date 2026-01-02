import type { Manhwa, ManhwaChapter, SearchResult } from '@manverse/core';

export class ScraperService {
  async search(): Promise<SearchResult> {
    throw new Error('Scraper service is not configured yet');
  }

  async getSeriesDetails(): Promise<Manhwa> {
    throw new Error('Scraper service is not configured yet');
  }

  async getChapterImages(): Promise<ManhwaChapter> {
    throw new Error('Scraper service is not configured yet');
  }
}
