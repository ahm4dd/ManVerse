export const THROTTLE_POLICY_NAMES = [
  'global',
  'burst',
  'authenticatedRead',
  'secret',
  'authSensitive',
] as const;

export type ThrottlePolicyName = (typeof THROTTLE_POLICY_NAMES)[number];

export const THROTTLE_POLICY_METADATA_KEY = 'app:throttle-policy';
