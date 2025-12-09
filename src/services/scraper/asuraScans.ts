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

    /**
     * AsuraScans DOM Structure and Scraping Strategy
     * ================================================
     * 
     * Search results selector: 'div a[href^="series/"]'
     * Each result is an anchor tag containing nested divs with the following structure:
     * 
     * <a href="series/[series-slug]">
     *   <div>                                    // First div child
     *     <div>                                  // Inner div
     *       <div>                                // First content div (contains status & image)
     *         <span>Status Text</span>           // Status: "Ongoing", "Completed", "Hiatus", etc.
     *         <img src="[image-url]" />          // Cover image
     *       </div>
     *       <div>                                // Second content div (contains metadata)
     *         <span>Series Name</span>           // [0] Name of the series
     *         <span>Chapter XX</span>            // [1] Latest chapter number
     *         <span>                             // [2] Rating section (complex nested structure)
     *           <div>                            // Star rating visualization
     *             <span class="ml-1">X.X</span>  // Actual numeric rating (e.g., "7.0", "9.5")
     *           </div>
     *         </span>
     *       </div>
     *     </div>
     *   </div>
     * </a>
     * 
     * Extraction Strategy:
     * 1. Navigate to first div child
     * 2. Find inner div within it
     * 3. Get two direct child divs using ':scope > div'
     * 4. From first div: extract status (span) and imageUrl (img)
     * 5. From second div: extract name (span[0]), chapters (span[1]), and rating (span[2] > span.ml-1)
     * 6. Return null if any required structure is missing (filtered later)
     * 
     * Note: The rating section has a complex structure with star SVGs for visual display,
     * but we only need the numeric value from the span with class "ml-1"
     */
    const seriesRaw = await page.$$eval('div a[href^="series/"]', (manhwas) => {
      return manhwas.map((manhwa) => {
        // Get the first div child
        const firstDiv = manhwa.querySelector('div');
        if (!firstDiv) return null;
        
        // Get the inner div within the first div
        const innerDiv = firstDiv.querySelector('div');
        if (!innerDiv) return null;
        
        // Get the two divs inside innerDiv
        const divs = innerDiv.querySelectorAll(':scope > div');
        if (divs.length < 2) return null;
        
        // First div contains status span and image
        const firstContentDiv = divs[0];
        const statusSpan = firstContentDiv.querySelector('span');
        const img = firstContentDiv.querySelector('img');
        
        // Second div contains 3 spans: name, chapters, rating
        const secondContentDiv = divs[1];
        const spans = secondContentDiv.querySelectorAll('span');
        
        // Extract data
        const status = statusSpan?.textContent?.trim() || '';
        const imageUrl = img?.getAttribute('src') || '';
        const name = spans[0]?.textContent?.trim() || '';
        const chapters = spans[1]?.textContent?.trim() || '';
        
        // Extract rating from the third span (contains the numeric value)
        let rating = '';
        if (spans[2]) {
          const ratingText = spans[2].querySelector('span.ml-1');
          rating = ratingText?.textContent?.trim() || '';
        }
        
        return {
          link: manhwa.href,
          name: name,
          status: status,
          imageUrl: imageUrl,
          chapters: chapters,
          rating: rating,
        };
      });
    });

    // Filter out null entries
    const series = seriesRaw.filter((s): s is NonNullable<typeof s> => s !== null);

    series.forEach((item) => {
      console.log('----------------');
      console.log(item.name);
      console.log(item.chapters);
      console.log(item.imageUrl);
      console.log(item.rating);
      console.log(item.status);
      console.log(item.link);
      console.log('----------------');
    });

    return {
      currentPage: 0,
      hasNextPage: false,
      results: [],
    };
  }
  checkManhwa(): Manhwa {
    throw new Error('Method not implemented.');
  }
  checkManhwaChapter(): ManhwaChapter {
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
