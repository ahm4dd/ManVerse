import { beforeEach, describe, expect, it } from 'vitest';
import { ZodError } from 'zod';

import { AnilistClientAuthError } from '../../../client/errors.js';
import {
  createMockGraphQLExecutor,
  type MockGraphQLExecutor,
} from '../../../test-utils/graphql-executor.mock.js';
import { getViewerId } from './operations.js';
import { VIEWER_ID_QUERY } from './queries.js';

describe('shared viewer operations', () => {
  let executor: MockGraphQLExecutor;

  beforeEach(() => {
    executor = createMockGraphQLExecutor();
  });

  it('should request and return the authenticated viewer id', async () => {
    executor.req.mockResolvedValue({
      Viewer: {
        id: 42,
      },
    });

    const result = await getViewerId(executor, 'viewer-token');

    expect(executor.req).toHaveBeenCalledTimes(1);
    expect(executor.req).toHaveBeenCalledWith({
      query: VIEWER_ID_QUERY,
      operationName: 'ViewerId',
      accessToken: 'viewer-token',
    });
    expect(result).toBe(42);
  });

  it('should return null when AniList returns no authenticated viewer', async () => {
    executor.req.mockResolvedValue({
      Viewer: null,
    });

    const result = await getViewerId(executor, 'viewer-token');

    expect(result).toBeNull();
  });

  it('should reject missing viewer access token before calling the executor', async () => {
    await expect(getViewerId(executor, '')).rejects.toBeInstanceOf(
      AnilistClientAuthError,
    );

    expect(executor.req).not.toHaveBeenCalled();
  });

  it('should reject an invalid viewer payload', async () => {
    executor.req.mockResolvedValue({
      Viewer: {
        id: 'not-a-number',
      },
    });

    await expect(getViewerId(executor, 'viewer-token')).rejects.toBeInstanceOf(
      ZodError,
    );
  });
});
