import { Job, JobResult, JobPayload, SearchResult, Manhwa, ManhwaChapterImage } from './types.js';

/**
 * Port: Job Queue Interface
 *
 * Defines how the Core interacts with a job queue, regardless of whether
 * it is Redis (BullMQ) or In-Memory.
 */
export interface IJobQueue {
  /**
   * Add a job to the queue
   */
  add(job: JobPayload): Promise<string>;

  /**
   * Get a job by ID
   */
  getJob(jobId: string): Promise<Job | null>;

  /**
   * Wait for a job to complete and return the result
   */
  waitForAttributes(jobId: string): Promise<JobResult>;
  close(): Promise<void>;
}

/**
 * Port: Scraper Interface
 *
 * Defines how the Core requests scraping data, regardless of the underlying engine
 * (Puppeteer, Cheerio, Playwright, etc).
 */
export interface IScraper {
  name: string;

  /**
   * Search for manhwas
   */
  search(query: string, page: number): Promise<SearchResult>;

  /**
   * Check manhwa details
   */
  getManhwa(url: string): Promise<Manhwa>;

  /**
   * Get chapter images
   */
  getChapter(url: string): Promise<ManhwaChapterImage[]>;

  /**
   * Download chapter images
   */
  downloadChapter(url: string, outputDir: string): Promise<void>;
}
