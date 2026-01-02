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
  /** Total size in bytes (if content-length known) or total number of images */
  total: number;
  /** Current downloaded bytes or number of images processed */
  current: number;
  /** The name/URL of the file currently being processed */
  currentFile?: string;
}

export interface DownloadOptions {
  /** Absolute path to the destination folder */
  path: string;
  /** Number of concurrent downloads (default: 5) */
  concurrency?: number;
  /** Custom HTTP headers to include in requests */
  headers?: Record<string, string>;
  /** Callback for tracking download progress */
  onProgress?: (progress: DownloadProgress) => void;
}

export interface DownloadResult {
  /** Whether the entire chapter was downloaded successfully */
  success: boolean;
  /** Ordered list of absolute paths to the downloaded files */
  files: string[];
  /** List of errors encountered during download */
  errors: Error[];
  /** Time taken for the operation in milliseconds */
  timeTakenMs: number;
}

export interface IDownloader {
  downloadChapter(chapter: ManhwaChapter, options: DownloadOptions): Promise<DownloadResult>;
}

// ------------------ PDF Generator Types ------------------

export interface IPDFGenerator {
  /** Generate a PDF from a list of image file paths */
  generate(imagePaths: string[], outputPath: string): Promise<void>;
}

export interface PDFDownloadOptions extends DownloadOptions {
  /** If true, keep temporary image files after PDF generation */
  keepImages?: boolean;
  /** If true, overwrite existing files even if they strictly match the expected output path */
  force?: boolean;
}

export interface PDFDownloadResult extends DownloadResult {
  /** Absolute path to the generated PDF file */
  pdfPath: string;
}

// -----------------------------------------------------

export type SearchedManhwa = z.infer<typeof SearchedManhwa>;
export type SearchResult = z.infer<typeof SearchResult>;
export type Manhwa = z.infer<typeof Manhwa>;
export type ManhwaChapter = z.infer<typeof ManhwaChapter>;
