import puppeteer from 'puppeteer';
import { ScraperFactory, optimizePage } from '@manverse/scrapers';
import { defaultBrowserConfig } from '@manverse/core';
import { FileSystemDownloader } from '@manverse/downloader';
import path from 'path';

async function main() {
  const browser = await puppeteer.launch(defaultBrowserConfig);
  try {
    const page = await browser.newPage();
    await optimizePage(page);

    console.log('Searching for "dragon"...');
    const scraper = ScraperFactory.createScraper('AsuraScans');
    const searchResult = await scraper.search(false, page, 'dragon');

    const targetSeries = searchResult.results[0]; // Take the first result
    console.log(`Found: ${targetSeries.title}`);

    const manhwa = await scraper.checkManhwa(page, targetSeries.id);
    const targetChapter = manhwa.chapters[0]; // Take the latest (first) chapter for testing
    console.log(`Getting chapter: ${targetChapter.chapterNumber}`);

    const chapterImages = await scraper.checkManhwaChapter(page, targetChapter.chapterUrl);

    console.log(`Found ${chapterImages.length} images. Starting download...`);

    const downloader = new FileSystemDownloader();
    const downloadPath = path.resolve(
      process.cwd(),
      'downloads',
      targetSeries.title,
      `Chapter ${targetChapter.chapterNumber}`,
    );

    const result = await downloader.downloadChapter(chapterImages, {
      path: downloadPath,
      onProgress: (p) => {
        process.stdout.write(`\rDownloading: ${p.current}/${p.total} (${p.currentFile})`);
      },
    });

    console.log('\n\nDownload Result:');
    console.log('Success:', result.success);
    console.log('Time:', result.timeTakenMs + 'ms');
    console.log('Files:', result.files.length);
    console.log('Errors:', result.errors.length);
    if (result.errors.length > 0) {
      console.log('First Error:', result.errors[0].message);
    }
  } catch (error) {
    console.error('Fatal Error:', error);
  } finally {
    console.log('Closing browser...');
    await browser.close();
  }
}

main();
