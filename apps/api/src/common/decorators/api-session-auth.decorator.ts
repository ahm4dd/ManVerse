import { applyDecorators } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiExtraModels,
  ApiUnauthorizedResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { HttpErrorResponseDto } from '../dto/http-error-response.dto.js';

export const BETTER_AUTH_SESSION_SECURITY_SCHEME = 'betterAuthSession';
export const BETTER_AUTH_SESSION_COOKIE_NAME = 'better-auth.session_token';

export function ApiSessionAuth() {
  return applyDecorators(
    ApiExtraModels(HttpErrorResponseDto),
    ApiCookieAuth(BETTER_AUTH_SESSION_SECURITY_SCHEME),
    ApiUnauthorizedResponse({
      description:
        'Authentication is required. Send a valid Better Auth session cookie (better-auth.session_token). See /api/auth/reference for the auth flow and session endpoints.',
      schema: {
        $ref: getSchemaPath(HttpErrorResponseDto),
      },
    }),
  );
}
