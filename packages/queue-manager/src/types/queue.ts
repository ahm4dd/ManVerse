import { type Queue } from 'bullmq';
/**
 * Queue job types and statuses
 */

export type QueueType = Queue;

export const JobType = {
  SCRAPE_SEARCH: 'scrape.search',
  SCRAPE_MANHWA: 'scrape.manhwa',
  SCRAPE_CHAPTER: 'scrape.chapter',
  DOWNLOAD_CHAPTER: 'download.chapter',
  GENERATE_PDF: 'generate.pdf',
  UPLOAD_FILE: 'upload.file',
} as const;

export type JobType = (typeof JobType)[keyof typeof JobType];

export const JobStatus = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  RETRYING: 'retrying',
} as const;

export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus];

export interface BaseJob {
  id: string;
  type: JobType;
  status: JobStatus;
  createdAt: Date;
  updatedAt: Date;
  attempts: number;
  maxAttempts: number;
  error?: string;
}

export interface ScrapeSearchJob extends BaseJob {
  type: typeof JobType.SCRAPE_SEARCH;
  data: {
    searchTerm: string;
    page: number;
    provider: string;
  };
}

export interface ScrapeManhwaJob extends BaseJob {
  type: typeof JobType.SCRAPE_MANHWA;
  data: {
    manhwaUrl: string;
    provider: string;
  };
}

export interface ScrapeChapterJob extends BaseJob {
  type: typeof JobType.SCRAPE_CHAPTER;
  data: {
    chapterUrl: string;
    provider: string;
  };
}

export interface DownloadChapterJob extends BaseJob {
  type: typeof JobType.DOWNLOAD_CHAPTER;
  data: {
    chapterUrl: string;
    outputDir: string;
    provider: string;
  };
}

export interface GeneratePdfJob extends BaseJob {
  type: typeof JobType.GENERATE_PDF;
  data: {
    imagePaths: string[];
    outputPath: string;
    title?: string;
  };
}

export interface UploadFileJob extends BaseJob {
  type: typeof JobType.UPLOAD_FILE;
  data: {
    filePath: string;
    destination: string;
    metadata?: Record<string, unknown>;
  };
}

export type Job =
  | ScrapeSearchJob
  | ScrapeManhwaJob
  | ScrapeChapterJob
  | DownloadChapterJob
  | GeneratePdfJob
  | UploadFileJob;

export interface JobStatusResponse {
  id: string | undefined;
  name: string;
  data: unknown;
  progress: unknown;
  returnvalue: unknown;
  finishedOn?: number;
  failedReason?: string;
  stacktrace?: string[];
  attemptsMade: number;
}

export interface JobResult<T = unknown> {
  jobId: string;
  status: JobStatus;
  data?: T;
  error?: string;
}
