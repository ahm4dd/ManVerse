/**
 * Common types for Manhwa/Manga content
 * Synced with apps/scraper/generalScraper.ts
 */

export interface SearchResult {
  currentPage: number;
  hasNextPage: boolean;
  results: SearchResultItem[];
}

export interface SearchResultItem {
  id: string;
  title: string;
  altTitles: string[];
  image: string;
  headerForImage?: { Referer: string };
  // Extra fields allowed by .loose() in scraper
  status?: string;
  rating?: string;
  [key: string]: unknown;
}

export interface Manhwa {
  id: string;
  title: string;
  description: string;
  image: string;
  headerForImage?: { Referer: string };
  status: string;
  rating?: string;
  genres: string[];
  chapters: ChapterInfo[];
  // Extra fields that populate implementation details
  followers?: string;
  author?: string;
  artist?: string;
  serialization?: string;
  updatedOn?: string;
  [key: string]: unknown;
}

export interface ChapterInfo {
  chapterNumber: string;
  chapterTitle?: string;
  chapterUrl: string;
  releaseDate?: string;
}

export interface ChapterPage {
  page: number;
  img: string;
  headerForImage?: { Referer: string };
}

export type ManhwaChapter = ChapterPage[];

export interface DownloadProgress {
  chapterId: string;
  current: number;
  total: number;
  status: 'pending' | 'downloading' | 'completed' | 'failed';
  error?: string;
}
