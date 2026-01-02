import { useAppStore } from '../state/store.js';
import { useDownloadStore } from '../state/download-store.js';
import { PDFDownloader, FileSystemDownloader } from '@manverse/downloader';
import { PDFKitGenerator } from '@manverse/pdf';
import { AsuraScansScarper } from '@manverse/scrapers';
import type { ManhwaChapter } from '@manverse/core';
import path from 'path';
import os from 'os';

export class DownloadService {
  private static instance: DownloadService;
  private processing = false;
  private downloader: PDFDownloader;

  private constructor() {
    const imageDownloader = new FileSystemDownloader();
    const pdfGenerator = new PDFKitGenerator();
    this.downloader = new PDFDownloader(imageDownloader, pdfGenerator);

    // Subscribe to store changes to trigger processing
    useDownloadStore.subscribe((state) => {
      this.processQueue();
    });
  }

  public static getInstance(): DownloadService {
    if (!DownloadService.instance) {
      DownloadService.instance = new DownloadService();
    }
    return DownloadService.instance;
  }

  public async processQueue() {
    if (this.processing) return;

    const store = useDownloadStore.getState();
    const appStore = useAppStore.getState();
    const { queue, activeDownloads, maxConcurrent, updateJob } = store;

    if (activeDownloads >= maxConcurrent) return;

    // Find next queued job
    const nextJob = queue.find((j) => j.status === 'queued');
    if (!nextJob) return;

    this.processing = true;

    try {
      // Start job
      updateJob(nextJob.id, { status: 'downloading', startTime: Date.now(), progress: 0 });

      // 1. Get browser
      const browser = appStore.browser;
      if (!browser) {
        throw new Error('Browser not initialized');
      }

      // 2. Get pages from scraper
      // TODO: Use Factory when multiple providers are supported
      const scraper = new AsuraScansScarper();

      const page = await browser.newPage();
      let pages: ManhwaChapter;
      try {
        pages = await scraper.checkManhwaChapter(page, nextJob.chapterUrl);
      } finally {
        await page.close();
      }

      if (!pages || pages.length === 0) {
        throw new Error('No pages found in chapter');
      }

      // 3. Download
      const safeTitle = nextJob.mangaTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const downloadPath = path.join(os.homedir(), 'Downloads', 'ManVerse', safeTitle);

      const result = await this.downloader.downloadChapter(pages, {
        path: downloadPath,
        onProgress: (progress) => {
          const percentage =
            progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

          updateJob(nextJob.id, {
            progress: percentage,
            downloadedFiles: progress.current,
            totalFiles: progress.total,
            currentFile: progress.currentFile,
          });
        },
      });

      if (result.success) {
        updateJob(nextJob.id, { status: 'completed', endTime: Date.now(), progress: 100 });
      } else {
        throw new Error(result.errors.map((e) => e.message).join(', '));
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      updateJob(nextJob.id, { status: 'failed', error: errorMessage, endTime: Date.now() });
    } finally {
      this.processing = false;
      // Trigger again in case there are more slots
      setTimeout(() => {
        this.processQueue().catch(console.error);
      }, 100);
    }
  }
}
