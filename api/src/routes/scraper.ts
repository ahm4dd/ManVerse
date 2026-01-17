import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import type { HonoEnv } from '../types/api.ts';
import { jsonSuccess } from '../utils/response.ts';
import { openApiHook } from '../openapi/hook.ts';
import {
  scraperLogger,
  type ScraperOperation,
  type ScraperLogEvent,
  type ScraperLogHealth,
  type ScraperLogBundle,
  type ScraperLoggingStatus,
} from '../services/scraper-logger.ts';
import { Providers } from '@manverse/core';

const scraper = new OpenAPIHono<HonoEnv>({ defaultHook: openApiHook });

const operationSchema = z.enum(
  ['search', 'details', 'chapters', 'chapter', 'image'] as [ScraperOperation, ...ScraperOperation[]],
);

const eventSchema = z.object({
  id: z.string(),
  timestamp: z.number(),
  requestId: z.string().optional(),
  provider: z.nativeEnum(Providers),
  operation: operationSchema,
  ok: z.boolean(),
  durationMs: z.number(),
  errorCode: z.string().optional(),
  message: z.string().optional(),
});

const healthSchema: z.ZodType<ScraperLogHealth> = z.object({
  updatedAt: z.string(),
  total: z.number(),
  success: z.number(),
  failed: z.number(),
  avgDurationMs: z.number(),
  providers: z.array(
    z.object({
      provider: z.nativeEnum(Providers),
      total: z.number(),
      success: z.number(),
      failed: z.number(),
      avgDurationMs: z.number(),
      lastError: z
        .object({
          message: z.string().optional(),
          code: z.string().optional(),
          at: z.string().optional(),
          operation: operationSchema.optional(),
        })
        .optional(),
      actions: z.array(
        z.object({
          operation: operationSchema,
          total: z.number(),
          success: z.number(),
          failed: z.number(),
          avgDurationMs: z.number(),
          lastError: z
            .object({
              message: z.string().optional(),
              code: z.string().optional(),
              at: z.string().optional(),
            })
            .optional(),
        }),
      ),
    }),
  ),
  recentErrors: z.array(eventSchema),
});

const statusSchema: z.ZodType<ScraperLoggingStatus> = z.object({
  enabled: z.boolean(),
  logFile: z.string().nullable(),
  sizeBytes: z.number(),
  maxBytes: z.number(),
  maxFiles: z.number(),
});

const bundleSchema: z.ZodType<ScraperLogBundle> = z.object({
  generatedAt: z.string(),
  status: statusSchema,
  health: healthSchema,
  recentEvents: z.array(eventSchema),
  fileTail: z.array(z.string()),
});

const healthRoute = createRoute({
  method: 'get',
  path: '/health',
  tags: ['scraper'],
  responses: {
    200: {
      description: 'Scraper health summary',
      content: {
        'application/json': {
          schema: healthSchema,
        },
      },
    },
  },
});

scraper.openapi(healthRoute, (c) => jsonSuccess(c, scraperLogger.health()));

const eventsRoute = createRoute({
  method: 'get',
  path: '/events',
  tags: ['scraper'],
  request: {
    query: z.object({
      limit: z.coerce.number().int().min(1).max(200).optional(),
    }),
  },
  responses: {
    200: {
      description: 'Recent scraper log events',
      content: {
        'application/json': {
          schema: z.array(eventSchema) as z.ZodType<ScraperLogEvent[]>,
        },
      },
    },
  },
});

scraper.openapi(eventsRoute, (c) => {
  const { limit } = c.req.valid('query');
  return jsonSuccess(c, scraperLogger.list(limit ?? 50));
});

const loggingStatusRoute = createRoute({
  method: 'get',
  path: '/logging/status',
  tags: ['scraper'],
  responses: {
    200: {
      description: 'Scraper logging status',
      content: {
        'application/json': {
          schema: statusSchema,
        },
      },
    },
  },
});

scraper.openapi(loggingStatusRoute, (c) => jsonSuccess(c, scraperLogger.status()));

const loggingToggleRoute = createRoute({
  method: 'post',
  path: '/logging',
  tags: ['scraper'],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            enabled: z.boolean(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Updated scraper logging status',
      content: {
        'application/json': {
          schema: statusSchema,
        },
      },
    },
  },
});

scraper.openapi(loggingToggleRoute, (c) => {
  const { enabled } = c.req.valid('json');
  return jsonSuccess(c, scraperLogger.setLoggingEnabled(enabled));
});

const loggingClearRoute = createRoute({
  method: 'post',
  path: '/logging/clear',
  tags: ['scraper'],
  responses: {
    200: {
      description: 'Scraper logging buffer cleared',
      content: {
        'application/json': {
          schema: z.object({ cleared: z.boolean() }),
        },
      },
    },
  },
});

scraper.openapi(loggingClearRoute, (c) => {
  scraperLogger.clearBuffer();
  return jsonSuccess(c, { cleared: true });
});

const loggingExportRoute = createRoute({
  method: 'get',
  path: '/logging/export',
  tags: ['scraper'],
  responses: {
    200: {
      description: 'Scraper log export bundle',
      content: {
        'application/json': {
          schema: bundleSchema,
        },
      },
    },
  },
});

scraper.openapi(loggingExportRoute, (c) => jsonSuccess(c, scraperLogger.bundle()));

export default scraper;
