import { AnilistClient } from '@manverse/anilist-client';
import {
  NotFoundException,
  Controller,
  Get,
  Inject,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  AllowAnonymous,
  Session,
  type UserSession,
} from '@thallesp/nestjs-better-auth';
import { PrismaClient } from '../../generated/prisma/client.js';
import { GetUserQueryDto } from './dto/get-user.dto.js';

@ApiTags('Anilist')
@Controller({ path: 'anilist', version: ['1'] })
export class AnilistController {
  constructor(
    @Inject('ANILIST_CLIENT') private readonly anilistClient: AnilistClient,
    private readonly prisma: PrismaClient,
  ) {}

  @Get('viewer')
  async getViewer(@Session() session: UserSession) {
    const anilistAccount = await this.prisma.account.findFirst({
      where: {
        userId: session.user.id,
        providerId: 'anilist',
      },
      select: {
        accessToken: true,
      },
    });

    if (!anilistAccount) {
      throw new NotFoundException(
        'AniList account is not linked for the current user',
      );
    }

    if (!anilistAccount.accessToken) {
      throw new NotFoundException(
        'AniList access token is not available for the current user',
      );
    }

    return this.anilistClient.getViewerProfile(anilistAccount.accessToken);
  }

  @AllowAnonymous()
  @Get('users')
  getUser(@Query() query: GetUserQueryDto) {
    return this.anilistClient.getUserProfile({
      id: query.id,
      name: query.name,
    });
  }
}
