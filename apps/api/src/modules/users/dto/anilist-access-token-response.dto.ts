import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ANILIST_PROVIDER_ID } from '../../../common/constants/provider.constants.js';

const AnilistAccessTokenResponseDtoSchema = z
  .strictObject({
    providerId: z
      .literal(ANILIST_PROVIDER_ID)
      .describe('The linked provider identifier'),
    accessToken: z
      .string()
      .min(1)
      .describe('The current user AniList access token'),
  })
  .meta({
    id: 'AnilistAccessTokenResponse',
    description:
      'The current authenticated user AniList access token for direct browser-to-AniList requests',
  });

export class AnilistAccessTokenResponseDto extends createZodDto(
  AnilistAccessTokenResponseDtoSchema,
) {}
