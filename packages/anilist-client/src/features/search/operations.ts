import type { GraphQLExecutor } from '../../types/httpclient.js';
import { SEARCH_MEDIA_QUERY } from './queries.js';
import { searchMediaDataSchema, searchMediaInputSchema } from './schemas.js';
import type {
  ResolvedSearchMediaInput,
  SearchMediaInput,
  SearchMediaPage,
} from './schemas.js';

export async function searchMedia(
  executor: GraphQLExecutor,
  input: SearchMediaInput,
): Promise<SearchMediaPage | null> {
  const parsedInput: ResolvedSearchMediaInput =
    searchMediaInputSchema.parse(input);

  const rawData = await executor.req<unknown>({
    query: SEARCH_MEDIA_QUERY,
    operationName: 'SearchMedia',
    variables: {
      search: parsedInput.search,
      page: parsedInput.page,
      perPage: parsedInput.perPage,
      isAdult: parsedInput.isAdult,
    },
  });
  const data = searchMediaDataSchema.parse(rawData);

  return data.Page;
}
