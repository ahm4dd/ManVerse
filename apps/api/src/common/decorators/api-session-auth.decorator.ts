import { applyDecorators } from '@nestjs/common';
import { ApiCookieAuth, ApiUnauthorizedResponse } from '@nestjs/swagger';

export const BETTER_AUTH_SESSION_SECURITY_SCHEME = 'betterAuthSession';
export const BETTER_AUTH_SESSION_COOKIE_NAME = 'better-auth.session_token';

export function ApiSessionAuth() {
  return applyDecorators(
    ApiCookieAuth(BETTER_AUTH_SESSION_SECURITY_SCHEME),
    ApiUnauthorizedResponse({
      description:
        'Authentication is required. Send a valid Better Auth session cookie (better-auth.session_token). See /api/auth/reference for the auth flow and session endpoints.',
    }),
  );
}
