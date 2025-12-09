import puppeteer from 'puppeteer';
import axios, { AxiosRequestConfig } from 'axios';
import { Manhwa, ManhwaChapter, Scraper, SearchResult } from './generalScraper.js';
import { asuraScansConfig, AsuraScansConfig } from '../../config/index.js';
import path from 'path';
import fs from 'fs';

// ----------------------------------Scraper Class-------------------------------------
// ------------------------------------------------------------------------------------
export class AsuraScans extends Scraper {
  private config: AsuraScansConfig;

  constructor(config: AsuraScansConfig = asuraScansConfig) {
    super();
    this.config = config;
  }

  async search(
    consumet = false,
    page: puppeteer.Page,
    term: string,
    pageNumber: number = 1,
  ): Promise<SearchResult> {
    if (consumet) {
      throw new Error(`Consumet should not be activated for ${this.config.baseUrl}`);
    }

    const targetUrl = `${this.config.baseUrl}series?page=${pageNumber}&name=${term}`;

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

    /**
     * Pagination Detection
     * ====================
     * 
     * AsuraScans uses two navigation buttons at the bottom:
     * - Previous: disabled when on first page (style="pointer-events:none", bg-slate-500, opacity-60)
     * - Next: disabled when on last page (style="pointer-events:none", bg-slate-500, opacity-60)
     * 
     * Enabled buttons have: style="pointer-events:auto" and bg-themecolor class
     * Disabled buttons have: style="pointer-events:none", bg-slate-500, and opacity-60
     * 
     * We check the Next button to determine if there's a next page available.
     */
    const hasNextPage = await page.evaluate(() => {
      // Find all anchor tags that contain "Next" text and are navigation buttons
      const buttons = Array.from(document.querySelectorAll('a'));
      const nextButton = buttons.find((btn) => btn.textContent?.includes('Next'));
      
      if (!nextButton) return false;
      
      // Check if the button is enabled (pointer-events: auto)
      const style = nextButton.getAttribute('style');
      return style?.includes('pointer-events:auto') || !style?.includes('pointer-events:none');
    });

    // Map AsuraScans data to SearchedManhwa format
    const results = series.map((item) => ({
      id: item.link,
      title: item.name,
      altTitles: [],
      headerForImage: { Referer: this.config.baseUrl },
      image: item.imageUrl,
      // AsuraScans-specific extra metadata (not in base type but useful)
      status: item.status,
      chapters: item.chapters,
      rating: item.rating,
    }));

    return {
      currentPage: pageNumber,
      hasNextPage: hasNextPage,
      results: results,
    };
  }
  
  async checkManhwa(page: puppeteer.Page, url: string): Promise<Manhwa> {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    console.log(`Navigating to ${url} for manhwa details...`);

    /**
     * AsuraScans Manhwa Detail Page Structure
     * =========================================
     * 
     * Title: span with class "text-xl font-bold"
     * Image: img with alt="poster"
     * Status: In the status/type grid section
     * Rating: span.ml-1 within the rating stars section
     * Followers: Text containing "Followed by X people"
     * Synopsis: Under h3 containing "Synopsis" + series name
     * Genres: buttons in the genres section
     * Serialization/Author/Artist: Grid with labels and values
     * Updated On: In the grid with "Updated On" label
     * Chapters: List items with chapter links and dates
     */
    
    const manhwaData = await page.evaluate(() => {
      // Title - from breadcrumb h3 element
      const breadcrumbTitle = document.querySelector('h3.hover\\:text-themecolor.cursor-pointer.text-white.text-sm.shrink-0.w-\\[calc\\(100\\%-120px\\)\\].truncate');
      const title = breadcrumbTitle?.textContent?.trim() || '';
      
      // Image - poster image
      const imgElement = document.querySelector('img[alt="poster"]');
      const image = imgElement?.getAttribute('src') || '';
      
      // Status - find the div containing "Status" and get its sibling
      const statusElements = Array.from(document.querySelectorAll('h3.text-sm.text-\\[\\#A2A2A2\\]'));
      const statusLabel = statusElements.find(el => el.textContent?.includes('Status'));
      const statusValue = statusLabel?.nextElementSibling as HTMLElement;
      const status = statusValue?.textContent?.trim() || '';
      
      // Rating - numeric value in the rating section
      const ratingElement = document.querySelector('span.ml-1.text-xs');
      const rating = ratingElement?.textContent?.trim() || '';
      
      // Followers
      const followersElement = document.querySelector('p.text-\\[\\#A2A2A2\\].text-\\[13px\\]');
      const followersText = followersElement?.textContent?.trim() || '';
      const followersMatch = followersText.match(/(\d+)\s+people/);
      const followers = followersMatch ? followersMatch[1] : '';
      
      // Synopsis - after the "Synopsis [Title]" heading
      const synopsisHeading = Array.from(document.querySelectorAll('h3')).find(
        h3 => h3.textContent?.includes('Synopsis')
      );
      const synopsisElement = synopsisHeading?.nextElementSibling;
      const description = synopsisElement?.textContent?.trim() || '';
      
      // Genres - buttons in the genres section
      const genreButtons = document.querySelectorAll('.bg-\\[\\#343434\\].text-white.hover\\:text-themecolor');
      const genres = Array.from(genreButtons).map(btn => btn.textContent?.trim() || '').filter(Boolean);
      
      // Author, Artist, Serialization - from the grid
      const gridElements = document.querySelectorAll('.grid.grid-cols-1.md\\:grid-cols-2 h3');
      let author = '';
      let artist = '';
      let serialization = '';
      let updatedOn = '';
      
      for (let i = 0; i < gridElements.length; i += 2) {
        const label = gridElements[i]?.textContent?.trim();
        const value = gridElements[i + 1]?.textContent?.trim();
        
        if (label === 'Author') author = value || '';
        if (label === 'Artist') artist = value || '';
        if (label === 'Serialization') serialization = value || '';
        if (label === 'Updated On') updatedOn = value || '';
      }
      
      // Chapters - from the chapter list
      const chapterItems = document.querySelectorAll('div.pl-4.py-2.border.rounded-md');
      const chapters = Array.from(chapterItems).map(item => {
        const link = item.querySelector('a');
        const chapterUrl = link?.getAttribute('href') || '';
        const chapterText = link?.querySelector('h3')?.textContent?.trim() || '';
        const dateText = link?.querySelector('h3.text-xs.text-\\[\\#A2A2A2\\]')?.textContent?.trim() || '';
        
        // Extract chapter number from text like "Chapter 3"
        const chapterMatch = chapterText.match(/Chapter\s+(\d+)/);
        const chapterNumber = chapterMatch ? chapterMatch[1] : '';
        
        return {
          chapterNumber,
          chapterTitle: '', // AsuraScans doesn't seem to use chapter titles
          chapterUrl: chapterUrl.startsWith('http') ? chapterUrl : `https://asuracomic.net/${chapterUrl}`,
          releaseDate: dateText,
        };
      });
      
      return {
        title,
        image,
        status,
        rating,
        followers,
        description,
        genres,
        author,
        artist,
        serialization,
        updatedOn,
        chapters,
      };
    });

    return {
      id: url,
      title: manhwaData.title,
      description: manhwaData.description,
      image: manhwaData.image,
      headerForImage: { Referer: this.config.baseUrl },
      status: manhwaData.status,
      rating: manhwaData.rating,
      genres: manhwaData.genres,
      chapters: manhwaData.chapters,
      // AsuraScans-specific extra metadata
      followers: manhwaData.followers,
      author: manhwaData.author,
      artist: manhwaData.artist,
      serialization: manhwaData.serialization,
      updatedOn: manhwaData.updatedOn,
    };
  }
  
  async checkManhwaChapter(page: puppeteer.Page, url: string): Promise<ManhwaChapter> {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    console.log(`Navigating to ${url} for chapter images...`);

    /**
     * AsuraScans Chapter Page Structure
     * ==================================
     * 
     * Chapter pages are contained in divs with class "w-full mx-auto center"
     * Each div contains an img tag with:
     * - src: The image URL (e.g., https://gg.asuracomic.net/storage/media/.../01-optimized.webp)
     * - alt: "chapter page X" where X is the page number
     * - class: "object-cover mx-auto"
     * 
     * The images selector: img.object-cover.mx-auto (this matches chapter page images)
     * 
     * We extract:
     * - Image URL (src attribute)
     * - Page number (from alt attribute or index)
     * - Will use the baseUrl as referer for downloading
     */
    
    const chapterImages = await page.$$eval('img.object-cover.mx-auto', (images) => {
      return images
        .map((img, index) => {
          const src = img.getAttribute('src');
          const alt = img.getAttribute('alt') || '';
          
          // Extract page number from alt text like "chapter page 1"
          const pageMatch = alt.match(/page\s+(\d+)/i);
          const pageNumber = pageMatch ? parseInt(pageMatch[1], 10) : index + 1;
          
          return {
            src: src || '',
            pageNumber: pageNumber,
          };
        })
        .filter(item => item.src !== ''); // Filter out any images without src
    });

    if (chapterImages.length === 0) {
      console.warn('No chapter images found. The page may have failed to load.');
    }

    console.log(`Found ${chapterImages.length} chapter pages`);

    // Convert to ManhwaChapter format
    const result: ManhwaChapter = chapterImages.map((img) => ({
      page: img.pageNumber,
      img: img.src,
      headerForImage: this.config.baseUrl, // Use baseUrl as referer
    }));

    return result;
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
