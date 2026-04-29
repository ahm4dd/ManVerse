export { AnilistClient } from './src/client/client.js';
export {
  AnilistClientAuthError,
  HTTPClientAbortError,
  HTTPClientError,
  HTTPClientGraphQLError,
  HTTPClientInvalidJSONError,
  HTTPClientMissingDataError,
  HTTPClientResponseError,
  HTTPClientTimeoutError,
  HTTPClientTransportError,
} from './src/client/errors.js';
export {
  DELETE_MEDIA_LIST_ENTRY_MUTATION,
  deleteMediaListEntry,
  deleteMediaListEntryDataSchema,
  deleteMediaListEntryInputSchema,
  deleteMediaListEntryMutationSchema,
  deleteMediaListEntryResultSchema,
  SAVE_MEDIA_LIST_ENTRY_MUTATION,
  saveMediaListEntry,
  saveMediaListEntryDataSchema,
  saveMediaListEntryInputSchema,
  saveMediaListEntryMediaSchema,
  saveMediaListEntrySchema,
  saveMediaListEntryStatusSchema,
  viewerMangaListCollectionSchema,
} from './src/features/media-list/index.js';
export { profileUserSchema } from './src/features/profile/schemas.js';
export { searchMediaPageSchema } from './src/features/search/schemas.js';
export {
  TOGGLE_FAVOURITE_MUTATION,
  toggleFavourite,
  toggleFavouriteDataSchema,
  toggleFavouriteInputSchema,
  toggleFavouriteMangaConnectionSchema,
  toggleFavouriteMediaSchema,
  toggleFavouriteMediaTitleSchema,
  toggleFavouritePayloadSchema,
  toggleFavouriteResultSchema,
} from './src/features/toggle-favourite/index.js';
export type { AnilistClientConfig } from './src/types/client.js';
export type {
  DeleteMediaListEntryData,
  DeleteMediaListEntryInput,
  DeleteMediaListEntryMutation,
  DeleteMediaListEntryResult,
  SaveMediaListEntry,
  SaveMediaListEntryData,
  SaveMediaListEntryInput,
  SaveMediaListEntryMedia,
  SaveMediaListEntryStatus,
  ViewerMangaListCollection,
} from './src/features/media-list/index.js';
export type { AnilistClientLogger } from './src/types/logger.js';
export type { ProfileUser } from './src/features/profile/schemas.js';
export type { SearchMediaPage } from './src/features/search/schemas.js';
export type {
  ToggleFavouriteData,
  ToggleFavouriteInput,
  ToggleFavouriteMangaConnection,
  ToggleFavouriteMedia,
  ToggleFavouriteMediaTitle,
  ToggleFavouritePayload,
  ToggleFavouriteResult,
} from './src/features/toggle-favourite/index.js';
