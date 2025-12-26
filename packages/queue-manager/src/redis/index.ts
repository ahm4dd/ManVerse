import { Redis, RedisOptions } from 'ioredis';

const DEFAULT_REDIS_OPTIONS: RedisOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null, // Required for BullMQ
};

let redisClient: Redis | null = null;

/**
 * Get or create the shared Redis client instance
 */
export function getRedisClient(options: Partial<RedisOptions> = {}): Redis {
  if (!redisClient) {
    redisClient = createRedisClient(options);
  }
  return redisClient;
}

/**
 * Create a new Redis client instance
 */
export function createRedisClient(options: Partial<RedisOptions> = {}): Redis {
  const finalOptions = {
    ...DEFAULT_REDIS_OPTIONS,
    ...options,
  };

  return new Redis(finalOptions);
}

/**
 * Close the shared Redis client connection
 */
export async function closeRedisClient(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}
