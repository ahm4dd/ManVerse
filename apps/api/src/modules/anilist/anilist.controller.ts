import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiOkResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ZodSerializerDto } from 'nestjs-zod';
import {
  AllowAnonymous,
  Session,
  type UserSession,
} from '@thallesp/nestjs-better-auth';
import { ANILIST_PROVIDER_ID } from '../../common/constants/provider.constants.js';
import {
  HttpErrorResponseDto,
  ValidationErrorResponseDto,
} from '../../common/dto/http-error-response.dto.js';
import { ApiSessionAuth } from '../../common/decorators/api-session-auth.decorator.js';
import { GetUserQueryDto } from './dto/get-user.dto.js';
import { GetViewerMangaListsQueryDto } from './dto/get-viewer-manga-lists.dto.js';
import {
  GetViewerMangaListsResponseDto,
  getViewerMangaListsNullableResponseSchema,
  type GetViewerMangaListsResponse,
} from './dto/get-viewer-manga-lists-response.dto.js';
import {
  AniListProfileResponseDto,
  type AniListProfileNullableResponse,
} from './dto/profile-response.dto.js';
import {
  AniListSearchMediaPageResponseDto,
  type AniListSearchMediaPageNullableResponse,
} from './dto/search-media-response.dto.js';
import { SearchMediaDto } from './dto/search-media.dto.js';
import { AnilistClient } from '@manverse/anilist-client';
import { AnilistAccountService } from './anilist-account.service.js';

const PUBLIC_LOOKUP_THROTTLE_TTL_MS = 60_000;
const PUBLIC_USERS_THROTTLE_LIMIT = 60;
const PUBLIC_SEARCH_MEDIA_THROTTLE_LIMIT = 30;
const ANILIST_PROFILE_RESPONSE_SCHEMA = 'AniListProfileResponse';
const ANILIST_VIEWER_MANGA_LISTS_RESPONSE_SCHEMA =
  'AniListViewerMangaListsResponse';
const ANILIST_SEARCH_MEDIA_PAGE_RESPONSE_SCHEMA =
  'AniListSearchMediaPageResponse';
const HTTP_ERROR_RESPONSE_SCHEMA = 'HttpErrorResponse';
const VALIDATION_ERROR_RESPONSE_SCHEMA = 'ValidationErrorResponse';

@ApiTags('Anilist')
@ApiExtraModels(
  HttpErrorResponseDto,
  ValidationErrorResponseDto,
  AniListProfileResponseDto,
  AniListSearchMediaPageResponseDto,
  GetViewerMangaListsResponseDto,
)
@Controller({ path: ANILIST_PROVIDER_ID, version: ['1'] })
export class AnilistController {
  constructor(
    @Inject('ANILIST_CLIENT')
    private readonly anilistClient: AnilistClient,
    private readonly anilistAccountService: AnilistAccountService,
  ) {}

  @Get('viewer')
  @ApiSessionAuth()
  @ApiOperation({
    summary: 'Get the authenticated AniList viewer profile',
    description:
      'Protected endpoint. Requires the Better Auth session cookie. Returns the AniList viewer profile linked to the current authenticated user. See /api/auth/reference for the auth flow and session endpoints.',
  })
  @ApiOkResponse({
    description:
      'Return the AniList viewer profile linked to the current authenticated user, or null when AniList does not resolve a viewer profile for the linked account.',
    schema: {
      anyOf: [
        {
          $ref: getSchemaPath(ANILIST_PROFILE_RESPONSE_SCHEMA),
        },
        {
          type: 'null',
        },
      ],
    },
  })
  @ApiNotFoundResponse({
    description:
      'Returned when the current user does not have a linked AniList account or the AniList access token can no longer be retrieved and the account must be relinked.',
    schema: {
      $ref: getSchemaPath(HTTP_ERROR_RESPONSE_SCHEMA),
    },
  })
  async getViewer(
    @Session() session: UserSession,
  ): Promise<AniListProfileNullableResponse> {
    const accessToken =
      await this.anilistAccountService.getCurrentUserAccessToken(
        session.user.id,
      );

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
    schema: {
      $ref: getSchemaPath(VALIDATION_ERROR_RESPONSE_SCHEMA),
    },
  })
  @ApiOkResponse({
    description:
      'Return the grouped AniList manga list collection for the current authenticated user, or null when AniList has no manga list collection.',
    schema: {
      anyOf: [
        {
          $ref: getSchemaPath(ANILIST_VIEWER_MANGA_LISTS_RESPONSE_SCHEMA),
        },
        {
          type: 'null',
        },
      ],
    },
  })
  @ApiNotFoundResponse({
    description:
      'Returned when the current user does not have a linked AniList account or the AniList access token can no longer be retrieved and the account must be relinked.',
    schema: {
      $ref: getSchemaPath(HTTP_ERROR_RESPONSE_SCHEMA),
    },
  })
  async getViewerMangaLists(
    @Session() session: UserSession,
    @Query() query: GetViewerMangaListsQueryDto,
  ): Promise<GetViewerMangaListsResponse> {
    const accessToken =
      await this.anilistAccountService.getCurrentUserAccessToken(
        session.user.id,
      );

    return this.anilistClient.getViewerMangaLists(accessToken, query);
  }

  @AllowAnonymous()
  @Get('users')
  @UseGuards(ThrottlerGuard)
  @Throttle({
    default: {
      limit: PUBLIC_USERS_THROTTLE_LIMIT,
      ttl: PUBLIC_LOOKUP_THROTTLE_TTL_MS,
    },
  })
  @ApiOperation({
    summary: 'Lookup a public AniList user profile',
    description:
      'Public endpoint. Resolves an AniList user profile by numeric id or by username.',
  })
  @ApiOkResponse({
    description:
      'Return the AniList user profile that matches the query, or null when AniList does not resolve a profile for the lookup.',
    schema: {
      anyOf: [
        {
          $ref: getSchemaPath(ANILIST_PROFILE_RESPONSE_SCHEMA),
        },
        {
          type: 'null',
        },
      ],
    },
  })
  @ApiBadRequestResponse({
    description:
      'Returned when neither an AniList user id nor username is provided.',
    schema: {
      $ref: getSchemaPath(VALIDATION_ERROR_RESPONSE_SCHEMA),
    },
  })
  @ApiTooManyRequestsResponse({
    description:
      'Returned when the anonymous lookup rate limit is exceeded for the current client IP.',
    schema: {
      $ref: getSchemaPath(HTTP_ERROR_RESPONSE_SCHEMA),
    },
  })
  getUser(@Query() query: GetUserQueryDto) {
    return this.anilistClient.getUserProfile({
      id: query.id,
      name: query.name,
    });
  }

  @AllowAnonymous()
  @Get('search-media')
  @UseGuards(ThrottlerGuard)
  @Throttle({
    default: {
      limit: PUBLIC_SEARCH_MEDIA_THROTTLE_LIMIT,
      ttl: PUBLIC_LOOKUP_THROTTLE_TTL_MS,
    },
  })
  @ApiOperation({
    summary: 'Search public AniList media',
    description:
      'Public endpoint. Searches AniList media and returns the matching page of results. Supports pagination and adult-content filtering.',
  })
  @ApiBadRequestResponse({
    description: 'Returned when the search query parameters are invalid.',
    schema: {
      $ref: getSchemaPath(VALIDATION_ERROR_RESPONSE_SCHEMA),
    },
  })
  @ApiTooManyRequestsResponse({
    description:
      'Returned when the anonymous search rate limit is exceeded for the current client IP.',
    schema: {
      $ref: getSchemaPath(HTTP_ERROR_RESPONSE_SCHEMA),
    },
  })
  @ApiOkResponse({
    description:
      'Return AniList media search results for the given query, or null when AniList does not resolve a matching page.',
    schema: {
      anyOf: [
        {
          $ref: getSchemaPath(ANILIST_SEARCH_MEDIA_PAGE_RESPONSE_SCHEMA),
        },
        {
          type: 'null',
        },
      ],
    },
  })
  async searchMedia(
    @Query() query: SearchMediaDto,
  ): Promise<AniListSearchMediaPageNullableResponse> {
    return await this.anilistClient.searchMedia(query);
  }
}
