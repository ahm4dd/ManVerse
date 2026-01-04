import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { DownloadProgress, ManhwaChapter } from '@manverse/core';
import { Providers } from '@manverse/core';
import { FileSystemDownloader, PDFDownloader } from '@manverse/downloader';
import { PDFKitGenerator } from '@manverse/pdf';
import {
  getDownloadedChapter,
  getDownloadedChapterById,
  getDownloadedSizeForSeries,
  getProviderMangaByProviderId,
  listDownloadedChapters,
  listDownloadedSeries,
  upsertDownloadedChapter,
  upsertProviderManga,
} from '@manverse/database';
import { ScraperService } from './scraper-service.ts';

type Provider = typeof Providers[keyof typeof Providers];

const DEFAULT_DOWNLOAD_PATH = (() => {
  const override = Bun.env.MANVERSE_DOWNLOAD_PATH;
  if (override && override.trim().length > 0) {
    return override;
  }
  return path.join(os.homedir(), '.config', 'manverse', 'downloads');
})();

const DEFAULT_CONCURRENCY = Number.parseInt(Bun.env.DOWNLOAD_CONCURRENCY ?? '1', 10) || 1;
const DEFAULT_IMAGE_CONCURRENCY =
  Number.parseInt(Bun.env.DOWNLOAD_IMAGE_CONCURRENCY ?? '5', 10) || 5;
const DEFAULT_JOB_INTERVAL_MS =
  Number.parseInt(Bun.env.DOWNLOAD_JOB_INTERVAL_MS ?? '1500', 10) || 1500;
const DEFAULT_RETRY_LIMIT = Number.parseInt(Bun.env.DOWNLOAD_RETRY_LIMIT ?? '2', 10) || 2;
const DEFAULT_SERIES_BUDGET_MB =
  Number.parseInt(Bun.env.DOWNLOAD_SERIES_BUDGET_MB ?? '1024', 10) || 1024;

type DownloadStatus = 'queued' | 'downloading' | 'completed' | 'failed' | 'canceled';

export interface DownloadQueueRequest {
  provider?: Provider;
  providerSeriesId: string;
  chapterId?: string;
  chapterUrl?: string;
  chapterNumber: string;
  chapterTitle?: string;
  seriesTitle?: string;
  seriesImage?: string;
  seriesStatus?: string;
  seriesRating?: string;
  seriesChapters?: string;
  force?: boolean;
  seriesBudgetMb?: number;
  userId?: string | null;
}

export interface DownloadJob {
  id: string;
  provider: Provider;
  providerSeriesId: string;
  providerMangaId?: number;
  chapterId?: string;
  chapterUrl: string;
  chapterNumber: string;
  chapterTitle?: string;
  seriesTitle?: string;
  seriesImage?: string;
  status: DownloadStatus;
  progress?: DownloadProgress;
  attempts: number;
  maxAttempts: number;
  error?: string;
  filePath?: string;
  fileSize?: number;
  downloadId?: number;
  createdAt: number;
  updatedAt: number;
  force?: boolean;
  userId?: string | null;
  cancelRequested?: boolean;
}

function decodeBase64Url(input?: string): string {
  if (!input) return '';
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  try {
    return Buffer.from(`${normalized}${padding}`, 'base64').toString('utf-8');
  } catch {
    return '';
  }
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export class DownloadService {
  private static instance: DownloadService | null = null;
  private jobs = new Map<string, DownloadJob>();
  private queue: string[] = [];
  private active = 0;
  private scraper = new ScraperService();
  private downloader = new PDFDownloader(new FileSystemDownloader(), new PDFKitGenerator());
  private providerLastStart = new Map<Provider, number>();

  static getInstance(): DownloadService {
    if (!DownloadService.instance) {
      DownloadService.instance = new DownloadService();
    }
    return DownloadService.instance;
  }

  listJobs(): DownloadJob[] {
    return Array.from(this.jobs.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  listDownloadedSeries() {
    return listDownloadedSeries();
  }

  listDownloadedChapters(providerMangaId?: number) {
    return listDownloadedChapters(providerMangaId);
  }

  getJob(id: string): DownloadJob | null {
    return this.jobs.get(id) ?? null;
  }

  getDownloadedChapterById(id: number) {
    return getDownloadedChapterById(id);
  }

  async enqueue(request: DownloadQueueRequest): Promise<DownloadJob> {
    const provider = request.provider ?? Providers.AsuraScans;
    const chapterUrl = request.chapterUrl || decodeBase64Url(request.chapterId) || '';

    if (!chapterUrl) {
      throw new Error('Chapter url is required');
    }

    const providerRecord =
      getProviderMangaByProviderId(provider, request.providerSeriesId) ??
      (request.seriesTitle
        ? upsertProviderManga({
            provider,
            provider_id: request.providerSeriesId,
            title: request.seriesTitle,
            image: request.seriesImage ?? null,
            status: request.seriesStatus ?? null,
            rating: request.seriesRating ?? null,
            chapters: request.seriesChapters ?? null,
          })
        : null);

    if (!providerRecord) {
      throw new Error('Provider series metadata is missing');
    }

    const existing = getDownloadedChapter(providerRecord.id, request.chapterNumber);
    if (existing && fs.existsSync(existing.file_path) && !request.force) {
      const job: DownloadJob = {
        id: randomUUID(),
        provider,
        providerSeriesId: request.providerSeriesId,
        providerMangaId: providerRecord.id,
        chapterId: request.chapterId,
        chapterUrl,
        chapterNumber: request.chapterNumber,
        chapterTitle: request.chapterTitle,
        seriesTitle: providerRecord.title,
        seriesImage: providerRecord.image ?? undefined,
        status: 'completed',
        attempts: 0,
        maxAttempts: DEFAULT_RETRY_LIMIT,
        filePath: existing.file_path,
        fileSize: existing.file_size ?? undefined,
        downloadId: existing.id,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        userId: request.userId ?? null,
      };
      this.jobs.set(job.id, job);
      return job;
    }

    const budgetMb = request.seriesBudgetMb ?? DEFAULT_SERIES_BUDGET_MB;
    const budgetBytes = budgetMb * 1024 * 1024;
    const currentSize = getDownloadedSizeForSeries(providerRecord.id);
    if (currentSize >= budgetBytes) {
      throw new Error('Series storage budget exceeded');
    }

    const now = Date.now();
    const job: DownloadJob = {
      id: randomUUID(),
      provider,
      providerSeriesId: request.providerSeriesId,
      providerMangaId: providerRecord.id,
      chapterId: request.chapterId,
      chapterUrl,
      chapterNumber: request.chapterNumber,
      chapterTitle: request.chapterTitle,
      seriesTitle: providerRecord.title,
      seriesImage: providerRecord.image ?? undefined,
      status: 'queued',
      attempts: 0,
      maxAttempts: DEFAULT_RETRY_LIMIT,
      createdAt: now,
      updatedAt: now,
      force: request.force,
      userId: request.userId ?? null,
    };

    this.jobs.set(job.id, job);
    this.queue.push(job.id);
    this.pump();
    return job;
  }

  cancel(id: string): DownloadJob | null {
    const job = this.jobs.get(id);
    if (!job) return null;
    if (job.status === 'completed' || job.status === 'failed') {
      return job;
    }
    job.cancelRequested = true;
    if (job.status === 'queued') {
      this.queue = this.queue.filter((queuedId) => queuedId !== id);
      job.status = 'canceled';
      job.updatedAt = Date.now();
    }
    return job;
  }

  private pump() {
    while (this.active < DEFAULT_CONCURRENCY && this.queue.length > 0) {
      const nextId = this.queue.shift();
      if (!nextId) break;
      const job = this.jobs.get(nextId);
      if (!job) continue;
      if (job.cancelRequested) {
        job.status = 'canceled';
        job.updatedAt = Date.now();
        continue;
      }
      this.active += 1;
      this.runJob(job)
        .catch((error) => {
          console.error('Download job failed:', error);
        })
        .finally(() => {
          this.active = Math.max(0, this.active - 1);
          this.pump();
        });
    }
  }

  private async runJob(job: DownloadJob): Promise<void> {
    job.status = 'downloading';
    job.updatedAt = Date.now();

    while (job.attempts < job.maxAttempts) {
      if (job.cancelRequested) {
        job.status = 'canceled';
        job.updatedAt = Date.now();
        return;
      }

      job.attempts += 1;
      try {
        await this.waitForProviderWindow(job.provider);
        const chapterPages = await this.scraper.getChapterImages(job.chapterUrl, job.provider);
        const output = await this.downloadToPdf(job, chapterPages);
        if (job.cancelRequested) {
          job.status = 'canceled';
          job.updatedAt = Date.now();
          return;
        }

        const record = upsertDownloadedChapter({
          providerMangaId: job.providerMangaId as number,
          chapterNumber: job.chapterNumber,
          filePath: output.filePath,
          fileSize: output.fileSize,
        });

        job.status = 'completed';
        job.filePath = output.filePath;
        job.fileSize = output.fileSize;
        job.downloadId = record.id;
        job.error = undefined;
        job.updatedAt = Date.now();
        return;
      } catch (error) {
        job.error = error instanceof Error ? error.message : 'Download failed';
        job.updatedAt = Date.now();
        if (job.attempts >= job.maxAttempts) {
          job.status = 'failed';
          return;
        }
      }
    }
  }

  private async waitForProviderWindow(provider: Provider): Promise<void> {
    const lastStart = this.providerLastStart.get(provider) ?? 0;
    const now = Date.now();
    const elapsed = now - lastStart;
    if (elapsed < DEFAULT_JOB_INTERVAL_MS) {
      await new Promise((resolve) => setTimeout(resolve, DEFAULT_JOB_INTERVAL_MS - elapsed));
    }
    this.providerLastStart.set(provider, Date.now());
  }

  private async downloadToPdf(
    job: DownloadJob,
    chapterPages: ManhwaChapter,
  ): Promise<{ filePath: string; fileSize: number }> {
    const seriesSlug = slugify(job.seriesTitle || job.providerSeriesId);
    const chapterSlug = slugify(job.chapterNumber || 'chapter');
    const seriesDir = path.join(DEFAULT_DOWNLOAD_PATH, job.provider, seriesSlug || job.providerSeriesId);
    ensureDir(seriesDir);

    const basePath = path.join(seriesDir, `chapter-${chapterSlug}`);
    const result = await this.downloader.downloadChapter(chapterPages, {
      path: basePath,
      concurrency: DEFAULT_IMAGE_CONCURRENCY,
      onProgress: (progress) => {
        job.progress = progress;
        job.updatedAt = Date.now();
      },
      force: job.force,
    });

    if (!result.success || !result.pdfPath) {
      const error = result.errors[0] || new Error('Download failed');
      throw error;
    }

    const filePath = result.pdfPath;
    const stat = fs.statSync(filePath);

    const baseDir = basePath;
    if (fs.existsSync(baseDir)) {
      try {
        fs.rmSync(baseDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }

    return { filePath, fileSize: stat.size };
  }
}
