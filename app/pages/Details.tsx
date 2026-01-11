import React, { useEffect, useState, useMemo } from 'react';
import { Series, SeriesDetails } from '../types';
import { api } from '../lib/api';
import { anilistApi } from '../lib/anilist';
import { history, type HistoryItem } from '../lib/history';
import { ChevronLeft, StarIcon, ChevronDown, SearchIcon, LibraryIcon } from '../components/Icons';
import SeriesCard from '../components/SeriesCard';
import { useNotification } from '../lib/notifications';
import { motion } from 'framer-motion';

interface DetailsProps {
  seriesId: string;
  onNavigate: (view: string, data?: any) => void;
  onBack: () => void;
  user?: any;
}

const PROVIDERS = [
  { id: 'AsuraScans', name: 'Asura Scans', enabled: true },
  { id: 'MangaDex', name: 'MangaDex (Soon)', enabled: false },
  { id: 'FlameScans', name: 'Flame Scans (Soon)', enabled: false },
];

const formatTimeAgo = (timestamp?: number) => {
  if (!timestamp) return '';
  const seconds = Math.floor(Date.now() / 1000) - Math.floor(timestamp / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(months / 12);
  return `${years}y ago`;
};

const formatEnumLabel = (value?: string | null) => {
  if (!value) return 'Unknown';
  return value
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
};

const formatCountryLabel = (code?: string | null) => {
  if (!code) return '';
  const map: Record<string, string> = {
    JP: 'Japan',
    KR: 'South Korea',
    CN: 'China',
    TW: 'Taiwan',
    US: 'United States',
  };
  return map[code] ?? code;
};

const formatFuzzyDate = (date?: { year?: number | null; month?: number | null; day?: number | null } | null) => {
  if (!date || !date.year) return 'N/A';
  const month = date.month ? `${date.month}`.padStart(2, '0') : null;
  const day = date.day ? `${date.day}`.padStart(2, '0') : null;
  if (month && day) return `${date.year}-${month}-${day}`;
  if (month) return `${date.year}-${month}`;
  return `${date.year}`;
};

const formatNumber = (value?: number | null) => {
  if (value === null || value === undefined) return 'N/A';
  return value.toLocaleString();
};

const parseAniListId = (input: string) => {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/anilist\.co\/manga\/(\d+)/i);
  if (match?.[1]) return match[1];
  return null;
};

type ReconcileChoice = 'higher' | 'provider' | 'anilist' | 'none';

type ReconcileContext = {
  swapType: 'anilist' | 'provider';
  anilistId: string;
  anilistTitle?: string;
  anilistImage?: string;
  providerId: string;
  providerMangaId?: number;
  providerDetails?: SeriesDetails | null;
  localProgress: number | null;
  remoteProgress: number | null;
};

const Details: React.FC<DetailsProps> = ({ seriesId, onNavigate, onBack, user }) => {
  const [data, setData] = useState<SeriesDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const { notify } = useNotification();
  
  // View State
  const [activeTab, setActiveTab] = useState<'Chapters' | 'Info' | 'Recommendations'>('Chapters');

  // Provider Reading State
  const [providerLoading, setProviderLoading] = useState(false);
  const [providerRefreshing, setProviderRefreshing] = useState(false);
  const [providerCacheHit, setProviderCacheHit] = useState(false);
  const [providerResults, setProviderResults] = useState<Series[] | null>(null);
  const [activeProviderSeries, setActiveProviderSeries] = useState<SeriesDetails | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string>('AsuraScans');
  const [showProviderMenu, setShowProviderMenu] = useState(false);
  const [manualQuery, setManualQuery] = useState('');
  const [manualProviderUrl, setManualProviderUrl] = useState('');
  const [historyMatch, setHistoryMatch] = useState<HistoryItem | null>(null);
  const [readChapterIds, setReadChapterIds] = useState<Set<string>>(new Set());
  const [downloadedChapterIds, setDownloadedChapterIds] = useState<Set<string>>(new Set());
  const [downloadedChaptersByNumber, setDownloadedChaptersByNumber] = useState<Record<string, number>>({});
  const [queuedChapterIds, setQueuedChapterIds] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedChapterIds, setSelectedChapterIds] = useState<Set<string>>(new Set());
  const [batchDownloading, setBatchDownloading] = useState(false);
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [rangeMarking, setRangeMarking] = useState(false);
  const [anilistQuery, setAnilistQuery] = useState('');
  const [anilistResults, setAnilistResults] = useState<Series[]>([]);
  const [anilistManualInput, setAnilistManualInput] = useState('');
  const [anilistSearchLoading, setAnilistSearchLoading] = useState(false);
  const [linkingAniList, setLinkingAniList] = useState(false);
  const [linkedAniList, setLinkedAniList] = useState<{ id: string; title: string; image?: string } | null>(null);
  const [showAniListRemap, setShowAniListRemap] = useState(false);
  const [showProviderRemap, setShowProviderRemap] = useState(false);
  const [previousProviderSeries, setPreviousProviderSeries] = useState<SeriesDetails | null>(null);
  const [reconcileContext, setReconcileContext] = useState<ReconcileContext | null>(null);
  const [reconcileChoice, setReconcileChoice] = useState<ReconcileChoice>('higher');
  const [reconcileLoading, setReconcileLoading] = useState(false);

  // Chapter Search State
  const [chapterSearchQuery, setChapterSearchQuery] = useState('');
  
  // Pagination state
  const [visibleChapters, setVisibleChapters] = useState(100);

  // Library State
  const [userStatus, setUserStatus] = useState<string | null>(null);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setActiveTab('Chapters');
      setActiveProviderSeries(null);
      setProviderResults(null);
      setProviderLoading(false);
      setProviderRefreshing(false);
      setProviderCacheHit(false);
      setManualQuery('');
      setManualProviderUrl('');
      setShowProviderMenu(false);
      setHistoryMatch(null);
      setReadChapterIds(new Set());
      setAnilistQuery('');
      setAnilistResults([]);
      setAnilistManualInput('');
      setAnilistSearchLoading(false);
      setRangeStart('');
      setRangeEnd('');
      setRangeMarking(false);
      setLinkingAniList(false);
      setLinkedAniList(null);
      setShowAniListRemap(false);
      setShowProviderRemap(false);
      setPreviousProviderSeries(null);
      setReconcileContext(null);
      setReconcileChoice('higher');
      setReconcileLoading(false);
      try {
        // Determine source based on ID format (Numeric = AniList, String = Provider)
        const source = /^\d+$/.test(seriesId) ? 'AniList' : 'AsuraScans';
        const details = await api.getSeriesDetails(seriesId, source);
        setData(details);
        setUserStatus(details.userListStatus || null);

        // If we loaded directly from provider (e.g. from Home provider search), set it as active for reading
        if (source === 'AsuraScans') {
           setActiveProviderSeries(details);
        }
      } catch (e) {
        console.error(e);
        notify("Failed to load series details.", 'error');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [seriesId]);

  useEffect(() => {
    if (!data) return;
    if (data.source !== 'AniList') return;
    if (activeProviderSeries) return;

    let cancelled = false;
    setProviderLoading(true);

    api
      .getMappedProviderDetails(data.id, 'AsuraScans')
      .then((details) => {
        if (cancelled) return;
        setActiveProviderSeries(details);
        setProviderResults(null);
      })
      .catch(() => {
        if (cancelled) return;
      })
      .finally(() => {
        if (cancelled) return;
        setProviderLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [data, activeProviderSeries]);

  useEffect(() => {
    if (!data) return;
    if (data.source !== 'AsuraScans') return;

    const providerId = activeProviderSeries?.id || data.id;
    let cancelled = false;

    api
      .getProviderMappingByProviderId(providerId, 'AsuraScans')
      .then((mapping) => {
        if (cancelled) return;
        if (mapping.anilist) {
          const title = mapping.anilist.title_english || mapping.anilist.title_romaji;
          setLinkedAniList({
            id: mapping.anilist.id.toString(),
            title,
            image: mapping.anilist.cover_large || mapping.anilist.cover_medium || undefined,
          });
        } else {
          setLinkedAniList(null);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setLinkedAniList(null);
      });

    return () => {
      cancelled = true;
    };
  }, [data, activeProviderSeries]);

  useEffect(() => {
    if (!data) return;
    let match =
      data.source === 'AniList'
        ? history.getItem({ seriesId: data.id, anilistId: data.id, title: data.title })
        : history.getItem({ seriesId: data.id, providerSeriesId: data.id, title: data.title });
    if (!match && data.title) {
      match = history.getItem({ title: data.title });
    }
    setHistoryMatch(match);

      const providerIdFallback =
      activeProviderSeries?.id ||
      match?.providerSeriesId ||
      (match && !/^\d+$/.test(match.seriesId) ? match.seriesId : undefined) ||
      (data.source === 'AsuraScans' ? data.id : undefined);
    const readIds = new Set(
      history.getReadChapters({
        seriesId: data.id,
        anilistId: data.source === 'AniList' ? data.id : undefined,
        providerSeriesId: providerIdFallback,
        title: data.title,
      }),
    );
    setReadChapterIds(readIds);
  }, [data, activeProviderSeries]);

  const refreshDownloadedChapters = async (providerMangaId?: number) => {
    if (!providerMangaId) {
      setDownloadedChapterIds(new Set());
      setDownloadedChaptersByNumber({});
      return;
    }
    try {
      const chapters = await api.listDownloadedChapters(providerMangaId);
      const downloadedIds = new Set<string>();
      const byNumber: Record<string, number> = {};
      chapters.forEach((chapter) => {
        byNumber[chapter.chapterNumber] = chapter.id;
      });
      if (activeProviderSeries?.chapters) {
        activeProviderSeries.chapters.forEach((chapter) => {
          if (byNumber[chapter.number]) {
            downloadedIds.add(chapter.id);
          }
        });
      }
      setDownloadedChapterIds(downloadedIds);
      setDownloadedChaptersByNumber(byNumber);
    } catch (error) {
      console.warn('Failed to load downloaded chapters', error);
      setDownloadedChapterIds(new Set());
      setDownloadedChaptersByNumber({});
    }
  };

  useEffect(() => {
    refreshDownloadedChapters(activeProviderSeries?.providerMangaId);
  }, [activeProviderSeries?.providerMangaId, activeProviderSeries?.chapters?.length]);

  useEffect(() => {
    setSelectionMode(false);
    setSelectedChapterIds(new Set());
  }, [activeProviderSeries?.id]);

  const normalizeAsuraInput = (input: string) => {
    const trimmed = input.trim();
    if (!trimmed) return '';
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    const cleaned = trimmed.replace(/^\/+/, '');
    if (cleaned.startsWith('series/')) {
      return `https://asuracomic.net/${cleaned}`;
    }
    if (cleaned.startsWith('asuracomic.net/')) {
      return `https://${cleaned}`;
    }
    return `https://asuracomic.net/series/${cleaned}`;
  };

  const searchProvider = async (providerId: string, query: string) => {
    if (!data) return;
    if (providerId !== 'AsuraScans') return; // Only Asura supported for now

    setProviderLoading(true);
    setProviderRefreshing(false);
    setProviderCacheHit(false);
    setProviderResults(null);
    setShowProviderMenu(false);
    setSelectedProvider(providerId);

    try {
      const cached = api.peekProviderSearchCache(query, 'AsuraScans');
      let autoSelected = false;
      if (cached) {
        setProviderResults(cached.results);
        setProviderCacheHit(true);
        prefetchProviderDetails(cached.results);
        if (cached.results.length === 1) {
          autoSelected = true;
          handleSelectProviderSeries(cached.results[0].id);
          notify(`Found match on ${providerId} (cached).`, 'success');
        } else if (cached.results.length === 0) {
          notify(`No matches found on ${providerId}.`, 'warning');
        }
        if (cached.stale && !autoSelected) {
          setProviderRefreshing(true);
        }
        setProviderLoading(false);
        if (!cached.stale || autoSelected) {
          return;
        }
      }

      const results = await api.refreshProviderSearch(query, 'AsuraScans');
      applyProviderResults(results);

      if (results.length === 1) {
        handleSelectProviderSeries(results[0].id);
        notify(`Found match on ${providerId}`, 'success');
      } else if (results.length === 0) {
        notify(`No matches found on ${providerId}.`, 'warning');
      }
    } catch (e) {
      console.error(e);
      notify("Failed to search provider.", 'error');
    } finally {
      setProviderLoading(false);
      setProviderRefreshing(false);
    }
  };

  const normalizeMatchText = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();

  const normalizeSearchKey = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim() || value.toLowerCase().trim();

  const scoreSearchTerm = (value: string) => {
    const cleaned = value.trim();
    if (!cleaned) return 0;
    const ascii = cleaned.replace(/[^a-z0-9]/gi, '');
    const asciiRatio = ascii.length / cleaned.length;
    const length = cleaned.length;
    let lengthScore = 0.2;
    if (length >= 6 && length <= 40) lengthScore = 1;
    else if (length < 6) lengthScore = Math.max(0.2, length / 6);
    else if (length > 40) lengthScore = Math.max(0.2, 40 / length);
    const digitBoost = /\d/.test(cleaned) ? 0.05 : 0;
    return asciiRatio * 0.6 + lengthScore * 0.35 + digitBoost;
  };

  const expandSynonymTerms = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return [];
    const variants = new Set<string>([trimmed]);
    const decomma = trimmed.replace(/[,:]/g, ' ').replace(/\s+/g, ' ').trim();
    if (decomma && decomma !== trimmed) {
      variants.add(decomma);
    }
    return Array.from(variants);
  };

  const buildProviderSearchTerms = () => {
    if (!data) return [];
    const candidates = new Map<string, { term: string; score: number }>();
    const push = (term: string | undefined | null, base: number) => {
      if (!term) return;
      const cleaned = term.trim();
      if (cleaned.length < 3) return;
      const key = normalizeSearchKey(cleaned);
      const score = base + scoreSearchTerm(cleaned);
      const existing = candidates.get(key);
      if (!existing || score > existing.score) {
        candidates.set(key, { term: cleaned, score });
      }
    };

    push(data.titles?.english, 3.2);
    push(data.title, 3.0);
    push(data.titles?.romaji, 2.6);
    push(data.titles?.native, 1.6);
    (data.synonyms ?? []).forEach((synonym) => {
      expandSynonymTerms(synonym).forEach((term) => push(term, 3.4));
    });

    return Array.from(candidates.values())
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.term)
      .slice(0, 8);
  };

  const scoreTitleMatch = (title: string, terms: string[]) => {
    const candidate = normalizeMatchText(title);
    if (!candidate) return 0;
    let best = 0;
    for (const term of terms) {
      const normalized = normalizeMatchText(term);
      if (!normalized) continue;
      if (candidate === normalized) {
        best = Math.max(best, 1);
        continue;
      }
      if (candidate.includes(normalized) || normalized.includes(candidate)) {
        best = Math.max(best, 0.9);
        continue;
      }
      const candidateTokens = candidate.split(' ');
      const termTokens = normalized.split(' ');
      const overlap = candidateTokens.filter((token) => termTokens.includes(token)).length;
      const overlapRatio = overlap / Math.max(candidateTokens.length, termTokens.length);
      const prefixBoost =
        candidate.startsWith(normalized) || normalized.startsWith(candidate) ? 0.08 : 0;
      const score = Math.min(0.88, 0.5 + overlapRatio * 0.35 + prefixBoost);
      best = Math.max(best, score);
    }
    return best;
  };

  const prefetchProviderDetails = (results: Series[]) => {
    if (!results.length) return;
    const candidates = results.slice(0, 2);
    candidates.forEach((series) => {
      const normalized = normalizeAsuraInput(series.id);
      api.getSeriesDetails(normalized, 'AsuraScans').catch(() => {});
    });
  };

  const applyProviderResults = (results: Series[]) => {
    setProviderResults(results);
    setProviderCacheHit(false);
    prefetchProviderDetails(results);
  };

  useEffect(() => {
    if (!data || data.source !== 'AniList') return;
    if (providerLoading || providerResults !== null) return;
    const terms = buildProviderSearchTerms();
    if (terms.length === 0) return;
    api.prefetchProviderSearch(terms, 'AsuraScans');
  }, [data?.id]);

  const searchProviderWithFallback = async (providerId: string, queries: string[]) => {
    if (!data) return;
    if (providerId !== 'AsuraScans') return;

    setProviderLoading(true);
    setProviderRefreshing(false);
    setProviderCacheHit(false);
    setProviderResults(null);
    setShowProviderMenu(false);
    setSelectedProvider(providerId);

    try {
      const uniqueQueries = Array.from(new Set(queries.map((q) => q.trim()).filter(Boolean)));
      const searchTerms = uniqueQueries.slice(0, 3);
      const cachedEntries = searchTerms.map((term) => ({
        term,
        cache: api.peekProviderSearchCache(term, 'AsuraScans'),
      }));

      const cachedMerged = new Map<string, { series: Series; score: number }>();
      cachedEntries.forEach(({ term, cache }) => {
        if (!cache?.results?.length) return;
        cache.results.forEach((series) => {
          const score = scoreTitleMatch(series.title, searchTerms);
          const existing = cachedMerged.get(series.id);
          if (!existing || score > existing.score) {
            cachedMerged.set(series.id, { series, score });
          }
        });
      });

      const cachedRanked = Array.from(cachedMerged.values())
        .sort((a, b) => b.score - a.score)
        .map((entry) => entry.series);

      if (cachedRanked.length > 0) {
        setProviderResults(cachedRanked);
        setProviderCacheHit(true);
        prefetchProviderDetails(cachedRanked);
        setProviderLoading(false);
        if (cachedEntries.some((entry) => entry.cache?.stale)) {
          setProviderRefreshing(true);
        } else {
          const bestScore = cachedMerged.get(cachedRanked[0].id)?.score ?? 0;
          const runnerUpScore = cachedRanked.length > 1 ? cachedMerged.get(cachedRanked[1].id)?.score ?? 0 : 0;
          const highConfidence = bestScore >= 0.92 && bestScore - runnerUpScore >= 0.12;
          if (cachedRanked.length === 1 || highConfidence) {
            handleSelectProviderSeries(cachedRanked[0].id);
            notify(`Found match using "${searchTerms[0]}".`, 'success');
            return;
          }
          if (searchTerms.length > 1) {
            notify(`Found matches using ${searchTerms.slice(0, 2).join(' / ')}.`, 'success');
          }
          return;
        }
      }

      const queriesToFetch = cachedEntries
        .filter((entry) => !entry.cache || entry.cache.stale)
        .map((entry) => entry.term);

      const resultsByQuery = await Promise.all(
        queriesToFetch.map(async (query) => {
          try {
            const results = await api.refreshProviderSearch(query, 'AsuraScans');
            return { query, results };
          } catch {
            return { query, results: [] as Series[] };
          }
        }),
      );

      const merged = new Map<string, { series: Series; score: number }>();
      for (const { results } of resultsByQuery) {
        results.forEach((series) => {
          const score = scoreTitleMatch(series.title, searchTerms);
          const existing = merged.get(series.id);
          if (!existing || score > existing.score) {
            merged.set(series.id, { series, score });
          }
        });
      }
      cachedEntries.forEach(({ cache }) => {
        if (!cache?.results?.length) return;
        cache.results.forEach((series) => {
          const score = scoreTitleMatch(series.title, searchTerms);
          const existing = merged.get(series.id);
          if (!existing || score > existing.score) {
            merged.set(series.id, { series, score });
          }
        });
      });

      const ranked = Array.from(merged.values())
        .sort((a, b) => b.score - a.score)
        .map((entry) => entry.series);

      if (ranked.length === 0) {
        setProviderResults([]);
        notify(`No matches found on ${providerId}.`, 'warning');
        return;
      }

      applyProviderResults(ranked);
      const bestScore = merged.get(ranked[0].id)?.score ?? 0;
      const runnerUpScore = ranked.length > 1 ? merged.get(ranked[1].id)?.score ?? 0 : 0;
      const highConfidence = bestScore >= 0.92 && bestScore - runnerUpScore >= 0.12;
      if (ranked.length === 1 || highConfidence) {
        handleSelectProviderSeries(ranked[0].id);
        notify(`Found match using "${searchTerms[0]}".`, 'success');
        return;
      }

      if (searchTerms.length > 1) {
        notify(`Found matches using ${searchTerms.slice(0, 2).join(' / ')}.`, 'success');
      }
    } catch (e) {
      console.error(e);
      notify('Failed to search provider.', 'error');
    } finally {
      setProviderLoading(false);
      setProviderRefreshing(false);
    }
  };

  const handleSearchOnProvider = async (providerId: string) => {
    if (!data) return;
    if (providerId !== 'AsuraScans') return;
    if (!showProviderRemap) {
      if (activeProviderSeries?.chapters?.length) {
        setShowProviderMenu(false);
        notify('Provider already linked.', 'info');
        return;
      }
      try {
        setProviderLoading(true);
        setProviderResults(null);
        setShowProviderMenu(false);
        setSelectedProvider(providerId);
        const mapped = await api.getMappedProviderDetails(data.id, 'AsuraScans');
        if (mapped?.chapters?.length) {
          setActiveProviderSeries(mapped);
          setProviderResults(null);
          notify('Using existing provider mapping.', 'success');
          return;
        }
      } catch {
        // No mapping found; continue with search.
      } finally {
        setProviderLoading(false);
      }
    }
    const terms = buildProviderSearchTerms();
    if (terms.length <= 1) {
      await searchProvider(providerId, data.title);
      return;
    }
    await searchProviderWithFallback(providerId, terms);
  };

  const handleSelectProviderSeries = async (id: string) => {
    setProviderLoading(true);
    const normalizedId = normalizeAsuraInput(id);
    try {
      const details = await api.getSeriesDetails(normalizedId, 'AsuraScans');
      setActiveProviderSeries(details);
      setProviderResults(null); // Clear list to show chapters

      const isProviderSwap =
        data?.source === 'AniList' &&
        previousProviderSeries &&
        previousProviderSeries.id !== details.id;

      if (user && data?.source === 'AniList' && isProviderSwap) {
        const localProgress = getLocalProgress(previousProviderSeries?.id ?? details.id);
        const remoteProgress = data.mediaListEntry?.progress ?? null;
        setReconcileChoice('higher');
        setReconcileContext({
          swapType: 'provider',
          anilistId: data.id,
          anilistTitle: data.title,
          anilistImage: data.image,
          providerId: normalizedId,
          providerMangaId: details.providerMangaId,
          providerDetails: details,
          localProgress,
          remoteProgress,
        });
        setProviderLoading(false);
        return;
      }

      if (user && data?.source === 'AniList') {
        try {
          await api.mapProviderSeries(
            data.id,
            normalizedId,
            {
              title: details.title,
              image: details.image,
              status: details.status,
              rating: details.rating,
            },
            details.providerMangaId,
          );
          history.attachAnilistId({
            providerSeriesId: normalizedId,
            title: data.title,
            anilistId: data.id,
          });

          const localMatch = history.getItem({ providerSeriesId: normalizedId, title: data.title });
          const localProgressRaw = localMatch?.chapterNumber;
          const localProgress = localProgressRaw
            ? parseFloat(localProgressRaw.replace(/[^0-9.]/g, ''))
            : NaN;
          const remoteProgress = data.mediaListEntry?.progress ?? 0;
          if (
            !Number.isNaN(localProgress) &&
            localProgress > 0 &&
            localProgress > remoteProgress
          ) {
            await anilistApi.updateProgress(parseInt(data.id, 10), Math.floor(localProgress));
          }
          setShowProviderRemap(false);
          setPreviousProviderSeries(null);
        } catch (e) {
          console.warn('Failed to persist provider mapping', e);
        }
      }
    } catch (e) {
      console.error(e);
      notify("Failed to load chapters.", 'error');
    } finally {
      setProviderLoading(false);
    }
  };

  const handleManualSearch = async () => {
    if (!manualQuery.trim()) {
      notify('Enter a title to search the provider.', 'warning');
      return;
    }
    await searchProvider(selectedProvider, manualQuery.trim());
  };

  const handleManualUrlMap = async () => {
    const normalized = normalizeAsuraInput(manualProviderUrl);
    if (!normalized) {
      notify('Paste a valid Asura series URL.', 'warning');
      return;
    }
    await handleSelectProviderSeries(normalized);
  };

  const handleAniListSearch = async () => {
    if (!anilistQuery.trim()) {
      notify('Enter a title to search AniList.', 'warning');
      return;
    }

    setAnilistSearchLoading(true);
    setAnilistResults([]);
    try {
      const results = await anilistApi.search(anilistQuery.trim(), 1);
      setAnilistResults(results.slice(0, 10));
    } catch (e) {
      console.error(e);
      notify('Failed to search AniList.', 'error');
    } finally {
      setAnilistSearchLoading(false);
    }
  };

  const handleLinkAniList = async (anilistId: string, series?: Series) => {
    if (!user) {
      notify('Login to link AniList entries.', 'warning');
      return;
    }
    if (!data) return;

    const providerId = activeProviderSeries?.id || data.id;
    const normalizedProviderId =
      data.source === 'AsuraScans' ? normalizeAsuraInput(providerId) : providerId;

    if (!normalizedProviderId) {
      notify('Provider series is missing. Load a provider series first.', 'warning');
      return;
    }

    const isAniListSwap = linkedAniList && linkedAniList.id !== anilistId;
    if (isAniListSwap) {
      const localProgress = getLocalProgress(normalizedProviderId);
      const remoteProgress = await resolveRemoteProgress(anilistId);
      setReconcileChoice('higher');
      setReconcileContext({
        swapType: 'anilist',
        anilistId,
        anilistTitle: series?.title,
        anilistImage: series?.image,
        providerId: normalizedProviderId,
        providerMangaId: activeProviderSeries?.providerMangaId,
        providerDetails: activeProviderSeries,
        localProgress,
        remoteProgress,
      });
      return;
    }

    setLinkingAniList(true);
    try {
      await api.mapProviderSeries(
        anilistId,
        normalizedProviderId,
        {
          title: data.title,
          image: data.image,
          status: data.status,
          rating: data.rating,
        },
        activeProviderSeries?.providerMangaId,
      );

      history.attachAnilistId({
        providerSeriesId: normalizedProviderId,
        title: data.title,
        anilistId,
      });

      if (series) {
        setLinkedAniList({
          id: series.id,
          title: series.title,
          image: series.image,
        });
      } else {
        const details = await anilistApi.getDetails(parseInt(anilistId, 10));
        setLinkedAniList({
          id: details.id,
          title: details.title,
          image: details.image,
        });
      }

      notify('Linked to AniList successfully.', 'success');
      const localProgressRaw = historyMatch?.chapterNumber;
      const localProgress = localProgressRaw
        ? parseFloat(localProgressRaw.replace(/[^0-9.]/g, ''))
        : NaN;
      const remoteProgress = data.mediaListEntry?.progress ?? 0;
      if (
        user &&
        !Number.isNaN(localProgress) &&
        localProgress > 0 &&
        localProgress > remoteProgress
      ) {
        await anilistApi.updateProgress(parseInt(anilistId, 10), Math.floor(localProgress));
      }
      setShowAniListRemap(false);
    } catch (e) {
      console.error(e);
      notify('Failed to link AniList entry.', 'error');
    } finally {
      setLinkingAniList(false);
    }
  };

  const handleManualAniListLink = async () => {
    const anilistId = parseAniListId(anilistManualInput);
    if (!anilistId) {
      notify('Paste a valid AniList manga URL or ID.', 'warning');
      return;
    }
    await handleLinkAniList(anilistId);
  };

  const closeReconcile = () => {
    if (reconcileContext?.swapType === 'provider' && previousProviderSeries) {
      setActiveProviderSeries(previousProviderSeries);
    }
    setReconcileContext(null);
    setReconcileLoading(false);
  };

  const applyReconcile = async (choiceOverride?: ReconcileChoice) => {
    if (!reconcileContext || !data) return;
    const choice = choiceOverride ?? reconcileChoice;
    setReconcileLoading(true);

    try {
      const mappingDetails = reconcileContext.providerDetails
        ? {
            title: reconcileContext.providerDetails.title,
            image: reconcileContext.providerDetails.image,
            status: reconcileContext.providerDetails.status,
            rating: reconcileContext.providerDetails.rating,
          }
        : {
            title: data.title,
            image: data.image,
            status: data.status,
            rating: data.rating,
          };

      await api.mapProviderSeries(
        reconcileContext.anilistId,
        reconcileContext.providerId,
        mappingDetails,
        reconcileContext.providerMangaId,
      );

      history.attachAnilistId({
        providerSeriesId: reconcileContext.providerId,
        title: data.title,
        anilistId: reconcileContext.anilistId,
      });

      if (reconcileContext.swapType === 'anilist') {
        if (reconcileContext.anilistTitle || reconcileContext.anilistImage) {
          setLinkedAniList({
            id: reconcileContext.anilistId,
            title: reconcileContext.anilistTitle ?? data.title,
            image: reconcileContext.anilistImage,
          });
        } else {
          const details = await anilistApi.getDetails(parseInt(reconcileContext.anilistId, 10));
          setLinkedAniList({
            id: details.id,
            title: details.title,
            image: details.image,
          });
        }
        setShowAniListRemap(false);
      } else {
        setShowProviderRemap(false);
        setPreviousProviderSeries(null);
      }

      const localValue = reconcileContext.localProgress ?? 0;
      const remoteValue = reconcileContext.remoteProgress ?? 0;
      let resolvedChoice = choice;
      if (choice === 'higher') {
        resolvedChoice = localValue >= remoteValue ? 'provider' : 'anilist';
      }

      if (resolvedChoice === 'provider' && localValue > 0) {
        await anilistApi.updateProgress(parseInt(reconcileContext.anilistId, 10), Math.floor(localValue));
      }

      if (resolvedChoice === 'anilist' && remoteValue > 0 && reconcileContext.providerDetails) {
        const targetChapter =
          getChapterByProgress(reconcileContext.providerDetails.chapters, remoteValue) ||
          getLatestChapter(reconcileContext.providerDetails.chapters);
        const readIds = getReadIdsForProgress(reconcileContext.providerDetails.chapters, remoteValue);

        history.add({
          seriesId: reconcileContext.anilistId,
          anilistId: reconcileContext.anilistId,
          providerSeriesId: reconcileContext.providerId,
          seriesTitle: data.title,
          seriesImage: data.image,
          chapterId: targetChapter.id,
          chapterNumber: targetChapter.number,
          chapterTitle: targetChapter.title,
          source: reconcileContext.providerDetails.source || 'AsuraScans',
          readChapters: readIds,
        });

        setReadChapterIds(new Set(readIds));
      }

      notify('Mapping updated.', 'success');
    } catch (error) {
      console.error(error);
      notify('Failed to update mapping.', 'error');
    } finally {
      setReconcileLoading(false);
      setReconcileContext(null);
    }
  };

  const parseChapterNumber = (value: string) => {
    const parsed = parseFloat(value.replace(/[^0-9.]/g, ''));
    return Number.isNaN(parsed) ? null : parsed;
  };

  const getLatestChapter = (chapters: SeriesDetails['chapters']) => {
    let best = chapters[0];
    let bestNum = best ? parseChapterNumber(best.number) ?? -Infinity : -Infinity;
    for (const chapter of chapters) {
      const num = parseChapterNumber(chapter.number);
      if (num !== null && num > bestNum) {
        best = chapter;
        bestNum = num;
      }
    }
    return best;
  };

  const getChapterByProgress = (chapters: SeriesDetails['chapters'], progress: number) => {
    let best: SeriesDetails['chapters'][number] | null = null;
    let bestNum = -Infinity;
    for (const chapter of chapters) {
      const num = parseChapterNumber(chapter.number);
      if (num === null || num > progress) continue;
      if (num >= bestNum) {
        bestNum = num;
        best = chapter;
      }
    }
    return best;
  };

  const getReadIdsForProgress = (chapters: SeriesDetails['chapters'], progress: number) => {
    const ids: string[] = [];
    for (const chapter of chapters) {
      const num = parseChapterNumber(chapter.number);
      if (num !== null && num <= progress) {
        ids.push(chapter.id);
      }
    }
    return ids;
  };

  const getChapterOrder = (chapters: SeriesDetails['chapters']) => {
    let previous: number | null = null;
    for (const chapter of chapters) {
      const num = parseChapterNumber(chapter.number);
      if (num === null) continue;
      if (previous === null) {
        previous = num;
        continue;
      }
      if (num < previous) return 'desc';
      if (num > previous) return 'asc';
    }
    return 'desc';
  };

  const getLocalProgress = (providerId?: string) => {
    if (!providerId) return null;
    const match = history.getItem({ providerSeriesId: providerId, title: data?.title });
    if (!match) return null;
    const parsed = parseChapterNumber(match.chapterNumber);
    return parsed;
  };

  const resolveRemoteProgress = async (anilistId: string) => {
    if (!user) return null;
    if (data?.source === 'AniList' && data.id === anilistId) {
      return data.mediaListEntry?.progress ?? null;
    }
    try {
      const details = await anilistApi.getDetails(parseInt(anilistId, 10));
      return details.mediaListEntry?.progress ?? null;
    } catch (error) {
      console.warn('Failed to fetch AniList progress for remap:', error);
      return null;
    }
  };

  const startProviderRemap = () => {
    if (!data) return;
    if (activeProviderSeries) {
      setPreviousProviderSeries(activeProviderSeries);
    }
    setShowProviderRemap(true);
    setProviderResults([]);
    setManualQuery('');
    setManualProviderUrl('');
    setShowProviderMenu(false);
  };

  const cancelProviderRemap = () => {
    if (previousProviderSeries) {
      setActiveProviderSeries(previousProviderSeries);
    }
    setPreviousProviderSeries(null);
    setShowProviderRemap(false);
    setProviderResults(null);
    setManualQuery('');
    setManualProviderUrl('');
  };

  const navigateToReader = (chapter: any) => {
    if (!activeProviderSeries) return;

    // We preserve the main view seriesId for back navigation.
    // We pass the AniList ID if the main view was from AniList.
    const isAniListSource = data?.source === 'AniList';
    const linkedAnilistId = !isAniListSource ? linkedAniList?.id : undefined;
    
    // Attempt to parse chapter number
    const chapterNum = parseFloat(chapter.number.replace(/[^0-9.]/g, ''));

    onNavigate('reader', {
      chapterId: chapter.id,
      seriesId: seriesId, // Back navigation ID
      anilistId: isAniListSource ? data?.id : linkedAnilistId,
      providerSeriesId: activeProviderSeries.id,
      providerMangaId: activeProviderSeries.providerMangaId,
      chapterNumber: !isNaN(chapterNum) ? chapterNum : undefined,
      chapters: activeProviderSeries.chapters, // Pass the full chapter list for navigation
      seriesTitle: data?.title,
      seriesImage: data?.image,
      source: activeProviderSeries.source || 'AsuraScans',
      seriesStatus: activeProviderSeries.status,
    });
  };

  const resumeChapter = useMemo(() => {
    if (!activeProviderSeries) return null;

    if (historyMatch) {
      const byId = activeProviderSeries.chapters.find(ch => ch.id === historyMatch.chapterId);
      if (byId) return byId;
      const byNumber = activeProviderSeries.chapters.find(
        ch => ch.number === historyMatch.chapterNumber || ch.title === historyMatch.chapterTitle,
      );
      if (byNumber) return byNumber;
    }

    const progress = data?.mediaListEntry?.progress;
    if (typeof progress === 'number' && progress > 0) {
      const target = progress + 1;
      const byNext = activeProviderSeries.chapters.find(
        ch => parseFloat(ch.number) === target,
      );
      if (byNext) return byNext;
      const byCurrent = activeProviderSeries.chapters.find(
        ch => parseFloat(ch.number) === progress,
      );
      return byCurrent || null;
    }

    return null;
  }, [activeProviderSeries, historyMatch, data?.mediaListEntry?.progress]);

  const resumeProviderId = useMemo(() => {
    if (!historyMatch) return null;
    if (historyMatch.providerSeriesId) return historyMatch.providerSeriesId;
    if (/^\d+$/.test(historyMatch.seriesId)) return null;
    return historyMatch.seriesId;
  }, [historyMatch]);

  const handleToggleChapterRead = (chapter: any) => {
    if (!data || !activeProviderSeries) return;
    const updated = history.toggleRead({
      seriesId: data.source === 'AniList' ? data.id : activeProviderSeries.id,
      anilistId: data.source === 'AniList' ? data.id : linkedAniList?.id,
      providerSeriesId: activeProviderSeries.id,
      seriesTitle: data.title,
      seriesImage: data.image,
      chapterId: chapter.id,
      chapterNumber: chapter.number,
      chapterTitle: chapter.title,
      source: activeProviderSeries.source || 'AsuraScans',
    });
    setReadChapterIds(new Set(updated));
  };

  const handleMarkReadUpTo = async (chapter: any, messageOverride?: string) => {
    if (!data || !activeProviderSeries) return;
    const chapters = activeProviderSeries.chapters;
    if (chapters.length === 0) return;

    const targetProgress = parseChapterNumber(chapter.number);
    let ids: string[] = [];

    if (targetProgress !== null) {
      ids = getReadIdsForProgress(chapters, targetProgress);
    } else {
      const index = chapters.findIndex((item) => item.id === chapter.id);
      if (index >= 0) {
        const order = getChapterOrder(chapters);
        ids = order === 'desc'
          ? chapters.slice(index).map((item) => item.id)
          : chapters.slice(0, index + 1).map((item) => item.id);
      }
    }

    if (ids.length === 0) {
      ids = [chapter.id];
    }

    setReadChapterIds(new Set(ids));

    const seriesId = data.source === 'AniList' ? data.id : activeProviderSeries.id;
    const anilistId = data.source === 'AniList' ? data.id : linkedAniList?.id;

    history.add({
      seriesId,
      anilistId,
      providerSeriesId: activeProviderSeries.id,
      seriesTitle: data.title,
      seriesImage: data.image,
      chapterId: chapter.id,
      chapterNumber: chapter.number,
      chapterTitle: chapter.title,
      source: activeProviderSeries.source || 'AsuraScans',
      readChapters: ids,
    });

    if (user && anilistId && targetProgress !== null) {
      await anilistApi.updateProgress(parseInt(anilistId, 10), Math.floor(targetProgress));
    }

    notify(messageOverride ?? `Marked up to chapter ${chapter.number} as read.`, 'success');
  };

  const handleMarkReadRange = async () => {
    if (!data || !activeProviderSeries) return;
    if (!rangeStart || !rangeEnd) {
      notify('Enter a start and end chapter.', 'error');
      return;
    }

    const startValue = parseChapterNumber(rangeStart);
    const endValue = parseChapterNumber(rangeEnd);
    if (startValue === null || endValue === null) {
      notify('Enter valid chapter numbers.', 'error');
      return;
    }

    const from = Math.min(startValue, endValue);
    const to = Math.max(startValue, endValue);
    const chapters = activeProviderSeries.chapters;
    const ids = chapters
      .filter((chapter) => {
        const num = parseChapterNumber(chapter.number);
        return num !== null && num >= from && num <= to;
      })
      .map((chapter) => chapter.id);

    if (ids.length === 0) {
      notify('No chapters found in that range.', 'error');
      return;
    }

    setRangeMarking(true);
    try {
      const merged = new Set(readChapterIds);
      ids.forEach((id) => merged.add(id));
      setReadChapterIds(new Set(merged));

      const targetChapter =
        getChapterByProgress(chapters, to) || chapters.find((chapter) => ids.includes(chapter.id));
      const seriesId = data.source === 'AniList' ? data.id : activeProviderSeries.id;
      const anilistId = data.source === 'AniList' ? data.id : linkedAniList?.id;

      history.add({
        seriesId,
        anilistId,
        providerSeriesId: activeProviderSeries.id,
        seriesTitle: data.title,
        seriesImage: data.image,
        chapterId: targetChapter?.id || ids[ids.length - 1],
        chapterNumber: targetChapter?.number || rangeEnd,
        chapterTitle: targetChapter?.title,
        source: activeProviderSeries.source || 'AsuraScans',
        readChapters: Array.from(merged),
      });

      if (user && anilistId) {
        const existingProgress = data.mediaListEntry?.progress ?? 0;
        const updatedProgress = Math.max(existingProgress, Math.floor(to));
        await anilistApi.updateProgress(parseInt(anilistId, 10), updatedProgress);
      }

      notify(`Marked chapters ${from} - ${to} as read.`, 'success');
    } finally {
      setRangeMarking(false);
    }
  };

  const handleCatchUpToLatest = async () => {
    if (!activeProviderSeries) return;
    const latest = getLatestChapter(activeProviderSeries.chapters);
    if (!latest) return;
    await handleMarkReadUpTo(latest, 'Caught up to latest chapter.');
  };

  const handleClearReadHistory = () => {
    if (!data || !activeProviderSeries) return;
    const confirmed = window.confirm('Clear read history for this series?');
    if (!confirmed) return;
    history.clearSeries({
      seriesId: data.source === 'AniList' ? data.id : activeProviderSeries.id,
      anilistId: data.source === 'AniList' ? data.id : linkedAniList?.id,
      providerSeriesId: activeProviderSeries.id,
      title: data.title,
    });
    setReadChapterIds(new Set());
    setHistoryMatch(null);
    notify('Read history cleared.', 'success');
  };

  const handleDownloadChapter = async (chapter: any) => {
    if (!activeProviderSeries) return;
    setQueuedChapterIds((prev) => new Set(prev).add(chapter.id));
    try {
      const job = await api.queueDownload({
        providerSeriesId: activeProviderSeries.id,
        chapterId: chapter.id,
        chapterUrl: chapter.url,
        chapterNumber: chapter.number,
        chapterTitle: chapter.title,
        seriesTitle: activeProviderSeries.title,
        seriesImage: activeProviderSeries.image,
        seriesStatus: activeProviderSeries.status,
        seriesRating: activeProviderSeries.rating,
        seriesChapters: activeProviderSeries.chapters?.length
          ? String(activeProviderSeries.chapters.length)
          : undefined,
      });
      if (job.status === 'completed' || job.status === 'queued') {
        await refreshDownloadedChapters(activeProviderSeries.providerMangaId);
      }
      notify(
        job.status === 'completed'
          ? `Chapter ${chapter.number} is already downloaded.`
          : `Chapter ${chapter.number} added to downloads.`,
        'success',
      );
    } catch (error) {
      notify(
        error instanceof Error ? error.message : 'Failed to queue download',
        'error',
      );
    } finally {
      setQueuedChapterIds((prev) => {
        const next = new Set(prev);
        next.delete(chapter.id);
        return next;
      });
    }
  };

  const handleOpenDownload = (chapterNumber: string) => {
    const downloadId = downloadedChaptersByNumber[chapterNumber];
    if (!downloadId) return;
    window.open(api.getDownloadFileUrl(downloadId), '_blank', 'noopener');
  };

  const toggleChapterSelection = (chapterId: string) => {
    setSelectedChapterIds((prev) => {
      const next = new Set(prev);
      if (next.has(chapterId)) {
        next.delete(chapterId);
      } else {
        next.add(chapterId);
      }
      return next;
    });
  };

  const handleBatchDownload = async () => {
    if (!activeProviderSeries || batchDownloading) return;
    const selectedChapters = activeProviderSeries.chapters.filter((chapter) =>
      selectedChapterIds.has(chapter.id),
    );
    if (selectedChapters.length === 0) {
      notify('Select chapters to download.', 'error');
      return;
    }

    setBatchDownloading(true);
    let queued = 0;
    let skipped = 0;
    let failed = 0;

    for (const chapter of selectedChapters) {
      if (downloadedChapterIds.has(chapter.id) || queuedChapterIds.has(chapter.id)) {
        skipped += 1;
        continue;
      }

      setQueuedChapterIds((prev) => new Set(prev).add(chapter.id));
      try {
        await api.queueDownload({
          providerSeriesId: activeProviderSeries.id,
          chapterId: chapter.id,
          chapterUrl: chapter.url,
          chapterNumber: chapter.number,
          chapterTitle: chapter.title,
          seriesTitle: activeProviderSeries.title,
          seriesImage: activeProviderSeries.image,
          seriesStatus: activeProviderSeries.status,
          seriesRating: activeProviderSeries.rating,
          seriesChapters: activeProviderSeries.chapters?.length
            ? String(activeProviderSeries.chapters.length)
            : undefined,
        });
        queued += 1;
      } catch (error) {
        failed += 1;
      } finally {
        setQueuedChapterIds((prev) => {
          const next = new Set(prev);
          next.delete(chapter.id);
          return next;
        });
      }
    }

    await refreshDownloadedChapters(activeProviderSeries.providerMangaId);
    setBatchDownloading(false);
    setSelectedChapterIds(new Set());
    setSelectionMode(false);

    if (queued > 0) {
      notify(`Queued ${queued} chapters for download.`, 'success');
    }
    if (skipped > 0) {
      notify(`${skipped} chapters already queued or downloaded.`, 'info');
    }
    if (failed > 0) {
      notify(`Failed to queue ${failed} chapters.`, 'error');
    }
  };

  const handleStatusUpdate = async (status: string) => {
    if (!user) {
        notify("Login in to proceed to manage your library.", 'error');
        return;
    }
    
    if (!data) return;

    setUpdatingStatus(true);
    setShowStatusMenu(false);
    try {
       const success = await anilistApi.updateStatus(parseInt(data.id), status);
       if (success) {
         setUserStatus(status);
         notify(`Added to ${STATUS_LABELS[status]} list`, 'success');
       } else {
         notify("Failed to update status. Please try again.", 'error');
       }
    } catch (e) {
       console.error(e);
       notify("An error occurred while communicating with AniList.", 'error');
    } finally {
       setUpdatingStatus(false);
    }
  };

  // Filter chapters based on search query
  const filteredChapters = useMemo(() => {
    if (!activeProviderSeries) return [];
    if (!chapterSearchQuery) return activeProviderSeries.chapters;
    
    const lowerQuery = chapterSearchQuery.toLowerCase();
    
    // 1. Filter
    const filtered = activeProviderSeries.chapters.filter(ch => 
      ch.number.toLowerCase().includes(lowerQuery) || 
      ch.title.toLowerCase().includes(lowerQuery)
    );

    // 2. Sort by relevance if searching
    const queryNum = parseFloat(chapterSearchQuery);
    
    return filtered.sort((a, b) => {
        // Exact string match on number gets highest priority
        if (a.number === chapterSearchQuery) return -1;
        if (b.number === chapterSearchQuery) return 1;

        // If query is a number, sort by proximity to that number (asc order of distance)
        const aNum = parseFloat(a.number);
        const bNum = parseFloat(b.number);

        if (!isNaN(queryNum) && !isNaN(aNum) && !isNaN(bNum)) {
             const distA = Math.abs(aNum - queryNum);
             const distB = Math.abs(bNum - queryNum);
             if (distA !== distB) return distA - distB;
        }

        return 0; // Maintain original order (Descending date/number)
    });
  }, [activeProviderSeries, chapterSearchQuery]);

  // Reset pagination when search query changes
  useEffect(() => {
     if (chapterSearchQuery) {
         setVisibleChapters(10000); 
     } else {
         setVisibleChapters(100);
     }
  }, [chapterSearchQuery]);

  const handleLoadMore = () => {
    setVisibleChapters(prev => prev + 100);
  };

  if (loading || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isAniListSource = data.source === 'AniList';
  const countryLabel = formatCountryLabel(data.countryOfOrigin);
  const formatLabel = data.format ? formatEnumLabel(data.format) : 'Unknown';
  const formatDisplay = countryLabel ? `${formatLabel} (${countryLabel})` : formatLabel;
  const sourceLabel = data.sourceMaterial ? formatEnumLabel(data.sourceMaterial) : 'Unknown';
  const statusLabel = formatEnumLabel(data.status);
  const startDateLabel = formatFuzzyDate(data.startDate ?? null);
  const averageScoreLabel = data.averageScore !== null && data.averageScore !== undefined ? `${data.averageScore}%` : '—';
  const meanScoreLabel = data.meanScore !== null && data.meanScore !== undefined ? `${data.meanScore}%` : '—';
  const popularityLabel = formatNumber(data.popularity);
  const favouritesLabel = formatNumber(data.favourites);
  const rankings = (data.rankings ?? []).filter((rank) => rank.allTime).slice(0, 2);
  const displayTags = (data.tags ?? [])
    .filter((tag) => !tag.isMediaSpoiler)
    .sort((a, b) => b.rank - a.rank);
  const topCharacters = (data.characters ?? []).slice(0, 6);
  const topStaff = (data.staffMembers ?? []).slice(0, 6);
  const scoreDistribution = (data.scoreDistribution ?? []).slice().sort((a, b) => a.score - b.score);
  const statusDistribution = data.statusDistribution ?? [];
  const statusTotal = statusDistribution.reduce((sum, item) => sum + item.amount, 0);
  const scoreMax = scoreDistribution.reduce((max, item) => Math.max(max, item.amount), 0);
  const showChapters = activeProviderSeries && activeProviderSeries.chapters.length > 0;
  const hasRecommendations = data.recommendations && data.recommendations.length > 0;
  const showProviderSelection = providerResults !== null && (!showChapters || showProviderRemap);
  const providerList = providerResults ?? [];

  const STATUS_LABELS: Record<string, string> = {
      'CURRENT': 'Reading',
      'PLANNING': 'Planning',
      'COMPLETED': 'Completed',
      'DROPPED': 'Dropped',
      'PAUSED': 'Paused',
      'REPEATING': 'Rereading'
  };

  return (
    <div className="min-h-screen bg-background relative pb-20">
      {/* Dynamic Background with Fade In */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
        className="absolute top-0 left-0 w-full h-[60vh] overflow-hidden z-0 mask-gradient-b"
      >
        <img 
          src={data.bannerImage || data.image} 
          className="w-full h-full object-cover blur-3xl opacity-30 scale-110" 
          alt="bg" 
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/20 to-background" />
      </motion.div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pt-8">
        <motion.button 
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          onClick={onBack}
          className="mb-8 flex items-center gap-2.5 text-gray-300 hover:text-white transition-colors bg-black/40 hover:bg-black/60 px-6 py-3 rounded-full backdrop-blur-md font-bold text-base border border-white/5"
        >
          <ChevronLeft className="w-5 h-5" />
          <span>Back</span>
        </motion.button>

        <div className="flex flex-col md:flex-row gap-10 items-start">
          {/* Cover Image with pop-in */}
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ delay: 0.3, type: "spring", stiffness: 100 }}
            className="w-56 sm:w-72 flex-shrink-0 mx-auto md:mx-0 rounded-2xl overflow-hidden shadow-2xl shadow-black/50 border border-white/5 ring-1 ring-white/10 relative"
          >
            <img 
              src={data.image} 
              alt={data.title} 
              className="w-full h-auto object-cover" 
              loading="lazy"
            />
          </motion.div>

          {/* Info with stagger */}
          <motion.div 
            className="flex-1 space-y-8"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0 },
              visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.4 } }
            }}
          >
            <motion.div variants={{ hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1 } }} className="space-y-4 text-center md:text-left">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <h1 className="text-4xl sm:text-6xl font-extrabold text-white leading-[1.1] tracking-tight">{data.title}</h1>
              </div>
              
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-base font-medium text-gray-400">
                <span className="flex items-center gap-1.5 text-yellow-400 bg-yellow-400/10 px-3 py-1 rounded-lg">
                  <StarIcon className="w-4 h-4" fill />
                  <span className="font-bold">{data.rating}</span>
                </span>
                <span className="px-3 py-1 rounded-lg bg-surfaceHighlight text-white border border-white/5">{data.status}</span>
                <span className="text-gray-300">{data.author}</span>
                <span className={`px-3 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wide border ${isAniListSource ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-green-500/10 border-green-500/20 text-green-400'}`}>
                  {isAniListSource ? 'AniList' : 'AsuraScans'}
                </span>
              </div>
            </motion.div>

            <motion.div variants={{ hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1 } }} className="flex flex-wrap gap-2.5 justify-center md:justify-start">
              {data.genres.map(g => (
                <span key={g} className="px-4 py-1.5 rounded-full text-sm font-semibold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors">
                  {g}
                </span>
              ))}
            </motion.div>

            <motion.p variants={{ hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1 } }} className="text-gray-300 leading-relaxed text-base sm:text-lg max-w-4xl whitespace-pre-line font-medium">
              {data.description}
            </motion.p>

            {/* Primary Actions Area */}
            <motion.div variants={{ hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1 } }} className="flex flex-col gap-5 pt-4 items-center xl:items-start border-t border-white/5 mt-6">
              {showChapters && resumeChapter && (
                <div className="w-full max-w-xl">
                  <div className="text-[11px] font-bold uppercase tracking-widest text-primary/70 mb-2">
                    Continue Reading
                  </div>
                  <button
                    onClick={() => navigateToReader(resumeChapter)}
                    className="w-full px-7 py-4 bg-primary/90 hover:bg-primary text-onPrimary rounded-2xl shadow-lg shadow-primary/30 transition-all transform hover:scale-[1.01] active:scale-95 text-left border border-primary/40"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xl font-black leading-tight">
                        {historyMatch ? 'Resume' : 'Continue'}
                      </span>
                      <span className="text-[11px] font-semibold text-black/70 bg-black/10 px-2 py-0.5 rounded-full">
                        Ch {resumeChapter.number}
                      </span>
                    </div>
                    {historyMatch?.timestamp ? (
                      <div className="text-xs font-semibold text-black/70 mt-1">
                        Last read {formatTimeAgo(historyMatch.timestamp)}
                      </div>
                    ) : data?.mediaListEntry?.progress ? (
                      <div className="text-xs font-semibold text-black/70 mt-1">From AniList</div>
                    ) : null}
                  </button>
                </div>
              )}

              <div className="flex flex-wrap justify-center xl:justify-start gap-4 w-full">
                  {showChapters ? (
                    <>
                      <button 
                        onClick={() => navigateToReader(activeProviderSeries!.chapters[activeProviderSeries!.chapters.length - 1])}
                        className="min-w-[160px] px-6 py-3 bg-primary hover:bg-primaryHover text-onPrimary font-bold text-base rounded-xl shadow-lg shadow-primary/25 transition-all transform hover:scale-[1.02] active:scale-95 whitespace-nowrap"
                      >
                        Read First
                      </button>
                      <button 
                        onClick={() => navigateToReader(activeProviderSeries!.chapters[0])}
                        className="min-w-[160px] px-6 py-3 bg-surfaceHighlight hover:bg-white/10 text-white font-bold text-base rounded-xl border border-white/10 transition-all hover:border-white/20 whitespace-nowrap"
                      >
                        Read Latest
                      </button>
                    </>
                  ) : (
                    <div className="relative w-full md:w-auto flex-1 md:flex-none">
                        <button 
                           onClick={() => setShowProviderMenu(!showProviderMenu)}
                           className="w-full md:min-w-[240px] px-8 py-4 bg-surfaceHighlight hover:bg-white/10 border border-white/10 text-white font-bold text-lg rounded-xl transition-all flex items-center justify-center gap-3 shadow-lg hover:border-primary/50"
                        >
                           {providerLoading ? (
                              <span className="animate-spin w-5 h-5 border-2 border-white/50 border-t-white rounded-full"></span>
                           ) : (
                              <SearchIcon className="w-5 h-5" />
                           )}
                           <span>Find on Provider</span>
                           <ChevronDown className={`w-4 h-4 transition-transform ${showProviderMenu ? 'rotate-180' : ''}`} />
                        </button>

                        {showProviderMenu && (
                            <div className="absolute top-full left-0 mt-2 w-full md:w-64 bg-surface border border-white/10 rounded-xl shadow-2xl z-30 overflow-hidden animate-fade-in ring-1 ring-black/50">
                                <div className="px-4 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider bg-surfaceHighlight/50">
                                    Select Source
                                </div>
                                {PROVIDERS.map(p => (
                                    <button
                                       key={p.id}
                                       onClick={() => p.enabled && handleSearchOnProvider(p.id)}
                                       className={`w-full text-left px-4 py-3.5 text-sm font-bold transition-colors flex items-center justify-between border-b border-white/5 last:border-0 ${
                                           !p.enabled ? 'opacity-50 cursor-not-allowed bg-black/20' : 'hover:bg-white/10 text-white'
                                       }`}
                                    >
                                        {p.name}
                                        {p.enabled && <ChevronLeft className="w-4 h-4 rotate-180 text-gray-500" />}
                                    </button>
                                ))}
                            </div>
                        )}
                        
                        {showProviderMenu && <div className="fixed inset-0 z-20" onClick={() => setShowProviderMenu(false)} />}
                    </div>
                  )}

                  {/* Library Status Button - Prominently Placed */}
                  {isAniListSource && (
                      <div className="relative w-full md:w-auto flex-1 md:flex-none">
                         <button
                            onClick={() => setShowStatusMenu(!showStatusMenu)}
                            disabled={updatingStatus}
                            className={`w-full md:min-w-[200px] h-full min-h-[56px] px-6 py-4 font-bold text-lg rounded-xl border transition-all flex items-center justify-center gap-3 shadow-lg ${
                               userStatus 
                                 ? 'bg-[#3DB4F2] hover:bg-[#35a3db] text-white border-transparent shadow-blue-500/20' 
                                 : 'bg-surfaceHighlight hover:bg-white/10 text-blue-400 border-blue-500/30 hover:border-blue-400'
                            }`}
                         >
                            {updatingStatus ? (
                                <span className="animate-spin w-5 h-5 border-2 border-current border-t-transparent rounded-full" />
                            ) : (
                                <>
                                    <LibraryIcon className="w-5 h-5" />
                                    <span>{userStatus ? STATUS_LABELS[userStatus] : 'Add to Library'}</span>
                                    <ChevronDown className={`w-4 h-4 transition-transform ${showStatusMenu ? 'rotate-180' : ''}`} />
                                </>
                            )}
                         </button>
                         
                         {showStatusMenu && (
                            <div className="absolute top-full left-0 mt-2 w-full md:w-56 bg-surface border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden animate-fade-in ring-1 ring-black/50">
                                {Object.entries(STATUS_LABELS).map(([statusKey, label]) => (
                                    <button
                                       key={statusKey}
                                       onClick={() => handleStatusUpdate(statusKey)}
                                       className={`w-full text-left px-5 py-3.5 text-sm font-bold hover:bg-white/10 transition-colors flex items-center justify-between border-b border-white/5 last:border-0 ${
                                          userStatus === statusKey ? 'text-[#3DB4F2] bg-[#3DB4F2]/5' : 'text-gray-300'
                                       }`}
                                    >
                                        {label}
                                        {userStatus === statusKey && <div className="w-2 h-2 rounded-full bg-[#3DB4F2]" />}
                                    </button>
                                ))}
                            </div>
                         )}
                         {showStatusMenu && <div className="fixed inset-0 z-40" onClick={() => setShowStatusMenu(false)} />}
                      </div>
                  )}
              </div>
            </motion.div>

            {!isAniListSource && (
              <motion.div variants={{ hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1 } }} className="rounded-2xl border border-white/10 bg-surfaceHighlight/30 p-6 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-white">Link to AniList</h3>
                    <p className="text-sm text-gray-400">
                      Attach this provider series to AniList so we can sync progress and stats.
                    </p>
                  </div>
                  {linkedAniList && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onNavigate('details', linkedAniList.id)}
                        className="px-4 py-2 rounded-xl bg-white/10 text-white text-sm font-semibold border border-white/10 hover:bg-white/20"
                      >
                        Open AniList
                      </button>
                      <button
                        onClick={() => setShowAniListRemap((prev) => !prev)}
                        className="px-4 py-2 rounded-xl bg-white/5 text-white text-sm font-semibold border border-white/10 hover:bg-white/15"
                      >
                        {showAniListRemap ? 'Cancel' : 'Change Link'}
                      </button>
                    </div>
                  )}
                </div>

                {linkedAniList && (
                  <div className="flex items-center gap-4 rounded-xl bg-black/30 border border-white/10 p-4">
                    {linkedAniList.image && (
                      <img
                        src={linkedAniList.image}
                        alt={linkedAniList.title}
                        className="w-16 h-24 object-cover rounded-lg"
                      />
                    )}
                    <div>
                      <div className="text-sm font-bold text-white">{linkedAniList.title}</div>
                      <div className="text-xs text-green-400 font-semibold mt-1">Linked</div>
                      {showAniListRemap && (
                        <div className="text-[11px] text-yellow-300 mt-1">
                          Remapping will replace the current link.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {(!linkedAniList || showAniListRemap) && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-3">
                      <div>
                        <h4 className="text-sm font-bold text-white">Search AniList</h4>
                        <p className="text-xs text-gray-400">Find the official entry and link it.</p>
                      </div>
                      <div className="flex gap-2">
                        <input
                          value={anilistQuery}
                          onChange={(e) => setAnilistQuery(e.target.value)}
                          placeholder="Search AniList title..."
                          className="flex-1 bg-surfaceHighlight border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                        />
                        <button
                          onClick={handleAniListSearch}
                          disabled={anilistSearchLoading}
                          className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-60"
                        >
                          {anilistSearchLoading ? '...' : 'Search'}
                        </button>
                      </div>
                      {anilistResults.length > 0 && (
                        <div className="max-h-56 overflow-y-auto space-y-2">
                          {anilistResults.map((result) => (
                            <div
                              key={result.id}
                              className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/40 p-2"
                            >
                              <img
                                src={result.image}
                                alt={result.title}
                                className="w-10 h-14 object-cover rounded-md"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-semibold text-white truncate">{result.title}</div>
                                <div className="text-[10px] text-gray-500">ID {result.id}</div>
                              </div>
                              <button
                                onClick={() => handleLinkAniList(result.id, result)}
                                disabled={!user || linkingAniList}
                                className="px-3 py-1.5 rounded-full bg-white/10 text-xs font-semibold text-white border border-white/10 hover:bg-white/20 disabled:opacity-50"
                              >
                                Link
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-3">
                      <div>
                        <h4 className="text-sm font-bold text-white">Paste AniList URL or ID</h4>
                        <p className="text-xs text-gray-400">Example: https://anilist.co/manga/30013</p>
                      </div>
                      <div className="flex gap-2">
                        <input
                          value={anilistManualInput}
                          onChange={(e) => setAnilistManualInput(e.target.value)}
                          placeholder="AniList URL or ID"
                          className="flex-1 bg-surfaceHighlight border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                        />
                        <button
                          onClick={handleManualAniListLink}
                          disabled={!user || linkingAniList}
                          className="px-4 py-2 rounded-lg bg-white/10 text-white text-sm font-semibold border border-white/10 hover:bg-white/20 disabled:opacity-50"
                        >
                          Link
                        </button>
                      </div>
                      {!user && (
                        <div className="text-[11px] text-yellow-400">Login required to link AniList.</div>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

          </motion.div>
        </div>

        {/* --- Tab Navigation --- */}
        <div className="mt-20 border-b border-white/10 flex gap-8">
           <button 
             onClick={() => setActiveTab('Chapters')}
             className={`pb-4 text-lg font-bold transition-all border-b-2 ${activeTab === 'Chapters' ? 'border-primary text-white' : 'border-transparent text-gray-400 hover:text-white'}`}
           >
             Chapters
           </button>
           {isAniListSource && (
             <button 
               onClick={() => setActiveTab('Info')}
               className={`pb-4 text-lg font-bold transition-all border-b-2 ${activeTab === 'Info' ? 'border-primary text-white' : 'border-transparent text-gray-400 hover:text-white'}`}
             >
               Info
             </button>
           )}
           {hasRecommendations && (
             <button 
               onClick={() => setActiveTab('Recommendations')}
               className={`pb-4 text-lg font-bold transition-all border-b-2 ${activeTab === 'Recommendations' ? 'border-primary text-white' : 'border-transparent text-gray-400 hover:text-white'}`}
             >
               Recommendations
             </button>
           )}
        </div>

        {/* --- Content Area --- */}
        <div className="mt-10 min-h-[400px]">
          
          {/* TAB: CHAPTERS */}
          {activeTab === 'Chapters' && (
            <>
              {providerLoading && !providerResults && (
                <div className="space-y-8">
                  <div className="text-center py-8 text-gray-400 font-medium animate-pulse text-lg">
                    Searching {selectedProvider} repository...
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                    {Array.from({ length: 10 }).map((_, index) => (
                      <div
                        key={`provider-skeleton-${index}`}
                        className="rounded-2xl bg-surfaceHighlight/40 border border-white/5 overflow-hidden animate-pulse"
                      >
                        <div className="aspect-[2/3] bg-white/5" />
                        <div className="p-4 space-y-3">
                          <div className="h-3 bg-white/10 rounded w-4/5" />
                          <div className="h-3 bg-white/10 rounded w-2/3" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!showChapters && resumeProviderId && (
                <div className="mb-8 p-6 rounded-2xl bg-surfaceHighlight/40 border border-white/10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                  <div>
                    <h4 className="text-lg font-bold text-white">Resume from your last read</h4>
                    <p className="text-sm text-gray-400 mt-1">
                      We found your progress on Asura. Attach once and skip future searches.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => handleSelectProviderSeries(resumeProviderId)}
                      className="px-5 py-2.5 rounded-xl bg-primary text-onPrimary font-bold text-sm shadow-lg shadow-primary/20"
                    >
                      Resume Ch {historyMatch?.chapterNumber}
                    </button>
                    <button
                      onClick={() => handleSearchOnProvider(selectedProvider)}
                      className="px-5 py-2.5 rounded-xl bg-white/5 text-white font-semibold text-sm border border-white/10 hover:bg-white/10"
                    >
                      Search Again
                    </button>
                  </div>
                </div>
              )}

              {/* Provider Search Results / Remap */}
              {showProviderSelection && (
                <div className="animate-fade-in">
                  <div className="flex flex-wrap items-center gap-3 mb-3">
                    <h3 className="text-2xl font-extrabold text-white">
                      {showProviderRemap ? 'Remap Provider Series' : `Select Series from ${selectedProvider}`}
                    </h3>
                    {providerRefreshing && (
                      <span className="text-[11px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full bg-yellow-500/10 text-yellow-300 border border-yellow-500/30">
                        Refreshing
                      </span>
                    )}
                    {providerCacheHit && !providerRefreshing && (
                      <span className="text-[11px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full bg-white/5 text-gray-300 border border-white/10">
                        Cached
                      </span>
                    )}
                  </div>
                  <p className="text-gray-400 mb-8 font-medium">
                    {showProviderRemap
                      ? 'Search for the correct provider series to replace the current mapping.'
                      : 'We found multiple matches. Please select the correct one to load chapters.'}
                  </p>
                  
                  {providerList.length === 0 ? (
                     <div className="p-10 rounded-2xl bg-surfaceHighlight/30 text-center text-gray-400 border border-dashed border-white/10 font-medium">
                        {showProviderRemap
                          ? 'Start a new search or paste the provider URL below.'
                          : `No matching series found on ${selectedProvider} for "${data.title}".`}
                     </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                      {providerList.map((res) => (
                        <div 
                          key={res.id} 
                          onClick={() => handleSelectProviderSeries(res.id)}
                          className="cursor-pointer group bg-surfaceHighlight rounded-2xl overflow-hidden hover:ring-2 ring-primary transition-all shadow-lg"
                        >
                          <div className="aspect-[2/3] relative">
                            <img src={res.image} className="w-full h-full object-cover" loading="lazy" />
                            <div className="absolute inset-0 bg-black/50 group-hover:bg-black/20 transition-colors" />
                          </div>
                          <div className="p-4">
                            <h4 className="text-[15px] font-bold text-white line-clamp-2 leading-snug">{res.title}</h4>
                            <span className="text-xs font-medium text-gray-400 mt-1 block">{res.latestChapter}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {providerList.length === 0 && (
                    <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="p-5 rounded-2xl bg-surfaceHighlight/30 border border-white/10">
                        <h4 className="text-sm font-bold text-white mb-2">Search with a different name</h4>
                        <p className="text-xs text-gray-400 mb-4">
                          Try the provider’s official title or an alternate name.
                        </p>
                        <div className="flex gap-2">
                          <input
                            value={manualQuery}
                            onChange={(e) => setManualQuery(e.target.value)}
                            placeholder="Search Asura by title..."
                            className="flex-1 bg-surfaceHighlight border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                          />
                          <button
                            onClick={handleManualSearch}
                            className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold"
                          >
                            Search
                          </button>
                        </div>
                      </div>

                      <div className="p-5 rounded-2xl bg-surfaceHighlight/30 border border-white/10">
                        <h4 className="text-sm font-bold text-white mb-2">Paste the exact series URL</h4>
                        <p className="text-xs text-gray-400 mb-4">
                          We’ll load it directly and map it to AniList.
                        </p>
                        <div className="flex gap-2">
                          <input
                            value={manualProviderUrl}
                            onChange={(e) => setManualProviderUrl(e.target.value)}
                            placeholder="https://asuracomic.net/series/..."
                            className="flex-1 bg-surfaceHighlight border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                          />
                          <button
                            onClick={handleManualUrlMap}
                            className="px-4 py-2 rounded-lg bg-white/10 text-white text-sm font-semibold border border-white/10 hover:bg-white/20"
                          >
                            Load
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 1. Show Chapters if available */}
              {showChapters && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div className="flex flex-col gap-4 mb-8">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-2xl font-extrabold text-white flex items-center gap-3 tracking-tight">
                          Available Chapters
                          <span className="text-sm font-bold text-gray-400 bg-surfaceHighlight px-2.5 py-0.5 rounded-full border border-white/5">
                            {activeProviderSeries?.chapters.length}
                          </span>
                        </h3>
                        {isAniListSource && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={startProviderRemap}
                              className="px-3 py-1.5 rounded-lg bg-white/10 text-xs font-semibold text-white border border-white/10 hover:bg-white/20"
                            >
                              Change Provider
                            </button>
                            {showProviderRemap && (
                              <button
                                onClick={cancelProviderRemap}
                                className="px-3 py-1.5 rounded-lg bg-white/5 text-xs font-semibold text-gray-300 border border-white/10 hover:bg-white/10"
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="relative w-full sm:w-72 group ml-auto">
                        <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-gray-500 group-focus-within:text-primary transition-colors">
                          <SearchIcon className="w-5 h-5" />
                        </div>
                        <input 
                          type="text" 
                          placeholder="Search chapter..." 
                          className="w-full bg-surfaceHighlight border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                          value={chapterSearchQuery}
                          onChange={(e) => setChapterSearchQuery(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        onClick={handleCatchUpToLatest}
                        title="Marks all chapters up to the newest as read."
                        className="px-4 py-2 rounded-lg bg-white/10 text-sm font-semibold text-white border border-white/10 hover:bg-white/20"
                      >
                        Mark Latest Read
                      </button>
                      <button
                        onClick={handleClearReadHistory}
                        title="Clears local read history for this series."
                        className="px-4 py-2 rounded-lg bg-white/5 text-sm font-semibold text-gray-300 border border-white/10 hover:bg-white/10"
                      >
                        Clear History
                      </button>
                      <div className="flex flex-wrap items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Range</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          pattern="[0-9.]*"
                          placeholder="1"
                          value={rangeStart}
                          onChange={(event) => setRangeStart(event.target.value)}
                          className="w-16 h-8 bg-surfaceHighlight/70 border border-white/10 rounded-md px-2 text-xs font-semibold text-white focus:outline-none focus:border-primary"
                        />
                        <span className="text-xs text-gray-500">to</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          pattern="[0-9.]*"
                          placeholder="10"
                          value={rangeEnd}
                          onChange={(event) => setRangeEnd(event.target.value)}
                          className="w-16 h-8 bg-surfaceHighlight/70 border border-white/10 rounded-md px-2 text-xs font-semibold text-white focus:outline-none focus:border-primary"
                        />
                        <button
                          onClick={handleMarkReadRange}
                          disabled={rangeMarking || !rangeStart || !rangeEnd}
                          className={`h-8 px-3 rounded-md text-[11px] font-semibold uppercase tracking-wide border transition-colors ${
                            rangeMarking || !rangeStart || !rangeEnd
                              ? 'bg-white/5 text-gray-500 border-white/10'
                              : 'bg-primary/80 text-black border-primary hover:brightness-110'
                          }`}
                        >
                          {rangeMarking ? 'Marking...' : 'Mark Range'}
                        </button>
                      </div>
                      <button
                        onClick={() => {
                          setSelectionMode((prev) => !prev);
                          setSelectedChapterIds(new Set());
                        }}
                        title="Select chapters to download in a batch."
                        className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                          selectionMode
                            ? 'bg-primary text-black border-primary'
                            : 'bg-white/10 text-white border-white/10 hover:bg-white/20'
                        }`}
                      >
                        {selectionMode
                          ? `Selecting (${selectedChapterIds.size})`
                          : 'Select Chapters'}
                      </button>
                      {selectionMode && (
                        <>
                          <button
                            onClick={handleBatchDownload}
                            disabled={batchDownloading || selectedChapterIds.size === 0}
                            className={`px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                              batchDownloading || selectedChapterIds.size === 0
                                ? 'bg-white/5 text-gray-500 border-white/10'
                                : 'bg-primary/90 text-black border-primary hover:brightness-110'
                            }`}
                          >
                            {batchDownloading
                              ? 'Queueing...'
                              : `Download Selected (${selectedChapterIds.size})`}
                          </button>
                          <button
                            onClick={() => setSelectedChapterIds(new Set())}
                            className="px-3 py-2.5 rounded-xl text-xs font-semibold text-gray-300 border border-white/10 hover:bg-white/10"
                          >
                            Clear
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  
                  {filteredChapters.length > 0 ? (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {filteredChapters.slice(0, visibleChapters).map((chapter, idx) => {
                          const isRead = readChapterIds.has(chapter.id);
                          const isDownloaded = downloadedChapterIds.has(chapter.id);
                          const isQueued = queuedChapterIds.has(chapter.id);
                          const isSelected = selectedChapterIds.has(chapter.id);
                          return (
                            <motion.div
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: idx < 20 ? idx * 0.03 : 0 }}
                              key={chapter.id}
                              onClick={() => {
                                if (selectionMode) {
                                  toggleChapterSelection(chapter.id);
                                  return;
                                }
                                navigateToReader(chapter);
                              }}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault();
                                  if (selectionMode) {
                                    toggleChapterSelection(chapter.id);
                                    return;
                                  }
                                  navigateToReader(chapter);
                                }
                              }}
                              role="button"
                              tabIndex={0}
                              aria-label={`Open ${chapter.title}`}
                              className={`flex items-center justify-between p-4 rounded-xl border transition-all group text-left cursor-pointer ${
                                selectionMode && isSelected
                                  ? 'bg-primary/10 border-primary/50 ring-1 ring-primary/40'
                                  : isDownloaded
                                    ? `bg-primary/5 hover:bg-primary/10 border-primary/30 ${
                                        isRead ? 'ring-1 ring-emerald-400/40' : ''
                                      }`
                                    : isRead
                                      ? 'bg-emerald-500/10 border-emerald-500/30'
                                      : 'bg-surface hover:bg-surfaceHighlight border-white/5 hover:border-white/10'
                              }`}
                              whileHover={{ x: 5 }}
                            >
                              <div className="flex-1 min-w-0 pr-4">
                              <div className="flex items-center gap-2">
                                {selectionMode && (
                                  <div
                                    className={`h-4 w-4 rounded border ${
                                      isSelected
                                        ? 'bg-primary border-primary'
                                        : 'border-white/20'
                                    }`}
                                  />
                                )}
                              <h4 className={`font-bold text-[15px] transition-colors truncate ${isRead ? 'text-emerald-100' : 'text-gray-200 group-hover:text-primary'}`}>
                                {chapter.title.toLowerCase().includes('chapter') || chapter.title.toLowerCase().includes('episode') 
                                  ? chapter.title 
                                  : `Chapter ${chapter.number}${chapter.title ? ` - ${chapter.title}` : ''}`}
                                {isRead && (
                                  <span className="ml-2 text-[9px] uppercase tracking-wider text-emerald-300">Read</span>
                                )}
                                {isDownloaded && (
                                  <span className="ml-2 text-[9px] uppercase tracking-wider text-primary/80">Downloaded</span>
                                )}
                              </h4>
                              </div>
                              <p className="text-xs font-medium text-gray-500 mt-1.5">{chapter.date}</p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleChapterRead(chapter);
                                }}
                                className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border transition-colors ${
                                  isRead
                                    ? 'border-emerald-400/40 text-emerald-300 bg-emerald-500/10'
                                    : 'border-white/10 text-gray-400 hover:text-white hover:border-white/20'
                                }`}
                              >
                                {isRead ? 'Read' : 'Mark'}
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMarkReadUpTo(chapter);
                                }}
                                title="Mark this and previous chapters as read"
                                className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border border-primary/30 text-primary/80 hover:text-primary hover:border-primary/60 transition-colors"
                              >
                                Up to
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (isDownloaded) {
                                    handleOpenDownload(chapter.number);
                                    return;
                                  }
                                  if (!isQueued) {
                                    void handleDownloadChapter(chapter);
                                  }
                                }}
                                title={isDownloaded ? 'Open downloaded file' : 'Download for offline reading'}
                                className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border transition-colors ${
                                  isDownloaded
                                    ? 'border-primary/60 text-primary bg-primary/10'
                                    : isQueued
                                      ? 'border-white/10 text-gray-500 bg-white/5'
                                      : 'border-white/10 text-gray-400 hover:text-white hover:border-white/20'
                                }`}
                              >
                                {isDownloaded ? 'Open' : isQueued ? 'Queued' : 'Download'}
                              </button>
                              <ChevronLeft className="w-5 h-5 text-gray-600 group-hover:text-primary rotate-180 transition-colors" />
                            </div>
                          </motion.div>
                        );
                        })}
                      </div>
                      
                      {visibleChapters < filteredChapters.length && !chapterSearchQuery && (
                        <div className="mt-10 flex justify-center">
                           <button 
                             onClick={handleLoadMore}
                             className="px-8 py-3 bg-surfaceHighlight hover:bg-white/10 border border-white/10 rounded-full text-sm font-bold transition-colors"
                           >
                             Load More Chapters
                           </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="py-16 text-center text-gray-500">
                      <p className="text-lg">No chapters found matching "{chapterSearchQuery}"</p>
                    </div>
                  )}
                </motion.div>
              )}

              {/* 3. Empty State for AniList View (Before clicking search) */}
              {!showChapters && !providerResults && !providerLoading && isAniListSource && (
                 <div className="p-12 rounded-2xl bg-surfaceHighlight/10 border border-white/5 text-center">
                    <p className="text-gray-400 text-lg font-medium">Select a provider to find chapters for this series.</p>
                 </div>
              )}
            </>
          )}

          {/* TAB: INFO */}
          {activeTab === 'Info' && isAniListSource && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-2xl border border-white/10 bg-surfaceHighlight/30 p-5 space-y-4">
                  <h3 className="text-base font-bold text-gray-300 uppercase tracking-wider">Overview</h3>
                  {rankings.length > 0 && (
                    <div className="space-y-2">
                      {rankings.map((rank) => (
                        <div key={rank.id} className="flex items-center gap-2 text-xs text-gray-300">
                          <span className="text-primary font-bold">#{rank.rank}</span>
                          <span>{rank.context || (rank.type === 'POPULAR' ? 'Most Popular All Time' : 'Highest Rated All Time')}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4 text-[14px]">
                    <div>
                      <div className="text-[11px] uppercase text-gray-500">Format</div>
                      <div className="text-white font-semibold text-[15px]">{formatDisplay}</div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase text-gray-500">Status</div>
                      <div className="text-white font-semibold text-[15px]">{statusLabel}</div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase text-gray-500">Start Date</div>
                      <div className="text-white font-semibold text-[15px]">{startDateLabel}</div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase text-gray-500">Average Score</div>
                      <div className="text-white font-semibold text-[15px]">{averageScoreLabel}</div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase text-gray-500">Mean Score</div>
                      <div className="text-white font-semibold text-[15px]">{meanScoreLabel}</div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase text-gray-500">Popularity</div>
                      <div className="text-white font-semibold text-[15px]">{popularityLabel}</div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase text-gray-500">Favorites</div>
                      <div className="text-white font-semibold text-[15px]">{favouritesLabel}</div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase text-gray-500">Source</div>
                      <div className="text-white font-semibold text-[15px]">{sourceLabel}</div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-[11px] uppercase text-gray-500">Genres</div>
                      <div className="text-white font-semibold text-[15px]">{data.genres.join(', ')}</div>
                    </div>
                  </div>
                  {data.mediaListEntry?.status && (
                    <div className="rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-xs text-gray-300 flex items-center justify-between">
                      <span>Your Status</span>
                      <span className="text-primary font-bold">
                        {STATUS_LABELS[data.mediaListEntry.status] ?? formatEnumLabel(data.mediaListEntry.status)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-white/10 bg-surfaceHighlight/30 p-5 space-y-3">
                  <h3 className="text-base font-bold text-gray-300 uppercase tracking-wider">Titles</h3>
                  <div className="space-y-3 text-[13px] text-gray-300">
                    {data.titles?.romaji && (
                      <div>
                        <span className="text-gray-500 uppercase tracking-wide text-[11px]">Romaji</span>
                        <div className="text-white font-semibold text-[15px]">{data.titles.romaji}</div>
                      </div>
                    )}
                    {data.titles?.english && (
                      <div>
                        <span className="text-gray-500 uppercase tracking-wide text-[11px]">English</span>
                        <div className="text-white font-semibold text-[15px]">{data.titles.english}</div>
                      </div>
                    )}
                    {data.titles?.native && (
                      <div>
                        <span className="text-gray-500 uppercase tracking-wide text-[11px]">Native</span>
                        <div className="text-white font-semibold text-[15px]">{data.titles.native}</div>
                      </div>
                    )}
                    {data.synonyms && data.synonyms.length > 0 && (
                      <div>
                        <span className="text-gray-500 uppercase tracking-wide text-[11px]">Synonyms</span>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {data.synonyms.map((synonym, index) => (
                            <span
                              key={`${synonym}-${index}`}
                              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/90"
                            >
                              {synonym}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {displayTags.length > 0 && (
                  <div className="rounded-2xl border border-white/10 bg-surfaceHighlight/30 p-5 space-y-3">
                    <h3 className="text-base font-bold text-gray-300 uppercase tracking-wider">Tags</h3>
                    <div className="space-y-2">
                      {displayTags.slice(0, 10).map((tag) => (
                        <div key={tag.id} className="space-y-1">
                          <div className="flex items-center justify-between text-sm text-gray-200">
                            <span>{tag.name}</span>
                            <span className="text-primary font-semibold">{tag.rank}%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-black/40 overflow-hidden">
                            <div className="h-full bg-primary" style={{ width: `${tag.rank}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="rounded-2xl border border-white/10 bg-surfaceHighlight/30 p-5 space-y-4">
                  <h3 className="text-base font-bold text-gray-300 uppercase tracking-wider">Status Distribution</h3>
                  {statusDistribution.length > 0 ? (
                    <div className="space-y-3">
                      {statusDistribution.map((item) => {
                        const pct = statusTotal > 0 ? Math.round((item.amount / statusTotal) * 100) : 0;
                        const colorMap: Record<string, string> = {
                          CURRENT: 'bg-green-500',
                          PLANNING: 'bg-blue-500',
                          COMPLETED: 'bg-purple-500',
                          PAUSED: 'bg-yellow-500',
                          DROPPED: 'bg-red-500',
                          REPEATING: 'bg-emerald-500',
                        };
                        const barColor = colorMap[item.status] ?? 'bg-gray-500';
                        return (
                          <div key={item.status} className="space-y-1">
                            <div className="flex items-center justify-between text-sm text-gray-200">
                              <span>{formatEnumLabel(item.status)}</span>
                              <span>{formatNumber(item.amount)}</span>
                            </div>
                            <div className="h-2 rounded-full bg-black/40 overflow-hidden">
                              <div className={`h-full ${barColor}`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">No status data available.</div>
                  )}
                </div>

                <div className="rounded-2xl border border-white/10 bg-surfaceHighlight/30 p-5 space-y-4 lg:col-span-2">
                  <h3 className="text-base font-bold text-gray-300 uppercase tracking-wider">Score Distribution</h3>
                  {scoreDistribution.length > 0 ? (
                    <div className="flex items-end gap-2 h-36">
                      {scoreDistribution.map((item) => {
                        const height = scoreMax > 0 ? Math.max(8, (item.amount / scoreMax) * 100) : 0;
                        const hue = Math.round((item.score / 100) * 120);
                        return (
                          <div key={item.score} className="flex flex-col items-center gap-1 flex-1">
                            <div
                              className="w-full rounded-full"
                              style={{
                                height: `${height}%`,
                                backgroundColor: `hsl(${hue}, 70%, 50%)`,
                              }}
                            />
                            <span className="text-[11px] text-gray-400">{item.score}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">No score data available.</div>
                  )}
                </div>

                {topCharacters.length > 0 && (
                  <div className="rounded-2xl border border-white/10 bg-surfaceHighlight/30 p-6 space-y-4 lg:col-span-2">
                    <h3 className="text-base font-bold text-gray-300 uppercase tracking-wider">Characters</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {topCharacters.map((character) => (
                        <div key={character.id} className="flex items-center gap-4 rounded-2xl bg-black/40 border border-white/10 p-4 min-h-[96px]">
                          {character.image ? (
                            <img
                              src={character.image}
                              alt={character.name}
                              className="w-14 h-20 object-cover rounded-xl"
                            />
                          ) : (
                            <div className="w-14 h-20 rounded-xl bg-white/5 flex items-center justify-center text-[10px] text-gray-500">
                              NO IMAGE
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="text-[16px] font-semibold text-white leading-snug break-words">
                              {character.name}
                            </div>
                            {character.role && <div className="text-[13px] text-gray-400">{formatEnumLabel(character.role)}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {topStaff.length > 0 && (
                  <div className="rounded-2xl border border-white/10 bg-surfaceHighlight/30 p-6 space-y-4 lg:col-span-2">
                    <h3 className="text-base font-bold text-gray-300 uppercase tracking-wider">Staff</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {topStaff.map((member) => (
                        <div key={member.id} className="flex items-center gap-4 rounded-2xl bg-black/40 border border-white/10 p-4 min-h-[96px]">
                          {member.image ? (
                            <img
                              src={member.image}
                              alt={member.name}
                              className="w-14 h-20 object-cover rounded-xl"
                            />
                          ) : (
                            <div className="w-14 h-20 rounded-xl bg-white/5 flex items-center justify-center text-[10px] text-gray-500">
                              NO IMAGE
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="text-[16px] font-semibold text-white leading-snug break-words">
                              {member.name}
                            </div>
                            {member.role && <div className="text-[13px] text-gray-400">{member.role}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* TAB: RECOMMENDATIONS */}
          {activeTab === 'Recommendations' && hasRecommendations && (
            <div className="animate-fade-in grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
              {data.recommendations!.map((item, index) => (
                 <SeriesCard 
                   key={item.id} 
                   series={item} 
                   index={index}
                   onClick={() => onNavigate('details', item.id)} 
                 />
              ))}
            </div>
          )}

        </div>
      </div>

      {reconcileContext && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={closeReconcile} />

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="relative w-full max-w-lg bg-[#151515] rounded-xl shadow-2xl border border-white/10 overflow-hidden"
          >
            <div className="p-6 border-b border-white/10">
              <h3 className="text-xl font-bold text-white">
                {reconcileContext.swapType === 'anilist' ? 'Change AniList Link' : 'Change Provider'}
              </h3>
              <p className="text-sm text-gray-400 mt-1">
                Choose how progress should be reconciled after this mapping change.
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border border-white/10 bg-black/30 p-4">
                  <div className="text-xs text-gray-500 font-semibold uppercase">Provider</div>
                  <div className="text-lg font-bold text-white mt-1">
                    {reconcileContext.localProgress && reconcileContext.localProgress > 0
                      ? `Ch ${reconcileContext.localProgress}`
                      : '—'}
                  </div>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/30 p-4">
                  <div className="text-xs text-gray-500 font-semibold uppercase">AniList</div>
                  <div className="text-lg font-bold text-white mt-1">
                    {reconcileContext.remoteProgress && reconcileContext.remoteProgress > 0
                      ? `Ch ${reconcileContext.remoteProgress}`
                      : '—'}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {([
                  { id: 'higher', label: 'Use higher progress (recommended)' },
                  { id: 'provider', label: 'Keep provider progress and sync AniList' },
                  { id: 'anilist', label: 'Use AniList progress and update local history' },
                  { id: 'none', label: 'Don’t sync now' },
                ] as Array<{ id: ReconcileChoice; label: string }>).map((option) => (
                  <button
                    key={option.id}
                    onClick={() => setReconcileChoice(option.id)}
                    className={`w-full text-left px-4 py-3 rounded-lg border transition-colors text-sm font-semibold ${
                      reconcileChoice === option.id
                        ? 'border-primary bg-primary/10 text-white'
                        : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-5 border-t border-white/10 flex items-center justify-end gap-3">
              <button
                onClick={closeReconcile}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-300 hover:text-white hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={() => applyReconcile()}
                disabled={reconcileLoading}
                className="px-5 py-2 rounded-lg text-sm font-bold bg-primary text-onPrimary hover:bg-primaryHover disabled:opacity-60"
              >
                {reconcileLoading ? 'Updating...' : 'Apply Mapping'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Details;
