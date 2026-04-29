import { Injectable } from '@nestjs/common';
import { AuthService } from '@thallesp/nestjs-better-auth';
import { ANILIST_PROVIDER_ID } from '../../common/constants/provider.constants.js';
import {
  AnilistAccessTokenRelinkRequiredError,
  AnilistAccountNotLinkedError,
} from '../../common/errors/anilist.errors.js';
import auth, { getBetterAuthErrorCode } from '../../lib/auth.js';

@Injectable()
export class UsersRepository {
  constructor(private readonly authService: AuthService<typeof auth>) {}

  async getCurrentUserAnilistAccessToken(userId: string): Promise<string> {
    try {
      const tokens = await this.authService.api.getAccessToken({
        body: {
          providerId: ANILIST_PROVIDER_ID,
          userId,
        },
      });

      if (!tokens.accessToken?.trim()) {
        throw new AnilistAccessTokenRelinkRequiredError();
      }

      return tokens.accessToken;
    } catch (error) {
      const errorCode = getBetterAuthErrorCode(error);

      if (errorCode === 'ACCOUNT_NOT_FOUND') {
        throw new AnilistAccountNotLinkedError();
      }

      if (errorCode === 'FAILED_TO_GET_ACCESS_TOKEN') {
        throw new AnilistAccessTokenRelinkRequiredError();
      }

      throw error;
    }
  }
}
