import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { IJobQueue, Job, JobResult, JobStatus, JobPayload } from '@manverse/core';

/**
 * In-Memory Job Queue Adapter
 *
 * This adapter mimics the behavior of a distributed queue (like BullMQ)
 * but runs entirely in-process using JavaScript Maps and EventEmitters.
 *
 * Ideal for: CLI tools, Single-User Desktop Apps, Testing.
 * Not for: Scalable Server Deployments (use RedisJobQueue).
 */
export class InMemoryJobQueue implements IJobQueue {
  private jobs: Map<string, Job>;
  private eventEmitter: EventEmitter;
  private processor: ((job: Job) => Promise<any>) | null = null;
  private isProcessing: boolean = false;

  constructor() {
    this.jobs = new Map();
    this.eventEmitter = new EventEmitter();
    this.eventEmitter.setMaxListeners(50);
  }

  public setWorker(processor: (job: Job) => Promise<any>) {
    this.processor = processor;
    setTimeout(() => this.processNext(), 0);
  }

  async add(jobData: JobPayload): Promise<string> {
    const id = uuidv4();
    const now = new Date();

    const job: Job = {
      ...jobData,
      id,
      status: JobStatus.PENDING,
      createdAt: now,
      updatedAt: now,
      attempts: 0,
      maxAttempts: 3,
    } as any; // Cast as any because discriminating unions with spreads can be tricky for TS

    this.jobs.set(id, job);
    this.eventEmitter.emit('added', { jobId: id });
    setTimeout(() => this.processNext(), 0);

    return id;
  }

  async getJob(jobId: string): Promise<Job | null> {
    return this.jobs.get(jobId) || null;
  }

  async waitForAttributes(jobId: string): Promise<JobResult> {
    const job = this.jobs.get(jobId);

    if (job && (job.status === JobStatus.COMPLETED || job.status === JobStatus.FAILED)) {
      return this.createJobResult(job);
    }

    return new Promise((resolve) => {
      const handler = (data: { jobId: string }) => {
        if (data.jobId === jobId) {
          const currentJob = this.jobs.get(jobId);
          if (
            currentJob &&
            (currentJob.status === JobStatus.COMPLETED || currentJob.status === JobStatus.FAILED)
          ) {
            this.eventEmitter.off('completed', handler);
            this.eventEmitter.off('failed', handler);
            resolve(this.createJobResult(currentJob));
          }
        }
      };

      this.eventEmitter.on('completed', handler);
      this.eventEmitter.on('failed', handler);
    });
  }

  private async processNext() {
    if (this.isProcessing || !this.processor) return;

    const pendingJobEntry = Array.from(this.jobs.entries()).find(
      ([_, job]) => job.status === JobStatus.PENDING,
    );

    if (!pendingJobEntry) return;

    const [id, job] = pendingJobEntry;
    this.isProcessing = true;

    try {
      job.status = JobStatus.PROCESSING;
      job.updatedAt = new Date();
      this.jobs.set(id, job);

      const result = await this.processor(job);

      job.status = JobStatus.COMPLETED;
      this.eventEmitter.emit('completed', { jobId: id, result });
    } catch (error) {
      job.status = JobStatus.FAILED;
      job.error = error instanceof Error ? error.message : String(error);
      this.eventEmitter.emit('failed', { jobId: id, error: job.error });
    } finally {
      job.updatedAt = new Date();
      this.jobs.set(id, job);
      this.isProcessing = false;
      setTimeout(() => this.processNext(), 0);
    }
  }

  private createJobResult(job: Job): JobResult {
    return {
      jobId: job.id,
      status: job.status as JobStatus,
      data: (job as any).result,
      error: job.error,
    };
  }
  async close() {
    this.jobs.clear();
  }
}
