import { Hono } from 'hono';
import { logger as honoLogger } from 'hono/logger';
import { serverConfig } from './config.ts';

const app = new Hono();

// Middleware
app.use('*', honoLogger());

// Routes
// app.route('/manhwas', manhwasRouter);

// Error Handling
app.onError((err, c) => {
  // logger.error(`API Error: ${err.message}`);
  return c.json({ error: 'Internal Server Error' }, 500);
});

// Graceful Shutdown
const shutdown = async (signal: string) => {
  // logger.info(`Received ${signal}. Shutting down gracefully...`);

  const timeout = setTimeout(() => {
    // logger.warn('Shutdown timed out, forcing exit.');
    process.exit(1);
  }, 5000);

  try {
    // await Promise.all([scraperQueue.close(), pdfQueue.close(), uploadQueue.close()]);
    // logger.info('Queues closed successfully.');
    clearTimeout(timeout);
    process.exit(0);
  } catch (error) {
    // logger.error(`Error during shutdown: ${(error as Error).message}`);
    process.exit(1);
  }
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

export default {
  port: serverConfig.PORT,
  hostname: serverConfig.HOSTNAME,
  fetch: app.fetch,
};

console.log(`Server running on http://${serverConfig.HOSTNAME}:${serverConfig.PORT}`);
