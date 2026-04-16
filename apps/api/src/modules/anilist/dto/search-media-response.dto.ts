import { searchMediaPageSchema } from '@manverse/anilist-client';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const anilistSearchMediaPageResponseDtoSchema =
  searchMediaPageSchema.meta({
    id: 'AniListSearchMediaPageResponse',
    description: 'An AniList media search page returned by the lookup endpoint',
  });

export type AniListSearchMediaPageResponse = z.infer<
  typeof anilistSearchMediaPageResponseDtoSchema
>;

export type AniListSearchMediaPageNullableResponse =
  AniListSearchMediaPageResponse | null;

export class AniListSearchMediaPageResponseDto extends createZodDto(
  anilistSearchMediaPageResponseDtoSchema,
) {}
