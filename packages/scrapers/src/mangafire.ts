import type { Page, HTTPRequest, HTTPResponse } from 'puppeteer';
import type { Manhwa, ManhwaChapter, SearchResult } from '@manverse/core';
import { mangafireConfig, type MangaFireConfig } from '../config/index.ts';
import type IScraper from './scraper.ts';
import { ScraperCache } from './cache.ts';

export default class MangaFireScraper implements IScraper {
  config: MangaFireConfig;
  private cache: ScraperCache;
  private vrfCache = new Map<string, { value: string; ts: number }>();

  constructor(config: MangaFireConfig = mangafireConfig) {
    this.config = config;
    this.cache = new ScraperCache('mangafire');
  }

  private sleep(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
  }

  private normalizedBaseUrl(): string {
    return this.config.baseUrl.endsWith('/') ? this.config.baseUrl : `${this.config.baseUrl}/`;
  }

  private normalizedBaseRoot(): string {
    const base = this.normalizedBaseUrl();
    return base.endsWith('/') ? base.slice(0, -1) : base;
  }

  private normalizeSearchTerm(value: string): string {
    return value.trim().replace(/\s+/g, ' ');
  }

  private async captureFilterUrl(page: Page, term: string): Promise<string | null> {
    const normalizedTerm = this.normalizeSearchTerm(term);
    if (!normalizedTerm) return null;

    const cacheKey = `filter-url:${normalizedTerm.toLowerCase()}`;
    const cached = this.cache.get<string>(cacheKey);
    if (cached) return cached;

    const baseRoot = this.normalizedBaseRoot();
    const baseOrigin = new URL(baseRoot).origin;
    const selectors = this.config.selectors.search;
    const expectedKeyword = normalizedTerm.toLowerCase();
    let capturedUrl: string | null = null;

    const matchesFilterRequest = (requestUrl: string) => {
      try {
        const parsed = new URL(requestUrl);
        if (parsed.origin !== baseOrigin) return false;
        const pathname = parsed.pathname.replace(/\/+$/, '');
        if (pathname !== '/filter') return false;
        const keyword = parsed.searchParams.get('keyword') ?? '';
        const vrf = parsed.searchParams.get('vrf') ?? '';
        if (!keyword || !vrf) return false;
        const normalizedKeyword = this.normalizeSearchTerm(keyword).toLowerCase();
        return normalizedKeyword === expectedKeyword;
      } catch {
        return false;
      }
    };

    const requestListener = (request: HTTPRequest) => {
      if (matchesFilterRequest(request.url())) {
        capturedUrl = request.url();
      }
    };

    const attemptCapture = async (targetUrl: string) => {
      const requestPromise = page
        .waitForRequest((request) => matchesFilterRequest(request.url()), { timeout: 6000 })
        .catch(() => null);
      try {
        await page.goto(targetUrl, {
          waitUntil: 'domcontentloaded',
          timeout: Math.min(12000, this.config.timeout ?? 12000),
        });
      } catch {
        // Ignore navigation failures and attempt a direct submit anyway.
      }
      try {
        await page.waitForSelector(selectors.form, { timeout: 4000 });
      } catch {
        // Ignore missing form; submission will no-op.
      }
      try {
        await page.evaluate(
          (searchSelectors, value) => {
            const form = document.querySelector(searchSelectors.form) as HTMLFormElement | null;
            const input = document.querySelector(searchSelectors.keywordInput) as
              | HTMLInputElement
              | null;
            if (!form || !input) return;
            input.value = value;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            if (typeof form.requestSubmit === 'function') {
              form.requestSubmit();
            } else {
              form.submit();
            }
          },
          selectors,
          normalizedTerm,
        );
      } catch {
        // Ignore DOM submission failures.
      }
      const request = await requestPromise;
      if (request) {
        capturedUrl = request.url();
      }
    };

    page.on('request', requestListener);
    try {
      await attemptCapture(`${baseRoot}/home`);
      if (!capturedUrl) {
        await attemptCapture(baseRoot);
      }
    } finally {
      page.off('request', requestListener);
      try {
        await page.goto('about:blank', { waitUntil: 'domcontentloaded', timeout: 1000 });
      } catch {
        // Ignore reset failures.
      }
    }

    if (capturedUrl) {
      this.cache.set(cacheKey, capturedUrl, 5 * 60 * 1000);
    }
    return capturedUrl;
  }

  private async captureChapterAjaxUrl(
    page: Page,
    chapterUrl: string,
    timeoutMs: number,
    _blockedResourceTypes: Set<string>,
    _blockedHosts: Set<string>,
    preservePage = false,
  ): Promise<string | null> {
    const baseRoot = this.normalizedBaseRoot();
    let capturedUrl: string | null = null;
    const maxAttempts = 2;
    const navTimeout = Math.min(6000, timeoutMs);
    const requestTimeout = Math.min(6500, timeoutMs);

    const matchesAjaxRequest = (requestUrl: string) => {
      try {
        const parsed = new URL(requestUrl);
        if (!parsed.pathname.includes('/ajax/read/chapter/')) return false;
        return parsed.searchParams.has('vrf');
      } catch {
        return false;
      }
    };

    const isHomeRedirect = (currentUrl: string) => {
      try {
        const parsed = new URL(currentUrl);
        if (parsed.origin !== new URL(baseRoot).origin) return false;
        const path = parsed.pathname.replace(/\/+$/, '');
        return path === '' || path === '/' || path === '/home';
      } catch {
        return false;
      }
    };

    const requestListener = (request: HTTPRequest) => {
      const reqUrl = request.url();
      if (matchesAjaxRequest(reqUrl)) {
        capturedUrl = reqUrl;
      }
    };

    page.on('request', requestListener);
    try {
      for (let attempt = 0; attempt < maxAttempts && !capturedUrl; attempt += 1) {
        const requestPromise = page
          .waitForRequest((request) => matchesAjaxRequest(request.url()), {
            timeout: requestTimeout,
          })
          .catch(() => null);

        try {
          await page.goto(chapterUrl, { waitUntil: 'domcontentloaded', timeout: navTimeout });
        } catch {
          // Ignore navigation failures; request capture may still have happened.
        }

        if (!capturedUrl && isHomeRedirect(page.url())) {
          try {
            await page.evaluate(() => window.stop());
          } catch {
            // Ignore stop-loading failures.
          }
          try {
            await page.goto('about:blank', { waitUntil: 'domcontentloaded', timeout: 1000 });
          } catch {
            // Ignore reset failures.
          }
          await this.sleep(120);
          continue;
        }

        const request = await requestPromise;
        if (!capturedUrl && request) {
          capturedUrl = request.url();
        }

        if (!capturedUrl) {
          try {
            await page.evaluate(() => window.stop());
          } catch {
            // Ignore stop-loading failures.
          }
          try {
            await page.goto('about:blank', { waitUntil: 'domcontentloaded', timeout: 1000 });
          } catch {
            // Ignore reset failures.
          }
          await this.sleep(120);
        }
      }
    } finally {
      page.off('request', requestListener);
      try {
        await page.evaluate(() => window.stop());
      } catch {
        // Ignore stop-loading failures.
      }
      if (!preservePage) {
        try {
          await page.goto('about:blank', { waitUntil: 'domcontentloaded', timeout: 1000 });
        } catch {
          // Ignore reset failures.
        }
      }
    }

    return capturedUrl;
  }

  private async applyPageHeaders(page: Page): Promise<void> {
    if (this.config.headers?.userAgent) {
      await page.setUserAgent(this.config.headers.userAgent);
    }
    const extraHeaders: Record<string, string> = {
      'Accept-Language': 'en-US,en;q=0.9',
    };
    if (this.config.headers?.referer) {
      extraHeaders.Referer = this.config.headers.referer;
    }
    await page.setExtraHTTPHeaders(extraHeaders);
  }

  private async applyStealth(page: Page): Promise<void> {
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      const chromeData = (window as any).chrome || {};
      if (!chromeData.runtime) {
        chromeData.runtime = {};
      }
      Object.defineProperty(window, 'chrome', {
        get: () => chromeData,
      });
    });
  }

  private buildFetchHeaders(referer?: string, extraHeaders: Record<string, string> = {}) {
    const headers: Record<string, string> = {
      'Accept-Language': 'en-US,en;q=0.9',
    };
    if (this.config.headers?.userAgent) {
      headers['User-Agent'] = this.config.headers.userAgent;
    }
    if (referer) {
      headers.Referer = referer;
    }
    return { ...headers, ...extraHeaders };
  }

  private async fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  }

  private unwrapHtmlResult(payload: unknown): string | null {
    if (!payload || typeof payload !== 'object') return null;
    const record = payload as { result?: unknown; html?: unknown };
    if (typeof record.result === 'string') return record.result;
    if (record.result && typeof record.result === 'object') {
      const nested = record.result as { html?: unknown; result?: unknown; data?: unknown };
      if (typeof nested.html === 'string') return nested.html;
      if (typeof nested.result === 'string') return nested.result;
      if (typeof nested.data === 'string') return nested.data;
    }
    if (typeof record.html === 'string') return record.html;
    return null;
  }

  private async fetchHtml(url: string, referer: string, timeoutMs = 8000) {
    try {
      const response = await this.fetchWithTimeout(
        url,
        {
          headers: this.buildFetchHeaders(referer),
        },
        timeoutMs,
      );
      if (!response.ok) {
        return null;
      }
      const text = await response.text();
      const trimmed = text.trim();
      if (trimmed.startsWith('{')) {
        try {
          const payload = JSON.parse(trimmed);
          const html = this.unwrapHtmlResult(payload);
          if (html) return html;
        } catch {
          // Ignore JSON parsing errors and return raw text.
        }
      }
      return text;
    } catch {
      return null;
    }
  }

  private async fetchJson<T>(
    url: string,
    referer: string,
    timeoutMs = 8000,
    extraHeaders: Record<string, string> = {},
  ): Promise<T | null> {
    try {
      const response = await this.fetchWithTimeout(
        url,
        {
          headers: this.buildFetchHeaders(referer, extraHeaders),
        },
        timeoutMs,
      );
      if (!response.ok) {
        return null;
      }
      const text = await response.text();
      try {
        return JSON.parse(text) as T;
      } catch {
        return null;
      }
    } catch {
      return null;
    }
  }

  private extractHidFromUrl(value: string): string {
    try {
      const parsed = new URL(value);
      const segments = parsed.pathname.split('/').filter(Boolean);
      for (const segment of segments) {
        if (segment.includes('.')) {
          return segment.split('.').pop() ?? '';
        }
      }
    } catch {
      // Ignore invalid URLs.
    }
    return '';
  }

  async search(
    consumet: boolean,
    page: Page,
    term: string,
    pageNumber: number = 1,
  ): Promise<SearchResult> {
    if (consumet) {
      throw new Error(`Consumet should not be activated for ${this.config.baseUrl}`);
    }

    const trimmed = this.normalizeSearchTerm(term);
    if (!trimmed) {
      return { currentPage: pageNumber, hasNextPage: false, results: [] };
    }

    const cacheKey = `search:${trimmed}:${pageNumber}`;
    const cached = this.cache.get<SearchResult>(cacheKey);
    if (cached && cached.results.length > 0) {
      console.log(`[Cache] Returning cached search results for "${trimmed}"`);
      return cached;
    }

    const baseRoot = this.normalizedBaseRoot();
    let html: string | null = null;
    const filterUrl = await this.captureFilterUrl(page, trimmed);
    if (filterUrl) {
      try {
        const filterSearchUrl = new URL(filterUrl);
        if (pageNumber > 1) {
          filterSearchUrl.searchParams.set('page', `${pageNumber}`);
        }
        html = await this.fetchHtml(filterSearchUrl.toString(), `${baseRoot}/`);
      } catch {
        html = null;
      }
    }
    if (!html) {
      const searchUrl = new URL(`${baseRoot}/az-list`);
      searchUrl.searchParams.set('keyword', trimmed);
      if (pageNumber > 1) {
        searchUrl.searchParams.set('page', `${pageNumber}`);
      }
      html = await this.fetchHtml(searchUrl.toString(), `${baseRoot}/`);
    }
    if (!html) {
      return { currentPage: pageNumber, hasNextPage: false, results: [] };
    }

    const selectors = this.config.selectors.search;
    const parsed = await page.evaluate(
      (rawHtml, searchSelectors, baseRootValue) => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(rawHtml, 'text/html');

        const normalizeText = (value?: string | null) =>
          value?.replace(/\s+/g, ' ').trim() ?? '';

        const normalizeUrl = (src?: string | null) => {
          const cleaned = src?.trim() || '';
          if (!cleaned) return '';
          if (cleaned.startsWith('http')) return cleaned;
          if (cleaned.startsWith('//')) return `https:${cleaned}`;
          const normalized = cleaned.startsWith('/') ? cleaned : `/${cleaned}`;
          return `${baseRootValue}${normalized}`;
        };

        const sanitizeTitle = (value: string) => {
          if (!value) return value;
          let next = value.trim();
          if (/^read\b/i.test(next)) {
            next = next.replace(/^read\b[:\s-]*/i, '');
          }
          return next || value;
        };

        const seen = new Set<string>();
        const items: Array<{
          link: string;
          title: string;
          image: string;
          rating: string;
          chapters: string;
        }> = [];

        const containers = Array.from(doc.querySelectorAll(searchSelectors.resultContainer));

        const resolveAnchor = (root: Element) => {
          const anchor = root.querySelector(searchSelectors.link) as HTMLAnchorElement | null;
          if (anchor?.getAttribute('href')) return anchor;
          return root.querySelector('a.poster') as HTMLAnchorElement | null;
        };

        const resolveImage = (root: Element | null) => {
          if (!root) return '';
          const img = root.querySelector(searchSelectors.image) as HTMLImageElement | null;
          if (!img) return '';
          const src =
            img.getAttribute('data-src') ||
            img.getAttribute('data-original') ||
            img.getAttribute('data-lazy-src') ||
            img.getAttribute('src') ||
            '';
          return normalizeUrl(src);
        };

        const resolveTitle = (root: Element | null, anchor: HTMLAnchorElement | null) => {
          const heading = root?.querySelector(searchSelectors.title) as HTMLElement | null;
          const fromHeading = normalizeText(heading?.textContent);
          const fromAnchor = normalizeText(anchor?.getAttribute('title'));
          const fromText = normalizeText(anchor?.textContent);
          const img = root?.querySelector('img') as HTMLImageElement | null;
          const fromImg = normalizeText(img?.getAttribute('alt'));
          const raw = fromHeading || fromAnchor || fromText || fromImg;
          return sanitizeTitle(raw);
        };

        const resolveMeta = (root: Element | null, selector: string) => {
          if (!root) return '';
          const element = root.querySelector(selector);
          return normalizeText(element?.textContent);
        };

        containers.forEach((container) => {
          const anchor = resolveAnchor(container);
          const rawLink = anchor?.getAttribute('href') || '';
          const link = normalizeUrl(rawLink);
          if (!link || !link.includes('/manga/')) return;
          if (seen.has(link)) return;
          const image = resolveImage(container);
          const title = resolveTitle(container, anchor);
          if (!title) return;
          seen.add(link);
          items.push({
            link,
            title,
            image,
            rating: resolveMeta(container, searchSelectors.rating),
            chapters: resolveMeta(container, searchSelectors.chapters),
          });
        });

        const hasNextPage = Boolean(
          doc.querySelector('link[rel="next"]') || doc.querySelector(searchSelectors.nextButton),
        );

        return { items, hasNextPage };
      },
      html,
      selectors,
      baseRoot,
    );

    const normalizeSearchValue = (value: string) =>
      value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();

    const bigramScore = (value: string, query: string) => {
      const cleanValue = value.replace(/\s+/g, '');
      const cleanQuery = query.replace(/\s+/g, '');
      if (cleanValue.length < 2 || cleanQuery.length < 2) return 0;
      const toBigrams = (input: string) => {
        const grams: string[] = [];
        for (let i = 0; i < input.length - 1; i += 1) {
          grams.push(input.slice(i, i + 2));
        }
        return grams;
      };
      const gramsValue = toBigrams(cleanValue);
      const gramsQuery = toBigrams(cleanQuery);
      const counts = new Map<string, number>();
      gramsValue.forEach((gram) => counts.set(gram, (counts.get(gram) ?? 0) + 1));
      let overlap = 0;
      gramsQuery.forEach((gram) => {
        const count = counts.get(gram) ?? 0;
        if (count > 0) {
          overlap += 1;
          counts.set(gram, count - 1);
        }
      });
      return (2 * overlap) / (gramsValue.length + gramsQuery.length);
    };

    const scoreTitleMatch = (title: string, query: string) => {
      if (!query) return 0;
      const candidate = normalizeSearchValue(title);
      if (!candidate) return 0;
      if (candidate === query) return 10;
      let score = 0;
      if (candidate.startsWith(query)) score += 6;
      if (candidate.includes(query)) score += 4;
      const candidateTokens = candidate.split(' ').filter(Boolean);
      const queryTokens = query.split(' ').filter(Boolean);
      if (candidateTokens.length && queryTokens.length) {
        const overlap = candidateTokens.filter((token) => queryTokens.includes(token)).length;
        const overlapRatio = overlap / Math.max(candidateTokens.length, queryTokens.length);
        score += overlapRatio * 3;
      }
      const lengthDelta = Math.abs(candidate.length - query.length);
      score += Math.max(0, 2 - lengthDelta * 0.08);
      score += bigramScore(candidate, query) * 3;
      return score;
    };

    const normalizedQuery = normalizeSearchValue(trimmed);
    const rankedItems =
      normalizedQuery.length >= 3
        ? parsed.items
            .map((item, index) => ({
              item,
              index,
              score: scoreTitleMatch(item.title, normalizedQuery),
            }))
            .sort((a, b) => {
              if (b.score !== a.score) return b.score - a.score;
              return a.index - b.index;
            })
            .map((entry) => entry.item)
        : parsed.items;

    const response: SearchResult = {
      currentPage: pageNumber,
      hasNextPage: parsed.hasNextPage,
      results: rankedItems.map((item) => ({
        id: item.link,
        title: item.title,
        altTitles: [],
        headerForImage: { Referer: baseRoot },
        image: item.image,
        status: '',
        chapters: item.chapters,
        rating: item.rating,
      })),
    };

    if (response.results.length > 0) {
      this.cache.set(cacheKey, response);
    }
    return response;
  }

  async checkManhwa(page: Page, url: string): Promise<Manhwa> {
    const cacheKey = `manhwa:${url}`;
    const cached = this.cache.get<Manhwa>(cacheKey);
    if (cached && cached.chapters?.length) {
      console.log(`[Cache] Returning cached details for ${url}`);
      return cached;
    }

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: this.config.timeout });
    try {
      await page.waitForSelector(this.config.selectors.detail.title, {
        timeout: Math.min(12000, this.config.timeout),
      });
    } catch {
      // Allow parsing with fallbacks.
    }

    const baseRoot = this.normalizedBaseRoot();
    const detailSelectors = this.config.selectors.detail;

    const details = await page.evaluate((selectors, baseRoot) => {
      const normalizeText = (value?: string | null) =>
        value?.replace(/\s+/g, ' ').trim() ?? '';

      const normalizeUrl = (src?: string | null) => {
        const cleaned = src?.trim() || '';
        if (!cleaned) return '';
        if (cleaned.startsWith('http')) return cleaned;
        if (cleaned.startsWith('//')) return `https:${cleaned}`;
        const normalized = cleaned.startsWith('/') ? cleaned : `/${cleaned}`;
        return `${baseRoot}${normalized}`;
      };

      const titleEl = document.querySelector(selectors.title);
      const title = normalizeText(titleEl?.textContent);

      const imageEl = document.querySelector(selectors.image) as HTMLImageElement | null;
      const image =
        imageEl?.getAttribute('data-src') ||
        imageEl?.getAttribute('data-original') ||
        imageEl?.getAttribute('data-lazy-src') ||
        imageEl?.getAttribute('src') ||
        '';

      const descriptionEl = document.querySelector(selectors.description);
      const description = normalizeText(descriptionEl?.textContent);

      const statusEl = document.querySelector(selectors.status);
      const status = normalizeText(statusEl?.textContent);

      const ratingEl = document.querySelector(selectors.rating);
      const rating = normalizeText(ratingEl?.textContent);

      const genres = Array.from(document.querySelectorAll(selectors.genres))
        .map((el) => normalizeText(el.textContent))
        .filter(Boolean);

      let author = '';
      let artist = '';
      let serialization = '';
      let updatedOn = '';

      const metaItems = Array.from(document.querySelectorAll(selectors.metaItem));
      metaItems.forEach((item) => {
        const label = normalizeText(item.querySelector(selectors.metaLabel)?.textContent);
        const value = normalizeText(item.querySelector(selectors.metaValue)?.textContent);
        if (!label || !value) return;
        if (/author/i.test(label)) author = value;
        if (/artist/i.test(label)) artist = value;
        if (/serialization/i.test(label)) serialization = value;
        if (/updated/i.test(label)) updatedOn = value;
      });

      const chapterItems = Array.from(document.querySelectorAll(selectors.chapters));
      const chapters = chapterItems.map((item) => {
        const rawNumber = item.getAttribute('data-number') || item.getAttribute('data-num') || '';
        const link = item.querySelector(selectors.chapterLink) as HTMLAnchorElement | null;
        const rawUrl = link?.getAttribute('href') || '';
        const spans = link ? Array.from(link.querySelectorAll(selectors.chapterTitle)) : [];
        const metaText = normalizeText(
          spans[0]?.textContent || link?.getAttribute('title') || link?.textContent,
        );
        const dateText =
          normalizeText(spans[1]?.textContent) ||
          normalizeText(link?.querySelector(selectors.chapterDate)?.textContent);

        let chapterNumber = rawNumber;
        if (!chapterNumber) {
          const match = metaText.match(/(?:chapter|chap|ch\.?)[\s-]*([\d.]+)/i);
          chapterNumber = match?.[1] || '';
        }
        if (!chapterNumber && rawUrl) {
          const match = rawUrl.match(/chapter-([\d.]+)/i);
          chapterNumber = match?.[1] || '';
        }

        let chapterTitle = metaText;
        if (chapterTitle) {
          chapterTitle = chapterTitle
            .replace(/(?:chapter|chap|ch\.?)[\s-]*[\d.]+/i, '')
            .replace(/[:\-–]+/g, ' ')
            .replace(/\b(en|pt-br|pt|es|fr|jp|kr|ru|de|it|tr|ar|id)\b/gi, '')
            .replace(/\s{2,}/g, ' ')
            .trim();
        }

        return {
          chapterNumber,
          chapterTitle: chapterTitle && chapterTitle.length > 2 ? chapterTitle : '',
          chapterUrl: normalizeUrl(rawUrl),
          releaseDate: dateText,
        };
      });

      return {
        title,
        image: normalizeUrl(image),
        description,
        status,
        rating,
        genres,
        chapters,
        author,
        artist,
        serialization,
        updatedOn,
      };
    }, detailSelectors, baseRoot);

    let chapters = details.chapters;
    const hid = this.extractHidFromUrl(url);
    if (hid) {
      const ajaxUrl = `${baseRoot}/ajax/manga/${hid}/chapter/en`;
      const payload = await this.fetchJson<{ status?: number; result?: unknown }>(
        ajaxUrl,
        `${baseRoot}/`,
        Math.min(8000, this.config.timeout),
        { 'X-Requested-With': 'XMLHttpRequest' },
      );
      const chapterHtml = this.unwrapHtmlResult(payload);
      if (payload?.status === 200 && chapterHtml) {
        const parsedChapters = await page.evaluate((rawHtml, baseRootValue) => {
          const parser = new DOMParser();
          const doc = parser.parseFromString(rawHtml, 'text/html');

          const normalizeText = (value?: string | null) =>
            value?.replace(/\s+/g, ' ').trim() ?? '';

          const normalizeUrl = (src?: string | null) => {
            const cleaned = src?.trim() || '';
            if (!cleaned) return '';
            if (cleaned.startsWith('http')) return cleaned;
            if (cleaned.startsWith('//')) return `https:${cleaned}`;
            const normalized = cleaned.startsWith('/') ? cleaned : `/${cleaned}`;
            return `${baseRootValue}${normalized}`;
          };

          const items = Array.from(doc.querySelectorAll('li.item'));
          return items
            .map((item) => {
              const rawNumber = item.getAttribute('data-number') || item.getAttribute('data-num') || '';
              const link = item.querySelector('a') as HTMLAnchorElement | null;
              const rawUrl = link?.getAttribute('href') || '';
              const spans = link ? Array.from(link.querySelectorAll('span')) : [];
              const metaText = normalizeText(
                spans[0]?.textContent || link?.getAttribute('title') || link?.textContent,
              );
              const dateText = normalizeText(spans[1]?.textContent);

              let chapterNumber = rawNumber;
              if (!chapterNumber) {
                const match = metaText.match(/(?:chapter|chap|ch\.?)[\s-]*([\d.]+)/i);
                chapterNumber = match?.[1] || '';
              }
              if (!chapterNumber && rawUrl) {
                const match = rawUrl.match(/chapter-([\d.]+)/i);
                chapterNumber = match?.[1] || '';
              }

              let chapterTitle = metaText;
              if (chapterTitle) {
                chapterTitle = chapterTitle
                  .replace(/(?:chapter|chap|ch\.?)[\s-]*[\d.]+/i, '')
                  .replace(/[:\-–]+/g, ' ')
                  .replace(/\b(en|pt-br|pt|es|fr|jp|kr|ru|de|it|tr|ar|id)\b/gi, '')
                  .replace(/\s{2,}/g, ' ')
                  .trim();
              }

              return {
                chapterNumber,
                chapterTitle: chapterTitle && chapterTitle.length > 2 ? chapterTitle : '',
                chapterUrl: normalizeUrl(rawUrl),
                releaseDate: dateText,
              };
            })
            .filter((entry) => entry.chapterUrl);
        }, chapterHtml, baseRoot);

        if (parsedChapters.length) {
          chapters = parsedChapters;
        }
      }
    }

    const result: Manhwa = {
      id: url,
      title: details.title,
      description: details.description,
      image: details.image,
      headerForImage: { Referer: baseRoot },
      status: details.status || 'Unknown',
      rating: details.rating || '',
      genres: details.genres,
      chapters,
      author: details.author,
      artist: details.artist,
      serialization: details.serialization,
      updatedOn: details.updatedOn,
    };

    this.cache.set(cacheKey, result);
    return result;
  }

  async checkManhwaChapter(page: Page, url: string): Promise<ManhwaChapter> {
    const baseRoot = this.normalizedBaseRoot();
    const maxWaitMs = Math.min(12000, this.config.timeout);
    const navTimeout = Math.min(3500, this.config.timeout);
    const domWaitMs = Math.min(600, maxWaitMs);
    const maxAttempts = 2;
    const minimumImageCount = 3;
    const offlineWaitMs = Math.min(1200, maxWaitMs);
    const blockedResourceTypes = new Set(['image', 'stylesheet', 'font', 'media']);
    const blockedHosts = new Set([
      'platform.pubadx.one',
      'whos.amung.us',
      'platform-api.sharethis.com',
      'static.cloudflareinsights.com',
    ]);
    const targetUrl = new URL(url);
    const targetOrigin = targetUrl.origin;
    const targetPath = targetUrl.pathname;
    const parsedUrl = targetUrl;
    const segments = parsedUrl.pathname.split('/').filter(Boolean);
    const readIndex = segments.indexOf('read');
    const lang = readIndex >= 0 ? segments[readIndex + 2] || 'en' : 'en';
    const chapterSegment = readIndex >= 0 ? segments[readIndex + 3] || '' : '';
    const chapterNumberMatch = chapterSegment.match(/chapter-([\d.]+)/i);
    const chapterNumber = chapterNumberMatch?.[1] || '';
    const hid = this.extractHidFromUrl(url);
    const listPath = hid ? `/ajax/read/${hid}/chapter/${lang}` : '';
    let interceptionEnabled = false;

    await this.applyPageHeaders(page);
    await this.applyStealth(page);

    const normalizeChapterImageUrl = (src: string) => {
      const cleaned = src.trim();
      if (!cleaned) return '';
      if (cleaned.startsWith('http')) return cleaned;
      if (cleaned.startsWith('//')) return `https:${cleaned}`;
      if (cleaned.startsWith('/')) return `${baseRoot}${cleaned}`;
      return cleaned;
    };

    const isLikelyImageUrl = (src: string) => {
      const lowered = src.toLowerCase();
      if (
        lowered.includes('/assets/') ||
        lowered.includes('logo') ||
        lowered.includes('favicon') ||
        lowered.includes('icon')
      ) {
        return false;
      }
      if (!/^https?:\/\//i.test(src)) return false;
      if (!/\.(jpe?g|png|webp|gif)(\?|$)/i.test(src)) return false;
      try {
        const parsed = new URL(src);
        const host = parsed.hostname.toLowerCase();
        const path = parsed.pathname.toLowerCase();
        const isMfcdn = host.includes('mfcdn');
        return isMfcdn && (path.includes('/mf/') || path.includes('/chapter_'));
      } catch {
        return false;
      }
    };

    const decodeHtmlValue = (value: string) =>
      value.replace(/&amp;/g, '&').replace(/&#38;/g, '&').replace(/&quot;/g, '"');

    const sanitizeChapterImages = (sources: string[]) => {
      const seen = new Set<string>();
      return sources
        .map((src) => normalizeChapterImageUrl(src))
        .filter((src) => src && isLikelyImageUrl(src))
        .filter((src) => {
          if (seen.has(src)) return false;
          seen.add(src);
          return true;
        });
    };

    const extractImagesFromHtml = (html: string) => {
      const images: string[] = [];
      const tags = html.match(/<img[^>]*>/gi) || [];
      const attrPriority = ['data-url', 'data-src', 'data-original', 'data-lazy-src', 'src'];
      const seen = new Set<string>();
      tags.forEach((tag) => {
        for (const attr of attrPriority) {
          const match = new RegExp(`${attr}\\s*=\\s*["']([^"']+)["']`, 'i').exec(tag);
          const raw = match?.[1] || '';
          if (!raw) continue;
          const decoded = decodeHtmlValue(raw);
          const normalized = normalizeChapterImageUrl(decoded);
          if (!normalized || !isLikelyImageUrl(normalized)) continue;
          if (seen.has(normalized)) return;
          seen.add(normalized);
          images.push(normalized);
          return;
        }
      });

      if (images.length) return images;

      const scriptMatches = html.match(/(?:images|pages)\\s*[:=]\\s*(\\[[\\s\\S]*?\\])/gi) || [];
      for (const match of scriptMatches) {
        const bracketStart = match.indexOf('[');
        if (bracketStart === -1) continue;
        const arrayText = match.slice(bracketStart);
        const tryParse = (value: string) => {
          try {
            return JSON.parse(value);
          } catch {
            return null;
          }
        };
        let parsed = tryParse(arrayText);
        if (!parsed) {
          const normalized = arrayText.replace(/'/g, '"').replace(/,\\s*]/g, ']');
          parsed = tryParse(normalized);
        }
        if (!Array.isArray(parsed)) continue;
        parsed.forEach((entry) => {
          if (Array.isArray(entry)) {
            const candidate = entry[0];
            if (typeof candidate === 'string') {
              const normalized = normalizeChapterImageUrl(candidate);
              if (normalized && isLikelyImageUrl(normalized) && !seen.has(normalized)) {
                seen.add(normalized);
                images.push(normalized);
              }
            }
          } else if (typeof entry === 'string') {
            const normalized = normalizeChapterImageUrl(entry);
            if (normalized && isLikelyImageUrl(normalized) && !seen.has(normalized)) {
              seen.add(normalized);
              images.push(normalized);
            }
          }
        });
        if (images.length) break;
      }

      return images;
    };

    const extractImagesFromPayload = (payload: any) => {
      const resultPayload = payload?.result ?? payload?.data ?? payload?.html ?? payload;
      const rawImages =
        resultPayload?.images ||
        resultPayload?.pages ||
        payload?.images ||
        payload?.pages ||
        null;
      const nextImages: string[] = [];
      const nextPages: number[] = [];
      const seen = new Set<string>();
      const pushImage = (src: string, number: number) => {
        const normalized = normalizeChapterImageUrl(src);
        if (!normalized || !isLikelyImageUrl(normalized)) return;
        if (seen.has(normalized)) return;
        seen.add(normalized);
        nextImages.push(normalized);
        nextPages.push(number);
      };
      if (Array.isArray(rawImages) && rawImages.length > 0) {
        rawImages.forEach((entry: any, index: number) => {
          let src = '';
          let number = index + 1;
          if (Array.isArray(entry)) {
            src = entry[0] || '';
            if (entry[1]) {
              const parsed = Number(entry[1]);
              if (!Number.isNaN(parsed)) number = parsed;
            }
          } else if (typeof entry === 'string') {
            src = entry;
          } else if (entry && typeof entry === 'object') {
            src = entry.url || entry.src || '';
            const parsed = Number(entry.page ?? entry.number ?? entry.index);
            if (!Number.isNaN(parsed)) number = parsed;
          }
          if (src) {
            pushImage(src, number);
          }
        });
      } else if (typeof resultPayload === 'string' || typeof payload === 'string') {
        const html = typeof resultPayload === 'string' ? resultPayload : payload;
        const htmlImages = extractImagesFromHtml(html);
        htmlImages.forEach((src, index) => pushImage(src, index + 1));
      }
      return { nextImages, nextPages };
    };

    let capturedAjaxUrl = '';
    const buildChapterResult = (chapterImages: string[]) =>
      chapterImages.map((img, index) => ({
        page: index + 1,
        img,
        headerForImage: baseRoot,
      }));

    let cookieHeader = '';
    const ensureCookieHeader = async () => {
      if (cookieHeader) return cookieHeader;
      try {
        const cookies = await page.cookies(baseRoot);
        cookieHeader = cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
      } catch {
        cookieHeader = '';
      }
      return cookieHeader;
    };

    const fetchImagesFromAjax = async (ajaxUrl: string, cookies?: string) => {
      const response = await this.fetchWithTimeout(
        ajaxUrl,
        {
          headers: this.buildFetchHeaders(url, {
            'X-Requested-With': 'XMLHttpRequest',
            ...(cookies ? { Cookie: cookies } : {}),
          }),
        },
        Math.min(3500, this.config.timeout),
      );
      if (!response.ok) return null;
      const text = await response.text();
      let payload: any = null;
      try {
        payload = JSON.parse(text);
      } catch {
        payload = text;
      }
      const { nextImages, nextPages } = extractImagesFromPayload(payload);
      const cleanedImages = sanitizeChapterImages(nextImages);
      if (cleanedImages.length < minimumImageCount) return null;
      return { images: cleanedImages, pages: nextPages };
    };

    const fetchImagesFromAjaxInPage = async (ajaxUrl: string) => {
      try {
        const payload = await page.evaluate(async (targetUrl) => {
          try {
            const response = await fetch(targetUrl, {
              credentials: 'include',
              headers: { 'X-Requested-With': 'XMLHttpRequest' },
            });
            const text = await response.text();
            return { ok: response.ok, text };
          } catch {
            return { ok: false, text: '' };
          }
        }, ajaxUrl);
        if (!payload?.ok || !payload.text) return null;
        let parsed: any = null;
        try {
          parsed = JSON.parse(payload.text);
        } catch {
          parsed = payload.text;
        }
        const { nextImages, nextPages } = extractImagesFromPayload(parsed);
        const cleanedImages = sanitizeChapterImages(nextImages);
        if (cleanedImages.length < minimumImageCount) return null;
        return { images: cleanedImages, pages: nextPages };
      } catch {
        return null;
      }
    };

    let resolveResponse: ((value: { images: string[]; pages: number[] } | null) => void) | null =
      null;
    const createResponsePromise = () =>
      new Promise<{ images: string[]; pages: number[] } | null>((resolve) => {
        resolveResponse = resolve;
      });
    let responsePromise = createResponsePromise();
    let lastListHtml = '';
    let lastListUrl = '';
    let lastListBlocked = false;
    let lastAjaxHeaders: Record<string, string> = {};
    const unwrapListHtml = (raw: string) => {
      if (!raw) return '';
      const trimmed = raw.trim();
      if (!trimmed) return '';
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          const payload = JSON.parse(trimmed);
          return this.unwrapHtmlResult(payload) || raw;
        } catch {
          return raw;
        }
      }
      return raw;
    };
    const responseHandler = async (response: HTTPResponse) => {
      try {
        const responseUrl = response.url();
        const isChapter = responseUrl.includes('/ajax/read/chapter/');
        const isList = responseUrl.includes('/ajax/read/') && responseUrl.includes('/chapter/');
        if (!isChapter && !isList) return;

        let text = '';
        try {
          text = await response.text();
        } catch {
          text = '';
        }

        if (isChapter) {
          if (!response.ok() || !resolveResponse || !text) return;
          if (!capturedAjaxUrl) {
            capturedAjaxUrl = responseUrl;
          }
          let payload: any = null;
          try {
            payload = JSON.parse(text);
          } catch {
            payload = text;
          }
          const { nextImages, nextPages } = extractImagesFromPayload(payload);
          const cleanedImages = sanitizeChapterImages(nextImages);
          if (cleanedImages.length >= minimumImageCount) {
            resolveResponse({ images: cleanedImages, pages: nextPages });
            resolveResponse = null;
          }
          return;
        }

        if (isList) {
          const html = unwrapListHtml(text);
          lastListUrl = responseUrl;
          lastListHtml = html || text;
          const lowered = (html || text).toLowerCase();
          lastListBlocked =
            lowered.includes('request is invalid') ||
            lowered.includes('attention required') ||
            lowered.includes('cloudflare') ||
            lowered.includes('forbidden');
        }
      } catch {
        // Ignore response parsing failures.
      }
    };

    const isInvalidNavigation = async (response: HTTPResponse | null) => {
      if (!response) {
        return true;
      }
      const currentUrl = page.url();
      if (currentUrl.startsWith('chrome-error://') || currentUrl === 'about:blank') {
        return true;
      }
      try {
        const parsed = new URL(currentUrl);
        if (parsed.origin !== targetOrigin) {
          return true;
        }
        const targetPathname = targetPath.replace(/\/$/, '');
        const currentPathname = parsed.pathname.replace(/\/$/, '');
        if (currentPathname !== targetPathname) {
          return true;
        }
      } catch {
        return true;
      }
      return false;
    };

    const containsOfflineMessage = async () => {
      try {
        const text = await page.evaluate(() => document.body?.innerText?.slice(0, 2000) || '');
        const lowered = text.toLowerCase();
        return (
          lowered.includes("this site can\u2019t be reached") ||
          lowered.includes("this site can't be reached") ||
          lowered.includes('page not found') ||
          lowered.includes('err_connection') ||
          lowered.includes('err_failed') ||
          lowered.includes('err_name_not_resolved') ||
          lowered.includes('err_internet_disconnected') ||
          lowered.includes('dns_probe') ||
          lowered.includes('dns') ||
          lowered.includes('server ip address could not be found')
        );
      } catch {
        return false;
      }
    };

    const waitForChapterReady = async (timeoutMs: number) => {
      const startedAt = Date.now();
      while (Date.now() - startedAt < timeoutMs) {
        if (!(await containsOfflineMessage())) {
          return true;
        }
        await this.sleep(200);
      }
      return !(await containsOfflineMessage());
    };

    const requestListener = (request: HTTPRequest) => {
      const reqUrl = request.url();
      if (reqUrl.includes('/ajax/read/chapter/') && reqUrl.includes('vrf=')) {
        capturedAjaxUrl = reqUrl;
      }
      if (reqUrl.includes('/ajax/read/') && reqUrl.includes('/chapter/')) {
        lastAjaxHeaders = request.headers();
      }
      let shouldAbort = false;
      try {
        const parsed = new URL(reqUrl);
        if (blockedHosts.has(parsed.hostname)) {
          shouldAbort = true;
        }
      } catch {
        // Ignore invalid URLs.
      }
      const resourceType = request.resourceType();
      if (blockedResourceTypes.has(resourceType)) {
        shouldAbort = true;
      }
      if (shouldAbort && interceptionEnabled) {
        request.abort();
        return;
      }
      if (interceptionEnabled) {
        request.continue();
      }
    };

    page.on('response', responseHandler);
    page.on('request', requestListener);
    try {
      await page.setRequestInterception(true);
      interceptionEnabled = true;
    } catch {
      // Ignore interception failures.
    }

    const resetAfterFailure = async () => {
      try {
        await page.goto('about:blank', { waitUntil: 'domcontentloaded', timeout: 1000 });
      } catch {
        // Ignore stop-loading failures.
      }
    };

    const parseVrfFromUrl = (requestUrl: string) => {
      try {
        const parsed = new URL(requestUrl);
        const vrf = parsed.searchParams.get('vrf');
        return vrf || '';
      } catch {
        return '';
      }
    };

    const normalizePath = (value: string) => value.replace(/\/+$/, '');

    const captureVrfForPath = async (
      expectedPath: string,
      pageUrl: string,
      timeoutMs: number,
      forceRefresh = false,
    ) => {
      const cached = this.vrfCache.get(expectedPath);
      if (!forceRefresh && cached && Date.now() - cached.ts < 30 * 1000) {
        return cached.value;
      }
      const normalizedExpected = normalizePath(expectedPath);
      const waitMs = Math.min(timeoutMs, this.config.timeout);
      const maxAttempts = 2;
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const requestPromise = page
          .waitForRequest((request) => {
            try {
              const parsed = new URL(request.url());
              return (
                normalizePath(parsed.pathname) === normalizedExpected &&
                parsed.searchParams.has('vrf')
              );
            } catch {
              return false;
            }
          }, { timeout: waitMs })
          .catch(() => null);
        try {
          await page.goto(pageUrl, {
            waitUntil: 'domcontentloaded',
            timeout: Math.min(15000, this.config.timeout),
          });
        } catch {
          // Ignore navigation failures.
        }
        const request = await requestPromise;
        const vrf = request ? parseVrfFromUrl(request.url()) : '';
        if (vrf) {
          this.vrfCache.set(expectedPath, { value: vrf, ts: Date.now() });
          return vrf;
        }
        await this.sleep(200);
      }
      return '';
    };

    const attemptNavigate = async (attemptTimeout: number) => {
      let response: HTTPResponse | null = null;
      try {
        response = await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: attemptTimeout,
        });
      } catch {
        response = null;
      }
      if (response && (response.status() === 403 || response.status() === 429)) {
        return false;
      }
      if (await containsOfflineMessage()) {
        if (!(await waitForChapterReady(offlineWaitMs))) {
          return false;
        }
      }
      const invalid = await isInvalidNavigation(response);
      return !invalid;
    };

    const collectDomImages = async () => {
      try {
        await page.waitForSelector(this.config.selectors.chapter.images, {
          timeout: domWaitMs,
        });
      } catch {
        // Ignore if images are lazy.
      }
      let rawImages: string[] = [];
      try {
        rawImages = await page.$$eval(this.config.selectors.chapter.images, (nodes) => {
          const collected: string[] = [];
          nodes.forEach((node) => {
            const src =
              node.getAttribute('data-src') ||
              node.getAttribute('data-original') ||
              node.getAttribute('data-lazy-src') ||
              node.getAttribute('src') ||
              '';
            if (src) {
              collected.push(src);
            }
          });
          return collected;
        });
      } catch {
        return [];
      }
      return sanitizeChapterImages(rawImages);
    };

    const collectHtmlImages = async () => {
      try {
        const html = await page.content();
        return extractImagesFromHtml(html);
      } catch {
        return [];
      }
    };

    const shouldAcceptImages = (candidate: string[], attemptIndex: number) =>
      candidate.length >= minimumImageCount || attemptIndex >= maxAttempts - 1;

    let images: string[] = [];
    const directAjaxUrl = await this.captureChapterAjaxUrl(
      page,
      url,
      Math.min(8000, this.config.timeout),
      blockedResourceTypes,
      blockedHosts,
      false,
    );
    if (directAjaxUrl) {
      const directCookies = await ensureCookieHeader();
      const directAjaxResult = await fetchImagesFromAjax(directAjaxUrl, directCookies);
      if (directAjaxResult?.images.length) {
        return buildChapterResult(directAjaxResult.images);
      }
    }
    for (let attempt = 0; attempt < maxAttempts && images.length === 0; attempt += 1) {
      capturedAjaxUrl = '';
      const requestWaitMs = attempt === 0 ? Math.min(5200, maxWaitMs) : Math.min(8000, maxWaitMs);
      const raceWaitMs = attempt === 0 ? Math.min(6200, maxWaitMs) : Math.min(8500, maxWaitMs);
      const navTimeoutAttempt = attempt === 0 ? navTimeout : Math.min(7000, this.config.timeout);
      const ajaxRequestPromise = page
        .waitForRequest(
          (request) =>
            request.url().includes('/ajax/read/chapter/') && request.url().includes('vrf='),
          { timeout: requestWaitMs },
        )
        .then((request) => ({ type: 'request' as const, request }))
        .catch(() => null);
      responsePromise = createResponsePromise();
      const responsePromiseTagged = responsePromise.then((result) =>
        result ? ({ type: 'response' as const, result }) : null,
      );
      const navigated = await attemptNavigate(navTimeoutAttempt);
      if (!navigated) {
        await resetAfterFailure();
        await this.sleep(80);
        continue;
      }
      const firstSignal = await Promise.race([
        ajaxRequestPromise,
        responsePromiseTagged,
        this.sleep(raceWaitMs).then(() => null),
      ]);
      if (firstSignal?.type === 'request' && !capturedAjaxUrl) {
        capturedAjaxUrl = firstSignal.request.url();
      }
      if (firstSignal?.type === 'response' && firstSignal.result?.images.length) {
        if (shouldAcceptImages(firstSignal.result.images, attempt)) {
          images = firstSignal.result.images;
          break;
        }
      }
      if (capturedAjaxUrl) {
        const cookies = await ensureCookieHeader();
        const ajaxResult = await fetchImagesFromAjax(capturedAjaxUrl, cookies);
        if (ajaxResult?.images.length && shouldAcceptImages(ajaxResult.images, attempt)) {
          images = ajaxResult.images;
          break;
        }
      }
      if (await containsOfflineMessage()) {
        await resetAfterFailure();
        await this.sleep(80);
        continue;
      }
      const domImages = sanitizeChapterImages(await collectDomImages());
      if (domImages.length && shouldAcceptImages(domImages, attempt)) {
        images = domImages;
        break;
      }
      const htmlImages = sanitizeChapterImages(await collectHtmlImages());
      if (htmlImages.length && shouldAcceptImages(htmlImages, attempt)) {
        images = htmlImages;
        break;
      }
      await this.sleep(80);
    }

    if (images.length === 0) {
      if (interceptionEnabled) {
        try {
          await page.setRequestInterception(false);
          interceptionEnabled = false;
        } catch {
          // Ignore interception cleanup failures.
        }
      }
      try {
        await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: Math.min(12000, this.config.timeout),
        });
      } catch {
        // Ignore full-load failures.
      }
      const domImages = sanitizeChapterImages(await collectDomImages());
      if (domImages.length) {
        images = domImages;
      } else {
        const htmlImages = sanitizeChapterImages(await collectHtmlImages());
        images = htmlImages;
      }
    }

    if (images.length === 0) {
      if (hid) {
        const captureListFromPage = async () => {
          try {
            const responsePromise = page.waitForResponse(
              (resp) => resp.url().includes(listPath),
              { timeout: Math.min(6000, this.config.timeout) },
            );
            await page.evaluate(() => {
              const button = document.querySelector('button.number-toggler') as HTMLElement | null;
              if (button) {
                button.click();
              }
            });
            const response = await responsePromise;
            let text = '';
            try {
              text = await response.text();
            } catch {
              text = '';
            }
            if (!text) return '';
            try {
              const payload = JSON.parse(text);
              return this.unwrapHtmlResult(payload) || text;
            } catch {
              return text;
            }
          } catch {
            return '';
          }
        };
        let listHtml = '';
        if (lastListUrl.includes(listPath) && lastListHtml) {
          listHtml = unwrapListHtml(lastListHtml);
        }
        if (!listHtml) {
          listHtml = await captureListFromPage();
          if (!listHtml) {
            console.warn('[MangaFire] Chapter list not captured from page');
          }
        }

        let listVrf = '';
        const attemptListFetch = async (force: boolean) => {
          let nextHtml = '';
          if (!force && lastListUrl.includes(listPath) && lastListHtml) {
            nextHtml = lastListHtml;
          } else {
            try {
              const cookies = await ensureCookieHeader();
              const forwardedHeaders: Record<string, string> = {};
              Object.entries(lastAjaxHeaders || {}).forEach(([key, value]) => {
                if (!value) return;
                const loweredKey = key.toLowerCase();
                if (
                  loweredKey === 'cookie' ||
                  loweredKey === 'host' ||
                  loweredKey === 'content-length' ||
                  loweredKey === 'accept-encoding'
                ) {
                  return;
                }
                forwardedHeaders[loweredKey] = value;
              });
              const listUrl = `${baseRoot}${listPath}?vrf=${listVrf}`;
              const listResponse = await this.fetchWithTimeout(
                listUrl,
                {
                  headers: {
                    ...this.buildFetchHeaders(url, {
                      'X-Requested-With': 'XMLHttpRequest',
                      ...(cookies ? { Cookie: cookies } : {}),
                    }),
                    Origin: new URL(baseRoot).origin,
                    ...forwardedHeaders,
                  },
                },
                Math.min(8000, this.config.timeout),
              );
              if (listResponse.ok) {
                const listText = await listResponse.text();
                try {
                  const payload = JSON.parse(listText);
                  nextHtml = this.unwrapHtmlResult(payload) || '';
                } catch {
                  nextHtml = listText;
                }
              } else {
                console.warn(`[MangaFire] Chapter list request failed ${listResponse.status}`);
              }
            } catch {
              // Ignore list fetch failures.
            }
          }
          return unwrapListHtml(nextHtml);
        };

        if (!listHtml) {
          listVrf = await captureVrfForPath(listPath, url, Math.min(12000, this.config.timeout));
          if (!listVrf) {
            console.warn(`[MangaFire] Missing VRF for chapter list ${listPath}`);
          } else {
            listHtml = await attemptListFetch(false);
          }
        }

        if (listHtml) {
          let lowered = listHtml.toLowerCase();
          if (
            lowered.includes('request is invalid') ||
            lowered.includes('attention required') ||
            lowered.includes('cloudflare') ||
            lowered.includes('forbidden')
          ) {
            console.warn('[MangaFire] Chapter list returned an access block');
            listVrf = await captureVrfForPath(
              listPath,
              url,
              Math.min(12000, this.config.timeout),
              true,
            );
            if (listVrf) {
              listHtml = await attemptListFetch(true);
              lowered = listHtml.toLowerCase();
            }
          }
          if (
            lowered.includes('request is invalid') ||
            lowered.includes('attention required') ||
            lowered.includes('cloudflare') ||
            lowered.includes('forbidden')
          ) {
            console.warn('[MangaFire] Chapter list returned an access block');
          } else {
            const findChapterId = (rawHtml: string, targetPath: string, number: string) => {
              const items =
                rawHtml.match(/<li[^>]*data-id=["'][^"']+["'][^>]*>[\s\S]*?<\/li>/gi) ||
                rawHtml.match(/<li[^>]*>[\s\S]*?<\/li>/gi) ||
                [];
              const normalizedTarget = normalizePath(targetPath);
              let fallbackId = '';
              for (const item of items) {
                const dataIdMatch =
                  item.match(/data-id=["']([^"']+)["']/i) ||
                  item.match(/data-chapter-id=["']([^"']+)["']/i) ||
                  item.match(/data-hid=["']([^"']+)["']/i);
                const dataId = dataIdMatch?.[1] || '';
                if (dataId && !fallbackId) {
                  fallbackId = dataId;
                }
                const numberMatch =
                  item.match(/data-number=["']([^"']+)["']/i) ||
                  item.match(/data-num=["']([^"']+)["']/i);
                const dataNumber = numberMatch?.[1] || '';
                const hrefMatch = item.match(/<a[^>]*href=["']([^"']+)["']/i);
                const rawHref = hrefMatch?.[1] || '';
                const normalizedHref = normalizePath(rawHref);
                if (dataId && normalizedHref && normalizedTarget.endsWith(normalizedHref)) {
                  return dataId;
                }
                if (dataId && number && dataNumber === number) {
                  return dataId;
                }
                if (dataId && number && rawHref.includes(`chapter-${number}`)) {
                  return dataId;
                }
              }
              return fallbackId;
            };

            const chapterId = findChapterId(listHtml, parsedUrl.pathname, chapterNumber);

            if (chapterId) {
              const chapterPath = `/ajax/read/chapter/${chapterId}`;
              const chapterVrf = await captureVrfForPath(
                chapterPath,
                url,
                Math.min(12000, this.config.timeout),
              );
              if (!chapterVrf) {
                console.warn(`[MangaFire] Missing VRF for chapter ${chapterId}`);
              }
              if (chapterVrf) {
                const chapterAjaxUrl = `${baseRoot}${chapterPath}?vrf=${chapterVrf}`;
                const chapterResult = await fetchImagesFromAjax(
                  chapterAjaxUrl,
                  await ensureCookieHeader(),
                );
                if (chapterResult?.images.length) {
                  images = chapterResult.images;
                }
              }
            } else {
              console.warn('[MangaFire] Failed to resolve chapter id from list HTML');
            }
          }
        }
        if (listHtml) {
          lastListHtml = listHtml;
          lastListUrl = `${baseRoot}${listPath}`;
        }
      }
    }

    page.off('response', responseHandler);
    page.off('request', requestListener);
    resolveResponse = null;
    if (interceptionEnabled) {
      try {
        await page.setRequestInterception(false);
      } catch {
        // Ignore interception cleanup failures.
      }
    }
    if (capturedAjaxUrl && images.length > 0) {
      this.cache.set(`chapter-ajax:${url}`, capturedAjaxUrl, 2 * 60 * 1000);
    }
    try {
      await page.goto('about:blank', { waitUntil: 'domcontentloaded', timeout: 3000 });
    } catch {
      // Ignore stop-loading failures.
    }

    return buildChapterResult(images);
  }
}
