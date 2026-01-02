import type { Browser, Page } from 'puppeteer';
import { AsuraScansScarper } from '@manverse/scrapers';
import { PDFDownloader } from '@manverse/downloader';
import { PDFGenerator } from '@manverse/pdf';
import { recordDownload, updateProgress } from '@manverse/database';
import type { Manhwa } from '@manverse/core';
import { useDownloadStore } from '../state/download-store.js';

interface DownloadOptions {
  outputDir: string;
  onProgress?: (progress: number, currentFile?: string) => void;
}

export class DownloadService {
  private scraper: AsuraScansScarper;
  private pdfDownloader: PDFDownloader;

  constructor() {
    this.scraper = new AsuraScansScarper();
    this.pdfDownloader = new PDFDownloader(this.scraper, new PDFGenerator());
  }

  /**
   * Download a single chapter and generate PDF
   */
  async downloadChapter(
    browser: Browser,
    manga: Manhwa,
    chapterNumber: string,
    chapterUrl: string,
    options: DownloadOptions,
    jobId: string,
    libraryId?: number,
  ): Promise<{ success: boolean; filePath?: string; error?: string }> {
    const { updateJob } = useDownloadStore.getState();
    let page: Page | null = null;

    try {
      // Update job status
      updateJob(jobId, { status: 'downloading', progress: 0 });

      // Create new page
      page = await browser.newPage();

      // Download chapter as PDF
      const result = await this.pdfDownloader.downloadChapter(page, manga, chapterNumber, {
        outputDir: options.outputDir,
        onProgress: (progress) => {
          updateJob(jobId, { progress });
          options.onProgress?.(progress);
        },
      });

      if (!result.success) {
        throw new Error(result.error || 'Download failed');
      }

      // Record download in database
      if (libraryId) {
        recordDownload({
          provider_manga_id: libraryId,
          chapter_number: chapterNumber,
          chapter_url: chapterUrl,
          file_path: result.filePath,
          file_size: result.fileSize || null,
          page_count: result.pageCount || null,
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
        downloadPath: result.filePath,
        endTime: Date.now(),
      });

      return {
        success: true,
        filePath: result.filePath,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Mark job as failed
      updateJob(jobId, {
        status: 'failed',
        error: errorMessage,
        endTime: Date.now(),
      });

      console.error('Download failed:', errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      // Clean up page
      if (page) {
        await page.close().catch(console.error);
      }
    }
  }

  /**
   * Process download queue - picks up queued jobs and downloads them
   */
  async processQueue(browser: Browser, outputDir: string, maxConcurrent: number = 3) {
    const { queue, updateJob } = useDownloadStore.getState();

    // Get active and queued jobs
    const activeJobs = queue.filter((j) => j.status === 'downloading');
    const queuedJobs = queue.filter((j) => j.status === 'queued');

    // Check if we can start new downloads
    const slotsAvailable = maxConcurrent - activeJobs.length;
    if (slotsAvailable <= 0 || queuedJobs.length === 0) {
      return;
    }

    // Start downloads for available slots
    const jobsToStart = queuedJobs.slice(0, slotsAvailable);

    for (const job of jobsToStart) {
      // Mark as downloading immediately
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
    try {
      // Get manga details from scraper
      const page = await browser.newPage();
      try {
        const manga = await this.scraper.checkManhwa(page, job.chapterUrl);

        await this.downloadChapter(
          browser,
          manga,
          job.chapterNumber,
          job.chapterUrl,
          {
            outputDir,
            onProgress: (progress, currentFile) => {
              const { updateJob } = useDownloadStore.getState();
              updateJob(job.id, {
                progress,
                currentFile,
                downloadedFiles: Math.floor((progress / 100) * job.totalFiles),
              });
            },
          },
          job.id,
          job.libraryId,
        );
      } finally {
        await page.close().catch(console.error);
      }
    } catch (error) {
      console.error(`Job ${job.id} failed:`, error);
      const { updateJob } = useDownloadStore.getState();
      updateJob(job.id, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        endTime: Date.now(),
      });
    }
  }
}

// Singleton instance
export const downloadService = new DownloadService();
