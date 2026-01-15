import { getApiUrl } from './api-client';
import type { LanAccessInfo } from './desktop';

const REDIRECT_LAST_KEY = 'manverse_anilist_redirect_last';
const REDIRECT_CONFIRMED_KEY = 'manverse_anilist_redirect_confirmed';

export function normalizeRedirectUri(value?: string | null): string {
  return (value || '').trim().replace(/\/$/, '');
}

export function buildRedirectUri(apiUrl: string): string {
  const normalized = normalizeRedirectUri(apiUrl);
  return `${normalized}/api/auth/anilist/callback`;
}

export function getExpectedAniListRedirectUrl(lanInfo?: LanAccessInfo | null): string {
  const apiUrl =
    lanInfo?.enabled && lanInfo.apiUrl ? lanInfo.apiUrl : getApiUrl();
  return buildRedirectUri(apiUrl);
}

export function getRedirectConfirmationState(expectedRedirectUri: string): {
  confirmedRedirectUri: string | null;
  requiresConfirmation: boolean;
} {
  if (typeof window === 'undefined') {
    return { confirmedRedirectUri: null, requiresConfirmation: false };
  }
  const expected = normalizeRedirectUri(expectedRedirectUri);
  if (!expected) {
    return { confirmedRedirectUri: null, requiresConfirmation: false };
  }

  let lastRaw: string | null = null;
  let confirmedRaw: string | null = null;
  try {
    lastRaw = localStorage.getItem(REDIRECT_LAST_KEY);
    confirmedRaw = localStorage.getItem(REDIRECT_CONFIRMED_KEY);
  } catch {
    return { confirmedRedirectUri: null, requiresConfirmation: false };
  }
  const last = normalizeRedirectUri(lastRaw);
  const confirmed = normalizeRedirectUri(confirmedRaw);

  if (!last) {
    try {
      localStorage.setItem(REDIRECT_LAST_KEY, expected);
    } catch {
      return { confirmedRedirectUri: confirmed || null, requiresConfirmation: false };
    }
    if (!confirmed) {
      try {
        localStorage.setItem(REDIRECT_CONFIRMED_KEY, expected);
      } catch {
        return { confirmedRedirectUri: confirmed || null, requiresConfirmation: false };
      }
      return { confirmedRedirectUri: expected, requiresConfirmation: false };
    }
    return { confirmedRedirectUri: confirmed || null, requiresConfirmation: confirmed !== expected };
  }

  if (last !== expected) {
    try {
      localStorage.setItem(REDIRECT_LAST_KEY, expected);
    } catch {
      return { confirmedRedirectUri: confirmed || null, requiresConfirmation: true };
    }
  }

  const requiresConfirmation = !confirmed || confirmed !== expected;
  return { confirmedRedirectUri: confirmed || null, requiresConfirmation };
}

export function confirmRedirectUri(expectedRedirectUri: string): void {
  if (typeof window === 'undefined') return;
  const expected = normalizeRedirectUri(expectedRedirectUri);
  if (!expected) return;
  try {
    localStorage.setItem(REDIRECT_CONFIRMED_KEY, expected);
  } catch {
    // ignore
  }
}
