/**
 * -----------------------------------------------------------------------------
 * This file exports a single instance of the parsed environment, along with
 * it's DI token for NestJS
 * -----------------------------------------------------------------------------
 * */
import { z } from 'zod';
import * as dotenv from 'dotenv';
import { ANILIST_IDENTITY_SALT_MIN_LENGTH } from '../common/constants/anilist.constants.js';

// Loading .env
dotenv.config(); // You can suppress the logging by passing { quiet: true }

const TRUST_PROXY_HOP_COUNT_PATTERN = /^[1-9]\d*$/;
const BETTER_AUTH_SECRET_MIN_BYTES = 32;
const PLACEHOLDER_BETTER_AUTH_SECRETS = new Set([
  'better-auth-secret',
  'better_auth_secret',
  'changeme',
  'change-me',
  'change_me',
  'default',
  'development',
  'example',
  'password',
  'password123',
  'secret',
  'test',
  'test-secret',
]);
const PRODUCTION_LOCAL_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '[::1]',
]);

const DEFAULT_THROTTLE_GLOBAL_LIMIT = 100;
const DEFAULT_THROTTLE_GLOBAL_TTL_MS = 60_000;
const DEFAULT_THROTTLE_BURST_LIMIT = 10;
const DEFAULT_THROTTLE_BURST_TTL_MS = 1_000;
const DEFAULT_THROTTLE_AUTHENTICATED_READ_LIMIT = 30;
const DEFAULT_THROTTLE_AUTHENTICATED_READ_TTL_MS = 60_000;
const DEFAULT_THROTTLE_SECRET_LIMIT = 10;
const DEFAULT_THROTTLE_SECRET_TTL_MS = 60_000;
const DEFAULT_THROTTLE_AUTH_SENSITIVE_LIMIT = 5;
const DEFAULT_THROTTLE_AUTH_SENSITIVE_TTL_MS = 60_000;

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

function normalizeOptionalString(
  value: string | undefined,
): string | undefined {
  const normalizedValue = value?.trim();

  return normalizedValue ? normalizedValue : undefined;
}

function parsePositiveIntegerEnv(
  value: unknown,
  fieldName: string,
): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new Error(`${fieldName} must be a positive integer.`);
  }

  const normalizedValue =
    typeof value === 'string' ? value.trim() : value.toString().trim();

  if (!normalizedValue) {
    return undefined;
  }

  const parsedValue = Number(normalizedValue);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new Error(`${fieldName} must be a positive integer.`);
  }

  return parsedValue;
}

function createPositiveIntegerSchema(defaultValue: number, fieldName: string) {
  return z
    .union([z.string(), z.number()])
    .optional()
    .transform((value, ctx) => {
      try {
        return parsePositiveIntegerEnv(value, fieldName) ?? defaultValue;
      } catch (error) {
        ctx.addIssue({
          code: 'custom',
          message:
            error instanceof Error
              ? error.message
              : `${fieldName} must be a positive integer.`,
        });

        return z.NEVER;
      }
    });
}

function normalizeRedisUrl(value: string): string {
  const url = new URL(value);

  if (url.search || url.hash) {
    throw new Error('REDIS_URL must not include a query string or hash.');
  }

  if (url.protocol !== 'redis:' && url.protocol !== 'rediss:') {
    throw new Error('REDIS_URL must use the redis:// or rediss:// protocol.');
  }

  return url.toString();
}

function parseTrustProxySetting(
  value: string | undefined,
): boolean | number | undefined {
  const normalizedValue = normalizeOptionalString(value);

  if (!normalizedValue) {
    return undefined;
  }

  if (normalizedValue === 'false') {
    return false;
  }

  if (normalizedValue === 'true') {
    return true;
  }

  if (TRUST_PROXY_HOP_COUNT_PATTERN.test(normalizedValue)) {
    return Number(normalizedValue);
  }

  throw new Error(
    'TRUST_PROXY must be set to true, false, or a positive proxy hop count.',
  );
}

function getDecodedBase64ByteLength(value: string): number {
  return Buffer.from(value, 'base64').byteLength;
}

function isObviousBetterAuthSecretPlaceholder(value: string): boolean {
  const normalizedValue = value.trim().toLowerCase();
  const decodedValue = Buffer.from(value, 'base64')
    .toString('utf8')
    .trim()
    .toLowerCase();

  return (
    PLACEHOLDER_BETTER_AUTH_SECRETS.has(normalizedValue) ||
    PLACEHOLDER_BETTER_AUTH_SECRETS.has(decodedValue)
  );
}

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']),
    PORT: z.coerce.number().min(1).max(65535).optional().default(3000),
    DATABASE_URL: z.url(),
    BETTER_AUTH_SECRET: z
      .string()
      .trim()
      .pipe(z.base64())
      .superRefine((value, ctx) => {
        if (getDecodedBase64ByteLength(value) < BETTER_AUTH_SECRET_MIN_BYTES) {
          ctx.addIssue({
            code: 'custom',
            message: `BETTER_AUTH_SECRET must decode to at least ${BETTER_AUTH_SECRET_MIN_BYTES} bytes.`,
          });
        }

        if (isObviousBetterAuthSecretPlaceholder(value)) {
          ctx.addIssue({
            code: 'custom',
            message:
              'BETTER_AUTH_SECRET must not use an obvious placeholder or default value.',
          });
        }
      }),
    BETTER_AUTH_URL: z
      .url()
      .trim()
      .transform((value, ctx) =>
        normalizeEnvUrl(value, normalizeBetterAuthUrl, ctx),
      ),
    TRUST_PROXY: z
      .string()
      .optional()
      .transform((value, ctx) => {
        try {
          return parseTrustProxySetting(value);
        } catch (error) {
          ctx.addIssue({
            code: 'custom',
            message:
              error instanceof Error
                ? error.message
                : 'Invalid TRUST_PROXY configuration.',
          });

          return z.NEVER;
        }
      }),
    ANILIST_IDENTITY_SALT: z
      .string()
      .optional()
      .transform((value) => normalizeOptionalString(value)),
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
      .pipe(z.array(z.url()))
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
    THROTTLE_STORAGE: z.enum(['memory', 'redis']).optional().default('memory'),
    REDIS_URL: z
      .string()
      .optional()
      .transform((value) => normalizeOptionalString(value))
      .transform((value, ctx) => {
        if (!value) {
          return undefined;
        }

        return normalizeEnvUrl(value, normalizeRedisUrl, ctx);
      }),
    REDIS_THROTTLE_KEY_PREFIX: z
      .string()
      .optional()
      .transform((value) => normalizeOptionalString(value)),
    THROTTLE_GLOBAL_LIMIT: createPositiveIntegerSchema(
      DEFAULT_THROTTLE_GLOBAL_LIMIT,
      'THROTTLE_GLOBAL_LIMIT',
    ),
    THROTTLE_GLOBAL_TTL_MS: createPositiveIntegerSchema(
      DEFAULT_THROTTLE_GLOBAL_TTL_MS,
      'THROTTLE_GLOBAL_TTL_MS',
    ),
    THROTTLE_BURST_LIMIT: createPositiveIntegerSchema(
      DEFAULT_THROTTLE_BURST_LIMIT,
      'THROTTLE_BURST_LIMIT',
    ),
    THROTTLE_BURST_TTL_MS: createPositiveIntegerSchema(
      DEFAULT_THROTTLE_BURST_TTL_MS,
      'THROTTLE_BURST_TTL_MS',
    ),
    THROTTLE_AUTHENTICATED_READ_LIMIT: createPositiveIntegerSchema(
      DEFAULT_THROTTLE_AUTHENTICATED_READ_LIMIT,
      'THROTTLE_AUTHENTICATED_READ_LIMIT',
    ),
    THROTTLE_AUTHENTICATED_READ_TTL_MS: createPositiveIntegerSchema(
      DEFAULT_THROTTLE_AUTHENTICATED_READ_TTL_MS,
      'THROTTLE_AUTHENTICATED_READ_TTL_MS',
    ),
    THROTTLE_SECRET_LIMIT: createPositiveIntegerSchema(
      DEFAULT_THROTTLE_SECRET_LIMIT,
      'THROTTLE_SECRET_LIMIT',
    ),
    THROTTLE_SECRET_TTL_MS: createPositiveIntegerSchema(
      DEFAULT_THROTTLE_SECRET_TTL_MS,
      'THROTTLE_SECRET_TTL_MS',
    ),
    THROTTLE_AUTH_SENSITIVE_LIMIT: createPositiveIntegerSchema(
      DEFAULT_THROTTLE_AUTH_SENSITIVE_LIMIT,
      'THROTTLE_AUTH_SENSITIVE_LIMIT',
    ),
    THROTTLE_AUTH_SENSITIVE_TTL_MS: createPositiveIntegerSchema(
      DEFAULT_THROTTLE_AUTH_SENSITIVE_TTL_MS,
      'THROTTLE_AUTH_SENSITIVE_TTL_MS',
    ),
    PRISMA_LOG_QUERIES: z
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

    if (env.TRUST_PROXY === true) {
      ctx.addIssue({
        code: 'custom',
        path: ['TRUST_PROXY'],
        message:
          'TRUST_PROXY must be false or a positive proxy hop count in production.',
      });
    }

    if (env.THROTTLE_STORAGE === 'redis' && !env.REDIS_URL) {
      ctx.addIssue({
        code: 'custom',
        path: ['REDIS_URL'],
        message:
          'REDIS_URL is required when THROTTLE_STORAGE is set to redis in production.',
      });
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
