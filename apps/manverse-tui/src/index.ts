import puppeteer from 'puppeteer';
import { ScraperFactory } from '@manverse/scrapers';
import { defaultBrowserConfig } from '@manverse/core';

async function main() {
  const browser = await puppeteer.launch(defaultBrowserConfig);
  const page = await browser.newPage();

  const scraper = ScraperFactory.createScraper('AsuraScans');
  const searchResult = await scraper.search(false, page, 'dragon');
  const manhwa = await scraper.checkManhwa(page, searchResult.results[1].id);
  const chapter = await scraper.checkManhwaChapter(page, manhwa.chapters[1].chapterUrl);

  chapter.forEach((pictures) => {
    console.log(pictures.img);
  });

  browser.close();
}

main();
