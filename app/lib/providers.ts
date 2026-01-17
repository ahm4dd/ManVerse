import {
  Providers,
  ProviderList,
  ProviderMetadata,
  StableProviderList,
  ExperimentalProviderList,
  type ProviderType,
  type ProviderInfo,
} from '@manverse/core';
import { asuraScansConfig, mangaggConfig, mangafireConfig, toonilyConfig } from '@manverse/scrapers/config';

export type Source = 'AniList' | 'AllProviders' | ProviderType;

const deprecatedProviders = new Set<ProviderType>([Providers.Toonily]);

const filterDeprecatedProviders = <T extends ProviderInfo>(providers: T[]) =>
  providers.filter((provider) => !deprecatedProviders.has(provider.id));

export const providerOptions = filterDeprecatedProviders(StableProviderList);
export const experimentalProviderOptions = filterDeprecatedProviders(ExperimentalProviderList);
export const allProviderOptions = filterDeprecatedProviders(ProviderList);

export const providerApiSource = (provider: ProviderType): string =>
  ProviderMetadata[provider]?.apiSource ?? provider.toLowerCase();

export const providerLabel = (provider: ProviderType): string =>
  ProviderMetadata[provider]?.label ?? provider;

export const providerShortLabel = (provider: ProviderType): string =>
  ProviderMetadata[provider]?.shortLabel ?? provider;

export const providerBaseUrl = (provider: ProviderType): string => {
  if (provider === Providers.AsuraScans) {
    return asuraScansConfig.baseUrl;
  }
  if (provider === Providers.Toonily) {
    return toonilyConfig.baseUrl;
  }
  if (provider === Providers.MangaGG) {
    return mangaggConfig.baseUrl;
  }
  if (provider === Providers.MangaFire) {
    return mangafireConfig.baseUrl;
  }
  return '';
};

export const providerReferer = (provider: ProviderType): string => {
  if (provider === Providers.AsuraScans) {
    return asuraScansConfig.headers?.referer ?? asuraScansConfig.baseUrl;
  }
  if (provider === Providers.Toonily) {
    return toonilyConfig.headers?.referer ?? toonilyConfig.baseUrl;
  }
  if (provider === Providers.MangaGG) {
    return mangaggConfig.headers?.referer ?? mangaggConfig.baseUrl;
  }
  if (provider === Providers.MangaFire) {
    return mangafireConfig.headers?.referer ?? mangafireConfig.baseUrl;
  }
  return '';
};

export const isProviderSource = (source: Source): source is ProviderType =>
  source !== 'AniList' && source !== 'AllProviders';

export type { ProviderType };
export { Providers };
