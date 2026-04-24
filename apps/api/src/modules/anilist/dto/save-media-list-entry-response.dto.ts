import { saveMediaListEntrySchema } from '@manverse/anilist-client';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const saveMediaListEntryResponseDtoSchema =
  saveMediaListEntrySchema.meta({
    id: 'AniListSaveMediaListEntryResponse',
    description:
      'The AniList library entry returned after a successful save or update.',
  });

export type SaveMediaListEntryResponse = z.infer<
  typeof saveMediaListEntryResponseDtoSchema
>;

export class SaveMediaListEntryResponseDto extends createZodDto(
  saveMediaListEntryResponseDtoSchema,
) {}
