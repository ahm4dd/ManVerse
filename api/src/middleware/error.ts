import { ZodError } from 'zod';
import type { Context } from 'hono';
import type { HonoEnv } from '../types/api.ts';
import { jsonError } from '../utils/response.ts';
import { ValidationError } from '../utils/validation.ts';
import { AniListError } from '@manverse/anilist';

export function handleError(err: Error, c: Context<HonoEnv>) {
  if (err instanceof ValidationError) {
    return jsonError(
      c,
      {
        code: 'VALIDATION_ERROR',
        message: err.message,
        details: err.issues,
      },
      400,
    );
  }

  if (err instanceof ZodError) {
    return jsonError(
      c,
      {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: err.issues,
      },
      400,
    );
  }

  if (err instanceof AniListError) {
    const status = err.statusCode ?? 500;
    return jsonError(
      c,
      {
        code: err.code ?? 'ANILIST_ERROR',
        message: err.message || 'AniList request failed',
      },
      status,
    );
  }

  return jsonError(
    c,
    {
      code: 'INTERNAL_ERROR',
      message: err.message || 'Unexpected error',
    },
    500,
  );
}
