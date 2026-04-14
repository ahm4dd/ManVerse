import { z } from 'zod';

export const viewerIdSchema = z.object({
  id: z.number(),
});

export const viewerIdDataSchema = z.object({
  Viewer: viewerIdSchema.nullable(),
});

export type ViewerId = z.infer<typeof viewerIdSchema>;
export type ViewerIdData = z.infer<typeof viewerIdDataSchema>;
