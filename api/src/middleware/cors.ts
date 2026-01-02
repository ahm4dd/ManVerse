import { cors } from 'hono/cors';

function getAllowedOrigins(): string[] {
  const raw = Bun.env.CORS_ORIGIN || Bun.env.FRONTEND_URL || 'http://localhost:3000';
  return raw.split(',').map((origin) => origin.trim()).filter(Boolean);
}

export const corsMiddleware = cors({
  origin: (origin) => {
    const allowed = getAllowedOrigins();

    if (!origin) {
      return allowed[0] || '*';
    }

    if (allowed.includes('*')) {
      return origin;
    }

    return allowed.includes(origin) ? origin : '';
  },
  credentials: true,
});
