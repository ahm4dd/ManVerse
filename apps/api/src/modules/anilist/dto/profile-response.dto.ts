import { profileUserSchema } from '@manverse/anilist-client';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const anilistProfileResponseDtoSchema = profileUserSchema.meta({
  id: 'AniListProfileResponse',
  description: 'An AniList profile returned by the lookup endpoints',
});

export type AniListProfileResponse = z.infer<
  typeof anilistProfileResponseDtoSchema
>;

export type AniListProfileNullableResponse = AniListProfileResponse | null;

export class AniListProfileResponseDto extends createZodDto(
  anilistProfileResponseDtoSchema,
) {}
