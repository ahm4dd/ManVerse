import { z } from 'zod';

export const JobType = {
  SCRAPE_SEARCH: 'scrape.search',
  SCRAPE_MANHWA: 'scrape.manhwa',
  SCRAPE_CHAPTER: 'scrape.chapter',
  DOWNLOAD_CHAPTER: 'download.chapter',
  GENERATE_PDF: 'generate.pdf',
  UPLOAD_FILE: 'upload.file',
} as const;

export type JobType = (typeof JobType)[keyof typeof JobType];

export const JobStatus = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  RETRYING: 'retrying',
} as const;

export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus];

export * from './queue-names.ts';

export const SearchedManhwaSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    altTitles: z.array(z.string()),
    headerForImage: z.object({ Referer: z.string() }).optional(),
    image: z.string(),
  })
  .passthrough();

export type SearchedManhwa = z.infer<typeof SearchedManhwaSchema>;

export const SearchResultSchema = z.object({
  currentPage: z.number().default(0),
  hasNextPage: z.boolean().default(false),
  results: z.array(SearchedManhwaSchema),
});

export type SearchResult = z.infer<typeof SearchResultSchema>;

export const ManhwaChapterSchema = z.object({
  chapterNumber: z.string(),
  chapterTitle: z.string().optional(),
  chapterUrl: z.string(),
  releaseDate: z.string().optional(),
});

export type ManhwaChapter = z.infer<typeof ManhwaChapterSchema>;

export const ManhwaSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    image: z.string(),
    headerForImage: z.object({ Referer: z.string() }).optional(),
    status: z.string(),
    rating: z.string().optional(),
    genres: z.array(z.string()),
    chapters: z.array(ManhwaChapterSchema),
  })
  .passthrough();

export type Manhwa = z.infer<typeof ManhwaSchema>;

export const ManhwaChapterImagesSchema = z.array(
  z.object({
    page: z.number(),
    img: z.string(),
    headerForImage: z.string().optional(),
  }),
);

export type ManhwaChapterImage = z.infer<typeof ManhwaChapterImagesSchema>[number];

export const BaseJobSchema = z.object({
  id: z.string().uuid(),
  type: z.string(),
  status: z.enum(Object.values(JobStatus) as [string, ...string[]]),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  attempts: z.number().int().min(0),
  maxAttempts: z.number().int().min(1),
  error: z.string().optional(),
});

/**
 * Job Payload Definitions
 */
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

export type ScrapeSearchData = z.infer<typeof ScrapeSearchJobDataSchema>;
export type ScrapeManhwaData = z.infer<typeof ScrapeManhwaJobDataSchema>;
export type ScrapeChapterData = z.infer<typeof ScrapeChapterJobDataSchema>;
export type DownloadChapterData = z.infer<typeof DownloadChapterJobDataSchema>;
export type GeneratePdfData = z.infer<typeof GeneratePdfJobDataSchema>;
export type UploadFileData = z.infer<typeof UploadFileJobDataSchema>;

/**
 * Union Payloads
 */
export type JobPayload =
  | { type: typeof JobType.SCRAPE_SEARCH; data: ScrapeSearchData }
  | { type: typeof JobType.SCRAPE_MANHWA; data: ScrapeManhwaData }
  | { type: typeof JobType.SCRAPE_CHAPTER; data: ScrapeChapterData }
  | { type: typeof JobType.DOWNLOAD_CHAPTER; data: DownloadChapterData }
  | { type: typeof JobType.GENERATE_PDF; data: GeneratePdfData }
  | { type: typeof JobType.UPLOAD_FILE; data: UploadFileData };

export const JobPayloadSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal(JobType.SCRAPE_SEARCH), data: ScrapeSearchJobDataSchema }),
  z.object({ type: z.literal(JobType.SCRAPE_MANHWA), data: ScrapeManhwaJobDataSchema }),
  z.object({ type: z.literal(JobType.SCRAPE_CHAPTER), data: ScrapeChapterJobDataSchema }),
  z.object({ type: z.literal(JobType.DOWNLOAD_CHAPTER), data: DownloadChapterJobDataSchema }),
  z.object({ type: z.literal(JobType.GENERATE_PDF), data: GeneratePdfJobDataSchema }),
  z.object({ type: z.literal(JobType.UPLOAD_FILE), data: UploadFileJobDataSchema }),
]);

export type Job<T = any, R = any> = {
  id: string;
  type: JobType;
  status: JobStatus;
  data: T;
  createdAt: Date;
  updatedAt: Date;
  attempts: number;
  maxAttempts: number;
  error?: string;
  result?: R;
  updateProgress?: (progress: number | object) => Promise<void>;
};

export type JobResult<T = any> = {
  jobId: string;
  status: JobStatus;
  data?: T;
  error?: string;
};
