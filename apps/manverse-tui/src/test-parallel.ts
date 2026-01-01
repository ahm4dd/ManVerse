import puppeteer from 'puppeteer';
import { ScraperFactory, optimizePage } from '@manverse/scrapers';
import { defaultBrowserConfig } from '@manverse/core';
import { FileSystemDownloader, PDFDownloader } from '@manverse/downloader';
import { PDFKitGenerator } from '@manverse/pdf';
import path from 'path';

async function main() {
  const browser = await puppeteer.launch(defaultBrowserConfig);
  try {
    const page = await browser.newPage();
    await optimizePage(page);

    console.log('Searching for "dragon"...');
    const scraper = ScraperFactory.createScraper('AsuraScans');
    const searchResult = await scraper.search(false, page, 'dragon');

    const targetSeries = searchResult.results[0];
    console.log(`Found: ${targetSeries.title}`);

    const manhwa = await scraper.checkManhwa(page, targetSeries.id);

    // Download first 3 chapters in parallel
    const chaptersToDownload = manhwa.chapters.slice(0, 3);
    console.log(`\nDownloading ${chaptersToDownload.length} chapters in parallel...`);

    const downloadPromises = chaptersToDownload.map(async (chapter) => {
      const chapterPage = await browser.newPage();
      await optimizePage(chapterPage);

      const chapterImages = await scraper.checkManhwaChapter(chapterPage, chapter.chapterUrl);
      console.log(`Chapter ${chapter.chapterNumber}: Found ${chapterImages.length} images`);

      const imageDownloader = new FileSystemDownloader();
      const pdfGenerator = new PDFKitGenerator();
      const downloader = new PDFDownloader(imageDownloader, pdfGenerator);

      const downloadPath = path.resolve(
        process.cwd(),
        'downloads',
        `${targetSeries.title} - Chapter ${chapter.chapterNumber}`,
      );

      const result = await downloader.downloadChapter(chapterImages, {
        path: downloadPath,
        onProgress: (p) => {
          process.stdout.write(`\r[Ch ${chapter.chapterNumber}] ${p.current}/${p.total}`);
        },
      });

      await chapterPage.close();
      return { chapter: chapter.chapterNumber, result };
    });

    const results = await Promise.all(downloadPromises);

    console.log('\n\n=== Download Results ===');
    results.forEach(({ chapter, result }) => {
      console.log(`\nChapter ${chapter}:`);
      console.log(`  Success: ${result.success}`);
      console.log(`  PDF: ${result.pdfPath}`);
      console.log(`  Time: ${result.timeTakenMs}ms`);
      console.log(`  Errors: ${result.errors.length}`);
    });

    const allSuccessful = results.every((r) => r.result.success);
    console.log(`\n✓ All ${results.length} chapters downloaded: ${allSuccessful}`);
  } catch (error) {
    console.error('Fatal Error:', error);
  } finally {
    console.log('\nClosing browser...');
    await browser.close();
  }
}

main();
