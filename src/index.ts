import puppeteer from 'puppeteer';
import { AsuraScans } from './services/scraper/asuraScans.js';

// -------------------------------For Puppeteer Stealth--------------------------------
// ------------------------------------------------------------------------------------
// import { addExtra } from 'puppeteer-extra';
// import vanillaPuppeteer from 'puppeteer';
// import StealthPlugin from 'puppeteer-extra-plugin-stealth';
// import AdblockerPlugin from 'puppeteer-extra-plugin-adblocker';

// const puppeteer = addExtra(vanillaPuppeteer);

// puppeteer.use(StealthPlugin()).use(AdblockerPlugin({ blockTrackers: true }));
// ------------------------------------------------------------------------------------

async function main() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: 'shell',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // Check for common detection points (optional, for debugging)
    const detectionResults = await page.evaluate(() => {
      return {
        webdriver: navigator.webdriver,
        userAgent: navigator.userAgent,
      };
    });
    console.log('Detection test results:', detectionResults);

    const asuraScans = new AsuraScans();
    await asuraScans.search(false, page, 'ra');
  } catch (error) {
    console.error('An error occurred in main:', error);
  } finally {
    await browser.close();
  }
}

main();
