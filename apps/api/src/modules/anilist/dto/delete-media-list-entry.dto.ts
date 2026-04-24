import { createZodDto } from 'nestjs-zod';
import z from 'zod';

export const deleteMediaListEntryParamsDtoSchema = z
  .object({
    entryId: z.coerce
      .number()
      .int()
      .positive()
      .describe('AniList library entry identifier to delete'),
  })
  .meta({
    id: 'AniListDeleteMediaListEntryParams',
    description:
      'Route params for deleting an AniList manga library entry by entry id.',
  });

export class DeleteMediaListEntryParamsDto extends createZodDto(
  deleteMediaListEntryParamsDtoSchema,
) {}
