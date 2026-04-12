import { vi } from 'vitest';

import type { GraphQLExecutor } from '../types/httpclient.js';

export type MockGraphQLExecutor = GraphQLExecutor & {
  req: ReturnType<typeof vi.fn>;
};

export function createMockGraphQLExecutor(): MockGraphQLExecutor {
  return {
    req: vi.fn(),
  } as MockGraphQLExecutor;
}
