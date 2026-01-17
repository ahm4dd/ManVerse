import { z } from 'zod';
import { Providers, NetworkConfigSchema } from '@manverse/core';

export const ScraperConfigSchema = NetworkConfigSchema.extend({
  baseUrl: z.string(),
});

export const AsuraScansConfigSchema = ScraperConfigSchema.extend({
  // the name has to be one of the provider and that is asurascans
  name: z.literal(Providers.AsuraScans),
  selectors: z
    .object({
      // Search page selectors
      search: z
        .object({
          resultContainer: z.string().default('div a[href^="series/"]'),
          nextButton: z.string().default('a'),
          previousButton: z.string().default('a'),
          // Search result structure selectors (for parsing nested DOM)
          structure: z
            .object({
              firstDiv: z.string().default('div'),
              innerDiv: z.string().default('div'),
              scopeDiv: z.string().default(':scope > div'),
              statusSpan: z.string().default('span'),
              image: z.string().default('img'),
              spans: z.string().default('span'),
              ratingText: z.string().default('span.ml-1'),
            })
            .default({
              firstDiv: 'div',
              innerDiv: 'div',
              scopeDiv: ':scope > div',
              statusSpan: 'span',
              image: 'img',
              spans: 'span',
              ratingText: 'span.ml-1',
            }),
          // Pagination patterns
          pagination: z
            .object({
              nextButtonText: z.string().default('Next'),
              previousButtonText: z.string().default('Previous'),
            })
            .default({
              nextButtonText: 'Next',
              previousButtonText: 'Previous',
            }),
        })
        .default({
          resultContainer: 'div a[href^="series/"]',
          nextButton: 'a',
          previousButton: 'a',
          structure: {
            firstDiv: 'div',
            innerDiv: 'div',
            scopeDiv: ':scope > div',
            statusSpan: 'span',
            image: 'img',
            spans: 'span',
            ratingText: 'span.ml-1',
          },
          pagination: {
            nextButtonText: 'Next',
            previousButtonText: 'Previous',
          },
        }),
      // Manhwa detail page selectors
      detail: z
        .object({
          title: z
            .string()
            .default(
              'h3.hover\\:text-themecolor.cursor-pointer.text-white.text-sm.shrink-0.w-\\[calc\\(100\\%-120px\\)\\].truncate',
            ),
          image: z.string().default('img[alt="poster"]'),
          status: z.string().default('h3.text-sm.text-\\[\\#A2A2A2\\]'),
          rating: z.string().default('span.ml-1.text-xs'),
          followers: z.string().default('p.text-\\[\\#A2A2A2\\].text-\\[13px\\]'),
          genres: z.string().default('.bg-\\[\\#343434\\].text-white.hover\\:text-themecolor'),
          chapters: z.string().default('div.pl-4.py-2.border.rounded-md'),
          gridElements: z.string().default('.grid.grid-cols-1.md\\:grid-cols-2 h3'),
          // Synopsis selectors
          synopsisHeading: z.string().default('h3'),
          // Chapter item structure
          chapterLink: z.string().default('a'),
          chapterTitle: z.string().default('h3'),
          chapterDate: z.string().default('h3.text-xs.text-\\[\\#A2A2A2\\]'),
        })
        .default({
          title:
            'h3.hover\\:text-themecolor.cursor-pointer.text-white.text-sm.shrink-0.w-\\[calc\\(100\\%-120px\\)\\].truncate',
          image: 'img[alt="poster"]',
          status: 'h3.text-sm.text-\\[\\#A2A2A2\\]',
          rating: 'span.ml-1.text-xs',
          followers: 'p.text-\\[\\#A2A2A2\\].text-\\[13px\\]',
          genres: '.bg-\\[\\#343434\\].text-white.hover\\:text-themecolor',
          chapters: 'div.pl-4.py-2.border.rounded-md',
          gridElements: '.grid.grid-cols-1.md\\:grid-cols-2 h3',
          synopsisHeading: 'h3',
          chapterLink: 'a',
          chapterTitle: 'h3',
          chapterDate: 'h3.text-xs.text-\\[\\#A2A2A2\\]',
        }),
      // Chapter page selectors
      chapter: z
        .object({
          images: z.string().default('img.object-cover.mx-auto'),
        })
        .default({
          images: 'img.object-cover.mx-auto',
        }),
    })
    .default({
      search: {
        resultContainer: 'div a[href^="series/"]',
        nextButton: 'a',
        previousButton: 'a',
        structure: {
          firstDiv: 'div',
          innerDiv: 'div',
          scopeDiv: ':scope > div',
          statusSpan: 'span',
          image: 'img',
          spans: 'span',
          ratingText: 'span.ml-1',
        },
        pagination: {
          nextButtonText: 'Next',
          previousButtonText: 'Previous',
        },
      },
      detail: {
        title:
          'h3.hover\\:text-themecolor.cursor-pointer.text-white.text-sm.shrink-0.w-\\[calc\\(100\\%-120px\\)\\].truncate',
        image: 'img[alt="poster"]',
        status: 'h3.text-sm.text-\\[\\#A2A2A2\\]',
        rating: 'span.ml-1.text-xs',
        followers: 'p.text-\\[\\#A2A2A2\\].text-\\[13px\\]',
        genres: '.bg-\\[\\#343434\\].text-white.hover\\:text-themecolor',
        chapters: 'div.pl-4.py-2.border.rounded-md',
        gridElements: '.grid.grid-cols-1.md\\:grid-cols-2 h3',
        synopsisHeading: 'h3',
        chapterLink: 'a',
        chapterTitle: 'h3',
        chapterDate: 'h3.text-xs.text-\\[\\#A2A2A2\\]',
      },
      chapter: {
        images: 'img.object-cover.mx-auto',
      },
    }),
  // Output configuration for downloaded files
  output: z
    .object({
      directory: z.string().default('man'),
      fileExtension: z.string().default('.webp'),
      filenamePadding: z.number().default(3),
    })
    .default({
      directory: 'man',
      fileExtension: '.webp',
      filenamePadding: 3,
    }),
});

export const ToonilyConfigSchema = ScraperConfigSchema.extend({
  name: z.literal(Providers.Toonily),
  selectors: z
    .object({
      search: z
        .object({
          resultContainer: z
            .string()
            .default(
              '.page-item-detail, .page-item-detail.manga, .manga-item, .post-content, .row.c-tabs-item, .c-tabs-item__content',
            ),
          link: z.string().default('.item-thumb a, .post-title a, a[href*="/serie/"]'),
          image: z.string().default('.item-thumb img, img'),
          title: z.string().default('.post-title a, .post-title h3 a, h3 a, h4 a, a'),
          rating: z
            .string()
            .default('[property="ratingValue"], #averagerate, .post-total-rating, .score, .rating'),
          chapters: z
            .string()
            .default('.chapter, .post-total-chapter, .chapter-item, .latest-chapter, .chapters'),
          nextButton: z
            .string()
            .default('a.next, a.page-numbers.next, a[rel="next"], a.pagination-next'),
        })
        .default({
          resultContainer:
            '.page-item-detail, .page-item-detail.manga, .manga-item, .post-content, .row.c-tabs-item, .c-tabs-item__content',
          link: '.item-thumb a, .post-title a, a[href*="/serie/"]',
          image: '.item-thumb img, img',
          title: '.post-title a, .post-title h3 a, h3 a, h4 a, a',
          rating: '[property="ratingValue"], #averagerate, .post-total-rating, .score, .rating',
          chapters: '.chapter, .post-total-chapter, .chapter-item, .latest-chapter, .chapters',
          nextButton: 'a.next, a.page-numbers.next, a[rel="next"], a.pagination-next',
        }),
      detail: z
        .object({
          title: z.string().default('h1, .post-title h1, .manga-title h1'),
          image: z.string().default('.summary_image img, .summary_image a img, .summary_image img'),
          description: z
            .string()
            .default('.description-summary, .summary__content, .summary__content p'),
          genres: z
            .string()
            .default('.genres-content a, .genres a, .tags-content a, .summary-content a[rel="tag"]'),
          infoItem: z.string().default('.post-content_item, .summary-list li, .manga-info-row'),
          infoLabel: z.string().default('.summary-heading, .summary-label, .info-label'),
          infoValue: z.string().default('.summary-content, .summary-value, .info-value'),
          chapters: z
            .string()
            .default('li.wp-manga-chapter, .listing-chapters_wrap li, .chapter-list li'),
          chapterLink: z.string().default('a'),
          chapterDate: z
            .string()
            .default('.chapter-release-date, .chapter-release, .chapter-time, .post-on'),
        })
        .default({
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
        }),
      chapter: z
        .object({
          images: z.string().default('.reading-content img, .wp-manga-chapter-img img, img'),
        })
        .default({
          images: '.reading-content img, .wp-manga-chapter-img img, img',
        }),
    })
    .default({
      search: {
        resultContainer:
          '.page-item-detail, .c-tabs-item__content, .manga-item, .post-content, .row.c-tabs-item',
        link: 'a[href*="/serie/"]',
        image: 'img',
        title: 'h3, h4, a',
        rating: '.post-total-rating, .score, .rating',
        chapters: '.chapter, .post-total-chapter, .chapter-item',
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
    }),
  output: z
    .object({
      directory: z.string().default('toonily'),
      fileExtension: z.string().default('.jpg'),
      filenamePadding: z.number().default(3),
    })
    .default({
      directory: 'toonily',
      fileExtension: '.jpg',
      filenamePadding: 3,
    }),
});

export const MangaGGConfigSchema = ScraperConfigSchema.extend({
  name: z.literal(Providers.MangaGG),
  selectors: z
    .object({
      search: z
        .object({
          resultContainer: z
            .string()
            .default(
              '.c-tabs-item__content, .page-item-detail, .page-item-detail.manga, .c-tabs-item__content .row',
            ),
          link: z.string().default('a[href*="/comic/"]'),
          image: z.string().default('.item-thumb img, img'),
          title: z.string().default('.post-title a, .post-title h3 a, h3 a, h4 a'),
          rating: z
            .string()
            .default('[property="ratingValue"], #averagerate, .post-total-rating, .score, .rating'),
          chapters: z
            .string()
            .default('.latest-chap a, .latest-chapter a, .chapter a, .chapter-item a, .latest-chapter'),
          nextButton: z
            .string()
            .default('a.next, a.page-numbers.next, a[rel="next"], a.pagination-next'),
        })
        .default({
          resultContainer:
            '.c-tabs-item__content, .page-item-detail, .page-item-detail.manga, .c-tabs-item__content .row',
          link: 'a[href*="/comic/"]',
          image: '.item-thumb img, img',
          title: '.post-title a, .post-title h3 a, h3 a, h4 a',
          rating: '[property="ratingValue"], #averagerate, .post-total-rating, .score, .rating',
          chapters: '.latest-chap a, .latest-chapter a, .chapter a, .chapter-item a, .latest-chapter',
          nextButton: 'a.next, a.page-numbers.next, a[rel="next"], a.pagination-next',
        }),
      detail: z
        .object({
          title: z.string().default('h1, .post-title h1, .manga-title h1'),
          image: z.string().default('.summary_image img, .summary_image a img, .manga-thumbnail img'),
          description: z
            .string()
            .default('.summary__content, .summary__content p, .description-summary'),
          genres: z
            .string()
            .default('.genres-content a, .genres a, .tags-content a, .summary-content a[rel="tag"]'),
          infoItem: z.string().default('.post-content_item, .summary-list li, .manga-info-row'),
          infoLabel: z.string().default('.summary-heading, .summary-label, .info-label'),
          infoValue: z.string().default('.summary-content, .summary-value, .info-value'),
          chapters: z
            .string()
            .default('li.wp-manga-chapter, .listing-chapters_wrap li, .chapter-list li'),
          chapterLink: z.string().default('a'),
          chapterDate: z
            .string()
            .default('.chapter-release-date, .chapter-release, .chapter-time, .post-on'),
        })
        .default({
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
        }),
      chapter: z
        .object({
          images: z.string().default('.reading-content img, .wp-manga-chapter-img img, img'),
        })
        .default({
          images: '.reading-content img, .wp-manga-chapter-img img, img',
        }),
    })
    .default({
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
    }),
  output: z
    .object({
      directory: z.string().default('mangagg'),
      fileExtension: z.string().default('.jpg'),
      filenamePadding: z.number().default(3),
    })
    .default({
      directory: 'mangagg',
      fileExtension: '.jpg',
      filenamePadding: 3,
    }),
});

export const MangaFireConfigSchema = ScraperConfigSchema.extend({
  name: z.literal(Providers.MangaFire),
  selectors: z
    .object({
      search: z
        .object({
          form: z.string().default('form[action="filter"]'),
          keywordInput: z.string().default('input[name="keyword"]'),
          resultContainer: z.string().default('.unit'),
          link: z.string().default('a[href^="/manga/"]'),
          image: z.string().default('a.poster img, img'),
          title: z.string().default('.info > a, .info a'),
          rating: z.string().default('.live-score, .rating, .score'),
          chapters: z.string().default('.content[data-name="chap"]'),
          nextButton: z.string().default('a[rel="next"], a.next'),
        })
        .default({
          form: 'form[action="filter"]',
          keywordInput: 'input[name="keyword"]',
          resultContainer: '.unit',
          link: 'a[href^="/manga/"]',
          image: 'a.poster img, img',
          title: '.info > a, .info a',
          rating: '.live-score, .rating, .score',
          chapters: '.content[data-name="chap"]',
          nextButton: 'a[rel="next"], a.next',
        }),
      detail: z
        .object({
          title: z.string().default('h1[itemprop="name"], h1'),
          image: z.string().default('.poster img[itemprop="image"], .poster img'),
          description: z.string().default('.description'),
          status: z.string().default('.info p'),
          rating: z.string().default('.rating-box .live-score'),
          metaItem: z.string().default('.meta > div'),
          metaLabel: z.string().default('.meta > div > span:first-child'),
          metaValue: z.string().default('.meta > div > span:last-child'),
          genres: z.string().default('.meta a[href^="/genre/"]'),
          chapters: z.string().default('.list-body ul.scroll-sm li.item'),
          chapterLink: z.string().default('a'),
          chapterTitle: z.string().default('span'),
          chapterDate: z.string().default('span:nth-of-type(2)'),
        })
        .default({
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
        }),
      chapter: z
        .object({
          images: z.string().default('img'),
        })
        .default({
          images: 'img',
        }),
    })
    .default({
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
    }),
  output: z
    .object({
      directory: z.string().default('mangafire'),
      fileExtension: z.string().default('.jpg'),
      filenamePadding: z.number().default(3),
    })
    .default({
      directory: 'mangafire',
      fileExtension: '.jpg',
      filenamePadding: 3,
    }),
});

// Type exports
export type ScraperConfig = z.infer<typeof ScraperConfigSchema>;
export type AsuraScansConfig = z.infer<typeof AsuraScansConfigSchema>;
export type ToonilyConfig = z.infer<typeof ToonilyConfigSchema>;
export type MangaGGConfig = z.infer<typeof MangaGGConfigSchema>;
export type MangaFireConfig = z.infer<typeof MangaFireConfigSchema>;
export type AnyScraperConfig = AsuraScansConfig | ToonilyConfig | MangaGGConfig | MangaFireConfig;
