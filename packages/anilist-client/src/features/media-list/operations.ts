import { requireAccessToken } from '../../client/auth.js';
import type { GraphQLExecutor } from '../../types/httpclient.js';
import { getViewerId } from '../shared/viewer/operations.js';
import {
  DELETE_MEDIA_LIST_ENTRY_MUTATION,
  SAVE_MEDIA_LIST_ENTRY_MUTATION,
  VIEWER_MANGA_LISTS_QUERY,
} from './queries.js';
import {
  deleteMediaListEntryDataSchema,
  deleteMediaListEntryInputSchema,
  deleteMediaListEntryResultSchema,
  saveMediaListEntryDataSchema,
  saveMediaListEntryInputSchema,
  viewerMangaListsDataSchema,
  viewerMangaListsInputSchema,
} from './schemas.js';
import type {
  DeleteMediaListEntryInput,
  DeleteMediaListEntryResult,
  SaveMediaListEntry,
  SaveMediaListEntryInput,
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

export async function saveMediaListEntry(
  executor: GraphQLExecutor,
  accessToken: string,
  input: SaveMediaListEntryInput,
): Promise<SaveMediaListEntry | null> {
  const requiredAccessToken = requireAccessToken(
    accessToken,
    'The SaveMediaListEntry mutation',
  );
  const parsedInput = saveMediaListEntryInputSchema.parse(input);

  const rawData = await executor.req<unknown>({
    query: SAVE_MEDIA_LIST_ENTRY_MUTATION,
    operationName: 'SaveMediaListEntry',
    accessToken: requiredAccessToken,
    variables: {
      mediaId: parsedInput.mediaId,
      status: parsedInput.status,
      score: parsedInput.score,
      progress: parsedInput.progress,
    },
  });
  const data = saveMediaListEntryDataSchema.parse(rawData);

  return data.SaveMediaListEntry;
}

export async function deleteMediaListEntry(
  executor: GraphQLExecutor,
  accessToken: string,
  input: DeleteMediaListEntryInput,
): Promise<DeleteMediaListEntryResult> {
  const requiredAccessToken = requireAccessToken(
    accessToken,
    'The DeleteMediaListEntry mutation',
  );
  const parsedInput = deleteMediaListEntryInputSchema.parse(input);

  const rawData = await executor.req<unknown>({
    query: DELETE_MEDIA_LIST_ENTRY_MUTATION,
    operationName: 'DeleteMediaListEntry',
    accessToken: requiredAccessToken,
    variables: {
      id: parsedInput.entryId,
    },
  });
  const data = deleteMediaListEntryDataSchema.parse(rawData);

  return deleteMediaListEntryResultSchema.parse({
    entryId: parsedInput.entryId,
    deleted: data.DeleteMediaListEntry.deleted,
  });
}
