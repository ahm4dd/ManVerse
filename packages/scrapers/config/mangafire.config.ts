import { type MangaFireConfig } from './types.ts';

/**
 * MangaFire Scraper Configuration
 * Uses MangaFire-specific selectors and filter search form.
 */
export const mangafireConfig: MangaFireConfig = {
  name: 'MangaFire',
  baseUrl: 'https://mangafire.to/',
  timeout: 60000,
  retries: 3,
  headers: {
    referer: 'https://mangafire.to/',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  },
  selectors: {
    search: {
      form: 'form[action="filter"]',
      keywordInput: 'input[name="keyword"]',
      resultContainer: '.unit',
      link: 'a[href^="/manga/"]',
      image: 'a.poster img, img',
      title: '.info > a, .info a',
      rating: '.live-score, .rating, .score',
      chapters: '.content[data-name="chap"]',
      nextButton: 'a[rel="next"], a.next',
    },
    detail: {
      title: 'h1[itemprop="name"], h1',
      image: '.poster img[itemprop="image"], .poster img',
      description: '.description',
      status: '.info p',
      rating: '.rating-box .live-score',
      metaItem: '.meta > div',
      metaLabel: '.meta > div > span:first-child',
      metaValue: '.meta > div > span:last-child',
      genres: '.meta a[href^="/genre/"]',
      chapters: '.list-body ul.scroll-sm li.item',
      chapterLink: 'a',
      chapterTitle: 'span',
      chapterDate: 'span:nth-of-type(2)',
    },
    chapter: {
      images: 'img',
    },
  },
  output: {
    directory: 'mangafire',
    fileExtension: '.jpg',
    filenamePadding: 3,
  },
};
