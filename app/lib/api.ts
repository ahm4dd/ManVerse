import { Series, SeriesDetails, ChapterPage } from '../types';
import { anilistApi, SearchFilters } from './anilist';
import { API_URL, apiRequest } from './api-client';

export type Source = 'AniList' | 'AsuraScans';

export type DownloadJobStatus = 'queued' | 'downloading' | 'completed' | 'failed' | 'canceled';

export interface DownloadJob {
  id: string;
  provider: string;
  providerSeriesId: string;
  providerMangaId?: number;
  chapterId?: string;
  chapterUrl?: string;
  chapterNumber: string;
  chapterTitle?: string;
  seriesTitle?: string;
  seriesImage?: string;
  status: DownloadJobStatus;
  progress?: {
    total: number;
    current: number;
    currentFile?: string;
  };
  attempts: number;
  maxAttempts: number;
  error?: string;
  filePath?: string;
  fileSize?: number;
  downloadId?: number;
  createdAt: number;
  updatedAt: number;
}

export interface DownloadedSeries {
  providerMangaId: number;
  provider: string;
  providerSeriesId: string;
  title: string;
  image: string | null;
  chaptersDownloaded: number;
  totalSize: number;
  lastDownloaded: number | null;
}

export interface DownloadedChapter {
  id: number;
  providerMangaId: number;
  chapterNumber: string;
  filePath: string;
  fileSize: number | null;
  downloadedAt: number;
}

const PROVIDER_CACHE_KEY = 'manverse_provider_cache_v1';
const MAPPED_CACHE_KEY = 'manverse_provider_mapped_cache_v1';
const MAX_PROVIDER_CACHE = 20;
const providerDetailsCache = new Map<string, SeriesDetails>();
const mappedProviderCache = new Map<string, SeriesDetails>();

function loadCacheFromSession(key: string) {
  if (typeof window === 'undefined') return {};
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Record<string, SeriesDetails>) : {};
  } catch {
    return {};
  }
}

function persistCacheToSession(key: string, cache: Map<string, SeriesDetails>) {
  if (typeof window === 'undefined') return;
  try {
    const entries = Array.from(cache.entries()).slice(-MAX_PROVIDER_CACHE);
    const payload = Object.fromEntries(entries);
    sessionStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // Ignore persistence failures (storage quota, etc)
  }
}

function initCache() {
  const provider = loadCacheFromSession(PROVIDER_CACHE_KEY);
  Object.entries(provider).forEach(([id, details]) => {
    providerDetailsCache.set(id, details);
  });
  const mapped = loadCacheFromSession(MAPPED_CACHE_KEY);
  Object.entries(mapped).forEach(([id, details]) => {
    mappedProviderCache.set(id, details);
  });
}

initCache();

type ProviderSearchResult = {
  currentPage: number;
  hasNextPage: boolean;
  results: Array<{
    id: string;
    title: string;
    image: string;
    status?: string;
    chapters?: string;
    rating?: string;
    genres?: string[];
  }>;
};

type ProviderSeriesDetails = {
  id: string;
  title: string;
  description: string;
  image: string;
  status: string;
  rating?: string;
  genres?: string[];
  chapters: Array<{
    chapterNumber: string;
    chapterTitle?: string;
    chapterUrl: string;
    releaseDate?: string;
  }>;
  author?: string;
  artist?: string;
  serialization?: string;
  updatedOn?: string;
  providerMangaId?: number;
  providerId?: string;
};

type ProviderMapping = {
  mapping: {
    id: number;
    provider: string;
    provider_manga_id: number;
    is_active: number;
    updated_at: number;
  };
  provider: {
    id: number;
    provider: string;
    provider_id: string;
    title: string;
    image?: string | null;
  };
  anilist?: {
    id: number;
    title_romaji: string;
    title_english?: string | null;
    cover_large?: string | null;
    cover_medium?: string | null;
  } | null;
};

function encodeChapterId(url: string): string {
  const base = typeof btoa === 'function' ? btoa(url) : Buffer.from(url, 'utf-8').toString('base64');
  return base.replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
}

function formatSeriesResult(item: ProviderSearchResult['results'][number]): Series {
  return {
    id: item.id,
    title: item.title,
    image: item.image,
    status: item.status || 'Unknown',
    rating: item.rating || 'N/A',
    latestChapter: item.chapters || '',
    type: 'Manhwa',
    genres: item.genres,
    source: 'AsuraScans',
  };
}

function formatSeriesDetails(details: ProviderSeriesDetails): SeriesDetails {
  const chapters = details.chapters.map((ch) => ({
    id: encodeChapterId(ch.chapterUrl),
    number: ch.chapterNumber,
    title: ch.chapterTitle || `Chapter ${ch.chapterNumber}`,
    date: ch.releaseDate || '',
    url: ch.chapterUrl,
  }));

  return {
    id: details.id,
    title: details.title,
    image: details.image,
    status: details.status,
    rating: details.rating || 'N/A',
    latestChapter: chapters[0]?.title || '',
    type: 'Manhwa',
    genres: details.genres || [],
    description: details.description,
    author: details.author || 'Unknown',
    artist: details.artist || 'Unknown',
    serialization: details.serialization || 'Unknown',
    updatedOn: details.updatedOn || '',
    chapters,
    providerMangaId: details.providerMangaId,
    source: 'AsuraScans',
  };
}

export const api = {
  // Home Page / Discovery
  getPopularSeries: async (): Promise<Series[]> => {
    // Default to AniList for discovery
    try {
      return await anilistApi.getTrending();
    } catch (error) {
      console.warn("AniList failed, falling back to provider search", error);
      try {
        const res = await apiRequest<ProviderSearchResult>('/api/manga/search?source=asura&query=');
        return res.results.map(formatSeriesResult);
      } catch (e) {
        console.warn('Provider fallback failed', e);
        return [];
      }
    }
  },

  searchSeries: async (query: string, source: Source = 'AniList', filters: SearchFilters = {}): Promise<Series[]> => {
    if (source === 'AniList') {
      try {
        return await anilistApi.search(query, 1, filters);
      } catch (e) {
        console.warn("AniList search failed", e);
        return [];
      }
    } else {
      try {
        const res = await apiRequest<ProviderSearchResult>(
          `/api/manga/search?source=asura&query=${encodeURIComponent(query)}`,
        );
        return res.results.map(formatSeriesResult);
      } catch (e) {
        console.warn('Provider search failed', e);
        return [];
      }
    }
  },

  getSeriesDetails: async (id: string, source: Source = 'AniList'): Promise<SeriesDetails> => {
    // If ID is numeric, it's likely AniList. If it contains slashes or is complex string, it's scraper.
    // However, we passed the source explicitly to be safe.
    
    // Auto-detect based on ID format if source is ambiguous or mixed
    const isAniListId = /^\d+$/.test(id);

    if (source === 'AniList' && isAniListId) {
      return await anilistApi.getDetails(parseInt(id));
    }

    const cached = providerDetailsCache.get(id);
    if (cached) {
      return cached;
    }

    const details = await apiRequest<ProviderSeriesDetails>(
      `/api/manga/provider?provider=AsuraScans&id=${encodeURIComponent(id)}`,
    );
    const formatted = formatSeriesDetails(details);
    providerDetailsCache.set(id, formatted);
    persistCacheToSession(PROVIDER_CACHE_KEY, providerDetailsCache);
    return formatted;
  },

  getChapterImages: async (chapterId: string): Promise<ChapterPage[]> => {
    // Chapters always come from the scraper
    const pages = await apiRequest<Array<{ page: number; img: string; headerForImage?: string }>>(
      `/api/chapters/${encodeURIComponent(chapterId)}?provider=AsuraScans`,
    );
    return pages.map((page) => {
      const referer = page.headerForImage || 'https://asuracomic.net/';
      const proxyUrl = `${API_URL}/api/chapters/image?url=${encodeURIComponent(page.img)}&referer=${encodeURIComponent(referer)}`;
      return { page: page.page, src: proxyUrl };
    });
  },

  getProviderMappings: async (anilistId: string): Promise<ProviderMapping[]> => {
    return apiRequest<ProviderMapping[]>(`/api/manga/${anilistId}/providers`);
  },

  getProviderMappingByProviderId: async (
    providerId: string,
    provider: Source = 'AsuraScans',
  ): Promise<ProviderMapping> => {
    return apiRequest<ProviderMapping>(
      `/api/manga/provider/mapping?provider=${encodeURIComponent(provider)}&id=${encodeURIComponent(providerId)}`,
    );
  },

  getMappedProviderDetails: async (anilistId: string, provider: Source = 'AsuraScans'): Promise<SeriesDetails> => {
    const cacheKey = `${provider}:${anilistId}`;
    const cached = mappedProviderCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    const details = await apiRequest<ProviderSeriesDetails>(
      `/api/manga/${anilistId}/chapters?provider=${encodeURIComponent(provider)}`,
    );
    const formatted = formatSeriesDetails(details);
    mappedProviderCache.set(cacheKey, formatted);
    persistCacheToSession(MAPPED_CACHE_KEY, mappedProviderCache);
    return formatted;
  },

  mapProviderSeries: async (
    anilistId: string,
    providerId: string,
    details?: {
      title?: string;
      image?: string;
      status?: string;
      rating?: string;
    },
    providerMangaId?: number,
  ) => {
    const payload: Record<string, unknown> = {
      provider: 'AsuraScans',
      providerId,
    };

    if (details) {
      Object.entries(details).forEach(([key, value]) => {
        if (typeof value === 'string' && value.trim().length > 0) {
          payload[key] = value;
        }
      });
    }
    if (typeof providerMangaId === 'number' && Number.isFinite(providerMangaId)) {
      payload.providerMangaId = providerMangaId;
    }
    const response = await apiRequest(`/api/manga/${anilistId}/map`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    mappedProviderCache.delete(`AsuraScans:${anilistId}`);
    persistCacheToSession(MAPPED_CACHE_KEY, mappedProviderCache);
    return response;
  },

  queueDownload: async (payload: {
    providerSeriesId: string;
    chapterId?: string;
    chapterUrl?: string;
    chapterNumber: string;
    chapterTitle?: string;
    seriesTitle?: string;
    seriesImage?: string;
    seriesStatus?: string;
    seriesRating?: string;
    seriesChapters?: string;
    force?: boolean;
    seriesBudgetMb?: number;
  }): Promise<DownloadJob> => {
    return apiRequest<DownloadJob>('/api/downloads', {
      method: 'POST',
      body: JSON.stringify({
        provider: 'AsuraScans',
        ...payload,
      }),
    });
  },

  listDownloads: async (): Promise<DownloadJob[]> => {
    const response = await apiRequest<{ jobs: DownloadJob[] }>('/api/downloads');
    return response.jobs;
  },

  getDownloadStatus: async (id: string): Promise<DownloadJob> => {
    return apiRequest<DownloadJob>(`/api/downloads/${id}`);
  },

  cancelDownload: async (id: string): Promise<DownloadJob> => {
    return apiRequest<DownloadJob>(`/api/downloads/${id}`, {
      method: 'DELETE',
    });
  },

  listOfflineLibrary: async (): Promise<DownloadedSeries[]> => {
    return apiRequest<DownloadedSeries[]>('/api/downloads/library');
  },

  listDownloadedChapters: async (providerMangaId: number): Promise<DownloadedChapter[]> => {
    return apiRequest<DownloadedChapter[]>(`/api/downloads/series/${providerMangaId}`);
  },

  getDownloadFileUrl: (downloadId: number): string => {
    return `${API_URL}/api/downloads/${downloadId}/file`;
  },
};
