import type { Page } from 'puppeteer';
import type { Manhwa, ManhwaChapter, SearchResult } from '@manverse/core';
import { toonilyConfig, type ToonilyConfig } from '../config/index.ts';
import type IScraper from './scraper.ts';
import { ScraperCache } from './cache.ts';

export default class ToonilyScraper implements IScraper {
  config: ToonilyConfig;
  private cache: ScraperCache;

  constructor(config: ToonilyConfig = toonilyConfig) {
    this.config = config;
    this.cache = new ScraperCache('toonily');
  }

  private sleep(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
  }

  private async fetchSearchHtml(url: string) {
    try {
      const headers: Record<string, string> = {
        'User-Agent':
          this.config.headers?.userAgent ||
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      };
      if (this.config.headers?.referer) {
        headers.Referer = this.config.headers.referer;
      }
      const response = await fetch(url, { headers, redirect: 'follow' });
      if (!response.ok) return null;
      return await response.text();
    } catch {
      return null;
    }
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

    const cacheKey = `search:${term}:${pageNumber}`;
    const cached = this.cache.get<SearchResult>(cacheKey);
    if (cached && cached.results.length > 0) {
      console.log(`[Cache] Returning cached search results for "${term}"`);
      return cached;
    }

    const trimmed = term.trim();
    const encoded = encodeURIComponent(trimmed).replace(/%20/g, '+');
    const baseUrl = this.config.baseUrl.endsWith('/')
      ? this.config.baseUrl
      : `${this.config.baseUrl}/`;
    let targetUrl = `${baseUrl}?s=${encoded}&post_type=wp-manga`;

    if (pageNumber > 1) {
      targetUrl = `${baseUrl}page/${pageNumber}/?s=${encoded}&post_type=wp-manga`;
    }

    const html = await this.fetchSearchHtml(targetUrl);
    if (html) {
      await page.setContent(html, { waitUntil: 'domcontentloaded' });
    } else {
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: this.config.timeout });
      const waitForChallenge = async () => {
        const isChallenge = await page.evaluate(() => {
          const title = document.title || '';
          const text = document.body?.innerText || '';
          return /just a moment|checking your browser|verify you are human|cloudflare/i.test(
            `${title} ${text}`,
          );
        });
        if (!isChallenge) return;
        await this.sleep(3500);
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
      };
      await waitForChallenge();
      await this.sleep(500);
    }
    try {
      await page.waitForSelector(this.config.selectors.search.resultContainer, {
        timeout: Math.min(10000, this.config.timeout),
      });
    } catch {
      // Allow fallback parsing if results are lazy loaded or selectors shifted.
    }
    if (!html) {
      const isChallenge = await page.evaluate(() => {
        const title = document.title || '';
        const text = document.body?.innerText || '';
        return /just a moment|checking your browser|verify you are human|cloudflare/i.test(
          `${title} ${text}`,
        );
      });
      if (isChallenge) {
        await this.sleep(1200);
      }
    }

    const baseRoot = this.config.baseUrl.endsWith('/')
      ? this.config.baseUrl.slice(0, -1)
      : this.config.baseUrl;

    const results = await page.evaluate((selectors, baseRoot) => {
      const seen = new Set<string>();
      const items: Array<{
        link: string;
        title: string;
        image: string;
        rating: string;
        chapters: string;
      }> = [];

      const containers = Array.from(document.querySelectorAll(selectors.resultContainer));
      const anchors = containers.length ? [] : Array.from(document.querySelectorAll(selectors.link));

      const normalizeText = (value?: string | null) =>
        value?.replace(/\s+/g, ' ').trim() ?? '';

      const normalizeUrl = (src: string) => {
        if (!src) return '';
        if (src.startsWith('http')) return src;
        if (src.startsWith('//')) return `https:${src}`;
        const clean = src.startsWith('/') ? src : `/${src}`;
        return `${baseRoot}${clean}`;
      };

      const pickFromSrcset = (value?: string | null) => {
        if (!value) return '';
        const entries = value
          .split(',')
          .map((entry) => entry.trim())
          .filter(Boolean);
        if (!entries.length) return '';
        const first = entries[0];
        return first.split(' ')[0] || '';
      };

      const resolveImage = (root: Element | null) => {
        if (!root) return '';
        const img = root.querySelector(selectors.image) as HTMLImageElement | null;
        if (!img) return '';
        const srcset =
          img.getAttribute('data-srcset') ||
          img.getAttribute('data-lazy-srcset') ||
          img.getAttribute('srcset');
        const fromSet = pickFromSrcset(srcset);
        const raw =
          img.getAttribute('data-src') ||
          img.getAttribute('data-lazy-src') ||
          img.getAttribute('data-original') ||
          img.getAttribute('src') ||
          fromSet ||
          '';
        return normalizeUrl(raw);
      };

      const sanitizeTitle = (value: string) => {
        if (!value) return value;
        let next = value.trim();
        const shouldStripRead =
          /^read[-:\\s]+/i.test(next) && /\\b(manhwa|manga|webtoon|comic|for free)\\b/i.test(next);
        if (shouldStripRead) {
          next = next.replace(/^read[-:\\s]+/i, '');
        }
        next = next.replace(/\\b(manhwa|manga|webtoon|comic)\\b/gi, '');
        next = next.replace(/\\bfor free\\b/gi, '');
        next = next.replace(/\\s{2,}/g, ' ').trim();
        return next;
      };

      const resolveTitle = (root: Element | null, anchor: HTMLAnchorElement | null) => {
        const heading = root?.querySelector(selectors.title) as HTMLElement | null;
        const fromHeading = normalizeText(heading?.textContent);
        const fromAnchor = normalizeText(anchor?.getAttribute('title'));
        const fromText = normalizeText(anchor?.textContent);
        const img = root?.querySelector(selectors.image) as HTMLImageElement | null;
        const fromImg = normalizeText(img?.getAttribute('alt'));
        const raw = fromHeading || fromAnchor || fromText || fromImg;
        const cleaned = sanitizeTitle(raw);
        return cleaned || raw;
      };

      const resolveMeta = (root: Element | null, selector: string) => {
        if (!root) return '';
        const el = root.querySelector(selector);
        return normalizeText(el?.textContent);
      };

      const resolveAnchor = (root: Element | null) => {
        if (!root) return null;
        const anchor = root.querySelector(selectors.link) as HTMLAnchorElement | null;
        const href = anchor?.getAttribute('href');
        if (href) return anchor;
        const fallback = Array.from(root.querySelectorAll('a')).find((el) => {
          const value = (el as HTMLAnchorElement).getAttribute('href') || '';
          return value.includes('/serie/');
        });
        return (fallback as HTMLAnchorElement) || null;
      };

      const pushItem = (root: Element, anchor: HTMLAnchorElement | null) => {
        const rawLink = anchor?.getAttribute('href') || '';
        const link = normalizeUrl(rawLink);
        if (!link || !link.includes('/serie/') || link.includes('/chapter')) return;
        if (seen.has(link)) return;
        const image = resolveImage(root);
        const title = resolveTitle(root, anchor);
        if (!image || !title) return;
        seen.add(link);
        items.push({
          link,
          title,
          image,
          rating: resolveMeta(root, selectors.rating),
          chapters: resolveMeta(root, selectors.chapters),
        });
      };

      if (containers.length) {
        containers.forEach((container) => {
          const anchor = resolveAnchor(container);
          pushItem(container, anchor);
        });
      } else {
        anchors.forEach((anchorNode) => {
          const anchor = anchorNode as HTMLAnchorElement;
          const root = anchor.closest(selectors.resultContainer) ?? anchor;
          pushItem(root as Element, anchor);
        });
      }

      return items;
    }, this.config.selectors.search, baseRoot);

    const hasNextPage = await page.evaluate((selector) => {
      const next = document.querySelector(selector) as HTMLAnchorElement | null;
      if (!next) {
        const textMatch = Array.from(document.querySelectorAll('a')).find((el) =>
          /next|»/i.test(el.textContent || ''),
        );
        return Boolean(textMatch);
      }
      const style = next.getAttribute('style');
      return !style || !style.includes('pointer-events:none');
    }, this.config.selectors.search.nextButton);

    const response: SearchResult = {
      currentPage: pageNumber,
      hasNextPage: hasNextPage,
      results: results.map((item) => ({
        id: item.link,
        title: item.title,
        altTitles: [],
        headerForImage: { Referer: this.config.baseUrl },
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
    if (cached) {
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

    const details = await page.evaluate((selectors) => {
      const normalizeText = (value?: string | null) =>
        value?.replace(/\s+/g, ' ').trim() ?? '';

      const getMeta = (property: string) => {
        const meta = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
        return meta?.content?.trim() ?? '';
      };

      const titleEl = document.querySelector(selectors.title);
      const title = normalizeText(titleEl?.textContent) || getMeta('og:title');

      const imageEl = document.querySelector(selectors.image) as HTMLImageElement | null;
      const image =
        imageEl?.getAttribute('data-src') ||
        imageEl?.getAttribute('data-lazy-src') ||
        imageEl?.getAttribute('data-original') ||
        imageEl?.getAttribute('src') ||
        getMeta('og:image') ||
        '';

      const descriptionEl = document.querySelector(selectors.description);
      const description = normalizeText(descriptionEl?.textContent) || getMeta('og:description');

      const genres = Array.from(document.querySelectorAll(selectors.genres))
        .map((el) => normalizeText(el.textContent))
        .filter(Boolean);

      let status = '';
      let rating = '';
      let followers = '';
      let author = '';
      let artist = '';
      let serialization = '';
      let updatedOn = '';

      const infoItems = Array.from(document.querySelectorAll(selectors.infoItem));
      for (const item of infoItems) {
        const label = normalizeText(
          (item.querySelector(selectors.infoLabel) as HTMLElement | null)?.textContent,
        ).toLowerCase();
        const value = normalizeText(
          (item.querySelector(selectors.infoValue) as HTMLElement | null)?.textContent || item.textContent,
        );

        if (!label || !value) continue;
        if (label.includes('status')) status = value;
        if (label.includes('rating')) rating = value;
        if (label.includes('follow')) followers = value;
        if (label.includes('author')) author = value;
        if (label.includes('artist')) artist = value;
        if (label.includes('serialization') || label.includes('serial')) serialization = value;
        if (label.includes('updated')) updatedOn = value;
      }

      const chapterNodes = Array.from(document.querySelectorAll(selectors.chapters));
      const chapters = chapterNodes
        .map((node) => {
          const linkEl = node.querySelector(selectors.chapterLink) as HTMLAnchorElement | null;
          const href = linkEl?.href ?? '';
          if (!href || !href.includes('/chapter')) return null;
          const rawTitle = normalizeText(linkEl?.textContent || node.textContent);
          const numberMatch = rawTitle.match(/([0-9]+(?:\.[0-9]+)?)/);
          const chapterNumber = numberMatch ? numberMatch[1] : rawTitle;
          const date = normalizeText(
            (node.querySelector(selectors.chapterDate) as HTMLElement | null)?.textContent,
          );
          return {
            chapterNumber,
            chapterTitle: rawTitle,
            chapterUrl: href,
            releaseDate: date,
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item));

      return {
        title,
        image,
        description,
        status,
        rating,
        followers,
        genres,
        author,
        artist,
        serialization,
        updatedOn,
        chapters,
      };
    }, this.config.selectors.detail);

    const result: Manhwa = {
      id: url,
      title: details.title,
      description: details.description,
      image: details.image,
      headerForImage: { Referer: this.config.baseUrl },
      status: details.status || 'Unknown',
      rating: details.rating || undefined,
      genres: details.genres,
      chapters: details.chapters,
      followers: details.followers,
      author: details.author,
      artist: details.artist,
      serialization: details.serialization,
      updatedOn: details.updatedOn,
    };

    this.cache.set(cacheKey, result);
    return result;
  }

  private async scrollToBottom(page: Page) {
    try {
      await page.evaluate(async () => {
        await new Promise<void>((resolve) => {
          let total = 0;
          const distance = 600;
          const timer = window.setInterval(() => {
            const { scrollHeight } = document.body;
            window.scrollBy(0, distance);
            total += distance;
            if (total >= scrollHeight - window.innerHeight) {
              window.clearInterval(timer);
              resolve();
            }
          }, 200);
        });
      });
    } catch {
      // Ignore scroll failures; some pages lock scrolling.
    }
  }

  async checkManhwaChapter(page: Page, url: string): Promise<ManhwaChapter> {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: this.config.timeout });
    try {
      await page.waitForSelector(this.config.selectors.chapter.images, {
        timeout: Math.min(12000, this.config.timeout),
      });
    } catch {
      // Continue even if selector is slow; fallback to HTML scan.
    }
    await this.scrollToBottom(page);
    await this.sleep(500);

    const baseUrl = this.config.baseUrl.endsWith('/')
      ? this.config.baseUrl.slice(0, -1)
      : this.config.baseUrl;

    const chapterImages = await page.evaluate((selectors, base) => {
      const normalizeUrl = (src: string) => {
        if (!src) return '';
        if (src.startsWith('data:') || src.startsWith('blob:')) return '';
        if (src.startsWith('//')) return `https:${src}`;
        if (src.startsWith('http')) return src;
        const clean = src.startsWith('/') ? src : `/${src}`;
        return `${base}${clean}`;
      };

      const pickFromSrcset = (value?: string | null) => {
        if (!value) return '';
        const entries = value
          .split(',')
          .map((entry) => entry.trim())
          .filter(Boolean);
        if (!entries.length) return '';
        const last = entries[entries.length - 1];
        return last.split(' ')[0] || '';
      };

      const results: string[] = [];
      const seen = new Set<string>();
      const push = (src: string) => {
        const normalized = normalizeUrl(src);
        if (!normalized || seen.has(normalized)) return;
        seen.add(normalized);
        results.push(normalized);
      };

      const fromImages = Array.from(document.querySelectorAll(selectors.images));
      fromImages.forEach((img) => {
        const el = img as HTMLImageElement;
        const srcset =
          el.getAttribute('data-srcset') ||
          el.getAttribute('data-lazy-srcset') ||
          el.getAttribute('srcset');
        const srcFromSet = pickFromSrcset(srcset);
        const src =
          el.getAttribute('data-src') ||
          el.getAttribute('data-lazy-src') ||
          el.getAttribute('data-original') ||
          el.getAttribute('data-orig-file') ||
          el.getAttribute('data-full') ||
          srcFromSet ||
          el.currentSrc ||
          el.getAttribute('src') ||
          '';
        push(src);
      });

      if (results.length > 0) return results;

      const win = window as unknown as {
        chapter_preloaded_images?: string[];
        ts_reader?: { params?: { sources?: Array<{ images?: string[]; source?: string[] }> } };
      };

      const preloaded = win.chapter_preloaded_images;
      if (Array.isArray(preloaded)) {
        preloaded.forEach((src) => push(src));
        if (results.length > 0) return results;
      }

      const tsSources = win.ts_reader?.params?.sources;
      if (Array.isArray(tsSources)) {
        tsSources.forEach((source) => {
          source.images?.forEach((src) => push(src));
          source.source?.forEach((src) => push(src));
        });
        if (results.length > 0) return results;
      }

      const noscripts = Array.from(document.querySelectorAll('noscript'));
      for (const node of noscripts) {
        const html = node.innerHTML || '';
        const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
        if (match?.[1]) {
          push(match[1]);
        }
      }

      if (results.length > 0) return results;

      const html = document.documentElement?.innerHTML || '';
      const matches = html.match(/https?:\/\/[^"'\s)]+/g) || [];
      matches.forEach((url) => {
        if (/tnlycdn\.com|toonily\.com/.test(url)) {
          push(url);
        }
      });
      return results;
    }, this.config.selectors.chapter, baseUrl);

    const unique = Array.from(new Set(chapterImages));
    const result: ManhwaChapter = unique.map((src, index) => ({
      page: index + 1,
      img: src,
      headerForImage: this.config.baseUrl,
    }));

    if (result.length === 0) {
      console.warn('No chapter images found. The page may have failed to load.');
    }

    return result;
  }
}
