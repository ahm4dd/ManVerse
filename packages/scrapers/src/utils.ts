import { Page } from 'puppeteer';

/**
 * Optimizes the puppeteer page by blocking unnecessary resources.
 * This can speed up scraping by 3x-10x.
 */
export async function optimizePage(page: Page): Promise<void> {
  await page.setRequestInterception(true);

  page.on('request', (req) => {
    const resourceType = req.resourceType();
    if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
      req.abort();
    } else {
      req.continue();
    }
  });
}
