import { Providers, ProviderList, ProviderMetadata, type ProviderType } from '@manverse/core';
import { asuraScansConfig } from '@manverse/scrapers/config';

export type Source = 'AniList' | ProviderType;

export const providerOptions = ProviderList;

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
  return '';
};

export const providerReferer = (provider: ProviderType): string => {
  if (provider === Providers.AsuraScans) {
    return asuraScansConfig.headers?.referer ?? asuraScansConfig.baseUrl;
  }
  return '';
};

export const isProviderSource = (source: Source): source is ProviderType =>
  source !== 'AniList';

export type { ProviderType };
export { Providers };
