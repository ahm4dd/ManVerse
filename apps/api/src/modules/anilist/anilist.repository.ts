import { Injectable } from '@nestjs/common';
import { AuthService } from '@thallesp/nestjs-better-auth';
import auth, { getBetterAuthErrorCode } from '../../lib/auth.js';
import { ANILIST_PROVIDER_ID } from '../../common/constants/provider.constants.js';
import {
  AnilistAccountNotLinkedError,
  AnilistAccessTokenRelinkRequiredError,
} from './anilist.errors.js';

@Injectable()
export class AnilistRepository {
  constructor(private readonly authService: AuthService<typeof auth>) {}

  async getCurrentUserAccessToken(userId: string): Promise<string> {
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
