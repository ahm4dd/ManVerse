import { sign } from 'hono/jwt';
import type { AuthUser } from '../../../shared/types.ts';

const JWT_ALG = 'HS256';

export function getJwtSecret(): string {
  const secret = Bun.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }

  return secret;
}

export function getJwtAlgorithm(): string {
  return JWT_ALG;
}

export async function signUser(user: AuthUser): Promise<string> {
  return sign(user, getJwtSecret(), getJwtAlgorithm());
}
