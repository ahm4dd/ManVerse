export const Providers = {
  AsuraScans: 'AsuraScans',
} as const;

export type ProviderType = (typeof Providers)[keyof typeof Providers];

export const ImageExtensions = {
  JPG: '.jpg',
  PNG: '.png',
  WEBP: '.webp',
} as const;
