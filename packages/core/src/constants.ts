export const Providers = {
  AsuraScans: 'AsuraScans',
} as const;

export type ProviderType = (typeof Providers)[keyof typeof Providers];

export type ProviderInfo = {
  id: ProviderType;
  label: string;
  shortLabel: string;
  apiSource: string;
};

export const ProviderMetadata: Record<ProviderType, ProviderInfo> = {
  [Providers.AsuraScans]: {
    id: Providers.AsuraScans,
    label: 'Asura Scans',
    shortLabel: 'Asura',
    apiSource: 'asura',
  },
};

export const ProviderList = Object.values(ProviderMetadata);

export const ImageExtensions = {
  JPG: '.jpg',
  PNG: '.png',
  WEBP: '.webp',
} as const;
