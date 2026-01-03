import { Providers, type Manhwa, type ManhwaChapter, type SearchResult } from '@manverse/core';
import { ScraperFactory, asuraScansConfig, type ScraperConfig } from '@manverse/scrapers';
import puppeteer, { type Browser, type Page } from 'puppeteer';

type Provider = typeof Providers[keyof typeof Providers];

const DEFAULT_VIEWPORT = { width: 1366, height: 768 };

interface Scraper {
  config: ScraperConfig;
  search(consumet: boolean, page: Page, term: string, pageNumber?: number): Promise<SearchResult>;
  checkManhwa(page: Page, url: string): Promise<Manhwa>;
  checkManhwaChapter(page: Page, url: string): Promise<ManhwaChapter>;
}

function getLaunchArgs(): string[] {
  const args = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'];
  if (Bun.env.PUPPETEER_DISABLE_GPU === 'true') {
    args.push('--disable-gpu');
  }
  return args;
}

export class ScraperService {
  private static browser: Browser | null = null;
  private static scrapers = new Map<Provider, Scraper>();

  private async getBrowser(): Promise<Browser> {
    if (ScraperService.browser) {
      return ScraperService.browser;
    }

    const executablePath = Bun.env.PUPPETEER_EXECUTABLE_PATH;
    ScraperService.browser = await puppeteer.launch({
      headless: Bun.env.PUPPETEER_HEADLESS === 'false' ? false : 'new',
      executablePath: executablePath && executablePath.trim().length > 0 ? executablePath : undefined,
      args: getLaunchArgs(),
    });

    return ScraperService.browser;
  }

  private getScraper(provider: Provider): Scraper {
    const existing = ScraperService.scrapers.get(provider);
    if (existing) {
      return existing;
    }

    const scraper = ScraperFactory.createScraper(provider, asuraScansConfig);
    ScraperService.scrapers.set(provider, scraper);
    return scraper;
  }

  private async withPage<T>(
    provider: Provider,
    handler: (page: Page, scraper: IScraper) => Promise<T>,
  ): Promise<T> {
    const browser = await this.getBrowser();
    const scraper = this.getScraper(provider);
    const page = await browser.newPage();

    try {
      await page.setViewport(DEFAULT_VIEWPORT);
      if (scraper.config.headers?.userAgent) {
        await page.setUserAgent(scraper.config.headers.userAgent);
      }
      if (scraper.config.headers?.referer) {
        await page.setExtraHTTPHeaders({ Referer: scraper.config.headers.referer });
      }
      return await handler(page, scraper);
    } finally {
      await page.close();
    }
  }

  async search(query: string, page = 1, provider: Provider = Providers.AsuraScans): Promise<SearchResult> {
    return this.withPage(provider, (pageInstance, scraper) =>
      scraper.search(false, pageInstance, query, page),
    );
  }

  async getSeriesDetails(
    id: string,
    provider: Provider = Providers.AsuraScans,
  ): Promise<Manhwa> {
    return this.withPage(provider, (pageInstance, scraper) => scraper.checkManhwa(pageInstance, id));
  }

  async getChapterImages(
    id: string,
    provider: Provider = Providers.AsuraScans,
  ): Promise<ManhwaChapter> {
    return this.withPage(provider, (pageInstance, scraper) =>
      scraper.checkManhwaChapter(pageInstance, id),
    );
  }

  async close(): Promise<void> {
    if (ScraperService.browser) {
      await ScraperService.browser.close();
      ScraperService.browser = null;
    }
  }
}
