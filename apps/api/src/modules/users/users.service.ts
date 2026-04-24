import { Injectable, NotFoundException } from '@nestjs/common';
import { ANILIST_PROVIDER_ID } from '../../common/constants/provider.constants.js';
import {
  AnilistAccessTokenRelinkRequiredError,
  AnilistAccountNotLinkedError,
} from '../../common/errors/anilist.errors.js';
import { AnilistAccessTokenResponseDto } from './dto/anilist-access-token-response.dto.js';
import { UsersRepository } from './users.repository.js';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async getCurrentUserAnilistAccessToken(
    userId: string,
  ): Promise<AnilistAccessTokenResponseDto> {
    try {
      const accessToken =
        await this.usersRepository.getCurrentUserAnilistAccessToken(userId);

      return {
        providerId: ANILIST_PROVIDER_ID,
        accessToken,
      };
    } catch (error) {
      if (
        error instanceof AnilistAccountNotLinkedError ||
        error instanceof AnilistAccessTokenRelinkRequiredError
      ) {
        throw new NotFoundException(error.message);
      }

      throw error;
    }
  }
}
