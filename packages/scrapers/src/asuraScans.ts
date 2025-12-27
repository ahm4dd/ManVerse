import axios, { type AxiosRequestConfig } from 'axios';
import { type Manhwa, type ManhwaChapterImage, type SearchResult } from '@manverse/core';
import { PuppeteerScraper } from './puppeteerScraper.ts';
import { asuraScansConfig, type AsuraScansConfig } from '../config/index.ts';
import path from 'path';
import fs from 'fs';
import { convertWebPToPdf } from '@manverse/pdf';

export class AsuraScans extends PuppeteerScraper {
  name = 'asuraScans';
  private config: AsuraScansConfig;

  constructor(config: AsuraScansConfig = asuraScansConfig) {
    super();
    this.config = config;
  }

  async search(term: string, pageNumber: number = 1): Promise<SearchResult> {
    await this.init();
    const page = this.page!;

    const targetUrl = `${this.config.baseUrl}series?page=${pageNumber}&name=${term}`;

    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: this.config.timeout });
    console.log(`Navigating to ${targetUrl}...`);

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

    interface ScrapedSeries {
      link: string;
      name: string;
      status: string;
      imageUrl: string;
      chapters: string;
      rating: string;
    }

    const series = seriesRaw.filter((s): s is ScrapedSeries => s !== null);

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

    return {
      currentPage: pageNumber,
      hasNextPage: hasNextPage,
      results: series.map((item) => ({
        id: item.link,
        title: item.name,
        altTitles: [],
        headerForImage: { Referer: this.config.baseUrl },
        image: item.imageUrl,
        status: item.status,
        chapters: [],
        rating: item.rating,
      })),
    };
  }

  async getManhwa(url: string): Promise<Manhwa> {
    await this.init();
    const page = this.page!;

    await page.goto(url, { waitUntil: 'networkidle2', timeout: this.config.timeout });
    console.log(`Navigating to ${url} for manhwa details...`);

    const baseUrl = this.config.baseUrl;
    const detailSelectors = this.config.selectors.detail;

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

        const synopsisHeading = Array.from(
          document.querySelectorAll(selectors.synopsisHeading),
        ).find((h3) => h3.textContent?.includes('Synopsis'));
        const synopsisElement = synopsisHeading?.nextElementSibling;
        const description = synopsisElement?.textContent?.trim() || '';

        const genreButtons = document.querySelectorAll(selectors.genres);
        const genres = Array.from(genreButtons)
          .map((btn) => btn.textContent?.trim() || '')
          .filter(Boolean);

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

        return { title, image, status, rating, description, genres, chapters };
      },
      baseUrl,
      detailSelectors,
    );

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
    } as Manhwa;
  }

  async getChapter(url: string): Promise<ManhwaChapterImage[]> {
    await this.init();
    const page = this.page!;

    await page.goto(url, { waitUntil: 'networkidle2', timeout: this.config.timeout });

    const chapterImages = await page.$$eval(this.config.selectors.chapter.images, (images) => {
      return images
        .map((img, index) => {
          const src = img.getAttribute('src');
          const alt = img.getAttribute('alt') || '';
          const pageMatch = alt.match(/page\s+(\d+)/i);
          const pageNumber = pageMatch ? parseInt(pageMatch[1], 10) : index + 1;
          return { src: src || '', pageNumber: pageNumber };
        })
        .filter((item) => item.src !== '');
    });

    return chapterImages.map((img) => ({
      page: img.pageNumber,
      img: img.src,
      headerForImage: this.config.baseUrl,
    }));
  }

  async downloadChapter(url: string, outputDir: string): Promise<void> {
    await this.init();
    const page = this.page!;

    if (page.url() !== url) {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: this.config.timeout });
    }

    const aggregatedManhwaLinks = await page.$$eval(
      this.config.selectors.chapter.images,
      (elements) => {
        return elements.map((element) => (element as HTMLImageElement).src);
      },
    );

    for (let i = 0; i < aggregatedManhwaLinks.length; i++) {
      const link = aggregatedManhwaLinks[i];
      const fileName = `${(i + 1).toString().padStart(this.config.output.filenamePadding, '0')}${this.config.output.fileExtension}`;
      const filePath = path.join(outputDir, fileName);
      await this.downloadImage(link, filePath);
    }

    const filePaths = aggregatedManhwaLinks.map((_, index) => {
      return path.join(
        outputDir,
        `${(index + 1).toString().padStart(this.config.output.filenamePadding, '0')}${this.config.output.fileExtension}`,
      );
    });

    await convertWebPToPdf(filePaths, path.join(outputDir, 'output.pdf'));
  }

  private async downloadImage(imageUrl: string, localFilePath: string): Promise<void> {
    try {
      const config: AxiosRequestConfig = {
        method: 'GET',
        url: imageUrl,
        responseType: 'stream',
        headers: {
          'User-Agent': this.config.headers.userAgent || 'Mozilla/5.0 ...',
          Referer: this.config.headers.referer || this.config.baseUrl,
        },
      };
      const response = await axios(config);
      const dir = path.dirname(localFilePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      const writer = fs.createWriteStream(localFilePath);
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
    } catch (err) {
      console.error(`Failed to download ${imageUrl}:`, err);
    }
  }
}
