import { createZodDto } from 'nestjs-zod';
import z from 'zod';

export const getUserQueryDtoSchema = z
  .object({
    id: z.coerce
      .number()
      .int()
      .positive()
      .optional()
      .describe('AniList numeric user ID to resolve'),
    name: z
      .string()
      .min(1)
      .optional()
      .describe('AniList user name or handle to resolve'),
  })
  .superRefine((data, ctx) => {
    if (data.id === undefined && data.name === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'AniList requires at least one query argument: id or name.',
      });
    }
  })
  .meta({
    id: 'AniListGetUserQuery',
    description:
      'AniList user lookup query. Provide either a numeric id or a username.',
  });

export class GetUserQueryDto extends createZodDto(getUserQueryDtoSchema) {}
