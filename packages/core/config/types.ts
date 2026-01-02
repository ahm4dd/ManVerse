import { z } from 'zod';

export const BrowserConfigSchema = z.object({
  headless: z.union([z.boolean(), z.literal('shell')]).default('shell'),
  args: z.array(z.string()).default(['--no-sandbox', '--disable-setuid-sandbox']),
  viewport: z
    .object({
      width: z.number().default(1920),
      height: z.number().default(1080),
    })
    .default({ width: 1920, height: 1080 }),
  userAgent: z.string().optional(),
  timeout: z.number().default(60000), // Default timeout in milliseconds (60 seconds)
});

export type BrowserConfig = z.infer<typeof BrowserConfigSchema>;
