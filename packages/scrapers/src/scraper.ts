import type { Page } from 'puppeteer';
import { SearchResult, Manhwa, ManhwaChapter } from './types.ts';

export default abstract class Scraper {
  #baseUrl: string = '';

  constructor() {}

  abstract search(
    consumet?: boolean,
    page?: Page,
    term?: string,
  ): Promise<SearchResult> | SearchResult;
  abstract checkManhwa(page: Page, url: string): Promise<Manhwa>;
  abstract checkManhwaChapter(page: Page, url: string): Promise<ManhwaChapter>;
}
