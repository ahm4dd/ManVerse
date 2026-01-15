import { getApiUrl } from './api-client';
import type { LanAccessInfo } from './desktop';

const REDIRECT_LAST_KEY = 'manverse_anilist_redirect_last';
const REDIRECT_CONFIRMED_KEY = 'manverse_anilist_redirect_confirmed';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0']);

export function normalizeRedirectUri(value?: string | null): string {
  return (value || '').trim().replace(/\/$/, '');
}

export function normalizeRedirectUriForCompare(value?: string | null): string {
  const trimmed = normalizeRedirectUri(value);
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    const host = LOCAL_HOSTS.has(parsed.hostname) ? 'localhost' : parsed.hostname;
    const port = parsed.port ? `:${parsed.port}` : '';
    const path = parsed.pathname.replace(/\/$/, '');
    return `${parsed.protocol}//${host}${port}${path}`;
  } catch {
    return trimmed;
  }
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
  const expected = normalizeRedirectUriForCompare(expectedRedirectUri);
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
  const last = normalizeRedirectUriForCompare(lastRaw);
  const confirmed = normalizeRedirectUriForCompare(confirmedRaw);

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
  const expected = normalizeRedirectUriForCompare(expectedRedirectUri);
  if (!expected) return;
  try {
    localStorage.setItem(REDIRECT_CONFIRMED_KEY, expected);
  } catch {
    // ignore
  }
}
