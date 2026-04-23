import { AuthEnv } from 'src/config/env.js';
import { afterEach, describe, expect, it, vi } from 'vitest';

type BetterAuthConfig = {
  account?: unknown;
  plugins?: unknown[];
};

async function loadAuthModule(envOverrides: Partial<AuthEnv> = {}) {
  vi.resetModules();

  const env: AuthEnv = {
    NODE_ENV: 'test',
    BETTER_AUTH_URL: 'https://api.manverse.local',
    BETTER_AUTH_SECRET: 'better-auth-secret',
    TRUSTED_ORIGINS: ['http://localhost:3000'],
    ANILIST_OAUTH_ENABLED: true,
    ANILIST_CLIENT_ID: 'anilist-client-id',
    ANILIST_CLIENT_SECRET: 'anilist-client-secret',
    ANILIST_IDENTITY_SALT: undefined,
    ...envOverrides,
  };

  const betterAuthMock = vi.fn((config: BetterAuthConfig) => config);
  const openApiPlugin = { plugin: 'openAPI' };
  const testUtilsPlugin = { plugin: 'testUtils' };
  const genericOAuthPlugin = { plugin: 'genericOAuth' };
  const openAPIMock = vi.fn(() => openApiPlugin);
  const testUtilsMock = vi.fn(() => testUtilsPlugin);
  const genericOAuthMock = vi.fn(() => genericOAuthPlugin);
  const prismaAdapterMock = vi.fn(() => ({ adapter: 'prisma' }));
  const accountOptions = { encryptOAuthTokens: true };
  const providerConfig = { providerId: 'anilist' };
  const createAnilistOAuthProviderConfigMock = vi.fn(() => providerConfig);
  const getViewerProfile = vi.fn();
  const AnilistClientMock = vi.fn(() => ({ getViewerProfile }));

  vi.doMock('../config/env.js', () => ({ env }));
  vi.doMock('better-auth', () => ({ betterAuth: betterAuthMock }));
  vi.doMock('better-auth/plugins', () => ({
    openAPI: openAPIMock,
    testUtils: testUtilsMock,
  }));
  vi.doMock('better-auth/plugins/generic-oauth', () => ({
    genericOAuth: genericOAuthMock,
  }));
  vi.doMock('better-auth/adapters/prisma', () => ({
    prismaAdapter: prismaAdapterMock,
  }));
  vi.doMock('../infrastructure/database/prisma/prisma.js', () => ({
    prisma: { client: 'prisma' },
  }));
  vi.doMock('@manverse/anilist-client', () => ({
    AnilistClient: AnilistClientMock,
  }));
  vi.doMock('./anilist-oauth.js', () => ({
    anilistAccountOptions: accountOptions,
    createAnilistOAuthProviderConfig: createAnilistOAuthProviderConfigMock,
  }));

  const authModule = await import('./auth.js');

  return {
    authModule,
    betterAuthMock,
    openAPIMock,
    testUtilsMock,
    genericOAuthMock,
    prismaAdapterMock,
    createAnilistOAuthProviderConfigMock,
    AnilistClientMock,
    getViewerProfile,
    accountOptions,
    providerConfig,
    openApiPlugin,
    testUtilsPlugin,
    genericOAuthPlugin,
  };
}

describe('auth configuration', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('wires the AniList OAuth provider into Better Auth when OAuth is enabled', async () => {
    const {
      betterAuthMock,
      openAPIMock,
      testUtilsMock,
      genericOAuthMock,
      createAnilistOAuthProviderConfigMock,
      AnilistClientMock,
      getViewerProfile,
      accountOptions,
      providerConfig,
      openApiPlugin,
      testUtilsPlugin,
      genericOAuthPlugin,
    } = await loadAuthModule();

    expect(AnilistClientMock).toHaveBeenCalledTimes(1);
    expect(createAnilistOAuthProviderConfigMock).toHaveBeenCalledWith({
      callbackUrl:
        'https://api.manverse.local/api/auth/oauth2/callback/anilist',
      clientId: 'anilist-client-id',
      clientSecret: 'anilist-client-secret',
      identitySalt: 'better-auth-secret',
      resolveViewer: expect.any(Function),
    });
    expect(genericOAuthMock).toHaveBeenCalledWith({
      config: [providerConfig],
    });
    expect(openAPIMock).toHaveBeenCalledWith({ path: 'reference' });
    expect(testUtilsMock).toHaveBeenCalledTimes(1);

    const authConfig = betterAuthMock.mock.calls[0]?.[0];
    expect(authConfig.account).toBe(accountOptions);
    expect(authConfig.plugins).toEqual([
      openApiPlugin,
      genericOAuthPlugin,
      testUtilsPlugin,
    ]);

    const providerOptions = (
      createAnilistOAuthProviderConfigMock.mock.calls as unknown as Array<
        [unknown]
      >
    ).at(0)?.[0] as
      | { resolveViewer?: (accessToken: string) => Promise<unknown> }
      | undefined;

    expect(providerOptions).toBeDefined();

    const resolveViewer = providerOptions?.resolveViewer;

    expect(resolveViewer).toBeTypeOf('function');

    await resolveViewer?.('viewer-token');

    expect(getViewerProfile).toHaveBeenCalledWith('viewer-token');
  });

  it('omits the AniList OAuth provider when OAuth is disabled', async () => {
    const {
      betterAuthMock,
      genericOAuthMock,
      createAnilistOAuthProviderConfigMock,
      openApiPlugin,
      testUtilsPlugin,
    } = await loadAuthModule({
      ANILIST_OAUTH_ENABLED: false,
      ANILIST_CLIENT_ID: undefined,
      ANILIST_CLIENT_SECRET: undefined,
    });

    expect(createAnilistOAuthProviderConfigMock).not.toHaveBeenCalled();
    expect(genericOAuthMock).not.toHaveBeenCalled();

    const authConfig = betterAuthMock.mock.calls[0]?.[0];
    expect(authConfig.plugins).toEqual([openApiPlugin, testUtilsPlugin]);
  });
});
