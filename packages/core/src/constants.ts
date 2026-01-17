export const Providers = {
  AsuraScans: 'AsuraScans',
  Toonily: 'Toonily',
  MangaGG: 'MangaGG',
  MangaFire: 'MangaFire',
} as const;

export type ProviderType = (typeof Providers)[keyof typeof Providers];

export type ProviderInfo = {
  id: ProviderType;
  label: string;
  shortLabel: string;
  apiSource: string;
  experimental?: boolean;
};

export const ProviderMetadata: Record<ProviderType, ProviderInfo> = {
  [Providers.AsuraScans]: {
    id: Providers.AsuraScans,
    label: 'Asura Scans',
    shortLabel: 'Asura',
    apiSource: 'asura',
  },
  [Providers.Toonily]: {
    id: Providers.Toonily,
    label: 'Toonily',
    shortLabel: 'Toonily',
    apiSource: 'toonily',
    experimental: true,
  },
  [Providers.MangaGG]: {
    id: Providers.MangaGG,
    label: 'MangaGG',
    shortLabel: 'MangaGG',
    apiSource: 'mangagg',
  },
  [Providers.MangaFire]: {
    id: Providers.MangaFire,
    label: 'MangaFire',
    shortLabel: 'MangaFire',
    apiSource: 'mangafire',
  },
};

export const ProviderList = Object.values(ProviderMetadata);
export const StableProviderList = ProviderList.filter((provider) => !provider.experimental);
export const ExperimentalProviderList = ProviderList.filter((provider) => provider.experimental);

export const ImageExtensions = {
  JPG: '.jpg',
  PNG: '.png',
  WEBP: '.webp',
} as const;
