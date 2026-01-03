import { z } from '@hono/zod-openapi';

export const ApiMetaSchema = z.object({
  timestamp: z.number().int(),
  requestId: z.string(),
});

export const ApiErrorSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
  meta: ApiMetaSchema,
});

export const createApiSuccessSchema = <T extends z.ZodTypeAny>(data: T) =>
  z.object({
    success: z.literal(true),
    data,
    meta: ApiMetaSchema,
  });

export const ApiSuccessUnknownSchema = createApiSuccessSchema(z.unknown());

export const AuthUrlSchema = z.object({
  authUrl: z.string().url(),
});

export const TokenSchema = z.object({
  token: z.string(),
});

export const OkSchema = z.object({
  ok: z.boolean(),
});

export const AuthUserSchema = z
  .object({
    id: z.number().nullable(),
    username: z.string().optional(),
    isGuest: z.boolean().optional(),
    anilistToken: z.string().optional(),
  })
  .passthrough();
