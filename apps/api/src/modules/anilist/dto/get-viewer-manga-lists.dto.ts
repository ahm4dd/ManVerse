import { createZodDto } from 'nestjs-zod';
import z from 'zod';

export const getViewerMangaListsQueryDtoSchema = z
  .object({
    chunk: z.coerce
      .number()
      .int()
      .positive()
      .optional()
      .describe('AniList chunk number to request, starting at 1'),
    perChunk: z.coerce
      .number()
      .int()
      .positive()
      .max(500)
      .optional()
      .describe('Number of AniList list groups to request per chunk'),
  })
  .meta({
    id: 'AniListGetViewerMangaListsQuery',
    description:
      'AniList viewer manga list query parameters. Supports optional chunk pagination.',
  });

export class GetViewerMangaListsQueryDto extends createZodDto(
  getViewerMangaListsQueryDtoSchema,
) {}
