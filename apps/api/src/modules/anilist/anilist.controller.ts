import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
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
import type { Response } from 'express';
import {
  Throttle,
  ThrottlerGuard,
  type ThrottlerGetTrackerFunction,
} from '@nestjs/throttler';
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
import { GetViewerMangaListsResponseDto } from './dto/get-viewer-manga-lists-response.dto.js';
import {
  DeleteMediaListEntryParamsDto,
  deleteMediaListEntryParamsDtoSchema,
} from './dto/delete-media-list-entry.dto.js';
import {
  DeleteMediaListEntryResponseDto,
  deleteMediaListEntryResponseDtoSchema,
  type DeleteMediaListEntryResponse,
} from './dto/delete-media-list-entry-response.dto.js';
import {
  AniListProfileResponseDto,
  type AniListProfileNullableResponse,
} from './dto/profile-response.dto.js';
import {
  SaveMediaListEntryResponseDto,
  saveMediaListEntryResponseDtoSchema,
  type SaveMediaListEntryResponse,
} from './dto/save-media-list-entry-response.dto.js';
import { SaveMediaListEntryDto } from './dto/save-media-list-entry.dto.js';
import {
  AniListSearchMediaPageResponseDto,
  type AniListSearchMediaPageNullableResponse,
} from './dto/search-media-response.dto.js';
import { SearchMediaDto } from './dto/search-media.dto.js';
import {
  ToggleFavouriteResponseDto,
  toggleFavouriteResponseDtoSchema,
  type ToggleFavouriteResponse,
} from './dto/toggle-favourite-response.dto.js';
import { ToggleFavouriteDto } from './dto/toggle-favourite.dto.js';
import { AnilistService } from './anilist.service.js';

const PUBLIC_LOOKUP_THROTTLE_TTL_MS = 60_000;
const AUTHENTICATED_ROUTE_THROTTLE_TTL_MS = 60_000;
const PUBLIC_USERS_THROTTLE_LIMIT = 60;
const PUBLIC_SEARCH_MEDIA_THROTTLE_LIMIT = 30;
const AUTHENTICATED_VIEWER_THROTTLE_LIMIT = 30;
const AUTHENTICATED_LIBRARY_WRITE_THROTTLE_LIMIT = 20;
const ANILIST_PROFILE_RESPONSE_SCHEMA = 'AniListProfileResponse';
const ANILIST_VIEWER_MANGA_LISTS_RESPONSE_SCHEMA =
  'AniListViewerMangaListsResponse';
const ANILIST_SEARCH_MEDIA_PAGE_RESPONSE_SCHEMA =
  'AniListSearchMediaPageResponse';
const ANILIST_SAVE_MEDIA_LIST_ENTRY_RESPONSE_SCHEMA =
  'AniListSaveMediaListEntryResponse';
const ANILIST_DELETE_MEDIA_LIST_ENTRY_RESPONSE_SCHEMA =
  'AniListDeleteMediaListEntryResponse';
const ANILIST_TOGGLE_FAVOURITE_RESPONSE_SCHEMA =
  'AniListToggleFavouriteResponse';
const HTTP_ERROR_RESPONSE_SCHEMA = 'HttpErrorResponse';
const VALIDATION_ERROR_RESPONSE_SCHEMA = 'ValidationErrorResponse';
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

@ApiTags('Anilist')
@ApiExtraModels(
  HttpErrorResponseDto,
  ValidationErrorResponseDto,
  AniListProfileResponseDto,
  AniListSearchMediaPageResponseDto,
  GetViewerMangaListsResponseDto,
  SaveMediaListEntryResponseDto,
  DeleteMediaListEntryResponseDto,
  ToggleFavouriteResponseDto,
)
@Controller({ path: ANILIST_PROVIDER_ID, version: ['1'] })
export class AnilistController {
  constructor(private readonly anilistService: AnilistService) {}

  @Get('viewer')
  @ApiSessionAuth()
  @UseGuards(ThrottlerGuard)
  @Throttle({
    default: {
      limit: AUTHENTICATED_VIEWER_THROTTLE_LIMIT,
      ttl: AUTHENTICATED_ROUTE_THROTTLE_TTL_MS,
      getTracker: getAuthenticatedThrottleTracker,
    },
  })
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
  @ApiTooManyRequestsResponse({
    description:
      'Returned when the authenticated AniList viewer rate limit is exceeded for the current session user.',
    schema: {
      $ref: getSchemaPath(HTTP_ERROR_RESPONSE_SCHEMA),
    },
  })
  async getViewer(
    @Session() session: UserSession,
  ): Promise<AniListProfileNullableResponse> {
    return this.anilistService.getViewer(session.user.id);
  }

  @Get('viewer/manga-lists')
  @ApiSessionAuth()
  @UseGuards(ThrottlerGuard)
  @Throttle({
    default: {
      limit: AUTHENTICATED_VIEWER_THROTTLE_LIMIT,
      ttl: AUTHENTICATED_ROUTE_THROTTLE_TTL_MS,
      getTracker: getAuthenticatedThrottleTracker,
    },
  })
  @ApiOperation({
    summary: 'Get the authenticated AniList viewer manga lists',
    description:
      'Protected endpoint. Requires the Better Auth session cookie. Returns the grouped AniList manga list collection for the current authenticated user. Supports optional chunk pagination. See /api/auth/reference for the auth flow and session endpoints.',
  })
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
  @ApiTooManyRequestsResponse({
    description:
      'Returned when the authenticated AniList manga-list rate limit is exceeded for the current session user.',
    schema: {
      $ref: getSchemaPath(HTTP_ERROR_RESPONSE_SCHEMA),
    },
  })
  async getViewerMangaLists(
    @Session() session: UserSession,
    @Query() query: GetViewerMangaListsQueryDto,
    @Res() response: Response,
  ): Promise<void> {
    const result = await this.anilistService.getViewerMangaLists(
      session.user.id,
      query,
    );

    response.status(200).json(result);
  }

  @Post('library/entries')
  @HttpCode(200)
  @ApiSessionAuth()
  @UseGuards(ThrottlerGuard)
  @Throttle({
    default: {
      limit: AUTHENTICATED_LIBRARY_WRITE_THROTTLE_LIMIT,
      ttl: AUTHENTICATED_ROUTE_THROTTLE_TTL_MS,
      getTracker: getAuthenticatedThrottleTracker,
    },
  })
  @ZodSerializerDto(saveMediaListEntryResponseDtoSchema)
  @ApiOperation({
    summary: 'Save or update an authenticated AniList library entry',
    description:
      'Protected endpoint. Requires the Better Auth session cookie. Saves or updates the current authenticated user AniList manga library entry for the supplied media and optional progress state.',
  })
  @ApiOkResponse({
    description:
      'Return the saved AniList manga library entry for the authenticated user.',
    schema: {
      $ref: getSchemaPath(ANILIST_SAVE_MEDIA_LIST_ENTRY_RESPONSE_SCHEMA),
    },
  })
  @ApiBadRequestResponse({
    description:
      'Returned when the save media list entry request body is invalid.',
    schema: {
      $ref: getSchemaPath(VALIDATION_ERROR_RESPONSE_SCHEMA),
    },
  })
  @ApiNotFoundResponse({
    description:
      'Returned when the current user does not have a linked AniList account or the AniList access token can no longer be retrieved and the account must be relinked.',
    schema: {
      $ref: getSchemaPath(HTTP_ERROR_RESPONSE_SCHEMA),
    },
  })
  @ApiTooManyRequestsResponse({
    description:
      'Returned when the authenticated AniList library-write rate limit is exceeded for the current session user.',
    schema: {
      $ref: getSchemaPath(HTTP_ERROR_RESPONSE_SCHEMA),
    },
  })
  async saveMediaListEntry(
    @Session() session: UserSession,
    @Body() body: SaveMediaListEntryDto,
  ): Promise<SaveMediaListEntryResponse> {
    return this.anilistService.saveMediaListEntry(session.user.id, body);
  }

  @Delete('library/entries/:entryId')
  @ApiSessionAuth()
  @UseGuards(ThrottlerGuard)
  @Throttle({
    default: {
      limit: AUTHENTICATED_LIBRARY_WRITE_THROTTLE_LIMIT,
      ttl: AUTHENTICATED_ROUTE_THROTTLE_TTL_MS,
      getTracker: getAuthenticatedThrottleTracker,
    },
  })
  @ZodSerializerDto(deleteMediaListEntryResponseDtoSchema)
  @ApiOperation({
    summary: 'Delete an authenticated AniList library entry',
    description:
      'Protected endpoint. Requires the Better Auth session cookie. Deletes the current authenticated user AniList manga library entry by AniList entry id.',
  })
  @ApiOkResponse({
    description:
      'Return the AniList library deletion result for the requested entry id.',
    schema: {
      $ref: getSchemaPath(ANILIST_DELETE_MEDIA_LIST_ENTRY_RESPONSE_SCHEMA),
    },
  })
  @ApiBadRequestResponse({
    description:
      'Returned when the delete media list entry route param is invalid.',
    schema: {
      $ref: getSchemaPath(VALIDATION_ERROR_RESPONSE_SCHEMA),
    },
  })
  @ApiNotFoundResponse({
    description:
      'Returned when the current user does not have a linked AniList account or the AniList access token can no longer be retrieved and the account must be relinked.',
    schema: {
      $ref: getSchemaPath(HTTP_ERROR_RESPONSE_SCHEMA),
    },
  })
  @ApiTooManyRequestsResponse({
    description:
      'Returned when the authenticated AniList library-delete rate limit is exceeded for the current session user.',
    schema: {
      $ref: getSchemaPath(HTTP_ERROR_RESPONSE_SCHEMA),
    },
  })
  async deleteMediaListEntry(
    @Session() session: UserSession,
    @Param() params: DeleteMediaListEntryParamsDto,
  ): Promise<DeleteMediaListEntryResponse> {
    const parsedParams = deleteMediaListEntryParamsDtoSchema.parse(params);

    return this.anilistService.deleteMediaListEntry(
      session.user.id,
      parsedParams.entryId,
    );
  }

  @Post('favourites/media')
  @HttpCode(200)
  @ApiSessionAuth()
  @UseGuards(ThrottlerGuard)
  @Throttle({
    default: {
      limit: AUTHENTICATED_LIBRARY_WRITE_THROTTLE_LIMIT,
      ttl: AUTHENTICATED_ROUTE_THROTTLE_TTL_MS,
      getTracker: getAuthenticatedThrottleTracker,
    },
  })
  @ZodSerializerDto(toggleFavouriteResponseDtoSchema)
  @ApiOperation({
    summary: 'Toggle an authenticated AniList manga favourite',
    description:
      'Protected endpoint. Requires the Better Auth session cookie. Toggles the current authenticated user AniList manga favourite state for the supplied media.',
  })
  @ApiOkResponse({
    description:
      'Return the AniList favourite toggle result for the requested media.',
    schema: {
      $ref: getSchemaPath(ANILIST_TOGGLE_FAVOURITE_RESPONSE_SCHEMA),
    },
  })
  @ApiBadRequestResponse({
    description: 'Returned when the toggle favourite request body is invalid.',
    schema: {
      $ref: getSchemaPath(VALIDATION_ERROR_RESPONSE_SCHEMA),
    },
  })
  @ApiNotFoundResponse({
    description:
      'Returned when the current user does not have a linked AniList account or the AniList access token can no longer be retrieved and the account must be relinked.',
    schema: {
      $ref: getSchemaPath(HTTP_ERROR_RESPONSE_SCHEMA),
    },
  })
  @ApiTooManyRequestsResponse({
    description:
      'Returned when the authenticated AniList favourite-write rate limit is exceeded for the current session user.',
    schema: {
      $ref: getSchemaPath(HTTP_ERROR_RESPONSE_SCHEMA),
    },
  })
  async toggleFavourite(
    @Session() session: UserSession,
    @Body() body: ToggleFavouriteDto,
  ): Promise<ToggleFavouriteResponse> {
    return this.anilistService.toggleFavourite(session.user.id, body);
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
      'Returned when neither an AniList user id nor a non-blank username is provided.',
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
    return this.anilistService.getUser(query);
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
    description:
      'Returned when the search query parameters are invalid, including a blank search phrase.',
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
    return this.anilistService.searchMedia(query);
  }
}
