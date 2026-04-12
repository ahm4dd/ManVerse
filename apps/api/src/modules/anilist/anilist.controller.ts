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
import { ANILIST_PROVIDER_ID } from '../../common/constants/provider.constants.js';
import { PrismaClient } from '../../generated/prisma/client.js';
import { GetUserQueryDto } from './dto/get-user.dto.js';
import { SearchMediaDto } from './dto/search-media.dto.js';

@ApiTags('Anilist')
@Controller({ path: ANILIST_PROVIDER_ID, version: ['1'] })
export class AnilistController {
  constructor(
    @Inject('ANILIST_CLIENT') private readonly anilistClient: AnilistClient,
    @Inject(PrismaClient) private readonly prisma: PrismaClient,
  ) {}

  @Get('viewer')
  async getViewer(@Session() session: UserSession) {
    const anilistAccount = await this.prisma.account.findFirst({
      where: {
        userId: session.user.id,
        providerId: ANILIST_PROVIDER_ID,
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

  @AllowAnonymous()
  @Get('search-media')
  async searchMedia(@Query() query: SearchMediaDto) {
    return await this.anilistClient.searchMedia(query);
  }
}
