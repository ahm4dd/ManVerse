import React, { useEffect, useState, useRef } from 'react';
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
  const [loading, setLoading] = useState(true);
  
  // View/Filter States for default view
  const [activeTab, setActiveTab] = useState<'Newest' | 'Popular' | 'Top Rated'>('Newest');

  // Drag Constraints for History
  const historyContainerRef = useRef<HTMLDivElement>(null);
  const [historyWidth, setHistoryWidth] = useState(0);

  // Check if filters are active (dirty)
  const isFiltersDirty = 
    globalFilters.format !== 'All' || 
    globalFilters.status !== 'All' || 
    globalFilters.genre !== 'All' || 
    globalFilters.country !== 'All' || 
    globalFilters.sort !== 'Popularity';

  // Discovery Mode enabled if there is a search query OR GLOBAL filters are applied
  const isDiscoveryMode = globalSearchQuery.length > 0 || isFiltersDirty;

  useEffect(() => {
    // Only load initial default data if we aren't already searching/filtering
    if (!isDiscoveryMode) {
      loadDefaultData();
    }
  }, []);

  useEffect(() => {
    loadContinueReading();
  }, [user]);

  // Update drag constraints when history changes
  useEffect(() => {
     if (historyContainerRef.current) {
        setHistoryWidth(historyContainerRef.current.scrollWidth - historyContainerRef.current.offsetWidth);
     }
  }, [continueReading]);

  // Trigger global search when global props change (Debounced)
  useEffect(() => {
     if (!isDiscoveryMode) {
        setSearchResults([]); 
        // If we exited discovery mode (cleared search/filters), ensure default data is there if missing
        if (trending.length === 0 && !loading) loadDefaultData();
        return;
     }

     const timer = setTimeout(() => {
        handleGlobalSearch();
     }, 600);

     return () => clearTimeout(timer);
  }, [globalSearchQuery, globalFilters, globalSearchSource]);

  const loadDefaultData = async () => {
    setLoading(true);
    try {
      const [trendingData, popularData, topRatedData] = await Promise.all([
         anilistApi.getTrending(),
         anilistApi.getPopular(),
         anilistApi.getTopRated()
      ]);
      
      setTrending(trendingData);
      setPopular(popularData);
      setTopRated(topRatedData);
    } catch (e) {
      console.warn("Failed to load default data", e);
    } finally {
      setLoading(false);
    }
  };

  const loadContinueReading = async () => {
    let items: ContinueItem[] = [];

    // 1. Get Local History
    const localHistory = history.get();
    const localMap = new Map<string, typeof localHistory[0]>();
    localHistory.forEach(item => {
      localMap.set(item.seriesId, item);
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

          if (localMatch) {
             const localNum = parseFloat(localMatch.chapterNumber.replace(/[^0-9.]/g, ''));
             if (!isNaN(localNum) && localNum >= entry.progress) {
                 chapterNum = localMatch.chapterNumber;
                 chapterId = localMatch.chapterId;
                 progressSource = 'Local';
                 timestamp = localMatch.timestamp;
             }
          }

          return {
            id: aniListId,
            title: title,
            image: entry.media.bannerImage || entry.media.coverImage.extraLarge || entry.media.coverImage.large,
            chapterNumber: chapterNum,
            chapterId: chapterId,
            timestamp: timestamp,
            source: 'AniList',
            progressSource
          };
        });
      } catch (e) {
        console.error("Failed to load AniList reading list", e);
      }
    }

    // 3. Add any Local History items that were NOT matched in AniList
    const processedIds = new Set(items.map(i => i.id));
    const processedTitles = new Set(items.map(i => i.title.toLowerCase()));

    localHistory.forEach(local => {
       if (!processedIds.has(local.seriesId) && !processedTitles.has(local.seriesTitle.toLowerCase())) {
          items.push({
            id: local.seriesId,
            title: local.seriesTitle,
            image: local.seriesImage,
            chapterNumber: local.chapterNumber,
            chapterId: local.chapterId,
            timestamp: local.timestamp,
            source: local.source,
            progressSource: 'Local'
          });
       }
    });

    items.sort((a, b) => b.timestamp - a.timestamp);
    setContinueReading(items);
  };

  const handleGlobalSearch = async () => {
    setLoading(true);
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

      const data = await api.searchSeries(globalSearchQuery, globalSearchSource, apiFilters);
      setSearchResults(data);
    } finally {
      setLoading(false);
    }
  };

  const handleContinueClick = (item: ContinueItem) => {
    if (item.chapterId) {
      onNavigate('reader', {
        chapterId: item.chapterId,
        seriesId: item.id,
        anilistId: item.source === 'AniList' ? item.id : undefined,
        chapterNumber: typeof item.chapterNumber === 'string' ? parseFloat(item.chapterNumber) : item.chapterNumber,
      });
    } else {
      onNavigate('details', item.id);
    }
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

            {/* Watch History (Only on Default View) */}
            {continueReading.length > 0 && !isDiscoveryMode && (
               <motion.div 
                 initial={{ opacity: 0, y: 20 }}
                 animate={{ opacity: 1, y: 0 }}
                 className="mb-8"
               >
                  <div className="mb-5 flex items-end justify-between">
                     <div>
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Your Watchlist</h3>
                        <h2 className="text-2xl font-bold text-white leading-none">Watch History</h2>
                     </div>
                     <div className="text-xs text-gray-500 font-medium hidden sm:block">
                        Drag to explore
                     </div>
                  </div>
                  
                  <motion.div 
                    ref={historyContainerRef} 
                    className="overflow-hidden cursor-grab active:cursor-grabbing -mx-4 px-4 sm:mx-0 sm:px-0"
                  >
                     <motion.div 
                       drag="x"
                       dragConstraints={{ right: 0, left: -historyWidth }}
                       className="flex gap-5 w-max py-2" 
                     >
                        {continueReading.map((item) => (
                          <div key={item.id} className="w-[280px] sm:w-[320px] aspect-video flex-shrink-0">
                              <HistoryCard 
                                 item={item} 
                                 onClick={handleContinueClick}
                              />
                          </div>
                        ))}
                        <div className="w-[150px] aspect-video flex-shrink-0">
                           <HistoryCard isViewMore={true} onClick={() => onNavigate('library')} />
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