import { createZodDto } from 'nestjs-zod';
import z from 'zod';

export const getUserQueryDtoSchema = z
  .object({
    id: z.coerce.number().optional(),
    name: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    if (!(val.name || val.id)) {
      ctx.addIssue({
        code: 'custom',
        path: ['ANILIST_GET_USER_QUERY_MISSING'],
        message: 'AniList requires at least one query argument: id or name.',
      });
    }
  });

// TODO: spiritually accept Kai's answer to zod schemas
// Kai's passionate type refinement
// const schema = z.union([
//   z.object({ name: z.string(), id: z.number() }),
//   z.object({ name: z.string() }),
//   z.object({ id: z.number() }),
// ]);

// type test = z.infer<typeof schema>;

export class GetUserQueryDto extends createZodDto(getUserQueryDtoSchema) {}
// export class GetUserQueryDto extends createZodDto(schema) {}
