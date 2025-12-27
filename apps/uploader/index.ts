import { createLogger, createWorker, getRedisClient } from '@manverse/queue-manager';
import { QueueNames } from '@manverse/core';

const logger = createLogger({ prefix: 'Uploader-Worker' });
const redisClient = getRedisClient();

async function main() {
  logger.info('Uploader service placeholder initialized.');
  logger.info(`Listening for queue: ${QueueNames.UPLOAD_JOBS}`);

  // This worker handles post-processing like uploading to Telegram/S3
  const uploaderWorker = createWorker(
    QueueNames.UPLOAD_JOBS,
    async (job) => {
      logger.info(`Processing upload job ${job.id}`);
      // Implementation pending
      return { status: 'success' };
    },
    { connection: redisClient },
  );

  uploaderWorker.on('completed', (job) => logger.info(`Job ${job.id} completed`));
}

main().catch((err) => {
  console.error('Fatal Uploader Error:', err);
  process.exit(1);
});
