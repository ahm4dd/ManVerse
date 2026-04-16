import { faker } from '@faker-js/faker';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ANILIST_PROVIDER_ID } from '../common/constants/provider.constants.js';
import {
  ANILIST_SYNTHETIC_EMAIL_DOMAIN,
  anilistAccountOptions,
  buildAnilistSyntheticEmail,
  createAnilistOAuthProviderConfig,
  fetchAnilistOAuthViewer,
} from './anilist-oauth.js';

describe('AniList OAuth helpers', () => {
  beforeEach(() => {
    faker.seed(42);
    vi.clearAllMocks();
  });

  it('builds a deterministic opaque synthetic email for the same AniList viewer id', () => {
    const secret = Buffer.from('anilist-secret').toString('base64');
    const viewerId = 7_407_199;

    const firstEmail = buildAnilistSyntheticEmail({
      secret,
      viewerId,
    });
    const secondEmail = buildAnilistSyntheticEmail({
      secret,
      viewerId,
    });

    expect(firstEmail).toBe(secondEmail);
    expect(firstEmail).toContain(`@${ANILIST_SYNTHETIC_EMAIL_DOMAIN}`);
    expect(firstEmail).not.toContain(String(viewerId));
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
      secret: Buffer.from('another-secret').toString('base64'),
      resolveViewer: vi.fn(),
    });

    await expect(providerConfig.getUserInfo?.({})).rejects.toThrow(
      'AniList did not return an access token.',
    );
  });

  it('throws when AniList returns a non-ok response body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: () =>
        Promise.resolve(
          JSON.stringify({ errors: [{ message: 'Unauthorized' }] }),
        ),
    });

    await expect(
      fetchAnilistOAuthViewer('viewer-token', fetchMock as typeof fetch),
    ).rejects.toThrow(JSON.stringify([{ message: 'Unauthorized' }]));
  });

  it('throws when AniList returns invalid JSON for the viewer payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: () => Promise.resolve('{invalid-json'),
    });

    await expect(
      fetchAnilistOAuthViewer('viewer-token', fetchMock as typeof fetch),
    ).rejects.toThrow(
      'AniList returned invalid JSON while loading the viewer.',
    );
  });

  it('throws when AniList returns GraphQL errors in the viewer payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: () =>
        Promise.resolve(JSON.stringify({ errors: [{ message: 'Forbidden' }] })),
    });

    await expect(
      fetchAnilistOAuthViewer('viewer-token', fetchMock as typeof fetch),
    ).rejects.toThrow(JSON.stringify([{ message: 'Forbidden' }]));
  });

  it('getUserInfo() returns null when AniList resolves no authenticated viewer', async () => {
    const providerConfig = createAnilistOAuthProviderConfig({
      callbackUrl:
        'https://api.manverse.local/api/auth/oauth2/callback/anilist',
      clientId: 'anilist-client-id',
      clientSecret: 'anilist-client-secret',
      secret: Buffer.from('viewer-secret').toString('base64'),
      resolveViewer: vi.fn().mockResolvedValue(null),
    });

    await expect(
      providerConfig.getUserInfo?.({ accessToken: 'viewer-token' }),
    ).resolves.toBeNull();
  });

  it('getUserInfo() maps the AniList viewer to an opaque OAuth user', async () => {
    const secret = Buffer.from('opaque-secret').toString('base64');
    const providerConfig = createAnilistOAuthProviderConfig({
      callbackUrl:
        'https://api.manverse.local/api/auth/oauth2/callback/anilist',
      clientId: 'anilist-client-id',
      clientSecret: 'anilist-client-secret',
      secret,
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
        secret,
        viewerId: 7_407_199,
        providerId: ANILIST_PROVIDER_ID,
      }),
      emailVerified: false,
    });
  });
});
