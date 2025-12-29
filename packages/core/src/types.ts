import { z } from 'zod';
/**
 * Base schema for searched manhwa results
 *
 * Using .passthrough() allows each scraper to add their own specific fields
 * while maintaining the required base structure. This makes the scraper system
 * more flexible and allows scrapers like AsuraScans to include extra metadata
 * (status, chapters, rating, etc.) without type conflicts.
 */
const SearchedManhwa = z
  .object({
    id: z.string(),
    title: z.string(),
    altTitles: z.array(z.string()),
    headerForImage: z.object({ Referer: z.string() }),
    image: z.string(),
  })
  .loose(); // Allow additional properties from specific scrapers

const SearchResult = z.object({
  currentPage: z.number().default(0),
  hasNextPage: z.boolean().default(false),
  results: z.array(SearchedManhwa),
});

/**
 * Base schema for manhwa details
 *
 * Similar to SearchedManhwa, we use .loose() to allow each scraper to add
 * their own specific metadata while maintaining a common base structure.
 */
export const Manhwa = z
  .object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    image: z.string(),
    headerForImage: z.object({ Referer: z.string() }),
    status: z.string(), // "Ongoing", "Completed", "Hiatus", etc.
    rating: z.string().optional(),
    genres: z.array(z.string()),
    chapters: z.array(
      z.object({
        chapterNumber: z.string(),
        chapterTitle: z.string().optional(),
        chapterUrl: z.string(),
        releaseDate: z.string().optional(),
      }),
    ),
  })
  .loose(); // Allow additional properties from specific scrapers

export const ManhwaChapter = z.array(
  z.object({
    page: z.number(),
    img: z.string(),
    headerForImage: z.string(),
  }),
);

export const NetworkConfigSchema = z.object({
  timeout: z.number().default(60000),
  retries: z.number().default(3),
  headers: z
    .object({
      referer: z.string().optional(),
      userAgent: z.string().optional(),
    })
    .default({}),
});

export type NetworkConfig = z.infer<typeof NetworkConfigSchema>;

// ------------------ Downloader Types ------------------

export interface DownloadProgress {
  total: number; // Total bytes (if known) or total images
  current: number; // Bytes downloaded or images processed
  currentFile?: string; // Currently processing file
}

export interface DownloadOptions {
  path: string;
  concurrency?: number;
  headers?: Record<string, string>;
  // For the TUI to show a progress bar
  onProgress?: (progress: DownloadProgress) => void;
}

export interface DownloadResult {
  success: boolean;
  files: string[]; // Ordered list of downloaded file paths
  errors: Error[];
  timeTaken: number; // ms
}

export interface IDownloader {
  downloadChapter(chapter: ManhwaChapter, options: DownloadOptions): Promise<DownloadResult>;
}

// -----------------------------------------------------

export type SearchedManhwa = z.infer<typeof SearchedManhwa>;
export type SearchResult = z.infer<typeof SearchResult>;
export type Manhwa = z.infer<typeof Manhwa>;
export type ManhwaChapter = z.infer<typeof ManhwaChapter>;
