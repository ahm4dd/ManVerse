import { saveMediaListEntryInputSchema } from '@manverse/anilist-client';
import { createZodDto } from 'nestjs-zod';

export const saveMediaListEntryDtoSchema = saveMediaListEntryInputSchema.meta({
  id: 'AniListSaveMediaListEntryBody',
  description:
    'Body payload for saving or updating an AniList manga library entry.',
});

export class SaveMediaListEntryDto extends createZodDto(
  saveMediaListEntryDtoSchema,
) {}
