/**
 * -----------------------------------------------------------------------------
 * This file exports a single instance of the parsed environment, along with
 * it's DI token for NestJS
 * -----------------------------------------------------------------------------
 * */
import { z } from 'zod';
import * as dotenv from 'dotenv';

// Loading .env
dotenv.config(); // You can suppress the logging by passing { quiet: true }

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']),
    PORT: z.coerce.number().min(1).max(65535).optional().default(3000),
    DATABASE_URL: z.url(),
    BETTER_AUTH_SECRET: z.base64(),
    BETTER_AUTH_URL: z.string().min(1),
    ANILIST_IDENTITY_SALT: z
      .string()
      .optional()
      .transform((value) => {
        const normalizedValue = value?.trim();

        return normalizedValue ? normalizedValue : undefined;
      }),
    TRUSTED_ORIGINS: z
      .string()
      .optional()
      .default('')
      .transform((value) =>
        value
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean),
      )
      .pipe(z.array(z.url())),
    ANILIST_OAUTH_ENABLED: z
      .enum(['true', 'false'])
      .optional()
      .default('false')
      .transform((value) => value === 'true'),
    ANILIST_CLIENT_ID: z.string().min(1).optional(),
    ANILIST_CLIENT_SECRET: z.string().min(1).optional(),
  })
  .superRefine((env, ctx) => {
    if (!env.ANILIST_OAUTH_ENABLED) {
      return;
    }

    if (!env.ANILIST_CLIENT_ID) {
      ctx.addIssue({
        code: 'custom',
        path: ['ANILIST_CLIENT_ID'],
        message:
          'ANILIST_CLIENT_ID is required when ANILIST_OAUTH_ENABLED is true.',
      });
    }

    if (!env.ANILIST_CLIENT_SECRET) {
      ctx.addIssue({
        code: 'custom',
        path: ['ANILIST_CLIENT_SECRET'],
        message:
          'ANILIST_CLIENT_SECRET is required when ANILIST_OAUTH_ENABLED is true.',
      });
    }
  });

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error('Invalid environment variables.', z.treeifyError(result.error));
  process.exit(1);
}

export const env = result.data;

export type EnvironmentVariables = z.infer<typeof envSchema>;
export type AuthEnv = Pick<
  EnvironmentVariables,
  | 'NODE_ENV'
  | 'BETTER_AUTH_URL'
  | 'BETTER_AUTH_SECRET'
  | 'TRUSTED_ORIGINS'
  | 'ANILIST_OAUTH_ENABLED'
  | 'ANILIST_CLIENT_ID'
  | 'ANILIST_CLIENT_SECRET'
  | 'ANILIST_IDENTITY_SALT'
>;
export const ENV_TOKEN = Symbol('ENV');
