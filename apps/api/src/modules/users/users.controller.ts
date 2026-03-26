import { Controller, Get, Request } from '@nestjs/common';
import {
  AuthService,
  Session,
  type UserSession,
} from '@thallesp/nestjs-better-auth';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request as ExpressRequest } from 'express';
import auth from 'src/lib/auth.js';

// TODO: authService.api.generateOpenAPISchema()
@Controller({ path: 'users', version: ['1'] })
export class UsersController {
  constructor(private authService: AuthService<typeof auth>) {}

  @Get('accounts')
  async getAccounts(@Request() req: ExpressRequest) {
    const accounts = await this.authService.api.listUserAccounts({
      headers: fromNodeHeaders(req.headers),
    });

    return { accounts };
  }

  @Get('me')
  getProfile(@Session() session: UserSession) {
    return session;
  }

  //   @Get('optional')
  //   @OptionalAuth()
  //   async optionalRoute(@Session() session: UserSession) {
  //     return { authenticated: !!session, session };
  //   }
}
