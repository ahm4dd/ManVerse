import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import type { HonoEnv } from '../types/api.ts';
import { jsonSuccess } from '../utils/response.ts';
import { openApiHook } from '../openapi/hook.ts';
import { createApiSuccessSchema } from '../openapi/schemas.ts';
import { NotifierService } from '../services/notifier-service.ts';

const notifications = new OpenAPIHono<HonoEnv>({ defaultHook: openApiHook });
const notifier = new NotifierService();

const chapterUpdateSchema = z.object({
  anilistId: z.number(),
  provider: z.string(),
  providerId: z.string(),
  providerMangaId: z.number(),
  seriesTitle: z.string().nullable().optional(),
  chapterNumber: z.string(),
  chapterTitle: z.string().nullable().optional(),
  releaseDate: z.string().nullable().optional(),
});

const checkRoute = createRoute({
  method: 'get',
  path: '/chapters',
  tags: ['notifications'],
  responses: {
    200: {
      description: 'Latest chapter updates for reading entries',
      content: {
        'application/json': {
          schema: createApiSuccessSchema(z.array(chapterUpdateSchema)),
        },
      },
    },
  },
});

notifications.openapi(checkRoute, async (c) => {
  const updates = await notifier.checkReadingUpdates();
  return jsonSuccess(c, updates);
});

export default notifications;
