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

export const corsMiddleware = cors({
  origin: (origin) => {
    const allowed = getAllowedOrigins();
    const isDev = Bun.env.NODE_ENV !== 'production';

    if (!origin) {
      return allowed[0] || '*';
    }

    if (allowed.includes('*')) {
      return origin;
    }

    if (isDev && isLocalhostOrigin(origin)) {
      return origin;
    }

    return allowed.includes(origin) ? origin : '';
  },
  credentials: true,
});
