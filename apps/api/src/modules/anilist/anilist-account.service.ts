import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthService } from '@thallesp/nestjs-better-auth';
import auth from '../../lib/auth.js';
import { ANILIST_PROVIDER_ID } from '../../common/constants/provider.constants.js';
import {
  ANILIST_ACCOUNT_NOT_LINKED_MESSAGE,
  ANILIST_RELINK_REQUIRED_MESSAGE,
} from '../../lib/anilist-oauth.js';

type BetterAuthErrorLike = {
  body?: {
    code?: string;
  };
};

function getBetterAuthErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object' || !('body' in error)) {
    return undefined;
  }

  const errorBody = (error as BetterAuthErrorLike).body;

  if (!errorBody || typeof errorBody !== 'object') {
    return undefined;
  }

  return typeof errorBody.code === 'string' ? errorBody.code : undefined;
}

@Injectable()
export class AnilistAccountService {
  constructor(private readonly authService: AuthService<typeof auth>) {}

  async getCurrentUserAccessToken(userId: string): Promise<string> {
    try {
      const tokens = await this.authService.api.getAccessToken({
        body: {
          providerId: ANILIST_PROVIDER_ID,
          userId,
        },
      });

      if (!tokens.accessToken) {
        throw new NotFoundException(ANILIST_RELINK_REQUIRED_MESSAGE);
      }

      return tokens.accessToken;
    } catch (error) {
      const errorCode = getBetterAuthErrorCode(error);

      if (errorCode === 'ACCOUNT_NOT_FOUND') {
        throw new NotFoundException(ANILIST_ACCOUNT_NOT_LINKED_MESSAGE);
      }

      if (errorCode === 'FAILED_TO_GET_ACCESS_TOKEN') {
        throw new NotFoundException(ANILIST_RELINK_REQUIRED_MESSAGE);
      }

      throw error;
    }
  }
}
