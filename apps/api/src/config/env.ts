/**
 * -----------------------------------------------------------------------------
 * This file exports a single instance of the parsed environment, along with
 * it's DI token for NestJS
 * -----------------------------------------------------------------------------
 * */
import 'reflect-metadata';
import {
  IsBase64,
  IsEnum,
  IsPort,
  IsString,
  MinLength,
  validateSync,
} from 'class-validator';
import { plainToInstance } from 'class-transformer';
import * as dotenv from 'dotenv';

// Loading .env
dotenv.config(); // You can suppress the logging by passing { quiet: true }

export const ENV_TOKEN = Symbol('ENV');

class EnvironmentVariables {
  // TODO: change all urls to use IsURL or IsUrl decorator
  NODE_ENV!: 'development' | 'test' | 'production';

  PORT?: string; // @IsPort() expects a string
  DATABASE_URL!: string;

  // Better-auth related variables
  BETTER_AUTH_SECRET!: string;
  BETTER_AUTH_URL!: string;
}

/**
 * Manually applying decorators to the protoype.
 * This is exactly what @Decorator does, but in a syntax that every
 * JavaScript transpiler (including jiti for better-auth) understands
 */
IsEnum(['development', 'test', 'production'])(
  EnvironmentVariables.prototype,
  'NODE_ENV',
);
IsPort()(EnvironmentVariables.prototype, 'PORT');
MinLength(1)(EnvironmentVariables.prototype, 'DATABASE_URL');
IsBase64({ urlSafe: false })(
  EnvironmentVariables.prototype,
  'BETTER_AUTH_SECRET',
);
IsString()(EnvironmentVariables.prototype, 'BETTER_AUTH_URL');

/**
 * Validation Logic for process.env
 */
function parseEnv(): EnvironmentVariables {
  const config = plainToInstance(EnvironmentVariables, process.env);

  const errors = validateSync(config, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(`Environment validation failed: ${errors.toString()}`);
  }

  return config;
}

export const env = parseEnv();
