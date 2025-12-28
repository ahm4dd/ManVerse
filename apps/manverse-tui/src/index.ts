import puppeteer from 'puppeteer';
import { AsuraScansScarper } from '@manverse/scrapers';
import { defaultBrowserConfig } from '@manverse/core';

async function main() {
  const browser = await puppeteer.launch(defaultBrowserConfig);
  const page = await browser.newPage();

  const scraper = new AsuraScansScarper();
  const searchResult = await scraper.search(false, page, 'dragon');
  const manhwa = await scraper.checkManhwa(page, searchResult.results[1].id);
  const chapter = await scraper.checkManhwaChapter(page, manhwa.chapters[1].chapterUrl);

  chapter.forEach((pictures) => {
    console.log(pictures.page);
    console.log(pictures.img);
  });

  page.close();
  browser.close();
}

main();
