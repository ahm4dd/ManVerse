import type { Page } from 'puppeteer';
import type { Manhwa, ManhwaChapter, SearchResult } from '@manverse/core';
import { asuraScansConfig, AsuraScansConfig } from '../config/index.ts';
import type IScraper from './scraper.ts';
import { ScraperCache } from './cache.ts';

export default class AsuraScansScraper implements IScraper {
  config: AsuraScansConfig;
  private cache: ScraperCache;

  constructor(config: AsuraScansConfig = asuraScansConfig) {
    this.config = config;
    this.cache = new ScraperCache('asura');
  }

  async search(
    consumet: boolean,
    page: Page,
    term: string,
    pageNumber: number = 1,
  ): Promise<SearchResult> {
    if (consumet) {
      throw new Error(`Consumet should not be activated for ${this.config.baseUrl}`);
    }

    // Cache key for search results
    const cacheKey = `search:${term}:${pageNumber}`;
    const cached = this.cache.get<SearchResult>(cacheKey);
    if (cached) {
      console.log(`[Cache] Returning cached search results for "${term}"`);
      return cached;
    }

    const targetUrl = `${this.config.baseUrl}series?page=${pageNumber}&name=${term}`;

    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: this.config.timeout });
    // console.log(`Navigating to ${targetUrl}...`);

    // Extract search results using configured selectors
    const structureSelectors = this.config.selectors.search.structure;

    const seriesRaw = await page.$$eval(
      this.config.selectors.search.resultContainer,
      (manhwas, selectors) => {
        return manhwas.map((manhwa) => {
          const firstDiv = manhwa.querySelector(selectors.firstDiv);
          if (!firstDiv) return null;

          const innerDiv = firstDiv.querySelector(selectors.innerDiv);
          if (!innerDiv) return null;

          const divs = innerDiv.querySelectorAll(selectors.scopeDiv);
          if (divs.length < 2) return null;

          const firstContentDiv = divs[0];
          const statusSpan = firstContentDiv.querySelector(selectors.statusSpan);
          const img = firstContentDiv.querySelector(selectors.image);

          const secondContentDiv = divs[1];
          const spans = secondContentDiv.querySelectorAll(selectors.spans);

          const status = statusSpan?.textContent?.trim() || '';
          const imageUrl = img?.getAttribute('src') || '';
          const name = spans[0]?.textContent?.trim() || '';
          const chapters = spans[1]?.textContent?.trim() || '';

          let rating = '';
          if (spans[2]) {
            const ratingText = spans[2].querySelector(selectors.ratingText);
            rating = ratingText?.textContent?.trim() || '';
          }

          return {
            link: (manhwa as HTMLAnchorElement).href,
            name: name,
            status: status,
            imageUrl: imageUrl,
            chapters: chapters,
            rating: rating,
          };
        });
      },
      structureSelectors,
    );

    // Filter out null entries
    const series = seriesRaw.filter((s): s is NonNullable<typeof s> => s !== null);

    // Check pagination (Next button state)
    const paginationConfig = this.config.selectors.search.pagination;
    const nextButtonSelector = this.config.selectors.search.nextButton;

    const hasNextPage = await page.evaluate(
      (nextBtnText, btnSelector) => {
        const buttons = Array.from(document.querySelectorAll(btnSelector));
        const nextButton = buttons.find((btn) => btn.textContent?.includes(nextBtnText));

        if (!nextButton) return false;

        const style = nextButton.getAttribute('style');
        return style?.includes('pointer-events:auto') || !style?.includes('pointer-events:none');
      },
      paginationConfig.nextButtonText,
      nextButtonSelector,
    );

    const results = series.map((item) => ({
      id: item.link,
      title: item.name,
      altTitles: [],
      headerForImage: { Referer: this.config.baseUrl },
      image: item.imageUrl,
      status: item.status,
      chapters: item.chapters,
      rating: item.rating,
    }));

    const result = {
      currentPage: pageNumber,
      hasNextPage: hasNextPage,
      results: results,
    };

    // Cache results for 1 hour
    this.cache.set(cacheKey, result);
    return result;
  }

  async checkManhwa(page: Page, url: string): Promise<Manhwa> {
    // Cache key for manhwa details
    const cacheKey = `manhwa:${url}`;
    const cached = this.cache.get<Manhwa>(cacheKey);
    if (cached) {
      console.log(`[Cache] Returning cached details for ${url}`);
      return cached;
    }

    await page.goto(url, { waitUntil: 'networkidle2', timeout: this.config.timeout });
    console.log(`Navigating to ${url} for manhwa details...`);

    const baseUrl = this.config.baseUrl;
    const detailSelectors = this.config.selectors.detail;

    // Extract details using configured selectors
    const manhwaData = await page.evaluate(
      (baseUrl, selectors) => {
        const breadcrumbTitle = document.querySelector(selectors.title);
        const title = breadcrumbTitle?.textContent?.trim() || '';

        const imgElement = document.querySelector(selectors.image);
        const image = imgElement?.getAttribute('src') || '';

        const statusElements = Array.from(document.querySelectorAll(selectors.status));
        const statusLabel = statusElements.find((el) => el.textContent?.includes('Status'));
        const statusValue = statusLabel?.nextElementSibling as HTMLElement;
        const status = statusValue?.textContent?.trim() || '';

        const ratingElement = document.querySelector(selectors.rating);
        const rating = ratingElement?.textContent?.trim() || '';

        const followersElement = document.querySelector(selectors.followers);
        const followersText = followersElement?.textContent?.trim() || '';
        const followersMatch = followersText.match(/(\d+)\s+people/);
        const followers = followersMatch ? followersMatch[1] : '';

        const synopsisHeading = Array.from(
          document.querySelectorAll(selectors.synopsisHeading),
        ).find((h3) => h3.textContent?.includes('Synopsis'));
        const synopsisElement = synopsisHeading?.nextElementSibling;
        const description = synopsisElement?.textContent?.trim() || '';

        const genreButtons = document.querySelectorAll(selectors.genres);
        const genres = Array.from(genreButtons)
          .map((btn) => btn.textContent?.trim() || '')
          .filter(Boolean);

        const gridElements = document.querySelectorAll(selectors.gridElements);
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

        const chapterItems = document.querySelectorAll(selectors.chapters);
        const chapters = Array.from(chapterItems).map((item) => {
          const link = item.querySelector(selectors.chapterLink);
          const chapterUrl = link?.getAttribute('href') || '';
          const chapterText =
            link?.querySelector(selectors.chapterTitle)?.textContent?.trim() || '';
          const dateText = link?.querySelector(selectors.chapterDate)?.textContent?.trim() || '';

          const chapterMatch = chapterText.match(/Chapter\s+(\d+)/);
          const chapterNumber = chapterMatch ? chapterMatch[1] : '';

          let fullUrl = chapterUrl;
          if (!fullUrl.startsWith('http')) {
            if (!fullUrl.startsWith('series/') && !fullUrl.startsWith('/series/')) {
              const cleanPath = fullUrl.startsWith('/') ? fullUrl.slice(1) : fullUrl;
              fullUrl = `series/${cleanPath}`;
            }

            const cleanBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
            const cleanPath = fullUrl.startsWith('/') ? fullUrl.slice(1) : fullUrl;
            fullUrl = `${cleanBase}${cleanPath}`;
          }

          return {
            chapterNumber,
            chapterTitle: '',
            chapterUrl: fullUrl,
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
      },
      baseUrl,
      detailSelectors,
    );

    const result = {
      id: url,
      title: manhwaData.title,
      description: manhwaData.description,
      image: manhwaData.image,
      headerForImage: { Referer: this.config.baseUrl },
      status: manhwaData.status,
      rating: manhwaData.rating,
      genres: manhwaData.genres,
      chapters: manhwaData.chapters,
      followers: manhwaData.followers,
      author: manhwaData.author,
      artist: manhwaData.artist,
      serialization: manhwaData.serialization,
      updatedOn: manhwaData.updatedOn,
    };

    this.cache.set(cacheKey, result);
    return result;
  }

  async checkManhwaChapter(page: Page, url: string): Promise<ManhwaChapter> {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: this.config.timeout });
    console.log(`Navigating to ${url} for chapter images...`);

    // Extract chapter images
    const chapterImages = await page.$$eval(
      this.config.selectors.chapter.images,
      (images, baseUrl) => {
        return images
          .map((img, index) => {
            const src = img.getAttribute('src');
            const alt = img.getAttribute('alt') || '';

            const pageMatch = alt.match(/page\s+(\d+)/i);
            const pageNumber = pageMatch ? parseInt(pageMatch[1], 10) : index + 1;

            let fullSrc = src || '';
            if (fullSrc && !fullSrc.startsWith('http')) {
              fullSrc = baseUrl + (fullSrc.startsWith('/') ? '' : '/') + fullSrc;
            }

            return {
              src: fullSrc,
              pageNumber: pageNumber,
            };
          })
          .filter((item) => item.src !== '');
      },
      this.config.baseUrl,
    );

    if (chapterImages.length === 0) {
      console.warn('No chapter images found. The page may have failed to load.');
    }

    console.log(`Found ${chapterImages.length} chapter pages`);

    const result: ManhwaChapter = chapterImages.map((img) => ({
      page: img.pageNumber,
      img: img.src,
      headerForImage: this.config.baseUrl,
    }));

    return result;
  }

  // async downloadManhwaChapter(page: puppeteer.Page, url: string) {
  //   if (page.url() !== url) {
  //     await page.goto(url, { waitUntil: 'networkidle2', timeout: this.config.timeout });
  //     console.log(`Navigating to ${url}...`);
  //   }

  //   console.log('Extracting image links...');
  //   const aggregatedManhwaLinks = await page.$$eval(
  //     this.config.selectors.chapter.images,
  //     (elements) => {
  //       return elements.map((element) => (element as HTMLImageElement).src);
  //     },
  //   );

  //   console.log(`Found ${aggregatedManhwaLinks.length} images.`);

  //   if (aggregatedManhwaLinks.length === 0) {
  //     console.warn(
  //       'No images found. The selector might be incorrect or the page failed to load content.',
  //     );
  //   }

  //   // Download images with limited concurrency to avoid overwhelming the network
  //   // Using a simple loop for sequential download here for reliability
  //   for (let i = 0; i < aggregatedManhwaLinks.length; i++) {
  //     const link = aggregatedManhwaLinks[i];
  //     // Pad the index with leading zeros (e.g., 001.webp)
  //     const fileName = `${(i + 1).toString().padStart(this.config.output.filenamePadding, '0')}${this.config.output.fileExtension}`;
  //     const filePath = path.join(process.cwd(), this.config.output.directory, fileName);

  //     console.log(`Downloading ${i + 1}/${aggregatedManhwaLinks.length}: ${link}`);
  //     await this.downloadImage(link, filePath);
  //   }

  //   const filePaths = aggregatedManhwaLinks.map((_, index) => {
  //     return path.join(
  //       process.cwd(),
  //       this.config.output.directory,
  //       `${(index + 1).toString().padStart(this.config.output.filenamePadding, '0')}${this.config.output.fileExtension}`,
  //     );
  //   });
  //   await convertWebPToPdf(
  //     filePaths,
  //     path.join(process.cwd(), this.config.output.directory, 'output.pdf'),
  //   );
  //   console.log('All downloads completed.');
  // }

  // private async downloadImage(imageUrl: string, localFilePath: string): Promise<void> {
  //   try {
  //     const config: AxiosRequestConfig = {
  //       method: 'GET',
  //       url: imageUrl,
  //       responseType: 'stream',
  //       headers: {
  //         'User-Agent':
  //           this.config.headers.userAgent ||
  //           'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  //         Referer: this.config.headers.referer || this.config.baseUrl,
  //       },
  //     };
  //     const response = await axios(config);

  //     const dir = path.dirname(localFilePath);
  //     if (!fs.existsSync(dir)) {
  //       fs.mkdirSync(dir, { recursive: true });
  //     }

  //     const writer = fs.createWriteStream(localFilePath);
  //     response.data.pipe(writer);

  //     return new Promise((resolve, reject) => {
  //       writer.on('finish', () => {
  //         console.log(`Image downloaded: ${localFilePath}`);
  //         resolve();
  //       });
  //       writer.on('error', (err) => {
  //         console.error(`Error writing file ${localFilePath}:`, err);
  //         reject(err);
  //       });
  //     });
  //   } catch (err: unknown) {
  //     console.error(`Failed to download ${imageUrl}:`, err instanceof Error ? err.message : err);
  //   }
  // }
}
// ------------------------------------------------------------------------------------

// ----------------------------------Helper Functions----------------------------------
// ------------------------------------------------------------------------------------

function cleanSeriesName(name: string | undefined): string {
  if (!name) return '';
  return name.split('/')[1].split('-').slice(0, -1).join(' ');
}

// ------------------------------------------------------------------------------------
