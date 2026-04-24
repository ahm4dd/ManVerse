import { createHmac } from 'node:crypto';
import type { ProfileUser } from '@manverse/anilist-client';
import type { OAuth2UserInfo } from 'better-auth';
import type { GenericOAuthConfig } from 'better-auth/plugins/generic-oauth';
import { ANILIST_PROVIDER_ID } from '../common/constants/provider.constants.js';

export const ANILIST_SYNTHETIC_EMAIL_DOMAIN = 'anilist.manverse.local';
export const ANILIST_IDENTITY_SALT_REQUIRED_MESSAGE =
  'ANILIST_IDENTITY_SALT must be configured as a stable, non-empty secret.';
export const ANILIST_IDENTITY_SALT_MIN_LENGTH = 32;

type AnilistOAuthViewer = Pick<ProfileUser, 'id' | 'name' | 'avatar'>;

export type ResolveAnilistOAuthViewer = (
  accessToken: string,
) => Promise<AnilistOAuthViewer | null>;

export type CreateAnilistOAuthProviderConfigOptions = {
  callbackUrl: string;
  clientId: string;
  clientSecret: string;
  identitySalt: string;
  resolveViewer?: ResolveAnilistOAuthViewer;
};

export const anilistAccountOptions = {
  encryptOAuthTokens: true,
  accountLinking: {
    enabled: false,
  },
} as const;

export function requireAnilistIdentitySalt(identitySalt: string): string {
  const normalizedIdentitySalt = identitySalt.trim();

  if (!normalizedIdentitySalt) {
    throw new Error(ANILIST_IDENTITY_SALT_REQUIRED_MESSAGE);
  }

  if (normalizedIdentitySalt.length < ANILIST_IDENTITY_SALT_MIN_LENGTH) {
    throw new Error(
      `ANILIST_IDENTITY_SALT must be at least ${ANILIST_IDENTITY_SALT_MIN_LENGTH} characters long.`,
    );
  }

  return normalizedIdentitySalt;
}

export function buildAnilistSyntheticEmail(input: {
  identitySalt: string;
  viewerId: number | string;
  providerId?: string;
}): string {
  const providerId = input.providerId ?? ANILIST_PROVIDER_ID;
  const viewerId = String(input.viewerId).trim();

  if (!viewerId) {
    throw new Error(
      'AniList viewer id is required to build a synthetic email.',
    );
  }

  const digest = createHmac(
    'sha256',
    requireAnilistIdentitySalt(input.identitySalt),
  )
    .update(`${providerId}:${viewerId}`)
    .digest('hex');

  return `${providerId}-${digest.slice(0, 40)}@${ANILIST_SYNTHETIC_EMAIL_DOMAIN}`;
}

export function mapAnilistViewerToOAuthUserInfo(input: {
  viewer: AnilistOAuthViewer;
  identitySalt: string;
  providerId?: string;
}): OAuth2UserInfo {
  const providerId = input.providerId ?? ANILIST_PROVIDER_ID;

  return {
    id: String(input.viewer.id),
    name: input.viewer.name,
    image: input.viewer.avatar?.large ?? undefined,
    email: buildAnilistSyntheticEmail({
      identitySalt: input.identitySalt,
      viewerId: input.viewer.id,
      providerId,
    }),
    emailVerified: false,
  };
}

export function createAnilistOAuthProviderConfig(
  options: CreateAnilistOAuthProviderConfigOptions,
): GenericOAuthConfig {
  const identitySalt = requireAnilistIdentitySalt(options.identitySalt);

  return {
    responseType: 'code',
    redirectURI: options.callbackUrl,
    authorizationUrl: 'https://anilist.co/api/v2/oauth/authorize',
    authorizationHeaders: {
      Accept: 'application/json',
    },
    tokenUrl: 'https://anilist.co/api/v2/oauth/token',
    clientId: options.clientId,
    clientSecret: options.clientSecret,
    providerId: ANILIST_PROVIDER_ID,
    pkce: true,
    getUserInfo: async (tokens) => {
      if (!tokens.accessToken) {
        throw new Error('AniList did not return an access token.');
      }

      if (!options.resolveViewer) {
        throw new Error('AniList viewer resolver is not configured.');
      }

      const viewer = await options.resolveViewer(tokens.accessToken);

      if (!viewer) {
        return null;
      }

      return mapAnilistViewerToOAuthUserInfo({
        viewer,
        identitySalt,
      });
    },
  };
}
