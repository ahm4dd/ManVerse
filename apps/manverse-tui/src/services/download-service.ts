import type { Page } from 'puppeteer';
import { AsuraScansScarper } from '@manverse/scrapers';
import { PDFKitGenerator } from '@manverse/pdf';
import { recordDownload, updateProgress } from '@manverse/database';
import type { ManhwaChapter } from '@manverse/core';
import { useDownloadStore } from '../state/download-store.js';
import { $ } from 'bun';
import path from 'path';

/**
 * Download Service - Chapter downloads with PDF generation
 * CORRECT: AsuraScansScarper does NOT implement IDownloader, we handle download ourselves
 */
export class DownloadService {
  private scraper: AsuraScansScarper;
  private pdfGenerator: PDFKitGenerator;

  constructor() {
    this.scraper = new AsuraScansScarper();
    this.pdfGenerator = new PDFKitGenerator();
  }

  /**
   * Download a single chapter and generate PDF
   */
  async downloadChapter(
    page: Page,
    chapterUrl: string,
    outputDir: string,
    mangaTitle: string,
    chapterNumber: string,
    jobId: string,
    libraryId?: number,
  ): Promise<{ success: boolean; pdfPath?: string; error?: string }> {
    const { updateJob } = useDownloadStore.getState();

    try {
      updateJob(jobId, { status: 'downloading', progress: 0, startTime: Date.now() });

      // Get chapter images - CORRECT: ManhwaChapter is ARRAY
      const chapterImages: ManhwaChapter = await this.scraper.checkManhwaChapter(page, chapterUrl);

      if (chapterImages.length === 0) {
        throw new Error('No images found in chapter');
      }

      // Create temp directory for images
      const tempDir = path.join(outputDir, '.temp', `${Date.now()}`);
      await $`mkdir -p ${tempDir}`.quiet();

      // Download images (simple sequential download)
      const downloadedFiles: string[] = [];
      for (let i = 0; i < chapterImages.length; i++) {
        const image = chapterImages[i];
        const fileName = `${(i + 1).toString().padStart(3, '0')}.jpg`;
        const filePath = path.join(tempDir, fileName);

        // Download image using curl
        try {
          await $`curl -s -o ${filePath} -H "Referer: ${image.headerForImage}" "${image.img}"`.quiet();
          downloadedFiles.push(filePath);

          const progress = Math.floor(((i + 1) / chapterImages.length) * 80); // Reserve 20% for PDF gen
          updateJob(jobId, { progress, downloadedFiles: i + 1 });
        } catch (err) {
          console.error(`Failed to download image ${i + 1}:`, err);
        }
      }

      if (downloadedFiles.length === 0) {
        throw new Error('Failed to download any images');
      }

      // Generate PDF
      updateJob(jobId, { progress: 85 });
      const pdfPath = path.join(outputDir, `${mangaTitle}-ch${chapterNumber}.pdf`);
      await this.pdfGenerator.generate(downloadedFiles, pdfPath);

      // Cleanup temp directory
      await $`rm -rf ${tempDir}`.quiet();

      // Record download in database
      if (libraryId) {
        recordDownload({
          provider_manga_id: libraryId,
          chapter_number: chapterNumber,
          chapter_url: chapterUrl,
          file_path: pdfPath,
          file_size: null,
          page_count: chapterImages.length,
          downloaded_at: Date.now(),
        });

        const newProgress = parseInt(chapterNumber, 10);
        if (!isNaN(newProgress)) {
          updateProgress(libraryId, newProgress);
        }
      }

      updateJob(jobId, {
        status: 'completed',
        progress: 100,
        endTime: Date.now(),
      });

      return { success: true, pdfPath };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      updateJob(jobId, {
        status: 'failed',
        error: errorMessage,
        endTime: Date.now(),
      });

      return { success: false, error: errorMessage };
    }
  }

  async processQueue(outputDir: string, maxConcurrent: number = 3) {
    const { queue } = useDownloadStore.getState();
    const activeJobs = queue.filter((j) => j.status === 'downloading');
    const queuedJobs = queue.filter((j) => j.status === 'queued');

    const slotsAvailable = maxConcurrent - activeJobs.length;
    if (slotsAvailable <= 0 || queuedJobs.length === 0) {
      return;
    }

    // Note: Would need browser instance passed in to actually process
    // This is a placeholder for the queue processor
    console.log(`${slotsAvailable} slots available, ${queuedJobs.length} jobs queued`);
  }
}

export const downloadService = new DownloadService();
