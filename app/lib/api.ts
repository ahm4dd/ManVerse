import { Series, SeriesDetails, ChapterPage } from '../types';
import { anilistApi, SearchFilters } from './anilist';
import { API_URL, apiRequest } from './api-client';

export type Source = 'AniList' | 'AsuraScans';

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
};

function encodeChapterId(url: string): string {
  const base = btoa(url);
  return base.replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/g, '');
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

    const details = await apiRequest<ProviderSeriesDetails>(
      `/api/manga/provider?provider=AsuraScans&id=${encodeURIComponent(id)}`,
    );
    return formatSeriesDetails(details);
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

  mapProviderSeries: async (anilistId: string, providerId: string) => {
    return apiRequest(`/api/manga/${anilistId}/map`, {
      method: 'POST',
      body: JSON.stringify({ provider: 'AsuraScans', providerId }),
    });
  },
};
