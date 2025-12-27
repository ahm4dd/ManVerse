import { type Queue, type Job as BullJob } from 'bullmq';
import { QueueNames, JobType, type Job, type JobStatusResponse } from '@manverse/queue-manager';
import { getRedisClient, createLogger, createQueue } from '@manverse/queue-manager';
import { v4 as uuidv4 } from 'uuid';

export const redisClient = getRedisClient();
export const logger = createLogger({ prefix: 'Queue-API' });

export const scraperQueue = createQueue(QueueNames.SCRAPER_JOBS, {
  connection: redisClient,
});
export const pdfQueue = createQueue(QueueNames.PDF_JOBS, {
  connection: redisClient,
});
export const uploadQueue = createQueue(QueueNames.UPLOAD_JOBS, {
  connection: redisClient,
});

[scraperQueue, pdfQueue, uploadQueue].forEach((queue: Queue) => {
  queue.on('error', (err: Error) => logger.error(`${queue.name} Error: ${err.message}`));
  // Log when a job is added
  queue.on('waiting', (job: BullJob) =>
    logger.debug(`${queue.name} job added: ${job.id || 'unknown'}`),
  );
});

/**
 * Publish a job to the appropriate queue
 */
export async function publishJob(
  job: Omit<Job, 'id' | 'createdAt' | 'updatedAt' | 'attempts'>,
): Promise<string> {
  const jobId = uuidv4();
  const now = new Date();

  const fullJob: Job = {
    ...job,
    id: jobId,
    createdAt: now,
    updatedAt: now,
    attempts: 0,
  } as Job;

  let queue: Queue;

  // Route to appropriate queue based on job type
  if (fullJob.type.startsWith('scrape') || fullJob.type.includes('download')) {
    queue = scraperQueue;
  } else if (fullJob.type.includes('pdf')) {
    queue = pdfQueue;
  } else if (fullJob.type.includes('upload')) {
    queue = uploadQueue;
  } else {
    throw new Error(`Unknown job type: ${fullJob.type}`);
  }

  await queue.add(fullJob.type, fullJob, {
    jobId,
    attempts: job.maxAttempts,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  });

  return jobId;
}

/**
 * Get job status from queue
 */
export async function getJobStatus(
  jobId: string,
  jobType: JobType,
): Promise<JobStatusResponse | null> {
  let queue: Queue;

  if (jobType.startsWith('scrape') || jobType.includes('download')) {
    queue = scraperQueue;
  } else if (jobType.includes('pdf')) {
    queue = pdfQueue;
  } else if (jobType.includes('upload')) {
    queue = uploadQueue;
  } else {
    throw new Error(`Unknown job type: ${jobType}`);
  }

  const job = await queue.getJob(jobId);

  if (!job) {
    return null;
  }

  return {
    id: job.id,
    name: job.name,
    data: job.data,
    progress: job.progress,
    returnvalue: job.returnvalue,
    finishedOn: job.finishedOn,
    failedReason: job.failedReason,
    stacktrace: job.stacktrace,
    attemptsMade: job.attemptsMade,
  };
}
