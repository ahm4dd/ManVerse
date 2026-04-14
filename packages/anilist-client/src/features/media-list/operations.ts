import { requireAccessToken } from '../../client/auth.js';
import type { GraphQLExecutor } from '../../types/httpclient.js';
import { getViewerId } from '../shared/viewer/operations.js';
import { VIEWER_MANGA_LISTS_QUERY } from './queries.js';
import {
  viewerMangaListsDataSchema,
  viewerMangaListsInputSchema,
} from './schemas.js';
import type {
  ViewerMangaListCollection,
  ViewerMangaListsInput,
} from './schemas.js';

export async function getViewerMangaLists(
  executor: GraphQLExecutor,
  accessToken: string,
  input?: ViewerMangaListsInput,
): Promise<ViewerMangaListCollection | null> {
  const requiredAccessToken = requireAccessToken(
    accessToken,
    'The Viewer manga lists operation',
  );
  const parsedInput = viewerMangaListsInputSchema.parse(input ?? {});
  const viewerId = await getViewerId(executor, requiredAccessToken);

  if (viewerId === null) {
    return null;
  }

  const rawData = await executor.req<unknown>({
    query: VIEWER_MANGA_LISTS_QUERY,
    operationName: 'ViewerMangaLists',
    accessToken: requiredAccessToken,
    variables: {
      userId: viewerId,
      chunk: parsedInput.chunk,
      perChunk: parsedInput.perChunk,
    },
  });
  const data = viewerMangaListsDataSchema.parse(rawData);

  return data.MediaListCollection;
}
