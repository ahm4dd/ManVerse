import {
  Providers,
  ProviderList,
  ProviderMetadata,
  StableProviderList,
  ExperimentalProviderList,
  type ProviderType,
} from '@manverse/core';
import { asuraScansConfig, mangaggConfig, mangafireConfig, toonilyConfig } from '@manverse/scrapers/config';

export type Source = 'AniList' | 'AllProviders' | ProviderType;

export const providerOptions = StableProviderList;
export const experimentalProviderOptions = ExperimentalProviderList;
export const allProviderOptions = ProviderList;

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
