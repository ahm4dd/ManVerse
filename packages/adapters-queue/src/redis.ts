import { Queue, QueueEvents, Job as BullJob, type ConnectionOptions } from 'bullmq';
import { IJobQueue, Job, JobResult, JobPayload, JobStatus, JobType } from '@manverse/core';

export class RedisJobQueue implements IJobQueue {
  private queue: Queue;
  private queueEvents: QueueEvents;

  /**
   * @param queueName Name of the queue (e.g. 'scraper-jobs')
   * @param connection Redis connection options
   */
  constructor(queueName: string, connection: ConnectionOptions) {
    this.queue = new Queue(queueName, { connection });
    this.queueEvents = new QueueEvents(queueName, { connection });
  }

  async add(jobData: JobPayload): Promise<string> {
    const job = await this.queue.add(jobData.type, jobData, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    });

    return job.id!;
  }

  async getJob(jobId: string): Promise<Job | null> {
    const bullJob = await this.queue.getJob(jobId);
    if (!bullJob) return null;

    return this.mapBullJobToCoreJob(bullJob);
  }

  async waitForAttributes(jobId: string): Promise<JobResult> {
    try {
      const job = await this.queue.getJob(jobId);
      if (!job) {
        throw new Error(`Job ${jobId} not found`);
      }

      const result = await job.waitUntilFinished(this.queueEvents);
      const finishedJob = await this.queue.getJob(jobId);

      if (!finishedJob) throw new Error('Job disappeared after completion');

      const isFailed = await finishedJob.isFailed();
      return {
        jobId: finishedJob.id!,
        status: isFailed ? JobStatus.FAILED : JobStatus.COMPLETED,
        data: result,
        error: finishedJob.failedReason,
      };
    } catch (error) {
      return {
        jobId,
        status: JobStatus.FAILED,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private mapBullJobToCoreJob(bullJob: BullJob): Job {
    return {
      id: bullJob.id!,
      type: bullJob.name as JobType,
      status: JobStatus.PENDING,
      createdAt: new Date(bullJob.timestamp),
      updatedAt: new Date(bullJob.finishedOn || bullJob.timestamp),
      attempts: bullJob.attemptsMade,
      maxAttempts: bullJob.opts.attempts || 1,
      error: bullJob.failedReason,
      data: bullJob.data,
      updateProgress: (progress: number | object) => bullJob.updateProgress(progress),
    };
  }

  async close() {
    await this.queue.close();
    await this.queueEvents.close();
  }
}
