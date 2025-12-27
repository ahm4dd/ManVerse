import type { Request, Response } from 'express';
import { QueueEvents } from 'bullmq';
import { BadRequestError, ServerError } from '../errors.ts';
import { publishJob, redisClient, scraperQueue } from '../queue/publisher.ts';
import { JobType, QueueNames, ScrapeSearchJobDataSchema } from '@manverse/queue-manager';

export async function searchManhwas(req: Request, res: Response) {
  const { searchTerm, page, provider } = req.query;

  const jobData = ScrapeSearchJobDataSchema.safeParse({
    searchTerm: searchTerm as string,
    page: Number.parseInt(page as string, 10) || 1,
    provider: provider as string,
  });

  if (!jobData.success) {
    throw new BadRequestError(jobData.error.message);
  }

  const jobId = await publishJob({
    type: JobType.SCRAPE_SEARCH,
    data: jobData.data,
    status: 'pending',
    maxAttempts: 3,
  });

  const queueEvents = new QueueEvents(QueueNames.SCRAPER_JOBS, { connection: redisClient });
  try {
    const job = await scraperQueue.getJob(jobId);
    if (!job) throw new ServerError('Job not found');
    const result = await job.waitUntilFinished(queueEvents);
    await queueEvents.close();
    return res.json({ status: 'completed', data: result, jobId });
  } catch (error) {
    await queueEvents.close();
    throw new ServerError((error as Error).message);
  }
}
