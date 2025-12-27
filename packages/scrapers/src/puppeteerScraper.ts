import puppeteer, { type Browser, type Page } from 'puppeteer';
import {
  type IScraper,
  type SearchResult,
  type Manhwa,
  type ManhwaChapterImage,
} from '@manverse/core';
import { defaultBrowserConfig } from '../config/browser.config.ts';

export abstract class PuppeteerScraper implements IScraper {
  abstract name: string;
  protected browser: Browser | null = null;
  protected page: Page | null = null;

  async init() {
    if (this.browser) return;
    this.browser = await puppeteer.launch({
      headless: defaultBrowserConfig.headless,
      args: defaultBrowserConfig.args,
    });
    this.page = await this.browser.newPage();
    await this.page.setViewport(defaultBrowserConfig.viewport);
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }

  abstract search(query: string, page: number): Promise<SearchResult>;
  abstract getManhwa(url: string): Promise<Manhwa>;
  abstract getChapter(url: string): Promise<ManhwaChapterImage[]>;
  abstract downloadChapter(url: string, outputDir: string): Promise<void>;
}
