import { toggleFavouriteResultSchema } from '@manverse/anilist-client';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const toggleFavouriteResponseDtoSchema =
  toggleFavouriteResultSchema.meta({
    id: 'AniListToggleFavouriteResponse',
    description: 'The AniList favourite toggle result for the requested media.',
  });

export type ToggleFavouriteResponse = z.infer<
  typeof toggleFavouriteResponseDtoSchema
>;

export class ToggleFavouriteResponseDto extends createZodDto(
  toggleFavouriteResponseDtoSchema,
) {}
