import { z } from 'zod';

export const profileFavouriteMangaSchema = z.object({
  id: z.number(),
  chapters: z.number().nullable(),
  title: z.object({
    romaji: z.string().nullable(),
    english: z.string().nullable(),
    native: z.string().nullable(),
  }),
  coverImage: z.object({
    large: z.string().nullable(),
  }),
});

export const profileUserSchema = z.object({
  id: z.number(),
  name: z.string(),
  about: z.string().nullable(),
  bannerImage: z.string().nullable(),
  siteUrl: z.string().nullable(),
  createdAt: z.number().nullable(),
  avatar: z
    .object({
      large: z.string().nullable(),
    })
    .nullable(),
  favourites: z
    .object({
      manga: z.object({
        nodes: z.array(profileFavouriteMangaSchema),
      }),
    })
    .nullable(),
});

export const viewerProfileDataSchema = z.object({
  Viewer: profileUserSchema.nullable(),
});

export const userProfileDataSchema = z.object({
  User: profileUserSchema.nullable(),
});

export const userProfileInputSchema = z
  .object({
    id: z.number().int().positive().optional(),
    name: z.string().min(1).optional(),
  })
  .refine(
    (value) =>
      typeof value.id !== 'undefined' || typeof value.name !== 'undefined',
    {
      message: 'Either id or name is required',
    },
  );

export type ProfileFavouriteManga = z.infer<typeof profileFavouriteMangaSchema>;
export type ProfileUser = z.infer<typeof profileUserSchema>;
export type ViewerProfileData = z.infer<typeof viewerProfileDataSchema>;
export type UserProfileData = z.infer<typeof userProfileDataSchema>;
export type UserProfileInput = z.infer<typeof userProfileInputSchema>;
