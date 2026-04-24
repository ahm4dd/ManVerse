import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { AnilistClient } from '@manverse/anilist-client';
import {
  ANILIST_ACCOUNT_NOT_LINKED_MESSAGE,
  ANILIST_RELINK_REQUIRED_MESSAGE,
} from '../../lib/anilist-oauth.js';
import {
  AnilistAccountNotLinkedError,
  AnilistAccessTokenRelinkRequiredError,
} from './anilist.errors.js';
import { AnilistRepository } from './anilist.repository.js';
import type { GetUserQueryDto } from './dto/get-user.dto.js';
import {
  getViewerMangaListsNullableResponseSchema,
  type GetViewerMangaListsResponse,
} from './dto/get-viewer-manga-lists-response.dto.js';
import type { GetViewerMangaListsQueryDto } from './dto/get-viewer-manga-lists.dto.js';
import type { DeleteMediaListEntryResponse } from './dto/delete-media-list-entry-response.dto.js';
import type { SaveMediaListEntryResponse } from './dto/save-media-list-entry-response.dto.js';
import type { SearchMediaDto } from './dto/search-media.dto.js';
import type { SaveMediaListEntryDto } from './dto/save-media-list-entry.dto.js';
import type { ToggleFavouriteResponse } from './dto/toggle-favourite-response.dto.js';
import type { ToggleFavouriteDto } from './dto/toggle-favourite.dto.js';
import type { AniListProfileNullableResponse } from './dto/profile-response.dto.js';
import type { AniListSearchMediaPageNullableResponse } from './dto/search-media-response.dto.js';

@Injectable()
export class AnilistService {
  constructor(
    private readonly anilistClient: AnilistClient,
    private readonly anilistRepository: AnilistRepository,
  ) {}

  async getViewer(userId: string): Promise<AniListProfileNullableResponse> {
    const accessToken = await this.getCurrentUserAccessToken(userId);

    return this.anilistClient.getViewerProfile(accessToken);
  }

  async getViewerMangaLists(
    userId: string,
    query: GetViewerMangaListsQueryDto,
  ): Promise<GetViewerMangaListsResponse> {
    const accessToken = await this.getCurrentUserAccessToken(userId);

    const result = await this.anilistClient.getViewerMangaLists(
      accessToken,
      query,
    );

    return getViewerMangaListsNullableResponseSchema.parse(result);
  }

  async saveMediaListEntry(
    userId: string,
    input: SaveMediaListEntryDto,
  ): Promise<SaveMediaListEntryResponse> {
    const accessToken = await this.getCurrentUserAccessToken(userId);
    const result = await this.anilistClient.saveMediaListEntry(
      accessToken,
      input,
    );

    if (result === null) {
      throw new InternalServerErrorException(
        'AniList did not return a saved media list entry.',
      );
    }

    return result;
  }

  async deleteMediaListEntry(
    userId: string,
    entryId: number,
  ): Promise<DeleteMediaListEntryResponse> {
    const accessToken = await this.getCurrentUserAccessToken(userId);

    return this.anilistClient.deleteMediaListEntry(accessToken, {
      entryId,
    });
  }

  async toggleFavourite(
    userId: string,
    input: ToggleFavouriteDto,
  ): Promise<ToggleFavouriteResponse> {
    const accessToken = await this.getCurrentUserAccessToken(userId);

    return this.anilistClient.toggleFavourite(accessToken, input);
  }

  getUser(query: GetUserQueryDto): Promise<AniListProfileNullableResponse> {
    return this.anilistClient.getUserProfile({
      id: query.id,
      name: query.name,
    });
  }

  searchMedia(
    query: SearchMediaDto,
  ): Promise<AniListSearchMediaPageNullableResponse> {
    return this.anilistClient.searchMedia(query);
  }

  private async getCurrentUserAccessToken(userId: string): Promise<string> {
    try {
      return await this.anilistRepository.getCurrentUserAccessToken(userId);
    } catch (error) {
      if (error instanceof AnilistAccountNotLinkedError) {
        throw new NotFoundException(ANILIST_ACCOUNT_NOT_LINKED_MESSAGE);
      }

      if (error instanceof AnilistAccessTokenRelinkRequiredError) {
        throw new NotFoundException(ANILIST_RELINK_REQUIRED_MESSAGE);
      }

      throw error;
    }
  }
}
