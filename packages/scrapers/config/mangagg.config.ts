import { type MangaGGConfig } from './types.ts';

/**
 * MangaGG Scraper Configuration
 * Uses Madara-style selectors with MangaGG base URLs.
 */
export const mangaggConfig: MangaGGConfig = {
  name: 'MangaGG',
  baseUrl: 'https://mangagg.com/',
  timeout: 60000,
  retries: 3,
  headers: {
    referer: 'https://mangagg.com/',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  },
  selectors: {
    search: {
      resultContainer:
        '.c-tabs-item__content, .page-item-detail, .page-item-detail.manga, .c-tabs-item__content .row',
      link: 'a[href*="/comic/"]',
      image: '.item-thumb img, img',
      title: '.post-title a, .post-title h3 a, h3 a, h4 a',
      rating: '[property="ratingValue"], #averagerate, .post-total-rating, .score, .rating',
      chapters: '.latest-chap a, .latest-chapter a, .chapter a, .chapter-item a, .latest-chapter',
      nextButton: 'a.next, a.page-numbers.next, a[rel="next"], a.pagination-next',
    },
    detail: {
      title: 'h1, .post-title h1, .manga-title h1',
      image: '.summary_image img, .summary_image a img, .manga-thumbnail img',
      description: '.summary__content, .summary__content p, .description-summary',
      genres: '.genres-content a, .genres a, .tags-content a, .summary-content a[rel="tag"]',
      infoItem: '.post-content_item, .summary-list li, .manga-info-row',
      infoLabel: '.summary-heading, .summary-label, .info-label',
      infoValue: '.summary-content, .summary-value, .info-value',
      chapters: 'li.wp-manga-chapter, .listing-chapters_wrap li, .chapter-list li',
      chapterLink: 'a',
      chapterDate: '.chapter-release-date, .chapter-release, .chapter-time, .post-on',
    },
    chapter: {
      images: '.reading-content img, .wp-manga-chapter-img img, img',
    },
  },
  output: {
    directory: 'mangagg',
    fileExtension: '.jpg',
    filenamePadding: 3,
  },
};
