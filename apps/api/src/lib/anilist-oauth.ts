import { createHmac } from 'node:crypto';
import type { OAuth2UserInfo } from 'better-auth';
import type { GenericOAuthConfig } from 'better-auth/plugins/generic-oauth';
import { ANILIST_PROVIDER_ID } from '../common/constants/provider.constants.js';

const ANILIST_GRAPHQL_ENDPOINT = 'https://graphql.anilist.co';
const ANILIST_VIEWER_QUERY = `
  query Viewer {
    Viewer {
      id
      name
      avatar {
        large
      }
    }
  }
`;

export const ANILIST_SYNTHETIC_EMAIL_DOMAIN = 'anilist.manverse.local';
export const ANILIST_ACCOUNT_NOT_LINKED_MESSAGE =
  'AniList account is not linked for the current user';
export const ANILIST_RELINK_REQUIRED_MESSAGE =
  'AniList access token could not be retrieved for the current user. Please relink your AniList account.';

type AnilistOAuthViewer = {
  id: number;
  name: string;
  avatar?: {
    large?: string | null;
  } | null;
};

type AnilistViewerPayload = {
  data?: {
    Viewer?: AnilistOAuthViewer | null;
  };
  errors?: unknown;
};

export type ResolveAnilistOAuthViewer = (
  accessToken: string,
) => Promise<AnilistOAuthViewer | null>;

export type CreateAnilistOAuthProviderConfigOptions = {
  callbackUrl: string;
  clientId: string;
  clientSecret: string;
  secret: string;
  fetchImpl?: typeof fetch;
  resolveViewer?: ResolveAnilistOAuthViewer;
};

export const anilistAccountOptions = {
  encryptOAuthTokens: true,
  accountLinking: {
    enabled: false,
  },
} as const;

function parseAnilistViewerPayload(rawPayload: string): AnilistViewerPayload {
  if (!rawPayload) {
    return {};
  }

  try {
    return JSON.parse(rawPayload) as AnilistViewerPayload;
  } catch {
    throw new Error('AniList returned invalid JSON while loading the viewer.');
  }
}

export function buildAnilistSyntheticEmail(input: {
  secret: string;
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

  const digest = createHmac('sha256', input.secret)
    .update(`${providerId}:${viewerId}`)
    .digest('hex');

  return `${providerId}-${digest.slice(0, 40)}@${ANILIST_SYNTHETIC_EMAIL_DOMAIN}`;
}

export function mapAnilistViewerToOAuthUserInfo(input: {
  viewer: AnilistOAuthViewer;
  secret: string;
  providerId?: string;
}): OAuth2UserInfo {
  const providerId = input.providerId ?? ANILIST_PROVIDER_ID;

  return {
    id: String(input.viewer.id),
    name: input.viewer.name,
    image: input.viewer.avatar?.large ?? undefined,
    email: buildAnilistSyntheticEmail({
      secret: input.secret,
      viewerId: input.viewer.id,
      providerId,
    }),
    emailVerified: false,
  };
}

export async function fetchAnilistOAuthViewer(
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<AnilistOAuthViewer | null> {
  const normalizedAccessToken = accessToken.trim();

  if (!normalizedAccessToken) {
    throw new Error('AniList did not return an access token.');
  }

  const response = await fetchImpl(ANILIST_GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${normalizedAccessToken}`,
    },
    body: JSON.stringify({
      query: ANILIST_VIEWER_QUERY,
      operationName: 'Viewer',
    }),
  });

  const payload = parseAnilistViewerPayload(await response.text());

  if (!response.ok) {
    throw new Error(
      JSON.stringify(
        payload.errors ?? {
          status: response.status,
          statusText: response.statusText,
        },
      ),
    );
  }

  if (payload.errors) {
    throw new Error(JSON.stringify(payload.errors));
  }

  return payload.data?.Viewer ?? null;
}

export function createAnilistOAuthProviderConfig(
  options: CreateAnilistOAuthProviderConfigOptions,
): GenericOAuthConfig {
  const resolveViewer =
    options.resolveViewer ??
    ((accessToken: string) =>
      fetchAnilistOAuthViewer(accessToken, options.fetchImpl));

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

      const viewer = await resolveViewer(tokens.accessToken);

      if (!viewer) {
        return null;
      }

      return mapAnilistViewerToOAuthUserInfo({
        viewer,
        secret: options.secret,
      });
    },
  };
}
