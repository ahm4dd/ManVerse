import axios from 'axios';
import * as cheerio from 'cheerio';
import {
  type IScraper,
  type SearchResult,
  type Manhwa,
  type ManhwaChapterImage,
} from '@manverse/core';

/**
 * Cheerio Scraper Adapter
 *
 * Ultra-lightweight scraper that uses plain HTTP requests and HTML parsing.
 * Use this for sites that don't have aggressive anti-bot protections.
 * ~90% less resource usage than Puppeteer.
 */
export class CheerioScraper implements IScraper {
  name = 'cheerio';

  async search(query: string, page: number): Promise<SearchResult> {
    // Implementation placeholder - would use axios and cheerio.load()
    throw new Error('Cheerio search not implemented for this provider yet');
  }

  async getManhwa(url: string): Promise<Manhwa> {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);
    // Extract data using jQuery-like selectors
    throw new Error('Cheerio getManhwa not implemented for this provider yet');
  }

  async getChapter(url: string): Promise<ManhwaChapterImage[]> {
    throw new Error('Method not implemented.');
  }

  async downloadChapter(url: string, outputDir: string): Promise<void> {
    throw new Error('Method not implemented.');
  }
}
