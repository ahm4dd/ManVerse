const DEFAULT_API_URL = 'http://localhost:3001';
const TOKEN_KEY = 'manverse_token';
const RUNTIME_TOKEN_KEY = '__manverse_token';

const isLocalHost = (host: string) =>
  host === 'localhost' || host === '127.0.0.1' || host === '::1';

const resolveApiUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL || DEFAULT_API_URL;
  if (typeof window === 'undefined') return envUrl;
  try {
    const parsed = new URL(envUrl);
    const runtimeOverride = (window as any).manverse?.apiUrl;
    if (typeof runtimeOverride === 'string' && runtimeOverride.trim()) {
      return new URL(runtimeOverride.trim()).toString().replace(/\/$/, '');
    }
    const isDesktopRuntime = Boolean((window as any).manverse);
    const runtimeHost = window.location.hostname;
    const isEnvLocal = isLocalHost(parsed.hostname);
    const isRuntimeLocal = isLocalHost(runtimeHost);

    if (isDesktopRuntime && runtimeHost) {
      parsed.hostname = runtimeHost;
      return parsed.toString().replace(/\/$/, '');
    }

    if (isEnvLocal && runtimeHost && !isRuntimeLocal) {
      parsed.hostname = runtimeHost;
      return parsed.toString().replace(/\/$/, '');
    }

    if (!isEnvLocal && isRuntimeLocal) {
      parsed.hostname = runtimeHost;
      return parsed.toString().replace(/\/$/, '');
    }
  } catch {
    // Ignore invalid URLs
  }
  return envUrl;
};

export const API_URL = resolveApiUrl();
export const getApiUrl = () => resolveApiUrl();

function logDesktop(message: string, data?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  const bridge = (window as any).manverse;
  if (bridge?.log) {
    bridge.log({ message, data: data ?? null });
  }
}

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  const runtimeToken = (window as any)[RUNTIME_TOKEN_KEY];
  if (typeof runtimeToken === 'string' && runtimeToken) return runtimeToken;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch (error) {
    logDesktop('auth.storage.read_failed', {
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  if (!token) {
    (window as any)[RUNTIME_TOKEN_KEY] = null;
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch (error) {
      logDesktop('auth.storage.clear_failed', {
        message: error instanceof Error ? error.message : String(error),
      });
    }
    return;
  }
  (window as any)[RUNTIME_TOKEN_KEY] = token;
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch (error) {
    logDesktop('auth.storage.write_failed', {
      message: error instanceof Error ? error.message : String(error),
    });
  }
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

  const response = await fetch(`${getApiUrl()}${path}`, {
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
