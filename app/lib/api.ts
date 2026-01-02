import { Series, SeriesDetails, ChapterPage } from '../types';
import { AsuraScansScraper } from './scrapers/asura';
import { asuraScansConfig } from './config';
import { anilistApi, SearchFilters } from './anilist';

// Initialize the scraper (Mock Mode: true)
const asuraScraper = new AsuraScansScraper(asuraScansConfig, true);

export type Source = 'AniList' | 'AsuraScans';

export const api = {
  // Home Page / Discovery
  getPopularSeries: async (): Promise<Series[]> => {
    // Default to AniList for discovery
    try {
      return await anilistApi.getTrending();
    } catch (error) {
      console.warn("AniList failed, falling back to mock scraper", error);
      const res = await asuraScraper.search('');
      return res.results.map(s => ({ ...s, source: 'AsuraScans' }));
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
      // Direct Provider Search (Filters ignore for now on Asura mock)
      const response = await asuraScraper.search(query);
      return response.results.map(s => ({ ...s, source: 'AsuraScans' }));
    }
  },

  getSeriesDetails: async (id: string, source: Source = 'AniList'): Promise<SeriesDetails> => {
    // If ID is numeric, it's likely AniList. If it contains slashes or is complex string, it's scraper.
    // However, we passed the source explicitly to be safe.
    
    // Auto-detect based on ID format if source is ambiguous or mixed
    const isAniListId = /^\d+$/.test(id);

    if (source === 'AniList' && isAniListId) {
      return await anilistApi.getDetails(parseInt(id));
    } else {
      const details = await asuraScraper.getSeriesDetails(id);
      return { ...details, source: 'AsuraScans' };
    }
  },

  getChapterImages: async (chapterId: string): Promise<ChapterPage[]> => {
    // Chapters always come from the scraper
    return await asuraScraper.getChapterImages(chapterId);
  },
};