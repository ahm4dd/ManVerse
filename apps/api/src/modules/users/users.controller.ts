import { Controller, Get, Header, Post, Request } from '@nestjs/common';
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
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { ApiSessionAuth } from '../../common/decorators/api-session-auth.decorator.js';
import { HttpErrorResponseDto } from '../../common/dtos/http-error-response.dto.js';
import { UseThrottlePolicy } from '../throttling/throttle-policies.js';
import { AnilistAccessTokenResponseDto } from './dto/anilist-access-token-response.dto.js';
import { LinkedAccountsResponseDto } from './dto/linked-accounts-response.dto.js';
import { MeResponseDto } from './dto/me-response.dto.js';
import { UsersService } from './users.service.js';

// TODO: authService.api.generateOpenAPISchema(), probably no longer needed.
@ApiTags('Users')
@Controller({ path: 'users', version: ['1'] })
export class UsersController {
  constructor(
    private readonly authService: AuthService<typeof auth>,
    private readonly usersService: UsersService,
  ) {}

  @Get('accounts')
  @ApiSessionAuth()
  @UseThrottlePolicy('authenticatedRead')
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

  @Post('accounts/anilist/access-token')
  @ApiSessionAuth()
  @Header('Cache-Control', 'no-store, private')
  @Header('Pragma', 'no-cache')
  @UseThrottlePolicy('secret')
  @ApiOperation({
    summary: 'Get the current user AniList access token',
    description:
      'Protected endpoint. Requires the Better Auth session cookie. Returns the decrypted AniList access token for direct browser-to-AniList requests. Keep the token in memory only and do not persist it client-side.',
  })
  @ApiNotFoundResponse({
    description:
      'Returned when the current user does not have a linked AniList account, or the stored AniList token can no longer be retrieved and the account must be relinked.',
    schema: {
      $ref: getSchemaPath(HttpErrorResponseDto),
    },
  })
  @ApiTooManyRequestsResponse({
    description:
      'Returned when the AniList access-token lookup rate limit is exceeded for the current session user.',
    schema: {
      $ref: getSchemaPath(HttpErrorResponseDto),
    },
  })
  @ZodResponse({
    type: AnilistAccessTokenResponseDto,
    status: 200,
    description: "Return the current user's AniList access token",
  })
  getAnilistAccessToken(
    @Session() session: UserSession,
  ): Promise<AnilistAccessTokenResponseDto> {
    return this.usersService.getCurrentUserAnilistAccessToken(session.user.id);
  }

  @Get('me')
  @ApiSessionAuth()
  @UseThrottlePolicy('authenticatedRead')
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
