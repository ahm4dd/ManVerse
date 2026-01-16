import { type ToonilyConfig } from './types.ts';

/**
 * Toonily Scraper Configuration
 * Selectors follow common Madara theme structure with broad fallbacks.
 */
export const toonilyConfig: ToonilyConfig = {
  name: 'Toonily',
  baseUrl: 'https://toonily.com/',
  timeout: 60000,
  retries: 3,
  headers: {
    referer: 'https://toonily.com/',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  },
  selectors: {
    search: {
      resultContainer:
        '.page-item-detail, .page-item-detail.manga, .manga-item, .post-content, .row.c-tabs-item, .c-tabs-item__content',
      link: '.item-thumb a, .post-title a, a[href*="/serie/"]',
      image: '.item-thumb img, img',
      title: '.post-title a, .post-title h3 a, h3 a, h4 a, a',
      rating: '[property="ratingValue"], #averagerate, .post-total-rating, .score, .rating',
      chapters: '.chapter, .post-total-chapter, .chapter-item, .latest-chapter, .chapters',
      nextButton: 'a.next, a.page-numbers.next, a[rel="next"], a.pagination-next',
    },
    detail: {
      title: 'h1, .post-title h1, .manga-title h1',
      image: '.summary_image img, .summary_image a img, .summary_image img',
      description: '.description-summary, .summary__content, .summary__content p',
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
    directory: 'toonily',
    fileExtension: '.jpg',
    filenamePadding: 3,
  },
};
