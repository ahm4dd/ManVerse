import { Series, Chapter } from '../types';

export interface HistoryItem {
  seriesId: string;
  seriesTitle: string;
  seriesImage: string;
  chapterId: string;
  chapterNumber: string;
  chapterTitle: string;
  timestamp: number;
  source: 'AniList' | 'AsuraScans';
  page?: number;
}

const HISTORY_KEY = 'manverse_history';
const MAX_HISTORY = 20;

export const history = {
  get: (): HistoryItem[] => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  },

  add: (item: Omit<HistoryItem, 'timestamp'>) => {
    const current = history.get();
    
    // Remove existing entry for this series to avoid duplicates
    const filtered = current.filter(i => i.seriesId !== item.seriesId);
    
    const updated = [
      { ...item, timestamp: Date.now() },
      ...filtered
    ].slice(0, MAX_HISTORY);

    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  },

  // Get the last read page for a specific chapter
  getPage: (seriesId: string, chapterId: string): number => {
    const current = history.get();
    const item = current.find(i => i.seriesId === seriesId);
    // Only return page if it matches the exact chapter
    if (item && item.chapterId === chapterId) {
      return item.page || 1;
    }
    return 1;
  },

  clear: () => {
    localStorage.removeItem(HISTORY_KEY);
  }
};