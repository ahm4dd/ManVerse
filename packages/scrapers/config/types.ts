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

// Type exports
export type ScraperConfig = z.infer<typeof ScraperConfigSchema>;
export type AsuraScansConfig = z.infer<typeof AsuraScansConfigSchema>;
export type AnyScraperConfig = AsuraScansConfig;
