import puppeteer from 'puppeteer';
import axios, { AxiosRequestConfig } from 'axios';
import { Manhwa, ManhwaChapter, Scraper, SearchResult } from './generalScraper.js';
import path from 'path';
import fs from 'fs';

// ----------------------------------Scraper Class-------------------------------------
// ------------------------------------------------------------------------------------
export class AsuraScans extends Scraper {
  #baseUrl = 'https://asuracomic.net/';

  async search(
    consumet = false,
    page: puppeteer.Page,
    term: string,
    pageNumber: number = 1,
  ): Promise<SearchResult> {
    if (consumet) {
      throw new Error(`Consumet should not be activated for ${this.#baseUrl}`);
    }

    const targetUrl = `${this.#baseUrl}series?page=${pageNumber}&name=${term}`;

    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    console.log(`Navigating to ${targetUrl}...`);

    const series = await page.$$eval('div a[href^="series/"]', (manhwas) => {
      return manhwas.map((manhwa) => {
        const seriesName = manhwa.getAttribute('href') ?? undefined;
        return {
          link: manhwa.href,
          name: seriesName,
        };
      });
    });

    series.forEach((series) => {
      console.log(series.link);
      console.log(cleanSeriesName(series.name));
    });

    // const searchInput = await page.$eval('input[type="text"][placeholder="Search"]', (element) => {
    //   return {
    //     placeholder: element.placeholder,
    //     val: element.value,
    //   };
    // });

    // console.log(searchInput.placeholder);
    // console.log(searchInput.val);

    return {
      currentPage: 0,
      hasNextPage: false,
      results: [],
    };
  }
  checkManhwa(): Manhwa {
    throw new Error('Method not implemented.');
  }
  checkManhwaChatper(): ManhwaChapter {
    throw new Error('Method not implemented.');
  }

  async downloadManhwaChapter(page: puppeteer.Page, url: string) {
    if (page.url() !== url) {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
      console.log(`Navigating to ${url}...`);
    }

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
      await this.downloadImage(link, filePath);
    }

    console.log('All downloads completed.');
  }

  private async downloadImage(imageUrl: string, localFilePath: string): Promise<void> {
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
}
// ------------------------------------------------------------------------------------

// ----------------------------------Helper Functions----------------------------------
// ------------------------------------------------------------------------------------

function cleanSeriesName(name: string | undefined): string {
  if (!name) return '';
  return name.split('/')[1].split('-').slice(0, -1).join(' ');
}

// ------------------------------------------------------------------------------------
