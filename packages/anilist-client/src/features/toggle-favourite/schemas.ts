import { z } from 'zod';

export const toggleFavouriteMediaTitleSchema = z.object({
  romaji: z.string().nullable(),
  english: z.string().nullable(),
  native: z.string().nullable(),
  userPreferred: z.string(),
});

export const toggleFavouriteMediaSchema = z.object({
  id: z.number(),
  title: toggleFavouriteMediaTitleSchema,
});

export const toggleFavouriteMangaConnectionSchema = z.object({
  nodes: z.array(toggleFavouriteMediaSchema),
});

export const toggleFavouritePayloadSchema = z.object({
  manga: toggleFavouriteMangaConnectionSchema.nullable(),
});

export const toggleFavouriteDataSchema = z.object({
  ToggleFavourite: toggleFavouritePayloadSchema,
});

export const toggleFavouriteInputSchema = z.object({
  mediaId: z.number().int().positive(),
});

export const toggleFavouriteResultSchema = z.object({
  mediaId: z.number().int().positive(),
  isFavourite: z.boolean(),
  media: toggleFavouriteMediaSchema.nullable(),
});

export type ToggleFavouriteMediaTitle = z.infer<
  typeof toggleFavouriteMediaTitleSchema
>;
export type ToggleFavouriteMedia = z.infer<typeof toggleFavouriteMediaSchema>;
export type ToggleFavouriteMangaConnection = z.infer<
  typeof toggleFavouriteMangaConnectionSchema
>;
export type ToggleFavouritePayload = z.infer<
  typeof toggleFavouritePayloadSchema
>;
export type ToggleFavouriteData = z.infer<typeof toggleFavouriteDataSchema>;
export type ToggleFavouriteInput = z.input<typeof toggleFavouriteInputSchema>;
export type ToggleFavouriteResult = z.infer<typeof toggleFavouriteResultSchema>;
