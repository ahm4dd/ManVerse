import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import {
  Throttle,
  ThrottlerGuard,
  type ThrottlerGetTrackerFunction,
} from '@nestjs/throttler';
import {
  AuthService,
  Session,
  type UserSession,
} from '@thallesp/nestjs-better-auth';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request as ExpressRequest } from 'express';
import { ZodResponse } from 'nestjs-zod';
import auth from 'src/lib/auth.js';
import {
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { ApiSessionAuth } from '../../common/decorators/api-session-auth.decorator.js';
import { HttpErrorResponseDto } from '../../common/dto/http-error-response.dto.js';
import { LinkedAccountsResponseDto } from './dto/linked-accounts-response.dto.js';
import { MeResponseDto } from './dto/me-response.dto.js';

const AUTHENTICATED_USERS_THROTTLE_TTL_MS = 60_000;
const AUTHENTICATED_USERS_THROTTLE_LIMIT = 30;
type AuthenticatedThrottleRequest = {
  ip: string;
  user?: {
    id?: string | undefined;
  } | null;
  session?: {
    user?: {
      id?: string | undefined;
    } | null;
  } | null;
};
const getAuthenticatedThrottleTracker: ThrottlerGetTrackerFunction = (req) =>
  (req as AuthenticatedThrottleRequest).user?.id ??
  (req as AuthenticatedThrottleRequest).session?.user?.id ??
  (req as AuthenticatedThrottleRequest).ip;

// TODO: authService.api.generateOpenAPISchema(), probably no longer needed.
@ApiTags('Users')
@Controller({ path: 'users', version: ['1'] })
export class UsersController {
  constructor(private readonly authService: AuthService<typeof auth>) {}

  @Get('accounts')
  @ApiSessionAuth()
  @UseGuards(ThrottlerGuard)
  @Throttle({
    default: {
      limit: AUTHENTICATED_USERS_THROTTLE_LIMIT,
      ttl: AUTHENTICATED_USERS_THROTTLE_TTL_MS,
      getTracker: getAuthenticatedThrottleTracker,
    },
  })
  @ApiOperation({
    summary: 'Get the current user linked accounts',
    description:
      'Protected endpoint. Requires the Better Auth session cookie. See /api/auth/reference for the auth flow and session endpoints.',
  })
  @ApiTooManyRequestsResponse({
    description:
      'Returned when the authenticated account lookup rate limit is exceeded for the current session user.',
    schema: {
      $ref: getSchemaPath(HttpErrorResponseDto),
    },
  })
  @ZodResponse({
    type: LinkedAccountsResponseDto,
    status: 200,
    description: "Return the current user's linked accounts",
  })
  async getAccounts(
    @Request() req: ExpressRequest,
  ): Promise<LinkedAccountsResponseDto> {
    const accounts = await this.authService.api.listUserAccounts({
      headers: fromNodeHeaders(req.headers),
    });

    return {
      accounts: accounts.map((account) => ({
        id: account.id,
        providerId: account.providerId,
        userId: account.userId,
        accountId: account.accountId,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
        scopes: account.scopes,
      })),
    };
  }

  @Get('me')
  @ApiSessionAuth()
  @UseGuards(ThrottlerGuard)
  @Throttle({
    default: {
      limit: AUTHENTICATED_USERS_THROTTLE_LIMIT,
      ttl: AUTHENTICATED_USERS_THROTTLE_TTL_MS,
      getTracker: getAuthenticatedThrottleTracker,
    },
  })
  @ApiOperation({
    summary: 'Get the current authenticated user profile',
    description:
      'Protected endpoint. Requires the Better Auth session cookie. See /api/auth/reference for the auth flow and session endpoints.',
  })
  @ApiTooManyRequestsResponse({
    description:
      'Returned when the authenticated profile lookup rate limit is exceeded for the current session user.',
    schema: {
      $ref: getSchemaPath(HttpErrorResponseDto),
    },
  })
  @ZodResponse({
    type: MeResponseDto,
    status: 200,
    description: "Return information about the user's session",
  })
  getProfile(@Session() session: UserSession): MeResponseDto {
    const actualSession = session.session;
    const user = session.user;

    return {
      session: {
        id: actualSession.id,
        createdAt: actualSession.createdAt,
        expiresAt: actualSession.expiresAt,
        updatedAt: actualSession.updatedAt,
        userId: actualSession.userId,

        // ipAddress: actualSession.ipAddress ?? undefined,
        activeOrganizationId: actualSession.activeOrganizationId ?? undefined,
        userAgent: actualSession.userAgent ?? undefined,
      },
      user: {
        id: user.id,
        createdAt: user.createdAt,
        email: user.email,
        emailVerified: user.emailVerified,
        name: user.name,
        updatedAt: user.updatedAt,
        image: user.image ?? undefined,
      },
    };
  }

  //   @Get('optional')
  //   @OptionalAuth()
  //   async optionalRoute(@Session() session: UserSession) {
  //     return { authenticated: !!session, session };
  //   }
}
