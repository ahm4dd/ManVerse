export interface HistoryItem {
  seriesId: string;
  anilistId?: string;
  providerSeriesId?: string;
  seriesTitle: string;
  seriesImage: string;
  chapterId: string;
  chapterNumber: string;
  chapterTitle: string;
  timestamp: number;
  source: 'AniList' | 'AsuraScans';
  page?: number;
  readChapters?: string[];
}

const HISTORY_KEY = 'manverse_history';
const MAX_HISTORY = 20;

type HistoryMatch = {
  seriesId?: string;
  anilistId?: string;
  providerSeriesId?: string;
  title?: string;
};

type HistoryInput = Omit<HistoryItem, 'timestamp'>;

type ToggleReadInput = {
  seriesId: string;
  anilistId?: string;
  providerSeriesId?: string;
  seriesTitle: string;
  seriesImage: string;
  chapterId: string;
  chapterNumber: string;
  chapterTitle: string;
  source: 'AniList' | 'AsuraScans';
};

const normalizeTitle = (title?: string) => title?.trim().toLowerCase();

const matchesEntry = (entry: HistoryItem, match: HistoryMatch) => {
  const hasIdMatch = Boolean(match.seriesId || match.anilistId || match.providerSeriesId);
  const bySeriesId =
    match.seriesId &&
    (entry.seriesId === match.seriesId ||
      entry.anilistId === match.seriesId ||
      entry.providerSeriesId === match.seriesId);
  const byAnilist =
    match.anilistId &&
    (entry.anilistId === match.anilistId || entry.seriesId === match.anilistId);
  const byProvider =
    match.providerSeriesId &&
    (entry.providerSeriesId === match.providerSeriesId || entry.seriesId === match.providerSeriesId);
  if (bySeriesId || byAnilist || byProvider) return true;
  if (!hasIdMatch && match.title && entry.seriesTitle) {
    return normalizeTitle(entry.seriesTitle) === normalizeTitle(match.title);
  }
  return false;
};

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

  getItem: (match: HistoryMatch): HistoryItem | null => {
    const current = history.get();
    const found = current.find((entry) => matchesEntry(entry, match));
    return found || null;
  },

  getReadChapters: (match: HistoryMatch): string[] => {
    const entry = history.getItem(match);
    if (!entry) return [];
    const ids = new Set(entry.readChapters ?? []);
    if (entry.chapterId) ids.add(entry.chapterId);
    return Array.from(ids);
  },

  add: (item: HistoryInput) => {
    if (typeof window === 'undefined') return;
    const current = history.get();
    
    const matchIndex = current.findIndex((entry) =>
      matchesEntry(entry, {
        seriesId: item.seriesId,
        anilistId: item.anilistId,
        providerSeriesId: item.providerSeriesId,
        title: item.seriesTitle,
      }),
    );
    const existing = matchIndex >= 0 ? current[matchIndex] : null;

    const readChapters = new Set(existing?.readChapters ?? []);
    if (existing?.chapterId) readChapters.add(existing.chapterId);
    if (item.readChapters) {
      for (const chapterId of item.readChapters) readChapters.add(chapterId);
    }
    readChapters.add(item.chapterId);

    const updatedEntry: HistoryItem = {
      ...(existing ?? {}),
      ...item,
      readChapters: Array.from(readChapters),
      timestamp: Date.now(),
    };

    const filtered = current.filter((_, idx) => idx !== matchIndex);
    const updated = [updatedEntry, ...filtered].slice(0, MAX_HISTORY);

    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  },

  toggleRead: (input: ToggleReadInput) => {
    if (typeof window === 'undefined') return [];
    const current = history.get();
    const matchIndex = current.findIndex((entry) =>
      matchesEntry(entry, {
        seriesId: input.seriesId,
        anilistId: input.anilistId,
        providerSeriesId: input.providerSeriesId,
        title: input.seriesTitle,
      }),
    );

    if (matchIndex === -1) {
      const entry: HistoryItem = {
        seriesId: input.seriesId,
        anilistId: input.anilistId,
        providerSeriesId: input.providerSeriesId,
        seriesTitle: input.seriesTitle,
        seriesImage: input.seriesImage,
        chapterId: input.chapterId,
        chapterNumber: input.chapterNumber,
        chapterTitle: input.chapterTitle,
        timestamp: Date.now(),
        source: input.source,
        readChapters: [input.chapterId],
      };
      const updated = [entry, ...current].slice(0, MAX_HISTORY);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
      return entry.readChapters ?? [];
    }

    const entry = current[matchIndex];
    const readChapters = new Set(entry.readChapters ?? []);
    if (readChapters.has(input.chapterId)) {
      readChapters.delete(input.chapterId);
    } else {
      readChapters.add(input.chapterId);
    }

    const updated = [...current];
    updated[matchIndex] = {
      ...entry,
      readChapters: Array.from(readChapters),
    };
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    return updated[matchIndex].readChapters ?? [];
  },

  // Get the last read page for a specific chapter
  getPage: (seriesId: string, chapterId: string): number => {
    const current = history.get();
    const item = current.find((entry) => matchesEntry(entry, { seriesId }));
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
