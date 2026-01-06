import { Providers, type Manhwa, type ManhwaChapter, type SearchResult } from '@manverse/core';
import { ScraperFactory, ScraperCache, asuraScansConfig, type ScraperConfig } from '@manverse/scrapers';
import puppeteer, { type Browser, type Page } from 'puppeteer';
import { MemoryCache } from '../utils/cache.ts';

type Provider = typeof Providers[keyof typeof Providers];

const DEFAULT_VIEWPORT = { width: 1366, height: 768 };
const BLOCKED_RESOURCE_TYPES = new Set(['image', 'stylesheet', 'font', 'media']);
const DEFAULT_CACHE_TTL_MS = {
  search: 5 * 60 * 1000,
  details: 20 * 60 * 1000,
  chapter: 20 * 60 * 1000,
};
const DISK_CACHE_TTL_MS = {
  search: 30 * 60 * 1000,
  details: 4 * 60 * 60 * 1000,
  chapter: 12 * 60 * 60 * 1000,
};

type PageOptions = {
  blockResources?: boolean;
  allowImages?: boolean;
};

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
  private static cache = new MemoryCache();
  private static diskCache = new ScraperCache('api-scraper');

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
    handler: (page: Page, scraper: Scraper) => Promise<T>,
    options?: PageOptions,
  ): Promise<T> {
    const browser = await this.getBrowser();
    const scraper = this.getScraper(provider);
    const page = await browser.newPage();

    try {
      await page.setViewport(DEFAULT_VIEWPORT);
      await page.setCacheEnabled(true);
      if (options?.blockResources) {
        await page.setRequestInterception(true);
        page.on('request', (request) => {
          const type = request.resourceType();
          if (type === 'image' && options.allowImages) {
            request.continue();
            return;
          }
          if (BLOCKED_RESOURCE_TYPES.has(type)) {
            request.abort();
            return;
          }
          request.continue();
        });
      }
      if (scraper.config.timeout) {
        page.setDefaultNavigationTimeout(scraper.config.timeout);
        page.setDefaultTimeout(scraper.config.timeout);
      }
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
    const normalizedQuery = query.trim().toLowerCase();
    const cacheKey = `provider:${provider}:search:${normalizedQuery}:${page}`;
    const diskCached = ScraperService.diskCache.get<SearchResult>(cacheKey);
    if (diskCached) {
      await ScraperService.cache.getOrLoad(cacheKey, DEFAULT_CACHE_TTL_MS.search, async () => diskCached);
      return diskCached;
    }
    return ScraperService.cache.getOrLoad(cacheKey, DEFAULT_CACHE_TTL_MS.search, async () => {
      const result = await this.withPage(
        provider,
        (pageInstance, scraper) => scraper.search(false, pageInstance, query, page),
        { blockResources: true },
      );
      ScraperService.diskCache.set(cacheKey, result, DISK_CACHE_TTL_MS.search);
      return result;
    });
  }

  async getSeriesDetails(
    id: string,
    provider: Provider = Providers.AsuraScans,
  ): Promise<Manhwa> {
    const cacheKey = `provider:${provider}:details:${id.trim()}`;
    const diskCached = ScraperService.diskCache.get<Manhwa>(cacheKey);
    if (diskCached) {
      await ScraperService.cache.getOrLoad(cacheKey, DEFAULT_CACHE_TTL_MS.details, async () => diskCached);
      return diskCached;
    }
    return ScraperService.cache.getOrLoad(cacheKey, DEFAULT_CACHE_TTL_MS.details, async () => {
      const result = await this.withPage(
        provider,
        (pageInstance, scraper) => scraper.checkManhwa(pageInstance, id),
        { blockResources: true },
      );
      ScraperService.diskCache.set(cacheKey, result, DISK_CACHE_TTL_MS.details);
      return result;
    });
  }

  async getChapterImages(
    id: string,
    provider: Provider = Providers.AsuraScans,
  ): Promise<ManhwaChapter> {
    const cacheKey = `provider:${provider}:chapter:${id.trim()}`;
    const diskCached = ScraperService.diskCache.get<ManhwaChapter>(cacheKey);
    if (diskCached) {
      await ScraperService.cache.getOrLoad(cacheKey, DEFAULT_CACHE_TTL_MS.chapter, async () => diskCached);
      return diskCached;
    }
    return ScraperService.cache.getOrLoad(cacheKey, DEFAULT_CACHE_TTL_MS.chapter, async () => {
      const result = await this.withPage(
        provider,
        (pageInstance, scraper) => scraper.checkManhwaChapter(pageInstance, id),
        { blockResources: true },
      );
      ScraperService.diskCache.set(cacheKey, result, DISK_CACHE_TTL_MS.chapter);
      return result;
    });
  }

  async close(): Promise<void> {
    if (ScraperService.browser) {
      await ScraperService.browser.close();
      ScraperService.browser = null;
    }
  }
}
