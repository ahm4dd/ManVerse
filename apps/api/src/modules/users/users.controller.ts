import { Controller, Get, Request } from '@nestjs/common';
import {
  AuthService,
  Session,
  type UserSession,
} from '@thallesp/nestjs-better-auth';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request as ExpressRequest } from 'express';
import { ZodResponse } from 'nestjs-zod';
import auth from 'src/lib/auth.js';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiSessionAuth } from '../../common/decorators/api-session-auth.decorator.js';
import { LinkedAccountsResponseDto } from './dto/linked-accounts-response.dto.js';
import { MeResponseDto } from './dto/me-response.dto.js';

// TODO: authService.api.generateOpenAPISchema(), probably no longer needed.
@ApiTags('Users')
@Controller({ path: 'users', version: ['1'] })
export class UsersController {
  constructor(private readonly authService: AuthService<typeof auth>) {}

  @Get('accounts')
  @ApiSessionAuth()
  @ApiOperation({
    summary: 'Get the current user linked accounts',
    description:
      'Protected endpoint. Requires the Better Auth session cookie. See /api/auth/reference for the auth flow and session endpoints.',
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
  @ApiOperation({
    summary: 'Get the current authenticated user profile',
    description:
      'Protected endpoint. Requires the Better Auth session cookie. See /api/auth/reference for the auth flow and session endpoints.',
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
