import { toggleFavouriteInputSchema } from '@manverse/anilist-client';
import { createZodDto } from 'nestjs-zod';

export const toggleFavouriteDtoSchema = toggleFavouriteInputSchema.meta({
  id: 'AniListToggleFavouriteBody',
  description: 'Body payload for toggling an AniList manga favourite.',
});

export class ToggleFavouriteDto extends createZodDto(
  toggleFavouriteDtoSchema,
) {}
