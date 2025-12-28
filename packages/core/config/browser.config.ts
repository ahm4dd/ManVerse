import { type BrowserConfig } from './types.ts';

/**
 * Default Browser Configuration
 *
 * These are the recommended settings for running Puppeteer with the scrapers.
 * You can override these by creating a custom config file.
 */
export const defaultBrowserConfig: BrowserConfig = {
  headless: 'shell',
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--disable-gpu',
  ],
  viewport: {
    width: 1920,
    height: 1080,
  },
  timeout: 60000, // 60 seconds
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};
