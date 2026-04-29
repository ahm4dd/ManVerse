import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../../generated/prisma/client.js';
import { env } from '../../../config/env.js'; // Use our validated env

const DEVELOPMENT_LOG_LEVELS = ['error', 'info', 'warn'] as const;

const adapter = new PrismaPg({
  connectionString: env.DATABASE_URL,
});

function getPrismaLogLevels() {
  if (env.NODE_ENV !== 'development') {
    return env.PRISMA_LOG_QUERIES ? ['query'] : [];
  }

  return env.PRISMA_LOG_QUERIES
    ? [...DEVELOPMENT_LOG_LEVELS, 'query']
    : [...DEVELOPMENT_LOG_LEVELS];
}

// Export the singular instance
export const prisma = new PrismaClient({
  adapter,
  log: getPrismaLogLevels(),
});
