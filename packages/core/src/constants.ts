export const Providers = {
  AsuraScans: 'AsuraScans',
} as const;

export type ProviderType = (typeof Providers)[keyof typeof Providers];
