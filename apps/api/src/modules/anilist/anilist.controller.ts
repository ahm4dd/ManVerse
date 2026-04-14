import {
  NotFoundException,
  Controller,
  Get,
  Inject,
  Query,
} from '@nestjs/common';
import {
  ApiExtraModels,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiOkResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { ZodSerializerDto } from 'nestjs-zod';
import {
  AllowAnonymous,
  Session,
  type UserSession,
} from '@thallesp/nestjs-better-auth';
import { ANILIST_PROVIDER_ID } from '../../common/constants/provider.constants.js';
import { PrismaClient } from '../../generated/prisma/client.js';
import { ApiSessionAuth } from '../../common/decorators/api-session-auth.decorator.js';
import { GetUserQueryDto } from './dto/get-user.dto.js';
import { GetViewerMangaListsQueryDto } from './dto/get-viewer-manga-lists.dto.js';
import {
  GetViewerMangaListsResponseDto,
  getViewerMangaListsNullableResponseSchema,
  type GetViewerMangaListsResponse,
} from './dto/get-viewer-manga-lists-response.dto.js';
import { SearchMediaDto } from './dto/search-media.dto.js';
import { AnilistClient } from '@manverse/anilist-client';

@ApiTags('Anilist')
@ApiExtraModels(GetViewerMangaListsResponseDto)
@Controller({ path: ANILIST_PROVIDER_ID, version: ['1'] })
export class AnilistController {
  constructor(
    @Inject('ANILIST_CLIENT')
    private readonly anilistClient: AnilistClient,
    @Inject(PrismaClient) private readonly prisma: PrismaClient,
  ) {}

  private async getCurrentUserAnilistAccessToken(
    session: UserSession,
  ): Promise<string> {
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

    return anilistAccount.accessToken;
  }

  @Get('viewer')
  @ApiSessionAuth()
  @ApiOperation({
    summary: 'Get the authenticated AniList viewer profile',
    description:
      'Protected endpoint. Requires the Better Auth session cookie. Returns the AniList viewer profile linked to the current authenticated user. See /api/auth/reference for the auth flow and session endpoints.',
  })
  @ApiOkResponse({
    description:
      'Return the AniList viewer profile linked to the current authenticated user.',
  })
  @ApiNotFoundResponse({
    description:
      'Returned when the current user does not have a linked AniList account or no AniList access token is available.',
  })
  async getViewer(@Session() session: UserSession) {
    const accessToken = await this.getCurrentUserAnilistAccessToken(session);

    return this.anilistClient.getViewerProfile(accessToken);
  }

  @Get('viewer/manga-lists')
  @ApiSessionAuth()
  @ApiOperation({
    summary: 'Get the authenticated AniList viewer manga lists',
    description:
      'Protected endpoint. Requires the Better Auth session cookie. Returns the grouped AniList manga list collection for the current authenticated user. Supports optional chunk pagination. See /api/auth/reference for the auth flow and session endpoints.',
  })
  @ZodSerializerDto(getViewerMangaListsNullableResponseSchema)
  @ApiBadRequestResponse({
    description:
      'Returned when the chunk pagination query parameters are invalid.',
  })
  @ApiOkResponse({
    description:
      'Return the grouped AniList manga list collection for the current authenticated user, or null when AniList has no manga list collection.',
    schema: {
      anyOf: [
        {
          $ref: getSchemaPath(GetViewerMangaListsResponseDto),
        },
        {
          type: 'null',
        },
      ],
    },
  })
  @ApiNotFoundResponse({
    description:
      'Returned when the current user does not have a linked AniList account or no AniList access token is available.',
  })
  async getViewerMangaLists(
    @Session() session: UserSession,
    @Query() query: GetViewerMangaListsQueryDto,
  ): Promise<GetViewerMangaListsResponse> {
    const accessToken = await this.getCurrentUserAnilistAccessToken(session);

    return this.anilistClient.getViewerMangaLists(accessToken, query);
  }

  @AllowAnonymous()
  @Get('users')
  @ApiOperation({
    summary: 'Lookup a public AniList user profile',
    description:
      'Public endpoint. Resolves an AniList user profile by numeric id or by username.',
  })
  @ApiOkResponse({
    description: 'Return the AniList user profile that matches the query.',
  })
  @ApiBadRequestResponse({
    description:
      'Returned when neither an AniList user id nor username is provided.',
  })
  getUser(@Query() query: GetUserQueryDto) {
    return this.anilistClient.getUserProfile({
      id: query.id,
      name: query.name,
    });
  }

  @AllowAnonymous()
  @Get('search-media')
  @ApiOperation({
    summary: 'Search public AniList media',
    description:
      'Public endpoint. Searches AniList media and returns the matching page of results. Supports pagination and adult-content filtering.',
  })
  @ApiBadRequestResponse({
    description: 'Returned when the search query parameters are invalid.',
  })
  @ApiOkResponse({
    description: 'Return AniList media search results for the given query.',
  })
  async searchMedia(@Query() query: SearchMediaDto) {
    return await this.anilistClient.searchMedia(query);
  }
}
