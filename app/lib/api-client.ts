const DEFAULT_API_URL = 'http://localhost:3001';
const TOKEN_KEY = 'manverse_token';

const resolveApiUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL || DEFAULT_API_URL;
  if (typeof window === 'undefined') return envUrl;
  try {
    const parsed = new URL(envUrl);
    const runtimeHost = window.location.hostname;
    const isEnvLocal =
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1' ||
      parsed.hostname === '::1';
    const isRuntimeLocal =
      runtimeHost === 'localhost' ||
      runtimeHost === '127.0.0.1' ||
      runtimeHost === '::1';
    if (isEnvLocal && runtimeHost && !isRuntimeLocal) {
      parsed.hostname = runtimeHost;
      return parsed.toString().replace(/\/$/, '');
    }
  } catch {
    // Ignore invalid URLs
  }
  return envUrl;
};

export const API_URL = resolveApiUrl();

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  if (!token) {
    localStorage.removeItem(TOKEN_KEY);
    return;
  }
  localStorage.setItem(TOKEN_KEY, token);
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit & { skipAuth?: boolean } = {},
): Promise<T> {
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  if (!options.skipAuth) {
    const token = getStoredToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.success) {
    const message = payload?.error?.message || response.statusText || 'Request failed';
    const error = new Error(message) as Error & {
      status?: number;
      code?: string;
      details?: unknown;
    };
    error.status = response.status;
    error.code = payload?.error?.code;
    error.details = payload?.error?.details;
    throw error;
  }

  return payload.data as T;
}
