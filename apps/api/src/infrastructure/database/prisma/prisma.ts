import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../../generated/prisma/client.js';
import { env } from '../../../config/env.js'; // Use our validated env

const adapter = new PrismaPg({
  connectionString: env.DATABASE_URL,
});

// Export the singular instance
export const prisma = new PrismaClient(
  env.NODE_ENV === 'development'
    ? { adapter, log: ['error', 'info', 'query', 'warn'] }
    : { adapter, log: [] },
);
