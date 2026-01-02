import { z } from 'zod';
import type { Context } from 'hono';
import type { HonoEnv } from '../types/api.ts';

export class ValidationError extends Error {
  constructor(public issues: z.ZodIssue[]) {
    super('Request validation failed');
    this.name = 'ValidationError';
  }
}

export function parseQuery<T extends z.ZodTypeAny>(
  c: Context<HonoEnv>,
  schema: T,
): z.infer<T> {
  const result = schema.safeParse(c.req.query());
  if (!result.success) {
    throw new ValidationError(result.error.issues);
  }

  return result.data;
}

export async function parseJson<T extends z.ZodTypeAny>(
  c: Context<HonoEnv>,
  schema: T,
): Promise<z.infer<T>> {
  const body = await c.req.json();
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ValidationError(result.error.issues);
  }

  return result.data;
}
