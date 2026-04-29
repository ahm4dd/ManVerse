import { AnilistClientAuthError } from './errors.js';

export function requireAccessToken(
  accessToken?: string,
  operationName: string = 'This AniList operation',
): string {
  const normalizedAccessToken = accessToken?.trim();

  if (!normalizedAccessToken) {
    throw new AnilistClientAuthError(
      `${operationName} requires an AniList access token`,
    );
  }

  return normalizedAccessToken;
}
