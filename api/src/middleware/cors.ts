import { cors } from 'hono/cors';

function getAllowedOrigins(): string[] {
  const raw = Bun.env.CORS_ORIGIN || Bun.env.FRONTEND_URL;
  if (!raw) {
    return [];
  }

  return raw.split(',').map((origin) => origin.trim()).filter(Boolean);
}

function isLocalhostOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  } catch {
    return false;
  }
}

function isPrivateNetworkOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    if (hostname.endsWith('.local')) return true;
    if (hostname.startsWith('10.')) return true;
    if (hostname.startsWith('192.168.')) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)) return true;
    return false;
  } catch {
    return false;
  }
}

export const corsMiddleware = cors({
  origin: (origin) => {
    const allowed = getAllowedOrigins();
    const isDev = Bun.env.NODE_ENV !== 'production';
    const allowPrivateByDefault = allowed.length === 0;

    if (!origin) {
      return allowed[0] || '*';
    }

    if (allowed.includes('*')) {
      return origin;
    }

    if ((isDev || allowPrivateByDefault) && isLocalhostOrigin(origin)) {
      return origin;
    }

    if ((isDev || allowPrivateByDefault) && isPrivateNetworkOrigin(origin)) {
      return origin;
    }

    return allowed.includes(origin) ? origin : '';
  },
  credentials: true,
});
