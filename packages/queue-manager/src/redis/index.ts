import { Redis, RedisOptions } from 'ioredis';

/**
 * Get the base Redis options
 * @param options - Optional additional options
 * @returns The base Redis options
 */
export function getBaseOptions(options: Partial<RedisOptions> = {}): RedisOptions {
  const isProd = process.env.NODE_ENV === 'production';

  const base: RedisOptions = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: null, // Required for BullMQ
    ...options,
  };

  // Auto-enable TLS in production (standard for cloud Redis like Aiven, AWS, etc.)
  if (isProd && !base.tls) {
    base.tls = {};
  }

  return base;
}

let redisClient: Redis | null = null;

/**
 * Get or create the shared Redis client instance
 * @param options - Optional additional options
 * @returns The shared Redis client instance
 */
export function getRedisClient(options: Partial<RedisOptions> = {}): Redis {
  if (!redisClient) {
    redisClient = createRedisClient(options);
  }
  return redisClient;
}

/**
 * Create a new Redis client instance
 * @param options - Optional additional options
 * @returns The new Redis client instance
 */
export function createRedisClient(options: Partial<RedisOptions> = {}): Redis {
  const url = process.env.REDIS_URL;
  const finalOptions = getBaseOptions(options);

  if (url) {
    // If a full connection string is provided, use it
    return new Redis(url, finalOptions);
  }

  return new Redis(finalOptions);
}

/**
 * Close the shared Redis client connection
 * @returns A promise that resolves when the connection is closed
 */
export async function closeRedisClient(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}
