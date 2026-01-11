import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Series } from '../types';
import { api, Source } from '../lib/api';
import { anilistApi, SearchFilters as ISearchFilters } from '../lib/anilist';
import { history } from '../lib/history';
import SeriesCard from '../components/SeriesCard';
import HeroCarousel from '../components/HeroCarousel';
import LoginBanner from '../components/LoginBanner';
import HistoryCard from '../components/HistoryCard';
import SidebarList from '../components/SidebarList';
import { FilterState } from '../components/SearchFilters';
import { motion } from 'framer-motion';

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
  source: 'AniList' | 'AsuraScans';
  progressSource: 'AniList' | 'Local';
}

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
  const [homeHydrated, setHomeHydrated] = useState(false);
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

  const PREFETCH_CACHE_KEY = 'manverse_smart_prefetch_v1';
  const PREFETCH_TTL_MS = 12 * 60 * 60 * 1000;
  const ACTIVE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
  const HOME_STATE_KEY = 'manverse_home_state_v2';
  const scrollYRef = useRef(0);
  const restoredSearchKeyRef = useRef<string | null>(null);

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

        if (saved.searchContextKey === searchContextKey && Array.isArray(saved.searchResults)) {
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
        const key = item.anilistId ? `anilist:${item.anilistId}` : `provider:${item.providerSeriesId || item.id}`;
        if (!shouldPrefetch(key)) continue;

        try {
          if (item.providerSeriesId) {
            await api.getSeriesDetails(item.providerSeriesId, 'AsuraScans');
          } else if (item.anilistId) {
            await api.getMappedProviderDetails(item.anilistId, 'AsuraScans');
          } else if (item.source === 'AsuraScans') {
            await api.getSeriesDetails(item.id, 'AsuraScans');
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
          let source: 'AniList' | 'AsuraScans' = 'AniList';

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
             source = localMatch.source === 'AsuraScans' ? 'AsuraScans' : 'AniList';
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

  const handleGlobalSearch = async (page = 1, append = false) => {
    if (globalSearchSource === 'AsuraScans' && !globalSearchQuery.trim()) {
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

      const data = await api.searchSeries(globalSearchQuery, globalSearchSource, apiFilters, page);
      setSearchResults(data);
      setSearchHasMore(data.length > 0);
      if (!searchPageCacheRef.current[searchContextKey]) {
        searchPageCacheRef.current[searchContextKey] = {};
      }
      searchPageCacheRef.current[searchContextKey][page] = data;
    } finally {
      if (!append) setLoading(false);
      setSearchLoadingMore(false);
    }
  };

  const handleContinueClick = async (item: ContinueItem) => {
    const anilistId = item.anilistId || (item.source === 'AniList' ? item.id : undefined);

    if (!item.chapterId) {
      onNavigate('details', anilistId || item.id);
      return;
    }

    try {
      let providerDetails = null;
      if (item.providerSeriesId) {
        providerDetails = await api.getSeriesDetails(item.providerSeriesId, 'AsuraScans');
      } else if (!anilistId && item.source === 'AsuraScans') {
        providerDetails = await api.getSeriesDetails(item.id, 'AsuraScans');
      } else if (anilistId) {
        providerDetails = await api.getMappedProviderDetails(anilistId, 'AsuraScans');
      }

      if (!providerDetails) {
        onNavigate('details', anilistId || item.id);
        return;
      }

      const chapterNum = typeof item.chapterNumber === 'string' ? parseFloat(item.chapterNumber) : item.chapterNumber;
      onNavigate('reader', {
        chapterId: item.chapterId,
        seriesId: anilistId || item.id,
        anilistId: anilistId,
        providerSeriesId: providerDetails.id,
        providerMangaId: providerDetails.providerMangaId,
        chapterNumber: !isNaN(Number(chapterNum)) ? chapterNum : undefined,
        chapters: providerDetails.chapters,
        seriesTitle: item.title,
        seriesImage: item.image,
        source: providerDetails.source || item.source,
        seriesStatus: providerDetails.status,
      });
    } catch (e) {
      console.warn('Failed to resume reading, falling back to details', e);
      onNavigate('details', anilistId || item.id);
    }
  };

  const handleInfoClick = (item?: ContinueItem) => {
    if (!item) return;
    const anilistId = item.anilistId || (item.source === 'AniList' ? item.id : undefined);
    onNavigate('details', anilistId || item.id);
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
    const cache = searchPageCacheRef.current[searchContextKey]?.[page];
    setSearchPage(page);
    if (cache) {
      setSearchResults(cache);
      setSearchHasMore(cache.length > 0);
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

  useEffect(() => {
    if (!homeHydrated) return;
    if (isDiscoveryMode) return;
    const page = tabPages[activeTabKey] || 1;
    void loadTabPage(activeTab, page);
  }, [activeTab, homeHydrated]);

  return (
    <div className="min-h-screen pb-20 px-4 sm:px-6 lg:px-8 max-w-[1800px] mx-auto pt-6">
      
      {/* 1. Hero Carousel (Only on default view) */}
      {!isDiscoveryMode && trending.length > 0 && (
         <motion.div 
           initial={{ opacity: 0, y: -20 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ duration: 0.6, ease: "easeOut" }}
           className="mb-8"
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
                     <div className="text-xs text-gray-500 font-medium hidden sm:block">
                        Drag to explore
                     </div>
                  </div>
                  
                  <motion.div 
                    ref={continueHistoryRef} 
                    className="overflow-hidden cursor-grab active:cursor-grabbing -mx-4 px-4 sm:mx-0 sm:px-0"
                  >
                     <motion.div 
                       drag="x"
                       dragConstraints={{ right: 0, left: -continueHistoryWidth }}
                       onDragStart={handleContinueDragStart}
                       onDragEnd={handleContinueDragEnd}
                       className="flex gap-5 w-max py-2" 
                     >
                        {continueReading.map((item) => (
                          <div key={item.id} className="w-[280px] sm:w-[320px] aspect-video flex-shrink-0">
                              <HistoryCard 
                                 item={item} 
                                 onResume={handleContinueClick}
                                 onInfo={handleInfoClick}
                                 disableClick={suppressContinueClick}
                              />
                          </div>
                        ))}
                        <div className="w-[150px] aspect-video flex-shrink-0">
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
                     <div className="text-xs text-gray-500 font-medium hidden sm:block">
                        Saved on this device
                     </div>
                  </div>
                  
                  <motion.div 
                    ref={recentHistoryRef} 
                    className="overflow-hidden cursor-grab active:cursor-grabbing -mx-4 px-4 sm:mx-0 sm:px-0"
                  >
                     <motion.div 
                       drag="x"
                       dragConstraints={{ right: 0, left: -recentHistoryWidth }}
                       onDragStart={handleRecentDragStart}
                       onDragEnd={handleRecentDragEnd}
                       className="flex gap-5 w-max py-2" 
                     >
                        {recentReads.map((item) => (
                          <div key={item.id} className="w-[280px] sm:w-[320px] aspect-video flex-shrink-0">
                              <HistoryCard 
                                 item={item} 
                                 onResume={handleContinueClick}
                                 onInfo={handleInfoClick}
                                 disableClick={suppressRecentClick}
                              />
                          </div>
                        ))}
                        <div className="w-[150px] aspect-video flex-shrink-0">
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
                  <div className="flex items-center justify-between">
                     <div>
                         <h2 className="text-2xl font-bold text-white">
                            {globalSearchQuery ? `Results for "${globalSearchQuery}"` : 'Filtered Results'}
                         </h2>
                         {searchResults.length > 0 && <span className="text-sm text-gray-500">{searchResults.length} matches found</span>}
                     </div>
                     <div className="text-sm text-gray-500 font-bold px-3 py-1 bg-surfaceHighlight rounded-lg border border-white/5">
                        Source: {globalSearchSource}
                     </div>
                  </div>
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
                                onClick={() => onNavigate('details', item.id)} 
                             />
                          ))
                       ) : (
                          <div className="col-span-full py-20 text-center text-gray-500 flex flex-col items-center">
                             <span className="text-4xl mb-4 opacity-50">🔍</span>
                             <p className="text-lg font-medium">No results found.</p>
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
                              ? handleSearchPageChange(currentPage - 1)
                              : handleTabPageChange(currentPage - 1)
                          }
                          disabled={!canGoPrev || isLoadingMore}
                          className="px-5 py-2.5 rounded-xl bg-white/5 text-white font-semibold text-sm border border-white/10 hover:bg-white/10 disabled:opacity-50"
                        >
                          Previous
                        </button>
                        <div className="text-sm font-semibold text-gray-400">
                          Page {currentPage}
                        </div>
                        <button
                          onClick={() =>
                            isDiscoveryMode
                              ? handleSearchPageChange(currentPage + 1)
                              : handleTabPageChange(currentPage + 1)
                          }
                          disabled={!canLoadMore || isLoadingMore}
                          className="px-5 py-2.5 rounded-xl bg-white/5 text-white font-semibold text-sm border border-white/10 hover:bg-white/10 disabled:opacity-50"
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
