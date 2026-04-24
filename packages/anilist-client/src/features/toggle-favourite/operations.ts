import { requireAccessToken } from '../../client/auth.js';
import type { GraphQLExecutor } from '../../types/httpclient.js';
import { TOGGLE_FAVOURITE_MUTATION } from './queries.js';
import {
  toggleFavouriteDataSchema,
  toggleFavouriteInputSchema,
  toggleFavouriteResultSchema,
} from './schemas.js';
import type { ToggleFavouriteInput, ToggleFavouriteResult } from './schemas.js';

export async function toggleFavourite(
  executor: GraphQLExecutor,
  accessToken: string,
  input: ToggleFavouriteInput,
): Promise<ToggleFavouriteResult> {
  const requiredAccessToken = requireAccessToken(
    accessToken,
    'The ToggleFavourite mutation',
  );
  const parsedInput = toggleFavouriteInputSchema.parse(input);

  const rawData = await executor.req<unknown>({
    query: TOGGLE_FAVOURITE_MUTATION,
    operationName: 'ToggleFavourite',
    accessToken: requiredAccessToken,
    variables: {
      mangaId: parsedInput.mediaId,
    },
  });
  const data = toggleFavouriteDataSchema.parse(rawData);
  const matchingMedia =
    data.ToggleFavourite.manga?.nodes.find(
      (media) => media.id === parsedInput.mediaId,
    ) ?? null;

  return toggleFavouriteResultSchema.parse({
    mediaId: parsedInput.mediaId,
    isFavourite: matchingMedia !== null,
    media: matchingMedia,
  });
}
