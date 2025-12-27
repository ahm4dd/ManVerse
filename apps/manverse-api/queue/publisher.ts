import { QueueFactory, QueueAdapterType } from '@manverse/adapters-queue';
import {
  QueueNames,
  type Job,
  type JobType,
  type JobResult,
  type JobPayload,
  type JobStatus,
} from '@manverse/core';
import { type IJobQueue } from '@manverse/core';
import { getRedisClient, createLogger } from '@manverse/queue-manager';

export const logger = createLogger({ prefix: 'Queue-API' });

// Configuration: Switch between Redis and SQLite based on environment
const ADAPTER_TYPE = (process.env.QUEUE_ADAPTER || QueueAdapterType.REDIS) as QueueAdapterType;
const redisClient = ADAPTER_TYPE === QueueAdapterType.REDIS ? getRedisClient() : undefined;

// Initialize Queues using the Factory
export const scraperQueue = QueueFactory.create(ADAPTER_TYPE, QueueNames.SCRAPER_JOBS, redisClient);
export const pdfQueue = QueueFactory.create(ADAPTER_TYPE, QueueNames.PDF_JOBS, redisClient);
export const uploadQueue = QueueFactory.create(ADAPTER_TYPE, QueueNames.UPLOAD_JOBS, redisClient);

/**
 * Publish a job to the appropriate queue
 */
export async function publishJob(job: JobPayload): Promise<string> {
  let queue: IJobQueue;

  if (job.type.startsWith('scrape') || job.type.includes('download')) {
    queue = scraperQueue;
  } else if (job.type.includes('pdf')) {
    queue = pdfQueue;
  } else if (job.type.includes('upload')) {
    queue = uploadQueue;
  } else {
    throw new Error(`Unknown job type: ${job.type}`);
  }

  const jobId = await queue.add(job);
  logger.debug(`${job.type} job added: ${jobId}`);
  return jobId;
}

/**
 * Get job status from queue
 */
export async function getJobStatus(jobId: string, jobType: JobType): Promise<JobResult | null> {
  let queue: IJobQueue;

  if (jobType.startsWith('scrape') || jobType.includes('download')) {
    queue = scraperQueue;
  } else if (jobType.includes('pdf')) {
    queue = pdfQueue;
  } else if (jobType.includes('upload')) {
    queue = uploadQueue;
  } else {
    throw new Error(`Unknown job type: ${jobType}`);
  }

  return await queue.waitForAttributes(jobId);
}
