/**
 * Queue job types and statuses
 */

export enum JobType {
  SCRAPE_SEARCH = 'scrape.search',
  SCRAPE_MANHWA = 'scrape.manhwa',
  SCRAPE_CHAPTER = 'scrape.chapter',
  DOWNLOAD_CHAPTER = 'download.chapter',
  GENERATE_PDF = 'generate.pdf',
  UPLOAD_FILE = 'upload.file',
}

export enum JobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RETRYING = 'retrying',
}

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
  type: JobType.SCRAPE_SEARCH;
  data: {
    searchTerm: string;
    page: number;
    provider: string;
  };
}

export interface ScrapeManhwaJob extends BaseJob {
  type: JobType.SCRAPE_MANHWA;
  data: {
    manhwaUrl: string;
    provider: string;
  };
}

export interface ScrapeChapterJob extends BaseJob {
  type: JobType.SCRAPE_CHAPTER;
  data: {
    chapterUrl: string;
    provider: string;
  };
}

export interface DownloadChapterJob extends BaseJob {
  type: JobType.DOWNLOAD_CHAPTER;
  data: {
    chapterUrl: string;
    outputDir: string;
    provider: string;
  };
}

export interface GeneratePdfJob extends BaseJob {
  type: JobType.GENERATE_PDF;
  data: {
    imagePaths: string[];
    outputPath: string;
    title?: string;
  };
}

export interface UploadFileJob extends BaseJob {
  type: JobType.UPLOAD_FILE;
  data: {
    filePath: string;
    destination: string;
    metadata?: Record<string, any>;
  };
}

export type Job =
  | ScrapeSearchJob
  | ScrapeManhwaJob
  | ScrapeChapterJob
  | DownloadChapterJob
  | GeneratePdfJob
  | UploadFileJob;

export interface JobResult<T = any> {
  jobId: string;
  status: JobStatus;
  data?: T;
  error?: string;
}
