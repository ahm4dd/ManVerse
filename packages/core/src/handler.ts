import { type Job, JobType, type JobPayload } from './schemas.ts';

export type JobHandler<T extends JobType> = (
  job: Job<Extract<JobPayload, { type: T }>['data'], unknown>,
  payload: Extract<JobPayload, { type: T }>['data'],
) => Promise<unknown>;

export class JobManager {
  private handlers: Map<JobType, JobHandler<JobType>> = new Map();

  register<T extends JobType>(type: T, handler: JobHandler<T>) {
    this.handlers.set(type, handler as JobHandler<any>);
  }

  async handle(job: Job<unknown, unknown>): Promise<unknown> {
    const type = job.type;
    const handler = this.handlers.get(type);

    if (!handler) {
      throw new Error(`No handler registered for job type: ${type}`);
    }

    // BullMQ often nests data under 'data' if using Queue.add(name, data)
    const rawData = job.data;
    const data = ((rawData as Record<string, unknown> | null)?.data ||
      rawData) as JobPayload['data'];

    return handler(job as Parameters<typeof handler>[0], data);
  }
}
