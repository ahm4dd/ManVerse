import { requireAccessToken } from '../../../client/auth.js';
import type { GraphQLExecutor } from '../../../types/httpclient.js';
import { VIEWER_ID_QUERY } from './queries.js';
import { viewerIdDataSchema } from './schemas.js';

export async function getViewerId(
  executor: GraphQLExecutor,
  accessToken: string,
): Promise<number | null> {
  const requiredAccessToken = requireAccessToken(
    accessToken,
    'The Viewer id operation',
  );

  const rawData = await executor.req<unknown>({
    query: VIEWER_ID_QUERY,
    operationName: 'ViewerId',
    accessToken: requiredAccessToken,
  });
  const data = viewerIdDataSchema.parse(rawData);

  return data.Viewer?.id ?? null;
}
