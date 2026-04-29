export const PROVIDER_IDS = {
  anilist: 'anilist',
} as const;

export type ProviderId = (typeof PROVIDER_IDS)[keyof typeof PROVIDER_IDS];

export const ANILIST_PROVIDER_ID = PROVIDER_IDS.anilist;
