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

const ANILIST_IDENTITY_SALT_MIN_LENGTH = 32;
const PRODUCTION_LOCAL_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '[::1]',
]);

function normalizeBetterAuthUrl(value: string): string {
  const url = new URL(value);

  if (url.username || url.password) {
    throw new Error('BETTER_AUTH_URL must not include credentials.');
  }

  if (url.search || url.hash) {
    throw new Error('BETTER_AUTH_URL must not include a query string or hash.');
  }

  return url.pathname === '/' ? url.origin : url.toString().replace(/\/$/, '');
}

function normalizeTrustedOrigin(value: string): string {
  const url = new URL(value);

  if (url.username || url.password) {
    throw new Error('TRUSTED_ORIGINS entries must not include credentials.');
  }

  if (url.pathname !== '/' || url.search || url.hash) {
    throw new Error(
      'TRUSTED_ORIGINS entries must be origins only, without paths, query strings, or hashes.',
    );
  }

  return url.origin;
}

function isProductionLocalUrl(value: string): boolean {
  return PRODUCTION_LOCAL_HOSTNAMES.has(new URL(value).hostname.toLowerCase());
}

function normalizeEnvUrl(
  value: string,
  normalizer: (input: string) => string,
  ctx: z.RefinementCtx,
): string | typeof z.NEVER {
  try {
    return normalizer(value);
  } catch (error) {
    ctx.addIssue({
      code: 'custom',
      message:
        error instanceof Error ? error.message : 'Invalid URL configuration.',
    });

    return z.NEVER;
  }
}

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']),
    PORT: z.coerce.number().min(1).max(65535).optional().default(3000),
    DATABASE_URL: z.url(),
    BETTER_AUTH_SECRET: z.base64(),
    BETTER_AUTH_URL: z
      .string()
      .trim()
      .url()
      .transform((value, ctx) =>
        normalizeEnvUrl(value, normalizeBetterAuthUrl, ctx),
      ),
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
      .pipe(z.array(z.string().url()))
      .transform((origins, ctx) => {
        const normalizedOrigins = origins.map((origin) =>
          normalizeEnvUrl(origin, normalizeTrustedOrigin, ctx),
        );

        return [
          ...new Set(normalizedOrigins.filter((origin) => origin !== z.NEVER)),
        ];
      }),
    ANILIST_OAUTH_ENABLED: z
      .enum(['true', 'false'])
      .optional()
      .default('false')
      .transform((value) => value === 'true'),
    ANILIST_CLIENT_ID: z.string().min(1).optional(),
    ANILIST_CLIENT_SECRET: z.string().min(1).optional(),
  })
  .superRefine((env, ctx) => {
    if (env.ANILIST_OAUTH_ENABLED) {
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

      if (!env.ANILIST_IDENTITY_SALT) {
        ctx.addIssue({
          code: 'custom',
          path: ['ANILIST_IDENTITY_SALT'],
          message:
            'ANILIST_IDENTITY_SALT is required when ANILIST_OAUTH_ENABLED is true. Keep it stable and distinct from BETTER_AUTH_SECRET.',
        });
      } else if (
        env.ANILIST_IDENTITY_SALT.length < ANILIST_IDENTITY_SALT_MIN_LENGTH
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['ANILIST_IDENTITY_SALT'],
          message: `ANILIST_IDENTITY_SALT must be at least ${ANILIST_IDENTITY_SALT_MIN_LENGTH} characters long.`,
        });
      } else if (env.ANILIST_IDENTITY_SALT === env.BETTER_AUTH_SECRET) {
        ctx.addIssue({
          code: 'custom',
          path: ['ANILIST_IDENTITY_SALT'],
          message:
            'ANILIST_IDENTITY_SALT must be distinct from BETTER_AUTH_SECRET.',
        });
      }
    }

    if (env.NODE_ENV !== 'production') {
      return;
    }

    const betterAuthUrl = new URL(env.BETTER_AUTH_URL);
    const trustedOriginSet = new Set(env.TRUSTED_ORIGINS);

    if (betterAuthUrl.protocol !== 'https:') {
      ctx.addIssue({
        code: 'custom',
        path: ['BETTER_AUTH_URL'],
        message: 'BETTER_AUTH_URL must use https in production.',
      });
    }

    if (isProductionLocalUrl(env.BETTER_AUTH_URL)) {
      ctx.addIssue({
        code: 'custom',
        path: ['BETTER_AUTH_URL'],
        message:
          'BETTER_AUTH_URL must not point to localhost or a loopback address in production.',
      });
    }

    if (env.TRUSTED_ORIGINS.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['TRUSTED_ORIGINS'],
        message:
          'TRUSTED_ORIGINS must include at least the production app origin.',
      });
    }

    for (const [index, origin] of env.TRUSTED_ORIGINS.entries()) {
      const parsedOrigin = new URL(origin);

      if (parsedOrigin.protocol !== 'https:') {
        ctx.addIssue({
          code: 'custom',
          path: ['TRUSTED_ORIGINS', index],
          message: 'TRUSTED_ORIGINS entries must use https in production.',
        });
      }

      if (isProductionLocalUrl(origin)) {
        ctx.addIssue({
          code: 'custom',
          path: ['TRUSTED_ORIGINS', index],
          message:
            'TRUSTED_ORIGINS entries must not use localhost or loopback addresses in production.',
        });
      }
    }

    if (!trustedOriginSet.has(betterAuthUrl.origin)) {
      ctx.addIssue({
        code: 'custom',
        path: ['TRUSTED_ORIGINS'],
        message:
          'TRUSTED_ORIGINS must include the BETTER_AUTH_URL origin in production.',
      });
    }
  });

export type EnvironmentVariables = z.infer<typeof envSchema>;

export function parseEnvironmentVariables(
  rawEnv: NodeJS.ProcessEnv,
): EnvironmentVariables {
  return envSchema.parse(rawEnv);
}

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error('Invalid environment variables.', z.treeifyError(result.error));
  process.exit(1);
}

export const env = result.data;
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
