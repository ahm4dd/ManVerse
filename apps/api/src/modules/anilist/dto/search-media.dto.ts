import { createZodDto } from 'nestjs-zod';
import z from 'zod';

export const searchMediaQueryDtoSchema = z
  .object({
    search: z
      .string()
      .min(1)
      .describe(
        'AniList media search phrase, usually a title or partial title',
      ),
    page: z.coerce
      .number()
      .int()
      .positive()
      .optional()
      .default(1)
      .describe('AniList page number to request, starting at 1'),
    perPage: z.coerce
      .number()
      .int()
      .positive()
      .max(50)
      .optional()
      .default(10)
      .describe('Number of AniList media results to return per page, up to 50'),
    isAdult: z
      .preprocess((value) => {
        if (typeof value === 'string') {
          const normalizedValue = value.trim().toLowerCase();

          if (normalizedValue === 'true') {
            return true;
          }

          if (normalizedValue === 'false') {
            return false;
          }
        }

        return value;
      }, z.boolean().optional())
      .optional()
      .default(false)
      .describe('Whether to include adult media in the search results'),
  })
  .meta({
    id: 'AniListSearchMediaQuery',
    description:
      'AniList media search query parameters. Supports optional pagination and adult-content filtering.',
  });

export class SearchMediaDto extends createZodDto(searchMediaQueryDtoSchema) {}
