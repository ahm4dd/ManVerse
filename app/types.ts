import type { Source, ProviderType } from './lib/providers';

export interface Series {
  id: string;
  title: string;
  image: string;
  bannerImage?: string; // Added for high-quality landscape images
  status: string;
  rating: string;
  latestChapter: string;
  updatedAt?: number; // Added for release date calculation
  type?: string;
  genres?: string[];
  source?: Source;
  nextAiringEpisode?: {
    airingAt: number;
    timeUntilAiring: number;
    episode: number;
  };
  recentChapters?: {
    name: string;
    date: string;
  }[];
}

export interface SeriesDetails extends Series {
  description: string;
  genres: string[];
  author: string;
  artist: string;
  serialization: string;
  updatedOn: string;
  chapters: Chapter[];
  providerMangaId?: number;
  recommendations?: Series[]; // New field
  userListStatus?: 'CURRENT' | 'PLANNING' | 'COMPLETED' | 'DROPPED' | 'PAUSED' | 'REPEATING' | null;
  mediaListEntry?: {
    progress?: number | null;
    status?: string | null;
  };
  format?: string | null;
  countryOfOrigin?: string | null;
  averageScore?: number | null;
  meanScore?: number | null;
  popularity?: number | null;
  favourites?: number | null;
  sourceMaterial?: string | null;
  startDate?: { year?: number | null; month?: number | null; day?: number | null } | null;
  endDate?: { year?: number | null; month?: number | null; day?: number | null } | null;
  titles?: {
    romaji?: string | null;
    english?: string | null;
    native?: string | null;
    userPreferred?: string | null;
  };
  synonyms?: string[];
  tags?: { id: number; name: string; rank: number; isMediaSpoiler?: boolean }[];
  characters?: { id: number; name: string; role?: string; image?: string }[];
  staffMembers?: { id: number; name: string; role?: string; image?: string }[];
  rankings?: { id: number; rank: number; type?: string; allTime?: boolean; context?: string }[];
  statusDistribution?: { status: string; amount: number }[];
  scoreDistribution?: { score: number; amount: number }[];
  siteUrl?: string;
}

export interface Chapter {
  id: string;
  number: string;
  title: string;
  date: string;
  url: string;
}

export interface ChapterPage {
  page: number;
  src: string;
}

export type ScraperOperation = 'search' | 'details' | 'chapters' | 'chapter' | 'image';

export interface ScraperLogEvent {
  id: string;
  timestamp: number;
  requestId?: string;
  provider: ProviderType;
  operation: ScraperOperation;
  ok: boolean;
  durationMs: number;
  errorCode?: string;
  message?: string;
}

export interface ScraperLogAction {
  operation: ScraperOperation;
  total: number;
  success: number;
  failed: number;
  avgDurationMs: number;
  lastError?: {
    message?: string;
    code?: string;
    at?: string;
  };
}

export interface ScraperLogProvider {
  provider: ProviderType;
  total: number;
  success: number;
  failed: number;
  avgDurationMs: number;
  lastError?: {
    message?: string;
    code?: string;
    at?: string;
    operation?: ScraperOperation;
  };
  actions: ScraperLogAction[];
}

export interface ScraperLogHealth {
  updatedAt: string;
  total: number;
  success: number;
  failed: number;
  avgDurationMs: number;
  providers: ScraperLogProvider[];
  recentErrors: ScraperLogEvent[];
}

export interface ScraperLoggingStatus {
  enabled: boolean;
  logFile: string | null;
  sizeBytes: number;
  maxBytes: number;
  maxFiles: number;
}

export interface ScraperLogBundle {
  generatedAt: string;
  status: ScraperLoggingStatus;
  health: ScraperLogHealth;
  recentEvents: ScraperLogEvent[];
  fileTail: string[];
}

export interface SearchResult {
  results: Series[];
  currentPage: number;
  hasNextPage: boolean;
}

export interface Notification {
  id: string | number;
  type: 'APP_UPDATE' | 'CHAPTER_RELEASE' | 'ANILIST_ACTIVITY';
  title: string;
  message: string;
  time: string;
  read: boolean;
  image?: string;
  timestamp?: number;
}

export interface MediaListCollection {
  lists: {
    name: string;
    entries: {
      id: number;
      media: {
        id: number;
        title: {
          romaji: string;
          english: string;
        };
        coverImage: {
          extraLarge: string;
        };
        status: string;
      };
      progress: number;
    }[];
  }[];
}
