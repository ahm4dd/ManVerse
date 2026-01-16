import { Series, SeriesDetails, ChapterPage } from '../types';
import { anilistApi, SearchFilters } from './anilist';
import { apiRequest, getApiUrl, getStoredToken } from './api-client';
import {
  Providers,
  type ProviderType,
  type Source,
  providerApiSource,
  providerBaseUrl,
  providerReferer,
} from './providers';

export type { Source };

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

const PROVIDER_CACHE_KEY = 'manverse_provider_cache_v2';
const MAPPED_CACHE_KEY = 'manverse_provider_mapped_cache_v1';
const PROVIDER_SEARCH_CACHE_KEY = 'manverse_provider_search_cache_v1';
const MAX_PROVIDER_CACHE = 20;
const MAX_PROVIDER_SEARCH_CACHE = 40;
const PROVIDER_SEARCH_TTL_MS = 10 * 60 * 1000;
const providerDetailsCache = new Map<string, SeriesDetails>();
const mappedProviderCache = new Map<string, SeriesDetails>();
type ProviderSearchCacheEntry = {
  results: Series[];
  expiresAt: number;
  hasNextPage?: boolean;
  currentPage?: number;
};

type ProviderSearchMeta = {
  results: Series[];
  hasNextPage: boolean;
  currentPage: number;
};

const providerSearchCache = new Map<string, ProviderSearchCacheEntry>();
const providerSearchInFlight = new Map<string, Promise<Series[]>>();
const providerSearchMetaInFlight = new Map<string, Promise<ProviderSearchMeta>>();

function providerDetailsCacheKey(provider: ProviderType, id: string) {
  return `${provider}:${id}`;
}

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

function loadSearchCacheFromSession() {
  if (typeof window === 'undefined') return {};
  try {
    const raw = sessionStorage.getItem(PROVIDER_SEARCH_CACHE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, ProviderSearchCacheEntry>) : {};
  } catch {
    return {};
  }
}

function persistSearchCacheToSession() {
  if (typeof window === 'undefined') return;
  try {
    const entries = Array.from(providerSearchCache.entries()).slice(-MAX_PROVIDER_SEARCH_CACHE);
    const payload = Object.fromEntries(entries);
    sessionStorage.setItem(PROVIDER_SEARCH_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore persistence failures (storage quota, etc)
  }
}

function initCache() {
  const provider = loadCacheFromSession(PROVIDER_CACHE_KEY);
  Object.entries(provider).forEach(([id, details]) => {
    const providerPrefix = Object.values(Providers).find((entry) => id.startsWith(`${entry}:`));
    const key = providerPrefix ? id : providerDetailsCacheKey(Providers.AsuraScans, id);
    providerDetailsCache.set(key, details);
  });
  const mapped = loadCacheFromSession(MAPPED_CACHE_KEY);
  Object.entries(mapped).forEach(([id, details]) => {
    mappedProviderCache.set(id, details);
  });
  const search = loadSearchCacheFromSession();
  Object.entries(search).forEach(([key, entry]) => {
    if (entry.expiresAt > Date.now()) {
      providerSearchCache.set(key, entry);
    }
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

function proxyProviderImage(image: string, provider: ProviderType): string {
  if (!image) return image;
  if (image.includes('/api/chapters/image?url=')) return image;
  if (provider !== Providers.Toonily && provider !== Providers.MangaGG) return image;
  const referer = providerReferer(provider) || providerBaseUrl(provider);
  if (!referer) return image;
  return `${getApiUrl()}/api/chapters/image?url=${encodeURIComponent(image)}&referer=${encodeURIComponent(referer)}`;
}

function formatSeriesResult(
  item: ProviderSearchResult['results'][number],
  provider: ProviderType,
): Series {
  return {
    id: item.id,
    title: item.title,
    image: proxyProviderImage(item.image, provider),
    status: item.status || 'Unknown',
    rating: item.rating || 'N/A',
    latestChapter: item.chapters || '',
    type: 'Manhwa',
    genres: item.genres,
    source: provider,
  };
}

function formatSeriesDetails(details: ProviderSeriesDetails, provider: ProviderType): SeriesDetails {
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
    image: proxyProviderImage(details.image, provider),
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
    source: provider,
  };
}

function normalizeProviderSearchKey(provider: ProviderType, query: string, page = 1) {
  return `${provider}:${query.trim().toLowerCase()}:page:${page}`;
}

function providerFromCacheKey(key: string): ProviderType | null {
  const candidate = key.split(':')[0] as ProviderType;
  return Object.values(Providers).includes(candidate) ? candidate : null;
}

function applyProviderOverrides(results: Series[], provider: ProviderType | null): Series[] {
  if (!provider) return results;
  const mapped = results.map((entry) => ({
    ...entry,
    source: provider,
    image: proxyProviderImage(entry.image, provider),
  }));
  return mapped;
}

function getCachedProviderSearch(key: string): Series[] | null {
  const entry = providerSearchCache.get(key);
  if (!entry) return null;
  if (entry.results.length === 0) {
    providerSearchCache.delete(key);
    return null;
  }
  if (entry.expiresAt > Date.now()) {
    const provider = providerFromCacheKey(key);
    const results = applyProviderOverrides(entry.results, provider);
    if (results !== entry.results) {
      entry.results = results;
      providerSearchCache.set(key, entry);
    }
    return results;
  }
  return null;
}

function peekProviderSearchCache(query: string, provider: ProviderType, page = 1) {
  const cacheKey = normalizeProviderSearchKey(provider, query, page);
  const entry = providerSearchCache.get(cacheKey);
  if (!entry) return null;
  if (entry.results.length === 0) {
    providerSearchCache.delete(cacheKey);
    return null;
  }
  const providerFromKey = providerFromCacheKey(cacheKey);
  const results = applyProviderOverrides(entry.results, providerFromKey);
  if (results !== entry.results) {
    entry.results = results;
    providerSearchCache.set(cacheKey, entry);
  }
  return {
    results,
    hasNextPage: entry.hasNextPage,
    currentPage: entry.currentPage,
    stale: entry.expiresAt <= Date.now(),
    expiresAt: entry.expiresAt,
  };
}

function getCachedProviderSearchMeta(key: string): ProviderSearchMeta | null {
  const entry = providerSearchCache.get(key);
  if (!entry) return null;
  if (entry.results.length === 0) {
    providerSearchCache.delete(key);
    return null;
  }
  if (entry.expiresAt <= Date.now()) return null;
  const provider = providerFromCacheKey(key);
  const results = applyProviderOverrides(entry.results, provider);
  if (results !== entry.results) {
    entry.results = results;
    providerSearchCache.set(key, entry);
  }
  return {
    results,
    hasNextPage: entry.hasNextPage ?? entry.results.length > 0,
    currentPage: entry.currentPage ?? 1,
  };
}

function setCachedProviderSearch(
  key: string,
  results: Series[],
  meta?: { hasNextPage?: boolean; currentPage?: number },
) {
  if (results.length === 0) {
    providerSearchCache.delete(key);
    persistSearchCacheToSession();
    return;
  }
  providerSearchCache.set(key, {
    results,
    expiresAt: Date.now() + PROVIDER_SEARCH_TTL_MS,
    hasNextPage: meta?.hasNextPage,
    currentPage: meta?.currentPage,
  });
  persistSearchCacheToSession();
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
        const res = await apiRequest<ProviderSearchResult>(
          `/api/manga/search?source=${encodeURIComponent(providerApiSource(Providers.AsuraScans))}&query=`,
        );
        return res.results.map((item) => formatSeriesResult(item, Providers.AsuraScans));
      } catch (e) {
        console.warn('Provider fallback failed', e);
        return [];
      }
    }
  },

  searchProviderSeries: async (
    query: string,
    provider: ProviderType = Providers.AsuraScans,
    page = 1,
  ): Promise<Series[]> => {
    const trimmed = query.trim();
    if (!trimmed) return [];
    const cacheKey = normalizeProviderSearchKey(provider, trimmed, page);
    const cached = getCachedProviderSearch(cacheKey);
    if (cached) {
      return cached;
    }
    const inFlight = providerSearchInFlight.get(cacheKey);
    if (inFlight) {
      return inFlight;
    }

    const request = apiRequest<ProviderSearchResult>(
      `/api/manga/search?source=${encodeURIComponent(providerApiSource(provider))}&query=${encodeURIComponent(trimmed)}&page=${page}`,
    )
      .then((res) => {
        const results = res.results.map((item) => formatSeriesResult(item, provider));
        setCachedProviderSearch(cacheKey, results, {
          hasNextPage: res.hasNextPage,
          currentPage: res.currentPage,
        });
        return results;
      })
      .finally(() => {
        providerSearchInFlight.delete(cacheKey);
      });

    providerSearchInFlight.set(cacheKey, request);
    return request;
  },

  refreshProviderSearch: async (
    query: string,
    provider: ProviderType = Providers.AsuraScans,
    page = 1,
  ): Promise<Series[]> => {
    const trimmed = query.trim();
    if (!trimmed) return [];
    const cacheKey = normalizeProviderSearchKey(provider, trimmed, page);
    const inFlight = providerSearchInFlight.get(cacheKey);
    if (inFlight) {
      return inFlight;
    }
    const request = apiRequest<ProviderSearchResult>(
      `/api/manga/search?source=${encodeURIComponent(providerApiSource(provider))}&query=${encodeURIComponent(trimmed)}&page=${page}`,
    )
      .then((res) => {
        const results = res.results.map((item) => formatSeriesResult(item, provider));
        setCachedProviderSearch(cacheKey, results, {
          hasNextPage: res.hasNextPage,
          currentPage: res.currentPage,
        });
        return results;
      })
      .finally(() => {
        providerSearchInFlight.delete(cacheKey);
      });
    providerSearchInFlight.set(cacheKey, request);
    return request;
  },

  peekProviderSearchCache,

  searchProviderSeriesMeta: async (
    query: string,
    provider: ProviderType = Providers.AsuraScans,
    page = 1,
  ): Promise<ProviderSearchMeta> => {
    const trimmed = query.trim();
    if (!trimmed) return { results: [], hasNextPage: false, currentPage: page };
    const cacheKey = normalizeProviderSearchKey(provider, trimmed, page);
    const cached = getCachedProviderSearchMeta(cacheKey);
    if (cached) {
      return cached;
    }
    const inFlight = providerSearchMetaInFlight.get(cacheKey);
    if (inFlight) {
      return inFlight;
    }

    const request = apiRequest<ProviderSearchResult>(
      `/api/manga/search?source=${encodeURIComponent(providerApiSource(provider))}&query=${encodeURIComponent(trimmed)}&page=${page}`,
    )
      .then((res) => {
        const results = res.results.map((item) => formatSeriesResult(item, provider));
        const payload = {
          results,
          hasNextPage: res.hasNextPage,
          currentPage: res.currentPage,
        };
        setCachedProviderSearch(cacheKey, results, {
          hasNextPage: res.hasNextPage,
          currentPage: res.currentPage,
        });
        return payload;
      })
      .finally(() => {
        providerSearchMetaInFlight.delete(cacheKey);
      });

    providerSearchMetaInFlight.set(cacheKey, request);
    return request;
  },

  prefetchProviderSearch: (queries: string[], provider: ProviderType = Providers.AsuraScans) => {
    if (typeof window === 'undefined') return;
    const unique: string[] = [];
    const seen = new Set<string>();
    for (const term of queries) {
      const cleaned = term.trim();
      if (!cleaned) continue;
      const key = cleaned.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(cleaned);
    }

    unique.slice(0, 4).forEach((term, index) => {
      window.setTimeout(() => {
        api.searchProviderSeries(term, provider).catch(() => {});
      }, 250 + index * 350);
    });
  },

  searchSeries: async (
    query: string,
    source: Source = 'AniList',
    filters: SearchFilters = {},
    page = 1,
  ): Promise<Series[]> => {
    if (source === 'AniList') {
      try {
        return await anilistApi.search(query, page, filters);
      } catch (e) {
        console.warn("AniList search failed", e);
        return [];
      }
    } else {
      try {
        if (!query.trim()) return [];
        return await api.searchProviderSeries(query, source, page);
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

    const provider = source === 'AniList' ? Providers.AsuraScans : source;
    const cacheKey = providerDetailsCacheKey(provider, id);
    const cached = providerDetailsCache.get(cacheKey);
    if (cached) {
      if (cached.chapters?.length || source === 'AniList') {
        return cached;
      }
      providerDetailsCache.delete(cacheKey);
    }

    const details = await apiRequest<ProviderSeriesDetails>(
      `/api/manga/provider?provider=${encodeURIComponent(provider)}&id=${encodeURIComponent(id)}`,
    );
    const formatted = formatSeriesDetails(details, provider);
    providerDetailsCache.set(cacheKey, formatted);
    persistCacheToSession(PROVIDER_CACHE_KEY, providerDetailsCache);
    return formatted;
  },

  getChapterImages: async (
    chapterId: string,
    provider: ProviderType = Providers.AsuraScans,
  ): Promise<ChapterPage[]> => {
    // Chapters always come from the scraper
    const pages = await apiRequest<Array<{ page: number; img: string; headerForImage?: string }>>(
      `/api/chapters/${encodeURIComponent(chapterId)}?provider=${encodeURIComponent(provider)}`,
    );
    return pages.map((page) => {
      const referer =
        page.headerForImage ||
        providerReferer(provider) ||
        providerBaseUrl(provider);
      const proxyUrl = `${getApiUrl()}/api/chapters/image?url=${encodeURIComponent(page.img)}&referer=${encodeURIComponent(referer)}`;
      return { page: page.page, src: proxyUrl };
    });
  },

  getProviderMappings: async (anilistId: string): Promise<ProviderMapping[]> => {
    return apiRequest<ProviderMapping[]>(`/api/manga/${anilistId}/providers`);
  },

  getProviderMappingByProviderId: async (
    providerId: string,
    provider: ProviderType = Providers.AsuraScans,
  ): Promise<ProviderMapping> => {
    return apiRequest<ProviderMapping>(
      `/api/manga/provider/mapping?provider=${encodeURIComponent(provider)}&id=${encodeURIComponent(providerId)}`,
    );
  },

  getMappedProviderDetails: async (
    anilistId: string,
    provider: ProviderType = Providers.AsuraScans,
  ): Promise<SeriesDetails> => {
    const cacheKey = `${provider}:${anilistId}`;
    const cached = mappedProviderCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    const details = await apiRequest<ProviderSeriesDetails>(
      `/api/manga/${anilistId}/chapters?provider=${encodeURIComponent(provider)}`,
    );
    const formatted = formatSeriesDetails(details, provider);
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
    provider: ProviderType = Providers.AsuraScans,
  ) => {
    const payload: Record<string, unknown> = {
      provider,
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
    mappedProviderCache.delete(`${provider}:${anilistId}`);
    persistCacheToSession(MAPPED_CACHE_KEY, mappedProviderCache);
    return response;
  },

  queueDownload: async (payload: {
    provider?: ProviderType;
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
        provider: payload.provider ?? Providers.AsuraScans,
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
    const token = getStoredToken();
    const url = new URL(`${getApiUrl()}/api/downloads/${downloadId}/file`);
    if (token) {
      url.searchParams.set('token', token);
    }
    return url.toString();
  },
};
