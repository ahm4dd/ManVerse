import type { Page } from 'puppeteer';
import type { SearchResult, Manhwa, ManhwaChapter } from '@manverse/core';
import type { ScraperConfig } from '../config/types.ts';

export default interface IScraper {
  config: ScraperConfig;

  search(
    consumet: boolean,
    page: Page,
    term: string,
    pageNumber?: number,
  ): Promise<SearchResult>;
  checkManhwa(page: Page, url: string): Promise<Manhwa>;
  checkManhwaChapter(page: Page, url: string): Promise<ManhwaChapter>;
}
