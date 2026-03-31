import type { HTTPHeaders } from '../types/httpclient.js';

export const DEFAULT_ANILIST_GRAPHQL_ENDPOINT = 'https://graphql.anilist.co';

export const DEFAULT_HTTP_TIMEOUT_MS = 10_000;

export const DEFAULT_HTTP_HEADERS: Readonly<HTTPHeaders> = Object.freeze({
  Accept: 'application/json',
  'Content-Type': 'application/json',
});
