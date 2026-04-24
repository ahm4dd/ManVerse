import { faker } from '@faker-js/faker';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  HTTPClientGraphQLError,
  HTTPClientInvalidJSONError,
  HTTPClientResponseError,
} from '@manverse/anilist-client';
import { ANILIST_PROVIDER_ID } from '../common/constants/provider.constants.js';
import {
  ANILIST_SYNTHETIC_EMAIL_DOMAIN,
  anilistAccountOptions,
  buildAnilistSyntheticEmail,
  createAnilistOAuthProviderConfig,
} from './anilist-oauth.js';
import {
  ANILIST_IDENTITY_SALT_MIN_LENGTH,
  ANILIST_IDENTITY_SALT_REQUIRED_MESSAGE,
} from '../common/constants/anilist.constants.js';

describe('AniList OAuth helpers', () => {
  const longIdentitySalt = Buffer.from(
    'anilist-identity-salt-that-is-definitely-long-enough',
  ).toString('base64');

  beforeEach(() => {
    faker.seed(42);
    vi.clearAllMocks();
  });

  it('builds a deterministic opaque synthetic email for the same AniList viewer id', () => {
    const identitySalt = longIdentitySalt;
    const viewerId = 7_407_199;

    const firstEmail = buildAnilistSyntheticEmail({
      identitySalt,
      viewerId,
    });
    const secondEmail = buildAnilistSyntheticEmail({
      identitySalt,
      viewerId,
    });

    expect(firstEmail).toBe(secondEmail);
    expect(firstEmail).toContain(`@${ANILIST_SYNTHETIC_EMAIL_DOMAIN}`);
    expect(firstEmail).not.toContain(String(viewerId));
  });

  it('keeps the synthetic email stable when the identity salt is fixed and Better Auth secrets rotate', () => {
    const identitySalt = longIdentitySalt;
    const viewerId = 7_407_199;
    const oldBetterAuthSecret = Buffer.from('old-better-auth-secret').toString(
      'base64',
    );
    const newBetterAuthSecret = Buffer.from('new-better-auth-secret').toString(
      'base64',
    );

    const emailBeforeSecretRotation = buildAnilistSyntheticEmail({
      identitySalt,
      viewerId,
    });
    const emailAfterSecretRotation = buildAnilistSyntheticEmail({
      identitySalt,
      viewerId,
    });

    expect(oldBetterAuthSecret).not.toBe(newBetterAuthSecret);
    expect(emailBeforeSecretRotation).toBe(emailAfterSecretRotation);
  });

  it('rejects a blank AniList identity salt', () => {
    expect(() =>
      buildAnilistSyntheticEmail({
        identitySalt: '   ',
        viewerId: 7_407_199,
      }),
    ).toThrow(ANILIST_IDENTITY_SALT_REQUIRED_MESSAGE);
  });

  it('rejects an AniList identity salt shorter than the enforced minimum', () => {
    expect(() =>
      buildAnilistSyntheticEmail({
        identitySalt: 'too-short',
        viewerId: 7_407_199,
      }),
    ).toThrow(
      `ANILIST_IDENTITY_SALT must be at least ${ANILIST_IDENTITY_SALT_MIN_LENGTH} characters long.`,
    );
  });

  it('enables OAuth token encryption and disables AniList account linking', () => {
    expect(anilistAccountOptions.encryptOAuthTokens).toBe(true);
    expect(anilistAccountOptions.accountLinking.enabled).toBe(false);
  });

  it('getUserInfo() rejects when AniList does not return an access token', async () => {
    const providerConfig = createAnilistOAuthProviderConfig({
      callbackUrl:
        'https://api.manverse.local/api/auth/oauth2/callback/anilist',
      clientId: 'anilist-client-id',
      clientSecret: 'anilist-client-secret',
      identitySalt: longIdentitySalt,
      resolveViewer: vi.fn(),
    });

    await expect(providerConfig.getUserInfo?.({})).rejects.toThrow(
      'AniList did not return an access token.',
    );
  });

  it('surfaces shared client response errors from the AniList viewer resolver', async () => {
    const providerConfig = createAnilistOAuthProviderConfig({
      callbackUrl:
        'https://api.manverse.local/api/auth/oauth2/callback/anilist',
      clientId: 'anilist-client-id',
      clientSecret: 'anilist-client-secret',
      identitySalt: longIdentitySalt,
      resolveViewer: vi
        .fn()
        .mockRejectedValue(
          new HTTPClientResponseError(
            401,
            'Unauthorized',
            '{"errors":[{"message":"Unauthorized"}]}',
          ),
        ),
    });

    await expect(
      providerConfig.getUserInfo?.({ accessToken: 'viewer-token' }),
    ).rejects.toBeInstanceOf(HTTPClientResponseError);
  });

  it('surfaces shared client JSON parsing errors from the AniList viewer resolver', async () => {
    const providerConfig = createAnilistOAuthProviderConfig({
      callbackUrl:
        'https://api.manverse.local/api/auth/oauth2/callback/anilist',
      clientId: 'anilist-client-id',
      clientSecret: 'anilist-client-secret',
      identitySalt: longIdentitySalt,
      resolveViewer: vi
        .fn()
        .mockRejectedValue(new HTTPClientInvalidJSONError()),
    });

    await expect(
      providerConfig.getUserInfo?.({ accessToken: 'viewer-token' }),
    ).rejects.toBeInstanceOf(HTTPClientInvalidJSONError);
  });

  it('surfaces shared client GraphQL errors from the AniList viewer resolver', async () => {
    const providerConfig = createAnilistOAuthProviderConfig({
      callbackUrl:
        'https://api.manverse.local/api/auth/oauth2/callback/anilist',
      clientId: 'anilist-client-id',
      clientSecret: 'anilist-client-secret',
      identitySalt: longIdentitySalt,
      resolveViewer: vi
        .fn()
        .mockRejectedValue(
          new HTTPClientGraphQLError([{ message: 'Forbidden' }]),
        ),
    });

    await expect(
      providerConfig.getUserInfo?.({ accessToken: 'viewer-token' }),
    ).rejects.toBeInstanceOf(HTTPClientGraphQLError);
  });

  it('getUserInfo() returns null when AniList resolves no authenticated viewer', async () => {
    const providerConfig = createAnilistOAuthProviderConfig({
      callbackUrl:
        'https://api.manverse.local/api/auth/oauth2/callback/anilist',
      clientId: 'anilist-client-id',
      clientSecret: 'anilist-client-secret',
      identitySalt: longIdentitySalt,
      resolveViewer: vi.fn().mockResolvedValue(null),
    });

    await expect(
      providerConfig.getUserInfo?.({ accessToken: 'viewer-token' }),
    ).resolves.toBeNull();
  });

  it('getUserInfo() maps the AniList viewer to an opaque OAuth user', async () => {
    const identitySalt = longIdentitySalt;
    const providerConfig = createAnilistOAuthProviderConfig({
      callbackUrl:
        'https://api.manverse.local/api/auth/oauth2/callback/anilist',
      clientId: 'anilist-client-id',
      clientSecret: 'anilist-client-secret',
      identitySalt,
      resolveViewer: vi.fn().mockResolvedValue({
        id: 7_407_199,
        name: 'ahm4dd',
        avatar: {
          large: 'https://example.com/avatar.png',
        },
      }),
    });

    await expect(
      providerConfig.getUserInfo?.({ accessToken: 'viewer-token' }),
    ).resolves.toEqual({
      id: '7407199',
      name: 'ahm4dd',
      image: 'https://example.com/avatar.png',
      email: buildAnilistSyntheticEmail({
        identitySalt,
        viewerId: 7_407_199,
        providerId: ANILIST_PROVIDER_ID,
      }),
      emailVerified: false,
    });
  });
});
