import { type IJobQueue } from '@manverse/core';
import { RedisJobQueue } from './redis.ts';
import { SQLiteJobQueue } from './sqlite.ts';
import { InMemoryJobQueue } from './in-memory.ts';
import { type ConnectionOptions } from 'bullmq';

export enum QueueAdapterType {
  REDIS = 'redis',
  SQLITE = 'sqlite',
  IN_MEMORY = 'in-memory',
}

export class QueueFactory {
  static create(
    type: QueueAdapterType,
    queueName: string,
    connection?: ConnectionOptions,
  ): IJobQueue {
    switch (type) {
      case QueueAdapterType.REDIS:
        if (!connection) throw new Error('Redis connection required for Redis adapter');
        return new RedisJobQueue(queueName, connection);
      case QueueAdapterType.SQLITE:
        return new SQLiteJobQueue(queueName);
      case QueueAdapterType.IN_MEMORY:
      default:
        return new InMemoryJobQueue();
    }
  }
}
