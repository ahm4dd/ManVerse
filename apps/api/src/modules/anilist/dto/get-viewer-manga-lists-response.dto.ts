import {
  viewerMangaListCollectionSchema,
  viewerMangaListCoverImageSchema,
  viewerMangaListEntrySchema,
  viewerMangaListFuzzyDateSchema,
  viewerMangaListGroupSchema,
  viewerMangaListMediaSchema,
  viewerMangaListTitleSchema,
} from '@manverse/anilist-client';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const viewerMangaListFuzzyDateDtoSchema = z
  .object({
    year: viewerMangaListFuzzyDateSchema.shape.year.describe(
      'Calendar year for the tracked list date',
    ),
    month: viewerMangaListFuzzyDateSchema.shape.month.describe(
      'Calendar month for the tracked list date',
    ),
    day: viewerMangaListFuzzyDateSchema.shape.day.describe(
      'Calendar day for the tracked list date',
    ),
  })
  .meta({
    id: 'AniListViewerMangaListFuzzyDate',
    description: 'A fuzzy date returned by AniList for list progress metadata',
  });

const viewerMangaListTitleDtoSchema = z
  .object({
    romaji: viewerMangaListTitleSchema.shape.romaji.describe(
      'Romaji title variant',
    ),
    english: viewerMangaListTitleSchema.shape.english.describe(
      'English title variant',
    ),
    native: viewerMangaListTitleSchema.shape.native.describe(
      'Native title variant',
    ),
    userPreferred: viewerMangaListTitleSchema.shape.userPreferred.describe(
      'AniList user-preferred title variant',
    ),
  })
  .meta({
    id: 'AniListViewerMangaListTitle',
    description: 'Localized title variants for an AniList media entry',
  });

const viewerMangaListCoverImageDtoSchema = z
  .object({
    extraLarge: viewerMangaListCoverImageSchema.shape.extraLarge.describe(
      'Extra-large cover image URL',
    ),
    large: viewerMangaListCoverImageSchema.shape.large.describe(
      'Large cover image URL',
    ),
    medium: viewerMangaListCoverImageSchema.shape.medium.describe(
      'Medium cover image URL',
    ),
    color: viewerMangaListCoverImageSchema.shape.color.describe(
      'Representative cover color',
    ),
  })
  .meta({
    id: 'AniListViewerMangaListCoverImage',
    description: 'Cover image metadata for an AniList media entry',
  });

const viewerMangaListMediaDtoSchema = z
  .object({
    id: viewerMangaListMediaSchema.shape.id.describe(
      'AniList media ID for the manga entry',
    ),
    idMal: viewerMangaListMediaSchema.shape.idMal.describe(
      'MyAnimeList ID, when AniList has one',
    ),
    title: viewerMangaListTitleDtoSchema.describe(
      'Localized titles for the manga entry',
    ),
    coverImage: viewerMangaListCoverImageDtoSchema.describe(
      'Cover image variants for the manga entry',
    ),
    format: viewerMangaListMediaSchema.shape.format.describe(
      'AniList media format',
    ),
    status: viewerMangaListMediaSchema.shape.status.describe(
      'AniList media publication status',
    ),
    chapters: viewerMangaListMediaSchema.shape.chapters.describe(
      'Total chapter count, when available',
    ),
    volumes: viewerMangaListMediaSchema.shape.volumes.describe(
      'Total volume count, when available',
    ),
    countryOfOrigin: viewerMangaListMediaSchema.shape.countryOfOrigin.describe(
      'Country of origin for the media',
    ),
    siteUrl: viewerMangaListMediaSchema.shape.siteUrl.describe(
      'AniList media site URL',
    ),
  })
  .meta({
    id: 'AniListViewerMangaListMedia',
    description: 'AniList manga metadata attached to a viewer list entry',
  });

const viewerMangaListEntryDtoSchema = z
  .object({
    id: viewerMangaListEntrySchema.shape.id.describe('AniList list entry ID'),
    mediaId: viewerMangaListEntrySchema.shape.mediaId.describe(
      'AniList media ID referenced by the list entry',
    ),
    status: viewerMangaListEntrySchema.shape.status.describe(
      'Current entry status in the viewer list',
    ),
    score: viewerMangaListEntrySchema.shape.score.describe(
      'Numeric score assigned to the entry',
    ),
    progress: viewerMangaListEntrySchema.shape.progress.describe(
      'Chapter progress for the entry',
    ),
    progressVolumes: viewerMangaListEntrySchema.shape.progressVolumes.describe(
      'Volume progress for the entry',
    ),
    repeat: viewerMangaListEntrySchema.shape.repeat.describe(
      'How many times the entry has been reread',
    ),
    priority: viewerMangaListEntrySchema.shape.priority.describe(
      'Entry priority set by the viewer',
    ),
    private: viewerMangaListEntrySchema.shape.private.describe(
      'Whether the entry is hidden from others',
    ),
    hiddenFromStatusLists:
      viewerMangaListEntrySchema.shape.hiddenFromStatusLists.describe(
        'Whether the entry is hidden from status-based list views',
      ),
    notes: viewerMangaListEntrySchema.shape.notes.describe(
      'Freeform notes attached to the entry',
    ),
    updatedAt: viewerMangaListEntrySchema.shape.updatedAt.describe(
      'Last AniList update timestamp for the entry',
    ),
    startedAt: viewerMangaListFuzzyDateDtoSchema
      .nullable()
      .describe('When the viewer started the entry, if AniList has the date'),
    completedAt: viewerMangaListFuzzyDateDtoSchema
      .nullable()
      .describe('When the viewer completed the entry, if AniList has the date'),
    media: viewerMangaListMediaDtoSchema
      .nullable()
      .describe(
        'Expanded media metadata for the list entry, when requested by AniList',
      ),
  })
  .meta({
    id: 'AniListViewerMangaListEntry',
    description: 'A single AniList manga list entry in the viewer collection',
  });

const viewerMangaListGroupDtoSchema = z
  .object({
    name: viewerMangaListGroupSchema.shape.name.describe(
      'AniList list group name',
    ),
    isCustomList: viewerMangaListGroupSchema.shape.isCustomList.describe(
      'Whether this is a custom viewer list',
    ),
    isSplitCompletedList:
      viewerMangaListGroupSchema.shape.isSplitCompletedList.describe(
        'Whether AniList split the completed entries into a separate list',
      ),
    status: viewerMangaListGroupSchema.shape.status.describe(
      'AniList list status bucket, when applicable',
    ),
    entries: z
      .array(viewerMangaListEntryDtoSchema)
      .describe('Entries that belong to this AniList list group'),
  })
  .meta({
    id: 'AniListViewerMangaListGroup',
    description: 'A grouped AniList manga list bucket for the viewer',
  });

const viewerMangaListCollectionDtoSchema = z
  .object({
    hasNextChunk: viewerMangaListCollectionSchema.shape.hasNextChunk.describe(
      'Whether AniList has another chunk of list groups',
    ),
    lists: z
      .array(viewerMangaListGroupDtoSchema)
      .describe('Grouped AniList manga lists for the viewer'),
  })
  .meta({
    id: 'AniListViewerMangaListCollection',
    description: 'The grouped AniList manga lists for the current viewer',
  });

export const getViewerMangaListsResponseDtoSchema =
  viewerMangaListCollectionDtoSchema.meta({
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
