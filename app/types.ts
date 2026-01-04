
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
  source?: 'AniList' | 'AsuraScans';
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

export interface SearchResult {
  results: Series[];
  currentPage: number;
  hasNextPage: boolean;
}

export interface Notification {
  id: number;
  type: 'APP_UPDATE' | 'CHAPTER_RELEASE' | 'ANILIST_ACTIVITY';
  title: string;
  message: string;
  time: string;
  read: boolean;
  image?: string;
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

// Scraper Configuration Types
export interface AsuraScansConfig {
  name: string;
  baseUrl: string;
  timeout: number;
  retries: number;
  headers: {
    referer: string;
    userAgent: string;
  };
  selectors: {
    search: {
      resultContainer: string;
      nextButton: string;
      previousButton: string;
      structure: {
        firstDiv: string;
        innerDiv: string;
        scopeDiv: string;
        statusSpan: string;
        image: string;
        spans: string;
        ratingText: string;
      };
      pagination: {
        nextButtonText: string;
        previousButtonText: string;
      };
    };
    detail: {
      title: string;
      image: string;
      status: string;
      rating: string;
      followers: string;
      genres: string;
      chapters: string;
      gridElements: string;
      synopsisHeading: string;
      chapterLink: string;
      chapterTitle: string;
      chapterDate: string;
    };
    chapter: {
      images: string;
    };
  };
  output: {
    directory: string;
    fileExtension: string;
    filenamePadding: number;
  };
}

export interface IScraper {
  search(query: string, page?: number): Promise<SearchResult>;
  getSeriesDetails(id: string): Promise<SeriesDetails>;
  getChapterImages(chapterId: string): Promise<ChapterPage[]>;
}
