import type { Browser, Page } from 'puppeteer';
import { AsuraScansScarper } from '@manverse/scrapers';
import { PDFDownloader } from '@manverse/downloader';
import { PDFKitGenerator } from '@manverse/pdf';
import { recordDownload, updateProgress } from '@manverse/database';
import type { Manhwa, ManhwaChapter, PDFDownloadOptions } from '@manverse/core';
import { useDownloadStore } from '../state/download-store.js';

/**
 * Download Service - Orchestrates chapter downloads with PDF generation
 * Uses correct backend APIs from @manverse/downloader and @manverse/pdf
 */
export class DownloadService {
  private scraper: AsuraScansScarper;
  private pdfDownloader: PDFDownloader;

  constructor() {
    this.scraper = new AsuraScansScarper();
    // Correct: PDFKitGenerator (not PDFGenerator)
    this.pdfDownloader = new PDFDownloader(this.scraper, new PDFKitGenerator());
  }

  /**
   * Download a single chapter and generate PDF
   */
  async downloadChapter(
    page: Page,
    chapterUrl: string,
    outputPath: string,
    jobId: string,
    libraryId?: number,
  ): Promise<{ success: boolean; pdfPath?: string; error?: string }> {
    const { updateJob } = useDownloadStore.getState();

    try {
      // Update job status
      updateJob(jobId, { status: 'downloading', progress: 0, startTime: Date.now() });

      // Get chapter images from scraper
      const chapter: ManhwaChapter = await this.scraper.checkManhwaChapter(page, chapterUrl);

      // Download chapter as PDF
      // Correct API: options is { path, force?, keepImages? }
      const options: PDFDownloadOptions = {
        path: outputPath,
        force: false,
        keepImages: false,
      };

      const result = await this.pdfDownloader.downloadChapter(chapter, options);

      if (!result.success) {
        throw new Error(result.errors.map((e) => e.message).join(', ') || 'Download failed');
      }

      // Correct: recordDownload takes DownloadedChapterInput object
      if (libraryId) {
        const chapterNumber = chapterUrl.split('/').pop() || 'unknown';
        recordDownload({
          provider_manga_id: libraryId,
          chapter_number: chapterNumber,
          chapter_url: chapterUrl,
          file_path: result.pdfPath, // Correct field: pdfPath (not filePath)
          file_size: null, // We could get file size if needed
          page_count: chapter.images.length,
          downloaded_at: Date.now(),
        });

        // Update library progress
        const newProgress = parseInt(chapterNumber, 10);
        if (!isNaN(newProgress)) {
          updateProgress(libraryId, newProgress);
        }
      }

      // Mark job as completed
      updateJob(jobId, {
        status: 'completed',
        progress: 100,
        endTime: Date.now(),
      });

      return {
        success: true,
        pdfPath: result.pdfPath,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Mark job as failed
      updateJob(jobId, {
        status: 'failed',
        error: errorMessage,
        endTime: Date.now(),
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Process download queue - picks up queued jobs
   */
  async processQueue(browser: Browser, outputDir: string, maxConcurrent: number = 3) {
    const { queue } = useDownloadStore.getState();

    const activeJobs = queue.filter((j) => j.status === 'downloading');
    const queuedJobs = queue.filter((j) => j.status === 'queued');

    const slotsAvailable = maxConcurrent - activeJobs.length;
    if (slotsAvailable <= 0 || queuedJobs.length === 0) {
      return;
    }

    const jobsToStart = queuedJobs.slice(0, slotsAvailable);

    for (const job of jobsToStart) {
      const { updateJob } = useDownloadStore.getState();
      updateJob(job.id, { status: 'downloading', startTime: Date.now() });

      // Start download (don't await - run in background)
      this.downloadJobAsync(browser, job, outputDir).catch((error) => {
        console.error(`Failed to process job ${job.id}:`, error);
      });
    }
  }

  /**
   * Download a job asynchronously
   */
  private async downloadJobAsync(browser: Browser, job: any, outputDir: string) {
    const page = await browser.newPage();
    try {
      const outputPath = `${outputDir}/${job.mangaTitle}-ch${job.chapterNumber}`;

      await this.downloadChapter(page, job.chapterUrl, outputPath, job.id, job.libraryId);
    } catch (error) {
      console.error(`Job ${job.id} failed:`, error);
      const { updateJob } = useDownloadStore.getState();
      updateJob(job.id, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        endTime: Date.now(),
      });
    } finally {
      await page.close().catch(console.error);
    }
  }
}

// Singleton instance
export const downloadService = new DownloadService();
