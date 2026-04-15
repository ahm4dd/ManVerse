import { viewerMangaListCollectionSchema } from '@manverse/anilist-client';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const getViewerMangaListsResponseDtoSchema =
  viewerMangaListCollectionSchema.meta({
    id: 'AniListViewerMangaListsResponse',
    description: 'The grouped AniList manga lists for the current viewer',
  });

export const getViewerMangaListsNullableResponseSchema =
  getViewerMangaListsResponseDtoSchema.nullable().meta({
    id: 'AniListViewerMangaListsResponseNullable',
    description:
      'The grouped AniList manga lists for the current viewer, or null when AniList has no manga list collection',
  });

export type GetViewerMangaListsResponse = z.infer<
  typeof getViewerMangaListsNullableResponseSchema
>;

export class GetViewerMangaListsResponseDto extends createZodDto(
  getViewerMangaListsResponseDtoSchema,
) {}
