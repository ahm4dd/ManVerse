import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Series } from '../types';
import { api } from '../lib/api';
import { anilistApi, SearchFilters as ISearchFilters } from '../lib/anilist';
import { history } from '../lib/history';
import SeriesCard from '../components/SeriesCard';
import HeroCarousel from '../components/HeroCarousel';
import LoginBanner from '../components/LoginBanner';
import HistoryCard from '../components/HistoryCard';
import SidebarList from '../components/SidebarList';
import { FilterState } from '../components/SearchFilters';
import { motion } from 'framer-motion';
import { SortIcon } from '../components/Icons';
import {
  Providers,
  type ProviderType,
  type Source,
  isProviderSource,
  allProviderOptions,
  providerBaseUrl,
  providerShortLabel,
} from '../lib/providers';
import { useMediaQuery } from '../lib/useMediaQuery';

interface HomeProps {
  onNavigate: (view: string, data?: any) => void;
  user?: any;
  // Global Search Props
  globalSearchQuery: string;
  globalFilters: FilterState;
  globalSearchSource: Source;
  toggleFilters: () => void;
}

interface ContinueItem {
  id: string; // Series ID
  anilistId?: string;
  providerSeriesId?: string;
  title: string;
  image: string;
  chapterNumber: string | number;
  chapterId?: string; // If available (Local History)
  timestamp: number;
  source: Source;
  progressSource: 'AniList' | 'Local';
}

type ProviderSearchStatus = 'pending' | 'success' | 'failed';

const Home: React.FC<HomeProps> = ({ 
  onNavigate, 
  user,
  globalSearchQuery,
  globalFilters,
  globalSearchSource,
  toggleFilters
}) => {
  // Data States
  const [trending, setTrending] = useState<Series[]>([]); // Newest
  const [popular, setPopular] = useState<Series[]>([]);   // Popular
  const [topRated, setTopRated] = useState<Series[]>([]); // Top Rated
  const [searchResults, setSearchResults] = useState<Series[]>([]); // Search Results
  
  const [continueReading, setContinueReading] = useState<ContinueItem[]>([]);
  const [recentReads, setRecentReads] = useState<ContinueItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // View/Filter States for default view
  const [activeTab, setActiveTab] = useState<'Newest' | 'Popular' | 'Top Rated'>('Newest');
  const [tabPages, setTabPages] = useState({ Newest: 1, Popular: 1, TopRated: 1 });
  const [tabHasMore, setTabHasMore] = useState({ Newest: true, Popular: true, TopRated: true });
  const [tabLoadingMore, setTabLoadingMore] = useState({ Newest: false, Popular: false, TopRated: false });
  const [searchPage, setSearchPage] = useState(1);
  const [searchHasMore, setSearchHasMore] = useState(true);
  const [searchLoadingMore, setSearchLoadingMore] = useState(false);
  const [searchPendingProviders, setSearchPendingProviders] = useState(0);
  const [searchProviderStatuses, setSearchProviderStatuses] = useState<
    Record<ProviderType, ProviderSearchStatus>
  >({});
  const [homeHydrated, setHomeHydrated] = useState(false);
  const [pageInput, setPageInput] = useState('1');
  const searchPageCacheRef = useRef<Record<string, Record<number, Series[]>>>({});
  const tabPageCacheRef = useRef<Record<string, Record<number, Series[]>>>({
    Newest: {},
    Popular: {},
    TopRated: {},
  });

  // Drag Constraints for History
  const continueHistoryRef = useRef<HTMLDivElement>(null);
  const recentHistoryRef = useRef<HTMLDivElement>(null);
  const [continueHistoryWidth, setContinueHistoryWidth] = useState(0);
  const [recentHistoryWidth, setRecentHistoryWidth] = useState(0);
  const [suppressContinueClick, setSuppressContinueClick] = useState(false);
  const [suppressRecentClick, setSuppressRecentClick] = useState(false);
  const continueClickTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recentClickTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefetchCacheRef = useRef<Record<string, number>>({});
  const searchAllProvidersTokenRef = useRef(0);

  const PREFETCH_CACHE_KEY = 'manverse_smart_prefetch_v1';
  const PREFETCH_TTL_MS = 12 * 60 * 60 * 1000;
  const ACTIVE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
  const HOME_STATE_KEY = 'manverse_home_state_v2';
  const scrollYRef = useRef(0);
  const restoredSearchKeyRef = useRef<string | null>(null);
  const isPhoneLayout = useMediaQuery('(max-width: 768px)');

  const parseChapterNumber = (value?: string | number) => {
    if (value === undefined || value === null) return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const cleaned = value.replace(/[^0-9.]/g, '');
    if (!cleaned) return null;
    const parsed = Number.parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  };

  // Check if filters are active (dirty)
  const isFiltersDirty = 
    globalFilters.format !== 'All' || 
    globalFilters.status !== 'All' || 
    globalFilters.genre !== 'All' || 
    globalFilters.country !== 'All' || 
    globalFilters.sort !== 'Popularity';

  // Discovery Mode enabled if there is a search query OR GLOBAL filters are applied
  const isDiscoveryMode = globalSearchQuery.length > 0 || isFiltersDirty;
  const searchContextKey = useMemo(() => {
    return JSON.stringify({
      q: globalSearchQuery.trim(),
      f: globalFilters,
      s: globalSearchSource,
    });
  }, [globalSearchQuery, globalFilters, globalSearchSource]);
  const providerStatusList = useMemo(() => {
    return allProviderOptions
      .map((provider) => provider.id)
      .filter((providerId) => providerBaseUrl(providerId))
      .map((providerId) => ({
        id: providerId,
        label: providerShortLabel(providerId),
        status: searchProviderStatuses[providerId] ?? 'pending',
      }));
  }, [searchProviderStatuses]);
  const providerStatusValues = Object.values(searchProviderStatuses);
  const providerSearchAllDone =
    providerStatusValues.length > 0 && providerStatusValues.every((status) => status !== 'pending');
  const providerSearchAllFailed =
    providerStatusValues.length > 0 && providerStatusValues.every((status) => status === 'failed');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onScroll = () => {
      scrollYRef.current = window.scrollY;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;

    const hydrate = async () => {
      const raw = sessionStorage.getItem(HOME_STATE_KEY);
      if (!raw) {
        if (!isDiscoveryMode) {
          await loadDefaultData();
        }
        if (!cancelled) setHomeHydrated(true);
        return;
      }

      try {
        const saved = JSON.parse(raw);
        const canRestoreSearch =
          saved.searchContextKey === searchContextKey && Array.isArray(saved.searchResults);
        const canRestoreDefault =
          !isDiscoveryMode &&
          (Array.isArray(saved.trending) ||
            Array.isArray(saved.popular) ||
            Array.isArray(saved.topRated));
        if (saved?.activeTab) {
          setActiveTab(saved.activeTab);
        }
        if (Array.isArray(saved.trending)) setTrending(saved.trending);
        if (Array.isArray(saved.popular)) setPopular(saved.popular);
        if (Array.isArray(saved.topRated)) setTopRated(saved.topRated);
        if (saved.tabPages) setTabPages(saved.tabPages);
        if (saved.tabHasMore) setTabHasMore(saved.tabHasMore);
        if (saved.tabPageCache) {
          tabPageCacheRef.current = saved.tabPageCache;
        }

        if (canRestoreSearch) {
          setSearchResults(saved.searchResults);
          setSearchPage(saved.searchPage || 1);
          setSearchHasMore(saved.searchHasMore ?? true);
          if (saved.searchPageCache) {
            searchPageCacheRef.current = saved.searchPageCache;
          }
          restoredSearchKeyRef.current = searchContextKey;
        }

        const targetScroll = isDiscoveryMode
          ? saved.searchScrollY ?? saved.scrollY
          : saved.scrollY;
        if (typeof targetScroll === 'number') {
          requestAnimationFrame(() => window.scrollTo(0, targetScroll));
        }

        if (!isDiscoveryMode && (!saved.trending || saved.trending.length === 0)) {
          await loadDefaultData();
        }

        if (canRestoreSearch || canRestoreDefault) {
          setLoading(false);
        }
      } catch {
        if (!isDiscoveryMode) {
          await loadDefaultData();
        }
      } finally {
        if (!cancelled) setHomeHydrated(true);
      }
    };

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    loadContinueReading();
  }, [user]);

  const persistHomeState = () => {
    if (typeof window === 'undefined' || !homeHydrated) return;
    const payload = {
      activeTab,
      trending,
      popular,
      topRated,
      tabPages,
      tabHasMore,
      tabPageCache: tabPageCacheRef.current,
      searchResults,
      searchPage,
      searchHasMore,
      searchPageCache: searchPageCacheRef.current,
      searchContextKey,
      scrollY: scrollYRef.current,
      searchScrollY: isDiscoveryMode ? scrollYRef.current : undefined,
    };
    try {
      sessionStorage.setItem(HOME_STATE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage issues
    }
  };

  useEffect(() => {
    if (!homeHydrated) return;
    persistHomeState();
    return () => {
      persistHomeState();
    };
  }, [
    activeTab,
    trending,
    popular,
    topRated,
    tabPages,
    tabHasMore,
    searchResults,
    searchPage,
    searchHasMore,
    searchContextKey,
    isDiscoveryMode,
    homeHydrated,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = sessionStorage.getItem(PREFETCH_CACHE_KEY);
      prefetchCacheRef.current = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    } catch {
      prefetchCacheRef.current = {};
    }
  }, []);

  useEffect(() => {
    if (continueReading.length === 0 || isDiscoveryMode) return;

    const now = Date.now();
    const freshItems = continueReading.filter((item) => now - item.timestamp <= ACTIVE_WINDOW_MS);
    const sorted = freshItems.sort((a, b) => b.timestamp - a.timestamp).slice(0, 2);

    const shouldPrefetch = (key: string) => {
      const last = prefetchCacheRef.current[key] ?? 0;
      return now - last > PREFETCH_TTL_MS;
    };

    const markPrefetched = (key: string) => {
      prefetchCacheRef.current[key] = Date.now();
      try {
        sessionStorage.setItem(PREFETCH_CACHE_KEY, JSON.stringify(prefetchCacheRef.current));
      } catch {
        // Ignore storage issues
      }
    };

    const warmCache = async () => {
      for (const item of sorted) {
        const provider = isProviderSource(item.source) ? item.source : Providers.AsuraScans;
        const key = item.anilistId
          ? `anilist:${item.anilistId}`
          : `provider:${provider}:${item.providerSeriesId || item.id}`;
        if (!shouldPrefetch(key)) continue;

        try {
          if (item.providerSeriesId) {
            await api.getSeriesDetails(item.providerSeriesId, provider);
          } else if (item.anilistId) {
            await api.getMappedProviderDetails(item.anilistId, provider);
          } else if (isProviderSource(item.source)) {
            await api.getSeriesDetails(item.id, provider);
          }
          markPrefetched(key);
        } catch (error) {
          console.warn('Prefetch warmup failed', error);
        }
      }
    };

    void warmCache();
  }, [continueReading, isDiscoveryMode]);

  // Update drag constraints when history changes
  useEffect(() => {
     if (continueHistoryRef.current) {
        setContinueHistoryWidth(continueHistoryRef.current.scrollWidth - continueHistoryRef.current.offsetWidth);
     }
  }, [continueReading]);

  useEffect(() => {
     if (recentHistoryRef.current) {
        setRecentHistoryWidth(recentHistoryRef.current.scrollWidth - recentHistoryRef.current.offsetWidth);
     }
  }, [recentReads]);

  useEffect(() => {
    return () => {
      if (continueClickTimeout.current) clearTimeout(continueClickTimeout.current);
      if (recentClickTimeout.current) clearTimeout(recentClickTimeout.current);
    };
  }, []);

  const handleContinueDragStart = () => {
    if (continueClickTimeout.current) clearTimeout(continueClickTimeout.current);
    setSuppressContinueClick(true);
  };

  const handleContinueDragEnd = () => {
    if (continueClickTimeout.current) clearTimeout(continueClickTimeout.current);
    continueClickTimeout.current = setTimeout(() => setSuppressContinueClick(false), 180);
  };

  const handleRecentDragStart = () => {
    if (recentClickTimeout.current) clearTimeout(recentClickTimeout.current);
    setSuppressRecentClick(true);
  };

  const handleRecentDragEnd = () => {
    if (recentClickTimeout.current) clearTimeout(recentClickTimeout.current);
    recentClickTimeout.current = setTimeout(() => setSuppressRecentClick(false), 180);
  };

  // Trigger global search when global props change (Debounced)
  useEffect(() => {
     if (!homeHydrated) return;
     if (!isDiscoveryMode) {
        setSearchResults([]); 
        setSearchPage(1);
        setSearchHasMore(true);
        setSearchLoadingMore(false);
        // If we exited discovery mode (cleared search/filters), ensure default data is there if missing
        if (trending.length === 0 && !loading) loadDefaultData();
        return;
     }

     if (restoredSearchKeyRef.current === searchContextKey) {
        restoredSearchKeyRef.current = null;
        return;
     }

     const timer = setTimeout(() => {
        setSearchPage(1);
        setSearchHasMore(true);
        handleGlobalSearch(1, false);
     }, 600);

     return () => clearTimeout(timer);
  }, [searchContextKey, isDiscoveryMode, homeHydrated]);

  const loadDefaultData = async () => {
    setLoading(true);
    try {
      const [trendingData, popularData, topRatedData] = await Promise.all([
         anilistApi.getTrending(1),
         anilistApi.getPopular(1),
         anilistApi.getTopRated(1)
      ]);
      
      setTrending(trendingData);
      setPopular(popularData);
      setTopRated(topRatedData);
      tabPageCacheRef.current = {
        Newest: { 1: trendingData },
        Popular: { 1: popularData },
        TopRated: { 1: topRatedData },
      };
      setTabPages({ Newest: 1, Popular: 1, TopRated: 1 });
      setTabHasMore({
        Newest: trendingData.length > 0,
        Popular: popularData.length > 0,
        TopRated: topRatedData.length > 0,
      });
    } catch (e) {
      console.warn("Failed to load default data", e);
    } finally {
      setLoading(false);
    }
  };

  const loadContinueReading = async () => {
    let items: ContinueItem[] = [];
    let localOnly: ContinueItem[] = [];

    // 1. Get Local History
    const localHistory = history.get();
    const localMap = new Map<string, typeof localHistory[0]>();
    localHistory.forEach(item => {
      localMap.set(item.seriesId, item);
      if (item.anilistId) localMap.set(item.anilistId, item);
      if (item.providerSeriesId) localMap.set(item.providerSeriesId, item);
      localMap.set(item.seriesTitle.toLowerCase(), item);
    });

    // 2. Get AniList Data if logged in
    if (user) {
      try {
        const aniListEntries = await anilistApi.getUserReadingList(user.id);
        items = aniListEntries.map(entry => {
          const title = entry.media.title.english || entry.media.title.romaji;
          const aniListId = entry.media.id.toString();
          
          const localMatch = localMap.get(aniListId) || localMap.get(title.toLowerCase());
          
          let chapterNum = entry.progress;
          let chapterId = undefined;
          let progressSource: 'AniList' | 'Local' = 'AniList';
          let timestamp = entry.updatedAt * 1000;
          let providerSeriesId = undefined;
          let source: Source = 'AniList';

          if (localMatch) {
             const localNum = parseFloat(localMatch.chapterNumber.replace(/[^0-9.]/g, ''));
             if (!isNaN(localNum) && localNum >= entry.progress) {
                 chapterNum = localMatch.chapterNumber;
                 chapterId = localMatch.chapterId;
                 progressSource = 'Local';
                 timestamp = localMatch.timestamp;
             }
             providerSeriesId =
               localMatch.providerSeriesId || (!/^\d+$/.test(localMatch.seriesId) ? localMatch.seriesId : undefined);
             source = localMatch.source;
          }

          return {
            id: aniListId,
            anilistId: aniListId,
            providerSeriesId,
            title: title,
            image: entry.media.bannerImage || entry.media.coverImage.extraLarge || entry.media.coverImage.large,
            chapterNumber: chapterNum,
            chapterId: chapterId,
            timestamp: timestamp,
            source,
            progressSource
          };
        });
      } catch (e) {
        console.error("Failed to load AniList reading list", e);
      }
    }

    // 3. Add any Local History items that were NOT matched in AniList
    const processedIds = new Set(items.map(i => i.anilistId || i.id));
    const processedTitles = new Set(items.map(i => i.title.toLowerCase()));

    localHistory.forEach(local => {
       const key = local.anilistId || local.seriesId;
       if (processedIds.has(key) || processedTitles.has(local.seriesTitle.toLowerCase())) return;
       const providerSeriesId =
         local.providerSeriesId || (!/^\d+$/.test(local.seriesId) ? local.seriesId : undefined);
       localOnly.push({
         id: key,
         anilistId: local.anilistId,
         providerSeriesId,
         title: local.seriesTitle,
         image: local.seriesImage,
         chapterNumber: local.chapterNumber,
         chapterId: local.chapterId,
         timestamp: local.timestamp,
         source: local.source,
         progressSource: 'Local'
       });
    });

    items.sort((a, b) => b.timestamp - a.timestamp);
    setContinueReading(items);
    localOnly.sort((a, b) => b.timestamp - a.timestamp);
    setRecentReads(localOnly);
  };

  const searchAllProviders = async (query: string, page = 1) => {
    if (page !== 1) {
      setSearchHasMore(false);
      setSearchLoadingMore(false);
      return;
    }
    const trimmed = query.trim();
    if (!trimmed) {
      setSearchResults([]);
      setSearchHasMore(false);
      setSearchLoadingMore(false);
      setSearchProviderStatuses({});
      return;
    }

    const providers = allProviderOptions
      .map((provider) => provider.id)
      .filter((providerId) => providerBaseUrl(providerId));
    const totalProviders = providers.length;
    const token = ++searchAllProvidersTokenRef.current;
    const initialStatuses = providers.reduce(
      (acc, providerId) => {
        acc[providerId] = 'pending';
        return acc;
      },
      {} as Record<ProviderType, ProviderSearchStatus>,
    );

    setSearchPendingProviders(totalProviders);
    setSearchResults([]);
    setSearchHasMore(false);
    setSearchLoadingMore(false);
    setSearchProviderStatuses(initialStatuses);
    if (totalProviders === 0) {
      setLoading(false);
      setSearchProviderStatuses({});
      return;
    }

    const merged = new Map<string, Series>();

    await Promise.allSettled(
      providers.map(async (providerId) => {
        try {
          const meta = await api.searchProviderSeriesMeta(trimmed, providerId, 1);
          if (searchAllProvidersTokenRef.current !== token) return;
          meta.results.forEach((series) => {
            merged.set(`${providerId}:${series.id}`, series);
          });
          setSearchResults(Array.from(merged.values()));
          setSearchProviderStatuses((prev) => ({
            ...prev,
            [providerId]: 'success',
          }));
        } catch {
          // Ignore provider failures for aggregated search.
          if (searchAllProvidersTokenRef.current !== token) return;
          setSearchProviderStatuses((prev) => ({
            ...prev,
            [providerId]: 'failed',
          }));
        } finally {
          if (searchAllProvidersTokenRef.current !== token) return;
          setSearchPendingProviders((prev) => {
            const next = Math.max(prev - 1, 0);
            if (next < totalProviders) {
              setLoading(false);
            }
            if (next === 0) {
              setLoading(false);
            }
            return next;
          });
        }
      }),
    );

    if (searchAllProvidersTokenRef.current === token) {
      setSearchPendingProviders(0);
      if (merged.size === 0) {
        setSearchResults([]);
      }
    }
  };

  const handleGlobalSearch = async (page = 1, append = false) => {
    const isProviderSearch = globalSearchSource === 'AllProviders' || isProviderSource(globalSearchSource);
    if (isProviderSearch && !globalSearchQuery.trim()) {
      setSearchResults([]);
      setSearchHasMore(false);
      return;
    }
    if (!append) setLoading(true);
    try {
      // Map UI Sort to API Sort
      let apiSort = 'POPULARITY_DESC';
      if (globalFilters.sort === 'Score') apiSort = 'SCORE_DESC';
      if (globalFilters.sort === 'Last Updated') apiSort = 'UPDATED_AT_DESC';
      if (globalFilters.sort === 'Title') apiSort = 'TITLE_ROMAJI';
      if (globalFilters.sort === 'Trending') apiSort = 'TRENDING_DESC';

      const apiFilters: ISearchFilters = {
         ...globalFilters,
         sort: apiSort
      };

      const sortProviderResults = (items: Series[]) => {
        const parseChapter = (value?: string) => {
          if (!value) return 0;
          const match = value.match(/(\d+(?:\.\d+)?)/);
          return match ? Number.parseFloat(match[1]) : 0;
        };
        if (globalFilters.sort === 'Chapters (High)') {
          return [...items].sort((a, b) => parseChapter(b.latestChapter) - parseChapter(a.latestChapter));
        }
        if (globalFilters.sort === 'Chapters (Low)') {
          return [...items].sort((a, b) => parseChapter(a.latestChapter) - parseChapter(b.latestChapter));
        }
        if (globalFilters.sort === 'Title') {
          return [...items].sort((a, b) => a.title.localeCompare(b.title));
        }
        return items;
      };

      let results: Series[] = [];
      if (globalSearchSource === 'AllProviders') {
        await searchAllProviders(globalSearchQuery.trim(), page);
        return;
      }
      if (isProviderSource(globalSearchSource)) {
        const meta = await api.searchProviderSeriesMeta(globalSearchQuery, globalSearchSource, page);
        results = sortProviderResults(meta.results);
        setSearchResults(results);
        setSearchHasMore(meta.hasNextPage);
      } else {
        results = await api.searchSeries(globalSearchQuery, globalSearchSource, apiFilters, page);
        setSearchResults(results);
        setSearchHasMore(results.length > 0);
      }
      if (!searchPageCacheRef.current[searchContextKey]) {
        searchPageCacheRef.current[searchContextKey] = {};
      }
      searchPageCacheRef.current[searchContextKey][page] = results;
    } finally {
      if (!append) setLoading(false);
      setSearchLoadingMore(false);
    }
  };

  useEffect(() => {
    if (globalSearchSource !== 'AniList') return;
    const query = globalSearchQuery.trim();
    if (!query || searchResults.length === 0) return;
    const key = `search:${query.toLowerCase()}`;
    const now = Date.now();
    const last = prefetchCacheRef.current[key] ?? 0;
    if (now - last <= PREFETCH_TTL_MS) return;

    prefetchCacheRef.current[key] = now;
    try {
      sessionStorage.setItem(PREFETCH_CACHE_KEY, JSON.stringify(prefetchCacheRef.current));
    } catch {
      // Ignore storage issues
    }

    const topTitles = searchResults.slice(0, 3).map((item) => item.title).filter(Boolean);
    const terms = Array.from(new Set([query, ...topTitles])).slice(0, 4);
    const providers = allProviderOptions
      .map((provider) => provider.id)
      .filter((providerId) => providerBaseUrl(providerId));

    providers.forEach((providerId) => {
      api.prefetchProviderSearch(terms, providerId);
    });
  }, [globalSearchSource, globalSearchQuery, searchResults]);

  const handleContinueClick = async (item: ContinueItem) => {
    const anilistId = item.anilistId || (item.source === 'AniList' ? item.id : undefined);

    try {
      let providerDetails = null;
      const provider = isProviderSource(item.source) ? item.source : Providers.AsuraScans;
      if (item.providerSeriesId) {
        providerDetails = await api.getSeriesDetails(item.providerSeriesId, provider);
      } else if (!anilistId && isProviderSource(item.source)) {
        providerDetails = await api.getSeriesDetails(item.id, provider);
      } else if (anilistId) {
        providerDetails = await api.getMappedProviderDetails(anilistId, provider);
      }

      if (!providerDetails) {
        onNavigate('details', anilistId || { id: item.id, source: item.source });
        return;
      }

      let chapterId = item.chapterId;
      const targetChapterNum = parseChapterNumber(item.chapterNumber);
      let resolvedChapterNum = item.chapterNumber;

      if (!chapterId && targetChapterNum !== null) {
        const matched = providerDetails.chapters.find((chapter) => {
          const chapterNum = parseChapterNumber(chapter.number);
          if (chapterNum === null) return false;
          return Math.abs(chapterNum - targetChapterNum) < 0.01;
        });
        if (matched) {
          chapterId = matched.id;
          resolvedChapterNum = matched.number;
        }
      }

      if (!chapterId) {
        onNavigate('details', anilistId || { id: item.id, source: item.source });
        return;
      }

      const chapterNum = parseChapterNumber(resolvedChapterNum);
      onNavigate('reader', {
        chapterId,
        seriesId: anilistId || item.id,
        anilistId: anilistId,
        providerSeriesId: providerDetails.id,
        providerMangaId: providerDetails.providerMangaId,
        chapterNumber: chapterNum ?? undefined,
        chapters: providerDetails.chapters,
        seriesTitle: item.title,
        seriesImage: item.image,
        source: providerDetails.source || item.source,
        seriesStatus: providerDetails.status,
      });
    } catch (e) {
      console.warn('Failed to resume reading, falling back to details', e);
      onNavigate('details', anilistId || { id: item.id, source: item.source });
    }
  };

  const handleInfoClick = (item?: ContinueItem) => {
    if (!item) return;
    const anilistId = item.anilistId || (item.source === 'AniList' ? item.id : undefined);
    const detailsPayload = isProviderSource(item.source)
      ? { id: item.id, source: item.source }
      : anilistId || item.id;
    onNavigate('details', detailsPayload);
  };

  const loadTabPage = async (tab: 'Newest' | 'Popular' | 'Top Rated', page: number) => {
    const tabKey = tab === 'Top Rated' ? 'TopRated' : tab;
    const cached = tabPageCacheRef.current[tabKey]?.[page];
    if (cached) {
      if (tab === 'Newest') setTrending(cached);
      if (tab === 'Popular') setPopular(cached);
      if (tab === 'Top Rated') setTopRated(cached);
      setTabPages((prev) => ({ ...prev, [tabKey]: page }));
      setTabHasMore((prev) => ({ ...prev, [tabKey]: cached.length > 0 }));
      return;
    }

    setTabLoadingMore((prev) => ({ ...prev, [tabKey]: true }));
    try {
      let data: Series[] = [];
      if (tab === 'Newest') {
        data = await anilistApi.getTrending(page);
        setTrending(data);
      } else if (tab === 'Popular') {
        data = await anilistApi.getPopular(page);
        setPopular(data);
      } else {
        data = await anilistApi.getTopRated(page);
        setTopRated(data);
      }
      if (!tabPageCacheRef.current[tabKey]) {
        tabPageCacheRef.current[tabKey] = {};
      }
      tabPageCacheRef.current[tabKey][page] = data;
      setTabPages((prev) => ({ ...prev, [tabKey]: page }));
      setTabHasMore((prev) => ({ ...prev, [tabKey]: data.length > 0 }));
    } finally {
      setTabLoadingMore((prev) => ({ ...prev, [tabKey]: false }));
    }
  };

  const handleSearchPageChange = async (page: number) => {
    if (page < 1) return;
    if (searchLoadingMore) return;
    if (globalSearchSource === 'AllProviders') {
      setSearchHasMore(false);
      return;
    }
    const cache = searchPageCacheRef.current[searchContextKey]?.[page];
    setSearchPage(page);
    if (cache) {
      if (isProviderSource(globalSearchSource)) {
        const parseChapter = (value?: string) => {
          if (!value) return 0;
          const match = value.match(/(\d+(?:\.\d+)?)/);
          return match ? Number.parseFloat(match[1]) : 0;
        };
        let nextResults = cache;
        if (globalFilters.sort === 'Chapters (High)') {
          nextResults = [...cache].sort((a, b) => parseChapter(b.latestChapter) - parseChapter(a.latestChapter));
        } else if (globalFilters.sort === 'Chapters (Low)') {
          nextResults = [...cache].sort((a, b) => parseChapter(a.latestChapter) - parseChapter(b.latestChapter));
        } else if (globalFilters.sort === 'Title') {
          nextResults = [...cache].sort((a, b) => a.title.localeCompare(b.title));
        }
        setSearchResults(nextResults);
      } else {
        setSearchResults(cache);
      }
      if (isProviderSource(globalSearchSource)) {
        const meta = api.peekProviderSearchCache(globalSearchQuery, globalSearchSource, page);
        setSearchHasMore(meta?.hasNextPage ?? cache.length > 0);
      } else {
        setSearchHasMore(cache.length > 0);
      }
      return;
    }
    setSearchLoadingMore(true);
    await handleGlobalSearch(page, false);
  };

  const handleTabPageChange = async (page: number) => {
    if (page < 1) return;
    const tabKey = activeTab === 'Top Rated' ? 'TopRated' : activeTab;
    if (tabLoadingMore[tabKey]) return;
    await loadTabPage(activeTab, page);
  };

  // Determine which list to show based on search or tab
  const getBaseSeriesList = () => {
    if (isDiscoveryMode) return searchResults;
    switch (activeTab) {
      case 'Popular': return popular;
      case 'Top Rated': return topRated;
      case 'Newest': default: return trending;
    }
  };

  const baseList = getBaseSeriesList();
  const activeTabKey = activeTab === 'Top Rated' ? 'TopRated' : activeTab;
  const canLoadMore = isDiscoveryMode ? searchHasMore : tabHasMore[activeTabKey];
  const isLoadingMore = isDiscoveryMode ? searchLoadingMore : tabLoadingMore[activeTabKey];
  const currentPage = isDiscoveryMode ? searchPage : tabPages[activeTabKey];
  const canGoPrev = currentPage > 1;
  const canGoFirst = currentPage > 1;

  useEffect(() => {
    if (!homeHydrated) return;
    if (isDiscoveryMode) return;
    const page = tabPages[activeTabKey] || 1;
    void loadTabPage(activeTab, page);
  }, [activeTab, homeHydrated]);

  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  const handleJumpToPage = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const target = Number(trimmed);
    if (!Number.isFinite(target) || target < 1) return;
    if (target === currentPage) return;
    if (isDiscoveryMode) {
      await handleSearchPageChange(target);
    } else {
      await handleTabPageChange(target);
    }
  };

  return (
    <div className="min-h-[100dvh] min-h-app pb-20 px-4 sm:px-6 lg:px-8 max-w-[1800px] mx-auto pt-4 sm:pt-6">
      
      {/* 1. Hero Carousel (Only on default view) */}
      {!isDiscoveryMode && trending.length > 0 && (
         <motion.div 
           initial={{ opacity: 0, y: -20 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ duration: 0.6, ease: "easeOut" }}
           className="mb-8"
           style={
             isPhoneLayout
               ? undefined
               : { marginTop: 'calc(var(--nav-height, 0px) * -1)' }
           }
         >
           <HeroCarousel 
              items={trending.slice(0, 5)} 
              onNavigate={(id) => onNavigate('details', id)} 
           />
         </motion.div>
      )}

      {/* 2. Main Layout Grid (Left Content + Right Sidebar) */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
         
         {/* LEFT COLUMN (Main Content) */}
         <div className="xl:col-span-3 space-y-10">

            {/* Continue Reading (AniList) */}
            {continueReading.length > 0 && !isDiscoveryMode && (
               <motion.div 
                 initial={{ opacity: 0, y: 20 }}
                 animate={{ opacity: 1, y: 0 }}
                 className="mb-8"
               >
                  <div className="mb-5 flex items-end justify-between">
                     <div>
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Your Watchlist</h3>
                        <h2 className="text-2xl font-bold text-white leading-none">Continue Reading</h2>
                     </div>
                     <div className="flex items-center gap-3">
                        <button
                          onClick={() => onNavigate('library')}
                          className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/15 px-3 py-1.5 text-xs font-semibold text-primary shadow-[0_0_12px_rgba(212,175,55,0.15)] transition hover:bg-primary/25 hover:text-white"
                        >
                          View library
                        </button>
                        <div className="text-xs text-gray-500 font-medium hidden sm:block">
                          Drag to explore
                        </div>
                     </div>
                  </div>
                  
                  <motion.div 
                    ref={continueHistoryRef} 
                    className={`-mx-4 px-4 sm:mx-0 sm:px-0 ${
                      isPhoneLayout
                        ? 'overflow-x-auto scrollbar-hide snap-x snap-mandatory'
                        : 'overflow-hidden cursor-grab active:cursor-grabbing'
                    }`}
                    style={
                      isPhoneLayout
                        ? { WebkitOverflowScrolling: 'touch' }
                        : undefined
                    }
                  >
                     <motion.div 
                       drag={isPhoneLayout ? false : "x"}
                       dragConstraints={
                         isPhoneLayout
                           ? undefined
                           : { right: 0, left: -continueHistoryWidth }
                       }
                       onDragStart={isPhoneLayout ? undefined : handleContinueDragStart}
                       onDragEnd={isPhoneLayout ? undefined : handleContinueDragEnd}
                       className="flex gap-4 sm:gap-5 w-max py-2" 
                     >
                        {continueReading.map((item) => (
                          <div
                            key={item.id}
                            className="w-[85vw] max-w-[320px] sm:w-[320px] aspect-[4/3] sm:aspect-video flex-shrink-0 snap-start"
                          >
                              <HistoryCard 
                                 item={item} 
                                 onResume={handleContinueClick}
                                 onInfo={handleInfoClick}
                                 disableClick={suppressContinueClick}
                              />
                          </div>
                        ))}
                        <div className="w-[70vw] max-w-[200px] h-[63.75vw] max-h-[240px] sm:w-[150px] sm:aspect-video sm:h-auto flex-shrink-0 snap-start">
                           <HistoryCard
                             isViewMore={true}
                             viewLabel="View Library"
                             onClick={() => onNavigate('library')}
                             disableClick={suppressContinueClick}
                           />
                        </div>
                     </motion.div>
                  </motion.div>
               </motion.div>
            )}

            {/* Local Reading History */}
            {recentReads.length > 0 && !isDiscoveryMode && (
               <motion.div 
                 initial={{ opacity: 0, y: 20 }}
                 animate={{ opacity: 1, y: 0 }}
                 className="mb-8"
               >
                  <div className="mb-5 flex items-end justify-between">
                     <div>
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Local Progress</h3>
                        <h2 className="text-2xl font-bold text-white leading-none">Recent Reads</h2>
                     </div>
                     <div className="flex items-center gap-3">
                        <button
                          onClick={() => onNavigate('recent-reads')}
                          className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/15 px-3 py-1.5 text-xs font-semibold text-primary shadow-[0_0_12px_rgba(212,175,55,0.15)] transition hover:bg-primary/25 hover:text-white"
                        >
                          View recent reads
                        </button>
                        <div className="text-xs text-gray-500 font-medium hidden sm:block">
                          Saved on this device
                        </div>
                     </div>
                  </div>
                  
                  <motion.div 
                    ref={recentHistoryRef} 
                    className={`-mx-4 px-4 sm:mx-0 sm:px-0 ${
                      isPhoneLayout
                        ? 'overflow-x-auto scrollbar-hide snap-x snap-mandatory'
                        : 'overflow-hidden cursor-grab active:cursor-grabbing'
                    }`}
                    style={
                      isPhoneLayout
                        ? { WebkitOverflowScrolling: 'touch' }
                        : undefined
                    }
                  >
                     <motion.div 
                       drag={isPhoneLayout ? false : "x"}
                       dragConstraints={
                         isPhoneLayout
                           ? undefined
                           : { right: 0, left: -recentHistoryWidth }
                       }
                       onDragStart={isPhoneLayout ? undefined : handleRecentDragStart}
                       onDragEnd={isPhoneLayout ? undefined : handleRecentDragEnd}
                       className="flex gap-4 sm:gap-5 w-max py-2" 
                     >
                        {recentReads.map((item) => (
                          <div
                            key={item.id}
                            className="w-[85vw] max-w-[320px] sm:w-[320px] aspect-[4/3] sm:aspect-video flex-shrink-0 snap-start"
                          >
                              <HistoryCard 
                                 item={item} 
                                 onResume={handleContinueClick}
                                 onInfo={handleInfoClick}
                                 disableClick={suppressRecentClick}
                              />
                          </div>
                        ))}
                        <div className="w-[70vw] max-w-[200px] h-[63.75vw] max-h-[240px] sm:w-[150px] sm:aspect-video sm:h-auto flex-shrink-0 snap-start">
                           <HistoryCard
                             isViewMore={true}
                             viewLabel="View Recent Reads"
                             onClick={() => onNavigate('recent-reads')}
                             disableClick={suppressRecentClick}
                           />
                        </div>
                     </motion.div>
                  </motion.div>
               </motion.div>
            )}

            {/* Login Banner */}
            {!user && !isDiscoveryMode && <LoginBanner />}

            {/* Content Grid */}
            <motion.div 
               layout
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               transition={{ delay: 0.2 }}
               className="space-y-6"
            >
               {/* Tab Filters (Only if NOT in discovery mode) */}
               {!isDiscoveryMode && (
                 <div className="flex flex-col gap-4 border-b border-white/5 pb-4">
                    <div className="flex items-center gap-6 overflow-x-auto scrollbar-hide">
                        {['Newest', 'Popular', 'Top Rated'].map(tab => (
                            <button 
                            key={tab}
                            onClick={() => setActiveTab(tab as any)}
                            className={`text-lg font-bold whitespace-nowrap transition-colors border-b-2 pb-1 ${
                                activeTab === tab 
                                ? 'text-white border-primary' 
                                : 'text-gray-500 border-transparent hover:text-gray-300'
                            }`}
                            >
                            {tab}
                            </button>
                        ))}
                    </div>
                 </div>
               )}

               {/* Results Title (Discovery Mode) */}
               {isDiscoveryMode && (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                       <div>
                           <h2 className="text-2xl font-bold text-white">
                              {globalSearchQuery ? `Results for "${globalSearchQuery}"` : 'Filtered Results'}
                           </h2>
                           {searchResults.length > 0 && <span className="text-sm text-gray-500">{searchResults.length} matches found</span>}
                       </div>
                       <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={toggleFilters}
                            className="flex items-center gap-2 text-xs font-bold px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/30 hover:border-primary/60 transition-colors"
                          >
                            <SortIcon className="w-3.5 h-3.5" />
                            Sort: {globalFilters.sort}
                          </button>
                          <div className="text-xs text-gray-500 font-bold px-3 py-1 bg-surfaceHighlight rounded-full border border-white/5">
                            Source: {globalSearchSource === 'AllProviders' ? 'All Providers' : globalSearchSource}
                          </div>
                          {globalSearchSource === 'AllProviders' && searchPendingProviders > 0 && (
                            <div className="text-xs text-amber-300 font-semibold px-3 py-1 bg-amber-500/10 rounded-full border border-amber-500/20">
                              Searching {searchPendingProviders} provider{searchPendingProviders === 1 ? '' : 's'}...
                            </div>
                          )}
                       </div>
                    </div>
                    {globalSearchSource === 'AllProviders' && providerStatusValues.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {providerStatusList.map((provider) => {
                          const status = provider.status;
                          const isPending = status === 'pending';
                          const isFailed = status === 'failed';
                          return (
                            <span
                              key={provider.id}
                              className={`flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold border ${
                                isFailed
                                  ? 'bg-red-500/10 text-red-300 border-red-500/30'
                                  : isPending
                                    ? 'bg-white/5 text-gray-300 border-white/10'
                                    : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                              }`}
                            >
                              {isPending ? (
                                <span className="inline-flex h-3.5 w-3.5 animate-spin rounded-full border border-white/30 border-t-transparent" />
                              ) : (
                                <span className="text-[12px] leading-none">{isFailed ? '×' : '✓'}</span>
                              )}
                              <span>{provider.label}</span>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </>
               )}

               {/* Grid */}
               {loading ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
                    {[...Array(8)].map((_, i) => (
                      <div key={i} className="animate-pulse flex flex-col gap-3">
                        <div className="aspect-[2/3] bg-surfaceHighlight rounded-xl w-full" />
                        <div className="h-4 bg-surfaceHighlight rounded w-3/4" />
                      </div>
                    ))}
                  </div>
               ) : (
                  <>
                    <motion.div 
                      layout
                      className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-5 gap-y-10"
                    >
                       {baseList.length > 0 ? (
                          baseList.map((item, index) => (
                             <SeriesCard 
                                key={item.id} 
                                series={item} 
                                index={index}
                                onClick={() =>
                                  onNavigate(
                                    'details',
                                    isProviderSource(item.source)
                                      ? { id: item.id, source: item.source }
                                      : item.id,
                                  )
                                }
                             />
                          ))
                       ) : (
                          <div className="col-span-full py-20 text-center text-gray-500 flex flex-col items-center">
                             <span className="text-4xl mb-4 opacity-50">🔍</span>
                             {globalSearchSource === 'AllProviders' && providerStatusValues.length > 0 ? (
                               <p className="text-lg font-medium">
                                 {searchPendingProviders > 0
                                   ? 'Searching providers... results will appear as they finish.'
                                   : providerSearchAllFailed
                                     ? 'All providers failed to respond. Try again or use a direct URL.'
                                     : providerSearchAllDone
                                       ? 'All providers finished. Try another title or refine the search.'
                                       : 'Waiting for providers...'}
                               </p>
                             ) : (
                               <p className="text-lg font-medium">No results found.</p>
                             )}
                             {isDiscoveryMode && (
                                <button onClick={toggleFilters} className="mt-4 text-primary hover:underline">Adjust filters</button>
                             )}
                          </div>
                       )}
                    </motion.div>
                    {baseList.length > 0 && (canGoPrev || canLoadMore) && (
                      <div className="flex flex-wrap items-center justify-center gap-4 pt-6">
                        <button
                          onClick={() =>
                            isDiscoveryMode
                              ? handleSearchPageChange(1)
                              : handleTabPageChange(1)
                          }
                          disabled={!canGoFirst || isLoadingMore}
                          className="px-4 py-2.5 rounded-xl bg-white/5 text-white font-semibold text-sm border border-white/10 hover:bg-white/10 disabled:opacity-50"
                        >
                          First
                        </button>
                        <button
                          onClick={() =>
                            isDiscoveryMode
                              ? handleSearchPageChange(currentPage - 1)
                              : handleTabPageChange(currentPage - 1)
                          }
                          disabled={!canGoPrev || isLoadingMore}
                          className="px-4 py-2.5 rounded-xl bg-white/5 text-white font-semibold text-sm border border-white/10 hover:bg-white/10 disabled:opacity-50"
                        >
                          Previous
                        </button>
                        <div className="text-sm font-semibold text-gray-400">
                          Page {currentPage}
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
                            Jump
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={pageInput}
                            onChange={(event) => setPageInput(event.target.value.replace(/[^\d]/g, ''))}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                void handleJumpToPage(pageInput);
                              }
                            }}
                            className="w-16 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm font-semibold text-white text-center focus:outline-none focus:border-primary/60"
                            placeholder="1"
                          />
                          <button
                            onClick={() => handleJumpToPage(pageInput)}
                            disabled={isLoadingMore}
                            className="px-3 py-2 rounded-lg bg-white/5 text-white text-xs font-bold border border-white/10 hover:bg-white/10 disabled:opacity-50"
                          >
                            Go
                          </button>
                        </div>
                        <button
                          onClick={() =>
                            isDiscoveryMode
                              ? handleSearchPageChange(currentPage + 1)
                              : handleTabPageChange(currentPage + 1)
                          }
                          disabled={!canLoadMore || isLoadingMore}
                          className="px-4 py-2.5 rounded-xl bg-white/5 text-white font-semibold text-sm border border-white/10 hover:bg-white/10 disabled:opacity-50"
                        >
                          {isLoadingMore ? 'Loading...' : 'Next'}
                        </button>
                      </div>
                    )}
                  </>
               )}
            </motion.div>
         </div>

         {/* RIGHT COLUMN (Sidebar) */}
         <div className="hidden xl:block col-span-1 space-y-8">
             <div className="sticky top-24 space-y-8">
                 <SidebarList 
                    title="Trending" 
                    items={trending.slice(0, 5)} 
                    onNavigate={(id) => onNavigate('details', id)}
                 />

                 <div className="p-6 rounded-2xl bg-gradient-to-br from-primary/20 to-purple-600/10 border border-primary/20 text-center space-y-3">
                    <h3 className="text-lg font-bold text-white">Love the site?</h3>
                    <p className="text-xs text-gray-400">Share ManVerse with your friends!</p>
                    <button className="w-full py-2 bg-primary hover:bg-primaryHover text-white text-xs font-bold rounded-lg shadow-lg shadow-primary/20 transition-all">
                       Share App
                    </button>
                 </div>

                 <SidebarList 
                    title="All Time Popular" 
                    items={popular.slice(0, 5)} 
                    onNavigate={(id) => onNavigate('details', id)}
                 />
             </div>
         </div>

      </div>
    </div>
  );
};

export default Home;
