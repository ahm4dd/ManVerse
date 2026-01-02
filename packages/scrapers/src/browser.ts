import puppeteer, { Browser, Page } from 'puppeteer';

let browserInstance: Browser | null = null;

export const startBrowser = async (): Promise<Browser> => {
  if (browserInstance) return browserInstance;

  console.log('Launching headless browser...');
  browserInstance = await puppeteer.launch({
    headless: true, // Visible for debugging if false, but typically true
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  return browserInstance;
};

export const getBrowser = (): Browser | null => {
  return browserInstance;
};

export const closeBrowser = async (): Promise<void> => {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
    console.log('Browser closed.');
  }
};

export const createPage = async (): Promise<Page> => {
  const browser = await startBrowser();
  const page = await browser.newPage();

  // Set a generic user agent to avoid basic bot detection
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  );

  return page;
};
