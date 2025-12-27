import { createLogger, createWorker, getRedisClient } from '@manverse/queue-manager';
import { JobType, JobPayloadSchema, JobManager, QueueNames, type Job } from '@manverse/core';
import { AsuraScans } from '@manverse/scrapers';
import { type Job as BullJob } from 'bullmq';

const logger = createLogger({ prefix: 'Scraper-Worker' });
const redisClient = getRedisClient();

async function main() {
  try {
    const asuraScans = new AsuraScans();
    const jobManager = new JobManager();

    // Register Handler for Search
    jobManager.register(JobType.SCRAPE_SEARCH, async (job, data) => {
      const { searchTerm, page: pageNum, provider } = data;
      if (provider !== 'asuraScans') throw new Error(`Provider ${provider} not supported`);

      await job.updateProgress?.(10);
      const results = await asuraScans.search(searchTerm, pageNum);
      await job.updateProgress?.(100);
      return results;
    });

    // Register Handler for Manhwa Details
    jobManager.register(JobType.SCRAPE_MANHWA, async (job, data) => {
      const { manhwaUrl, provider } = data;
      if (provider !== 'asuraScans') throw new Error(`Provider ${provider} not supported`);

      await job.updateProgress?.(10);
      const details = await asuraScans.getManhwa(manhwaUrl);
      await job.updateProgress?.(100);
      return details;
    });

    // Register Handler for Chapter Images
    jobManager.register(JobType.SCRAPE_CHAPTER, async (job, data) => {
      const { chapterUrl, provider } = data;
      if (provider !== 'asuraScans') throw new Error(`Provider ${provider} not supported`);

      await job.updateProgress?.(10);
      const images = await asuraScans.getChapter(chapterUrl);
      await job.updateProgress?.(100);
      return images;
    });

    // Register Handler for Downloads
    jobManager.register(JobType.DOWNLOAD_CHAPTER, async (job, data) => {
      const { chapterUrl, outputDir, provider } = data;
      if (provider !== 'asuraScans') throw new Error(`Provider ${provider} not supported`);

      await job.updateProgress?.(10);
      await asuraScans.downloadChapter(chapterUrl, outputDir);
      await job.updateProgress?.(100);
      return { status: 'downloaded', outputDir };
    });

    logger.info(`Starting worker for queue: ${QueueNames.SCRAPER_JOBS}`);

    const scraperWorker = createWorker(
      QueueNames.SCRAPER_JOBS,
      async (job: BullJob) => {
        logger.info(`Processing job ${job.id} - Type: ${job.name}`);
        try {
          // Validation
          JobPayloadSchema.parse(job.data);

          // Delegate to JobManager
          const coreJob = {
            ...job,
            type: job.name as JobType,
            data: job.data,
          } as unknown as Job<unknown, unknown>;

          return await jobManager.handle(coreJob);
        } catch (err) {
          logger.error(`Job ${job.id} failed: ${(err as Error).message}`);
          throw err;
        }
      },
      { connection: redisClient, concurrency: 1 },
    );

    scraperWorker.on('completed', (job) => logger.info(`Job ${job.id} completed successfully`));
    scraperWorker.on('failed', (job, err) =>
      logger.error(`Job ${job?.id} failed permanently: ${err.message}`),
    );

    process.on('SIGINT', async () => {
      logger.info('Shutting down...');
      await scraperWorker.close();
      await asuraScans.close();
      process.exit(0);
    });
  } catch (err) {
    logger.error(`Fatal worker error: ${(err as Error).message}`);
    process.exit(1);
  }
}

main();
