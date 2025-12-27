import { z } from 'zod';
import { JobType, JobStatus } from '../types/queue.js';

/**
 * Zod schemas for queue message validation
 */

export const BaseJobSchema = z.object({
  id: z.uuid(),
  type: z.enum(Object.values(JobType) as [string, ...string[]]),
  status: z.enum(Object.values(JobStatus) as [string, ...string[]]),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  attempts: z.number().int().min(0),
  maxAttempts: z.number().int().min(1),
  error: z.string().optional(),
});

export const ScrapeSearchJobDataSchema = z.object({
  searchTerm: z.string().min(1),
  page: z.number().int().positive(),
  provider: z.string(),
});

export const ScrapeManhwaJobDataSchema = z.object({
  manhwaUrl: z.string().url(),
  provider: z.string(),
});

export const ScrapeChapterJobDataSchema = z.object({
  chapterUrl: z.string().url(),
  provider: z.string(),
});

export const DownloadChapterJobDataSchema = z.object({
  chapterUrl: z.string().url(),
  outputDir: z.string(),
  provider: z.string(),
});

export const GeneratePdfJobDataSchema = z.object({
  imagePaths: z.array(z.string()).min(1),
  outputPath: z.string(),
  title: z.string().optional(),
});

export const UploadFileJobDataSchema = z.object({
  filePath: z.string(),
  destination: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const ScrapeSearchJobSchema = BaseJobSchema.extend({
  type: z.literal(JobType.SCRAPE_SEARCH),
  data: ScrapeSearchJobDataSchema,
});

export const ScrapeManhwaJobSchema = BaseJobSchema.extend({
  type: z.literal(JobType.SCRAPE_MANHWA),
  data: ScrapeManhwaJobDataSchema,
});

export const ScrapeChapterJobSchema = BaseJobSchema.extend({
  type: z.literal(JobType.SCRAPE_CHAPTER),
  data: ScrapeChapterJobDataSchema,
});

export const DownloadChapterJobSchema = BaseJobSchema.extend({
  type: z.literal(JobType.DOWNLOAD_CHAPTER),
  data: DownloadChapterJobDataSchema,
});

export const GeneratePdfJobSchema = BaseJobSchema.extend({
  type: z.literal(JobType.GENERATE_PDF),
  data: GeneratePdfJobDataSchema,
});

export const UploadFileJobSchema = BaseJobSchema.extend({
  type: z.literal(JobType.UPLOAD_FILE),
  data: UploadFileJobDataSchema,
});

export const JobSchema = z.discriminatedUnion('type', [
  ScrapeSearchJobSchema,
  ScrapeManhwaJobSchema,
  ScrapeChapterJobSchema,
  DownloadChapterJobSchema,
  GeneratePdfJobSchema,
  UploadFileJobSchema,
]);

export const JobResultSchema = z.object({
  jobId: z.uuid(),
  status: z.enum(Object.values(JobStatus) as [string, ...string[]]),
  data: z.unknown().optional(),
  error: z.string().optional(),
});
