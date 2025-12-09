import { z } from 'zod';

/**
 * Browser Configuration
 * Settings for Puppeteer browser instance
 */
export const BrowserConfigSchema = z.object({
  headless: z.union([z.boolean(), z.literal('shell')]).default('shell'),
  args: z.array(z.string()).default(['--no-sandbox', '--disable-setuid-sandbox']),
  viewport: z.object({
    width: z.number().default(1920),
    height: z.number().default(1080),
  }).default({ width: 1920, height: 1080 }),
  userAgent: z.string().optional(),
  timeout: z.number().default(60000), // Default timeout in milliseconds
});

/**
 * Scraper Configuration Base
 * Common settings that all scrapers share
 */
export const ScraperConfigSchema = z.object({
  name: z.string(),
  baseUrl: z.string().url(),
  timeout: z.number().default(60000),
  retries: z.number().default(3),
  headers: z.object({
    referer: z.string().optional(),
    userAgent: z.string().optional(),
  }).default({}),
});

/**
 * AsuraScans Specific Configuration
 * Extends base scraper config with AsuraScans-specific settings
 */
export const AsuraScansConfigSchema = ScraperConfigSchema.extend({
  selectors: z.object({
    // Search page selectors
    search: z.object({
      resultContainer: z.string().default('div a[href^="series/"]'),
      nextButton: z.string().default('a'),
      previousButton: z.string().default('a'),
    }).default({ resultContainer: 'div a[href^="series/"]', nextButton: 'a', previousButton: 'a' }),
    // Manhwa detail page selectors
    detail: z.object({
      title: z.string().default('h3.hover\\:text-themecolor.cursor-pointer.text-white.text-sm.shrink-0.w-\\[calc\\(100\\%-120px\\)\\].truncate'),
      image: z.string().default('img[alt="poster"]'),
      status: z.string().default('h3.text-sm.text-\\[\\#A2A2A2\\]'),
      rating: z.string().default('span.ml-1.text-xs'),
      followers: z.string().default('p.text-\\[\\#A2A2A2\\].text-\\[13px\\]'),
      genres: z.string().default('.bg-\\[\\#343434\\].text-white.hover\\:text-themecolor'),
      chapters: z.string().default('div.pl-4.py-2.border.rounded-md'),
      gridElements: z.string().default('.grid.grid-cols-1.md\\:grid-cols-2 h3'),
    }).default({
      title: 'h3.hover\\:text-themecolor.cursor-pointer.text-white.text-sm.shrink-0.w-\\[calc\\(100\\%-120px\\)\\].truncate',
      image: 'img[alt="poster"]',
      status: 'h3.text-sm.text-\\[\\#A2A2A2\\]',
      rating: 'span.ml-1.text-xs',
      followers: 'p.text-\\[\\#A2A2A2\\].text-\\[13px\\]',
      genres: '.bg-\\[\\#343434\\].text-white.hover\\:text-themecolor',
      chapters: 'div.pl-4.py-2.border.rounded-md',
      gridElements: '.grid.grid-cols-1.md\\:grid-cols-2 h3',
    }),
  }).default({
    search: { resultContainer: 'div a[href^="series/"]', nextButton: 'a', previousButton: 'a' },
    detail: {
      title: 'h3.hover\\:text-themecolor.cursor-pointer.text-white.text-sm.shrink-0.w-\\[calc\\(100\\%-120px\\)\\].truncate',
      image: 'img[alt="poster"]',
      status: 'h3.text-sm.text-\\[\\#A2A2A2\\]',
      rating: 'span.ml-1.text-xs',
      followers: 'p.text-\\[\\#A2A2A2\\].text-\\[13px\\]',
      genres: '.bg-\\[\\#343434\\].text-white.hover\\:text-themecolor',
      chapters: 'div.pl-4.py-2.border.rounded-md',
      gridElements: '.grid.grid-cols-1.md\\:grid-cols-2 h3',
    },
  }),
});

// Type exports
export type BrowserConfig = z.infer<typeof BrowserConfigSchema>;
export type ScraperConfig = z.infer<typeof ScraperConfigSchema>;
export type AsuraScansConfig = z.infer<typeof AsuraScansConfigSchema>;
