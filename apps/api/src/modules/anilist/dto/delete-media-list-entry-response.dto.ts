import { deleteMediaListEntryResultSchema } from '@manverse/anilist-client';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const deleteMediaListEntryResponseDtoSchema =
  deleteMediaListEntryResultSchema.meta({
    id: 'AniListDeleteMediaListEntryResponse',
    description:
      'The AniList library deletion result for the requested entry id.',
  });

export type DeleteMediaListEntryResponse = z.infer<
  typeof deleteMediaListEntryResponseDtoSchema
>;

export class DeleteMediaListEntryResponseDto extends createZodDto(
  deleteMediaListEntryResponseDtoSchema,
) {}
