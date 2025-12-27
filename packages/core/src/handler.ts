import { type Job, JobType, type JobPayload } from './schemas.ts';

export type JobHandler<T extends JobType> = (
  job: Job<Extract<JobPayload, { type: T }>['data']>,
  payload: Extract<JobPayload, { type: T }>['data'],
) => Promise<any>;

export class JobManager {
  private handlers: Map<JobType, JobHandler<any>> = new Map();

  register<T extends JobType>(type: T, handler: JobHandler<T>) {
    this.handlers.set(type, handler);
  }

  async handle(job: Job<any>): Promise<any> {
    const type = job.type;
    const handler = this.handlers.get(type);

    if (!handler) {
      throw new Error(`No handler registered for job type: ${type}`);
    }

    // BullMQ often nests data under 'data' if using Queue.add(name, data)
    const data = (job.data as any)?.data || job.data;
    return handler(job, data);
  }
}
