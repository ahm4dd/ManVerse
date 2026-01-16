import type { Page } from 'puppeteer';
import type { Manhwa, ManhwaChapter, SearchResult } from '@manverse/core';
import { mangaggConfig, type MangaGGConfig } from '../config/index.ts';
import type IScraper from './scraper.ts';
import { ScraperCache } from './cache.ts';

export default class MangaGGScraper implements IScraper {
  config: MangaGGConfig;
  private cache: ScraperCache;

  constructor(config: MangaGGConfig = mangaggConfig) {
    this.config = config;
    this.cache = new ScraperCache('mangagg');
  }

  private sleep(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
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

    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: this.config.timeout });
    try {
      await page.waitForSelector(this.config.selectors.search.resultContainer, {
        timeout: Math.min(10000, this.config.timeout),
      });
    } catch {
      // Allow fallback parsing when selectors shift or lazy content loads.
    }
    await this.sleep(200);

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

      const normalizeText = (value?: string | null) =>
        value?.replace(/\s+/g, ' ').trim() ?? '';

      const normalizeUrl = (src: string) => {
        const cleaned = src?.trim() || '';
        if (!cleaned) return '';
        if (cleaned.startsWith('data:') || cleaned.startsWith('blob:')) return '';
        if (cleaned.startsWith('http')) return cleaned;
        if (cleaned.startsWith('//')) return `https:${cleaned}`;
        const normalized = cleaned.startsWith('/') ? cleaned : `/${cleaned}`;
        return `${baseRoot}${normalized}`;
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

      const sanitizeTitle = (value: string) => {
        if (!value) return value;
        let next = value.trim();
        if (/^read\\b/i.test(next)) {
          next = next.replace(/^read\\b[:\\s-]*/i, '');
        }
        next = next.replace(/\\b(manhwa|manga|webtoon|comic)\\b/gi, '');
        next = next.replace(/\\bfor free\\b/gi, '');
        next = next.replace(/\\s{2,}/g, ' ').trim();
        return next || value;
      };

      const resolveAnchor = (root: Element) => {
        const primary = root.querySelector(selectors.link) as HTMLAnchorElement | null;
        const primaryHref = primary?.getAttribute('href') || '';
        if (primaryHref) return primary;
        const fallback = Array.from(root.querySelectorAll('a')).find((anchor) => {
          const href = (anchor as HTMLAnchorElement).getAttribute('href') || '';
          return href.includes('/comic/');
        });
        return (fallback as HTMLAnchorElement) || null;
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

      const resolveTitle = (root: Element | null, anchor: HTMLAnchorElement | null) => {
        const heading = root?.querySelector(selectors.title) as HTMLElement | null;
        const fromHeading = normalizeText(heading?.textContent);
        const fromAnchor = normalizeText(anchor?.getAttribute('title'));
        const fromText = normalizeText(anchor?.textContent);
        const img = root?.querySelector(selectors.image) as HTMLImageElement | null;
        const fromImg = normalizeText(img?.getAttribute('alt'));
        const raw = fromHeading || fromAnchor || fromText || fromImg;
        return sanitizeTitle(raw);
      };

      const resolveMeta = (root: Element | null, selector: string) => {
        if (!root) return '';
        const el = root.querySelector(selector);
        return normalizeText(el?.textContent);
      };

      const containers = Array.from(document.querySelectorAll(selectors.resultContainer));
      const anchors = containers.length ? [] : Array.from(document.querySelectorAll(selectors.link));

      const pushItem = (root: Element, anchor: HTMLAnchorElement | null) => {
        const rawLink = anchor?.getAttribute('href') || '';
        const link = normalizeUrl(rawLink);
        if (!link || !link.includes('/comic/') || link.includes('/chapter')) return;
        if (seen.has(link)) return;
        const image = resolveImage(root);
        const title = resolveTitle(root, anchor);
        if (!title || !image) return;
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
      if (document.querySelector('link[rel="next"]')) return true;
      const next = document.querySelector(selector) as HTMLAnchorElement | null;
      if (!next) {
        return Boolean(
          Array.from(document.querySelectorAll('a')).find((el) =>
            /next|»/i.test(el.textContent || ''),
          ),
        );
      }
      const style = next.getAttribute('style');
      return !style || !style.includes('pointer-events:none');
    }, this.config.selectors.search.nextButton);

    const response: SearchResult = {
      currentPage: pageNumber,
      hasNextPage,
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
          (item.querySelector(selectors.infoValue) as HTMLElement | null)?.textContent ||
            item.textContent,
        );

        if (!label || !value) continue;
        if (label.includes('status')) status = value;
        if (label.includes('rating')) rating = value;
        if (label.includes('follow') || label.includes('view')) followers = value;
        if (label.includes('author')) author = value;
        if (label.includes('artist')) artist = value;
        if (label.includes('serialization') || label.includes('serial')) serialization = value;
        if (label.includes('updated')) updatedOn = value;
      }

      const seen = new Set<string>();
      const chapterNodes = Array.from(document.querySelectorAll(selectors.chapters));
      const chapters = chapterNodes
        .map((node) => {
          const linkEl = node.querySelector(selectors.chapterLink) as HTMLAnchorElement | null;
          const href = linkEl?.href ?? '';
          if (!href || !href.includes('/chapter')) return null;
          if (seen.has(href)) return null;
          seen.add(href);
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

    let chapters = details.chapters;
    if (!chapters.length) {
      const ajaxChapters = await this.fetchAjaxChapters(page, url);
      if (ajaxChapters.length > 0) {
        chapters = ajaxChapters;
      }
    }

    const result: Manhwa = {
      id: url,
      title: details.title,
      description: details.description,
      image: details.image,
      headerForImage: { Referer: this.config.baseUrl },
      status: details.status || 'Unknown',
      rating: details.rating || undefined,
      genres: details.genres,
      chapters,
      followers: details.followers,
      author: details.author,
      artist: details.artist,
      serialization: details.serialization,
      updatedOn: details.updatedOn,
    };

    this.cache.set(cacheKey, result);
    return result;
  }

  private async fetchAjaxChapters(page: Page, url: string): Promise<Manhwa['chapters']> {
    const seriesBase = url.replace(/\/$/, '');
    const seriesBaseWithSlash = `${seriesBase}/`;
    const siteBase = this.config.baseUrl.endsWith('/')
      ? this.config.baseUrl.slice(0, -1)
      : this.config.baseUrl;

    const chapters = await this.fetchAjaxChapterPages(page, seriesBase, seriesBaseWithSlash);
    if (chapters.length > 0) {
      return chapters;
    }

    const legacy = await this.fetchLegacyChapterList(page, siteBase, seriesBaseWithSlash);
    return legacy;
  }

  private async fetchAjaxChapterPages(
    page: Page,
    seriesBase: string,
    seriesBaseWithSlash: string,
  ): Promise<Manhwa['chapters']> {
    const seen = new Set<string>();
    const chapters: Manhwa['chapters'] = [];
    let currentPage = 1;
    let maxPage: number | null = null;

    while (currentPage <= 50) {
      const pageUrl =
        currentPage === 1
          ? `${seriesBase}/ajax/chapters`
          : `${seriesBase}/ajax/chapters?t=${currentPage}`;

      const result = await page.evaluate(async (targetUrl, baseUrl) => {
        const normalizeText = (value?: string | null) =>
          value?.replace(/\s+/g, ' ').trim() ?? '';

        const parseHtml = (html: string) => {
          if (!html) return { items: [], maxPage: null as number | null };
          const doc = new DOMParser().parseFromString(html, 'text/html');
          const elements = Array.from(doc.querySelectorAll('li.wp-manga-chapter'));
          const items = elements
            .map((node) => {
              const link = node.querySelector('a');
              const href = link?.getAttribute('href') || '';
              const title = normalizeText(link?.textContent || node.textContent);
              const date = normalizeText(
                node.querySelector(
                  'span.chapter-release-date, span.chapter-release, span.chapter-time, span.post-on',
                )?.textContent,
              );
              if (!href || !title) return null;
              const absolute = new URL(href, baseUrl).toString();
              return { href: absolute, title, date };
            })
            .filter(Boolean) as Array<{ href: string; title: string; date: string }>;

          const pageElements = Array.from(
            doc.querySelectorAll(
              '.pagination a[data-page], .pagination span[data-page], a[data-page]',
            ),
          );
          const pageNumbers = pageElements
            .map((el) => parseInt(el.getAttribute('data-page') || '', 10))
            .filter((value) => !Number.isNaN(value));
          const maxPage = pageNumbers.length ? Math.max(...pageNumbers) : null;
          return { items, maxPage };
        };

        const fetchHtml = async (method: 'POST' | 'GET') => {
          try {
            const res = await fetch(targetUrl, {
              method,
              headers: {
                'X-Requested-With': 'XMLHttpRequest',
              },
            });
            if (!res.ok) return '';
            return await res.text();
          } catch {
            return '';
          }
        };

        let html = await fetchHtml('POST');
        if (!html) {
          html = await fetchHtml('GET');
        }
        return parseHtml(html);
      }, pageUrl, seriesBaseWithSlash);

      if (!result.items.length) {
        break;
      }

      result.items.forEach((item) => {
        if (seen.has(item.href)) return;
        seen.add(item.href);
        const numberMatch = item.title.match(/([0-9]+(?:\.[0-9]+)?)/);
        const chapterNumber = numberMatch ? numberMatch[1] : item.title;
        chapters.push({
          chapterNumber,
          chapterTitle: item.title,
          chapterUrl: item.href,
          releaseDate: item.date,
        });
      });

      if (maxPage === null && result.maxPage) {
        maxPage = result.maxPage;
      }

      if (maxPage !== null && currentPage >= maxPage) {
        break;
      }

      currentPage += 1;
    }

    return chapters;
  }

  private async fetchLegacyChapterList(
    page: Page,
    siteBase: string,
    seriesBaseWithSlash: string,
  ): Promise<Manhwa['chapters']> {
    const mangaId = await page.evaluate(() => {
      const wrapper =
        document.querySelector('div[id^=\"manga-chapters-holder\"]') ||
        document.querySelector('#manga-chapters-holder');
      if (!wrapper) return '';
      const dataId = wrapper.getAttribute('data-id');
      const datasetId = (wrapper as HTMLElement).dataset?.id;
      return dataId || datasetId || '';
    });

    if (!mangaId) return [];

    const result = await page.evaluate(
      async (endpoint, manga, baseUrl) => {
        const normalizeText = (value?: string | null) =>
          value?.replace(/\s+/g, ' ').trim() ?? '';
        const params = new URLSearchParams();
        params.set('action', 'manga_get_chapters');
        params.set('manga', manga);

        try {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
              'X-Requested-With': 'XMLHttpRequest',
            },
            body: params.toString(),
          });
          if (!res.ok) return [];
          const html = await res.text();
          if (!html) return [];
          const doc = new DOMParser().parseFromString(html, 'text/html');
          const nodes = Array.from(doc.querySelectorAll('li.wp-manga-chapter'));
          return nodes
            .map((node) => {
              const link = node.querySelector('a');
              const href = link?.getAttribute('href') || '';
              const title = normalizeText(link?.textContent || node.textContent);
              const date = normalizeText(
                node.querySelector(
                  'span.chapter-release-date, span.chapter-release, span.chapter-time, span.post-on',
                )?.textContent,
              );
              if (!href || !title) return null;
              const absolute = new URL(href, baseUrl).toString();
              return { href: absolute, title, date };
            })
            .filter(Boolean);
        } catch {
          return [];
        }
      },
      `${siteBase}/wp-admin/admin-ajax.php`,
      mangaId,
      seriesBaseWithSlash,
    );

    const seen = new Set<string>();
    return (result as Array<{ href: string; title: string; date: string }>)
      .filter((item) => {
        if (!item || !item.href) return false;
        if (seen.has(item.href)) return false;
        seen.add(item.href);
        return true;
      })
      .map((item) => {
        const numberMatch = item.title.match(/([0-9]+(?:\.[0-9]+)?)/);
        const chapterNumber = numberMatch ? numberMatch[1] : item.title;
        return {
          chapterNumber,
          chapterTitle: item.title,
          chapterUrl: item.href,
          releaseDate: item.date,
        };
      });
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
    await this.sleep(300);

    const baseUrl = this.config.baseUrl.endsWith('/')
      ? this.config.baseUrl.slice(0, -1)
      : this.config.baseUrl;

    const chapterImages = await page.evaluate((selectors, base) => {
      const normalizeUrl = (src: string) => {
        const cleaned = src?.trim() || '';
        if (!cleaned) return '';
        if (cleaned.startsWith('data:') || cleaned.startsWith('blob:')) return '';
        if (cleaned.startsWith('//')) return `https:${cleaned}`;
        if (cleaned.startsWith('http')) return cleaned;
        const normalized = cleaned.startsWith('/') ? cleaned : `/${cleaned}`;
        return `${base}${normalized}`;
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
      }

      return results;
    }, this.config.selectors.chapter, baseUrl);

    return chapterImages.map((img, index) => ({
      page: index + 1,
      img,
      headerForImage: this.config.headers?.referer ?? this.config.baseUrl,
    }));
  }
}
