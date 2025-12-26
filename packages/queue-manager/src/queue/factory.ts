import { Queue, Worker, QueueOptions, WorkerOptions, Processor } from 'bullmq';
import { getRedisClient } from '../redis/index.js';
import { DefaultJobOptions } from './constants.js';

export function createQueue<T = unknown, R = unknown, N extends string = string>(
  name: string,
  options: Partial<QueueOptions> = {},
): Queue<T, R, N> {
  const redisClient = getRedisClient();

  const defaultOptions: QueueOptions = {
    connection: redisClient,
    defaultJobOptions: DefaultJobOptions,
  };

  return new Queue(name, { ...defaultOptions, ...options });
}

export function createWorker<T = unknown, R = unknown, N extends string = string>(
  name: string,
  processor: Processor<T, R, N>,
  options: Partial<WorkerOptions> = {},
): Worker<T, R, N> {
  const redisClient = getRedisClient();

  const defaultOptions: WorkerOptions = {
    connection: redisClient,
    concurrency: 1, // Default processing concurrency
  };

  return new Worker(name, processor, { ...defaultOptions, ...options });
}
