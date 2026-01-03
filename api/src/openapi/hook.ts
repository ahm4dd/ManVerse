import type { Hook } from '@hono/zod-openapi';
import { jsonError } from '../utils/response.ts';

export const openApiHook: Hook<any, any, any, any> = (result, c) => {
  if (result.success) {
    return;
  }

  return jsonError(
    c,
    {
      code: 'REQUEST_VALIDATION_FAILED',
      message: 'Request validation failed',
      details: result.error.flatten(),
    },
    400,
  );
};
