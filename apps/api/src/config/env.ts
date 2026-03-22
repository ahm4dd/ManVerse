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

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().min(1).max(65535).optional().default(3000),
  DATABASE_URL: z.url(),
  BETTER_AUTH_SECRET: z.base64(),
  BETTER_AUTH_URL: z.string().min(1),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error('Invalid environment variables.', z.treeifyError(result.error));
  process.exit(1);
}

export const env = result.data;

export type EnvironmentVariables = z.infer<typeof envSchema>;
export const ENV_TOKEN = Symbol('ENV');
