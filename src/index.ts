import puppeteer from 'puppeteer';

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
  const browser = await puppeteer.launch({ headless: 'shell' });
  const page = await browser.newPage();

  // Test on bot detection site
  await page.goto(
    'https://asuracomic.net/series/the-greatest-estate-developer-efbd1177/chapter/167',
  );

  //   await page.screenshot({ path: 'bot-test.png', fullPage: false });
  //   await page.pdf({ path: 'hn.pdf ' });

  // Check for common detection points
  const detectionResults = await page.evaluate(() => {
    return {
      webdriver: navigator.webdriver,
      userAgent: navigator.userAgent,
    };
  });

  const functionResults = await page.$$eval('img.object-cover.mx-auto', (elements) => {
    return elements.map((element) => element.src);
  });

  console.log(functionResults);

  console.log('Detection test results:', detectionResults);
  await browser.close();
}

main();
