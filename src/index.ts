import puppeteer from 'puppeteer';
import axios, { type AxiosRequestConfig } from 'axios';
import fs from 'fs';
import path from 'path';

// -------------------------------For Puppeteer Stealth--------------------------------
// ------------------------------------------------------------------------------------
// import { addExtra } from 'puppeteer-extra';
// import vanillaPuppeteer from 'puppeteer';
// import StealthPlugin from 'puppeteer-extra-plugin-stealth';
// import AdblockerPlugin from 'puppeteer-extra-plugin-adblocker';

// const puppeteer = addExtra(vanillaPuppeteer);

// puppeteer.use(StealthPlugin()).use(AdblockerPlugin({ blockTrackers: true }));
// ------------------------------------------------------------------------------------

async function downloadImage(imageUrl: string, localFilePath: string): Promise<void> {
  try {
    const config: AxiosRequestConfig = {
      method: 'GET',
      url: imageUrl,
      responseType: 'stream',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Referer: 'https://asuracomic.net/',
      },
    };
    const response = await axios(config);

    const dir = path.dirname(localFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const writer = fs.createWriteStream(localFilePath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        console.log(`Image downloaded: ${localFilePath}`);
        resolve();
      });
      writer.on('error', (err) => {
        console.error(`Error writing file ${localFilePath}:`, err);
        reject(err);
      });
    });
  } catch (err: unknown) {
    console.error(`Failed to download ${imageUrl}:`, err instanceof Error ? err.message : err);
  }
}

async function main() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: 'shell',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    const targetUrl =
      'https://asuracomic.net/series/the-greatest-estate-developer-efbd1177/chapter/167';
    console.log(`Navigating to ${targetUrl}...`);

    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 60000 });

    // Check for common detection points (optional, for debugging)
    const detectionResults = await page.evaluate(() => {
      return {
        webdriver: navigator.webdriver,
        userAgent: navigator.userAgent,
      };
    });
    console.log('Detection test results:', detectionResults);

    console.log('Extracting image links...');
    const aggregatedManhwaLinks = await page.$$eval('img.object-cover.mx-auto', (elements) => {
      return elements.map((element) => element.src);
    });

    console.log(`Found ${aggregatedManhwaLinks.length} images.`);

    if (aggregatedManhwaLinks.length === 0) {
      console.warn(
        'No images found. The selector might be incorrect or the page failed to load content.',
      );
    }

    // Download images with limited concurrency to avoid overwhelming the network
    // Using a simple loop for sequential download here for reliability
    for (let i = 0; i < aggregatedManhwaLinks.length; i++) {
      const link = aggregatedManhwaLinks[i];
      // Pad the index with leading zeros (e.g., 001.webp)
      const fileName = `${(i + 1).toString().padStart(3, '0')}.webp`;
      const filePath = path.join(process.cwd(), 'man', fileName);

      console.log(`Downloading ${i + 1}/${aggregatedManhwaLinks.length}: ${link}`);
      await downloadImage(link, filePath);
    }

    console.log('All downloads completed.');
  } catch (error) {
    console.error('An error occurred in main:', error);
  } finally {
    await browser.close();
  }
}

main();
