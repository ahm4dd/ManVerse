import React, { useEffect, useState, useMemo } from 'react';
import { anilistApi } from '../lib/anilist';
import { history } from '../lib/history';
import { SearchIcon, StarIcon, FilterIcon, XIcon } from '../components/Icons';
import ActivityHeatmap from '../components/ActivityHeatmap';
import ActivityFeed from '../components/ActivityFeed';
import GenreCard from '../components/GenreCard';
import EditEntryModal from '../components/EditEntryModal';
import SearchFilters, { FilterState } from '../components/SearchFilters';
import { motion, AnimatePresence } from 'framer-motion';

interface LibraryProps {
  onNavigate: (view: string, data?: any) => void;
  user: any;
}

const Library: React.FC<LibraryProps> = ({ onNavigate, user }) => {
  const [fullLibrary, setFullLibrary] = useState<any>(null);
  const [userStats, setUserStats] = useState<any>(null);
  const [userActivity, setUserActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Tabs
  const [activeTab, setActiveTab] = useState<'Overview' | 'Manga List' | 'Stats'>('Overview');
  const [listFilter, setListFilter] = useState('Reading'); // For Manga List tab
  
  // Edit Modal State
  const [editingEntry, setEditingEntry] = useState<{entry: any, media: any} | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    format: 'All',
    status: 'All',
    genre: 'All',
    country: 'All',
    sort: 'Last Updated'
  });

  const loadData = async () => {
      setLoading(true);
      if (user) {
        try {
           const [libData, statsData, activityData] = await Promise.all([
             anilistApi.getFullUserLibrary(user.id),
             anilistApi.getUserStats(user.id),
             anilistApi.getUserActivity(user.id)
           ]);
           setFullLibrary(libData);
           setUserStats(statsData);
           setUserActivity(activityData || []);
        } catch (e) {
          console.error(e);
        }
      }
      setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [user]);

  // Derive Data
  const stats = userStats?.statistics?.manga;
  const genreStats = stats?.genres || [];
  
  // Helper to get covers for genres
  const getGenreImages = (genreName: string) => {
     if (!fullLibrary?.lists) return [];
     const images: string[] = [];
     fullLibrary.lists.forEach((list: any) => {
        list.entries.forEach((entry: any) => {
           if (entry.media.genres?.includes(genreName) && images.length < 4) {
              if (entry.media.coverImage.extraLarge) images.push(entry.media.coverImage.extraLarge);
           }
        });
     });
     return images;
  };

  // Derive available genres from library
  const availableGenres = useMemo(() => {
     const genres = new Set<string>();
     genres.add('All');
     if (fullLibrary?.lists) {
        fullLibrary.lists.forEach((list: any) => {
           list.entries.forEach((entry: any) => {
              entry.media.genres?.forEach((g: string) => genres.add(g));
           });
        });
     }
     return Array.from(genres).sort();
  }, [fullLibrary]);

  // Process Library for List View
  const processedLists = useMemo(() => {
    const lists: Record<string, any[]> = {
       'Reading': [],
       'Planning': [],
       'Completed': [],
       'Paused': [],
       'Dropped': [],
    };
    if (fullLibrary?.lists) {
       fullLibrary.lists.forEach((list: any) => {
          let key = list.name;
          if (key === 'Current') key = 'Reading';
          if (key === 'Repeating') key = 'Reading';
          if (lists[key]) lists[key] = [...lists[key], ...list.entries];
       });
    }
    return lists;
  }, [fullLibrary]);

  const currentListEntries = useMemo(() => {
     let entries = processedLists[listFilter] || [];
     
     // 1. Text Search
     if (searchQuery) {
        const q = searchQuery.toLowerCase();
        entries = entries.filter((e: any) => 
           e.media.title.english?.toLowerCase().includes(q) || 
           e.media.title.romaji?.toLowerCase().includes(q)
        );
     }

     // 2. Filters
     if (filters.format !== 'All') {
        entries = entries.filter((e: any) => e.media.format === filters.format.toUpperCase().replace(' ', '_'));
     }
     if (filters.status !== 'All') {
        entries = entries.filter((e: any) => e.media.status === filters.status.toUpperCase().replace(' ', '_'));
     }
     if (filters.genre !== 'All') {
        entries = entries.filter((e: any) => e.media.genres?.includes(filters.genre));
     }
     if (filters.country !== 'All') {
        entries = entries.filter((e: any) => e.media.countryOfOrigin === filters.country);
     }

     // 3. Sorting
     entries.sort((a: any, b: any) => {
        switch (filters.sort) {
           case 'Title':
              const tA = a.media.title.english || a.media.title.romaji;
              const tB = b.media.title.english || b.media.title.romaji;
              return tA.localeCompare(tB);
           case 'Score':
              return b.score - a.score;
           case 'Progress':
              return b.progress - a.progress;
           case 'Last Updated':
              return b.updatedAt - a.updatedAt;
           case 'Last Added':
              // Assuming ID correlates with addition order roughly if createdAt missing in this query scope
              // Ideally use createdAt from API
              return b.id - a.id; 
           case 'Popularity':
              // Not available in user list query usually, fallback to score
              return b.score - a.score;
           default: // Last Updated default
              return b.updatedAt - a.updatedAt;
        }
     });

     return entries;
  }, [processedLists, listFilter, searchQuery, filters]);

  const openEditModal = (entry: any) => {
     setEditingEntry({
       entry,
       media: entry.media
     });
  };

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
         <div className="w-20 h-20 bg-surfaceHighlight rounded-full flex items-center justify-center mb-6 animate-pulse">
            <StarIcon className="w-10 h-10 text-gray-600" />
         </div>
         <h2 className="text-2xl font-bold text-white mb-2">Login Required</h2>
         <button 
            onClick={async () => {
              const authUrl = await anilistApi.getLoginUrl();
              window.location.href = authUrl;
            }}
            className="mt-4 bg-[#02A9FF] text-white px-8 py-3 rounded-full font-bold shadow-lg"
         >
            Connect AniList
         </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 max-w-[1400px] mx-auto">
      
      {/* 1. Header (Profile) */}
      <div className="relative h-64 md:h-80 w-full overflow-hidden">
         {/* Banner */}
         <div className="absolute inset-0 bg-surfaceHighlight">
            {user.bannerImage && <img src={user.bannerImage} className="w-full h-full object-cover opacity-50" />}
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
         </div>
         
         <div className="absolute bottom-0 left-0 w-full px-4 md:px-8 pb-6 flex items-end gap-6">
            <img src={user.avatar.large} className="w-28 h-28 md:w-40 md:h-40 rounded-xl border-4 border-background shadow-2xl" />
            <div className="mb-2">
               <h1 className="text-3xl md:text-5xl font-black text-white">{user.name}</h1>
               {user.about && <div className="text-sm text-gray-300 mt-2 max-w-2xl line-clamp-2 md:line-clamp-none" dangerouslySetInnerHTML={{__html: user.about}} />}
            </div>
         </div>
      </div>

      {/* 2. Navigation Tabs */}
      <div className="bg-surface/80 backdrop-blur sticky top-16 z-30 border-b border-white/5 px-4 md:px-8">
         <div className="flex gap-8">
            {['Overview', 'Manga List', 'Stats'].map(tab => (
               <button 
                 key={tab}
                 onClick={() => setActiveTab(tab as any)}
                 className={`py-4 text-sm md:text-base font-bold transition-all border-b-2 ${activeTab === tab ? 'border-primary text-white' : 'border-transparent text-gray-400 hover:text-white'}`}
               >
                 {tab}
               </button>
            ))}
         </div>
      </div>

      <div className="px-4 md:px-8 py-8">
         
         {/* --- OVERVIEW TAB --- */}
         {activeTab === 'Overview' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
               {/* Left Column: Heatmap & Stats */}
               <div className="lg:col-span-2 space-y-8">
                  {/* Activity History Heatmap */}
                  <div className="bg-[#151f2e] p-6 rounded-2xl border border-white/5">
                     <h3 className="text-sm font-bold text-gray-400 mb-4">Activity History</h3>
                     {userStats?.stats?.mangaActivityHistory && (
                        <ActivityHeatmap history={userStats.stats.mangaActivityHistory} />
                     )}
                  </div>

                  {/* Summary Stats Strip */}
                  <div className="grid grid-cols-3 bg-[#151f2e] rounded-2xl border border-white/5 divide-x divide-white/5 overflow-hidden">
                      <div className="p-6 text-center">
                         <div className="text-2xl font-black text-primary mb-1">{stats?.count || 0}</div>
                         <div className="text-xs font-bold text-gray-500 uppercase">Total Manga</div>
                      </div>
                      <div className="p-6 text-center">
                         <div className="text-2xl font-black text-purple-400 mb-1">{(stats?.minutesRead / 60 / 24).toFixed(1)}</div>
                         <div className="text-xs font-bold text-gray-500 uppercase">Days Read</div>
                      </div>
                      <div className="p-6 text-center">
                         <div className="text-2xl font-black text-green-400 mb-1">{stats?.chaptersRead?.toLocaleString() || 0}</div>
                         <div className="text-xs font-bold text-gray-500 uppercase">Chapters</div>
                      </div>
                  </div>
               </div>

               {/* Right Column: Activity Feed */}
               <div>
                  <div className="bg-surface p-6 rounded-2xl border border-white/5 h-full">
                     <h3 className="text-sm font-bold text-gray-400 mb-6">Recent Activity</h3>
                     <ActivityFeed activities={userActivity} />
                  </div>
               </div>
            </motion.div>
         )}

         {/* --- MANGA LIST TAB --- */}
         {activeTab === 'Manga List' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col lg:flex-row gap-8 items-start">
               
               {/* Left: Filter Sidebar (Desktop) or Toggle (Mobile) */}
               <div className={`w-full lg:w-64 flex-shrink-0 ${showFilters ? 'block' : 'hidden lg:block'}`}>
                  <SearchFilters 
                     filters={filters} 
                     onChange={setFilters} 
                     availableGenres={availableGenres}
                     layout="column"
                  />
               </div>

               {/* Right: List Content */}
               <div className="flex-1 w-full">
                 {/* Toolbar */}
                 <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
                    <div className="flex bg-surfaceHighlight rounded-lg p-1 w-full md:w-auto overflow-x-auto">
                       {Object.keys(processedLists).map(key => (
                          <button
                            key={key}
                            onClick={() => setListFilter(key)}
                            className={`px-4 py-2 text-sm font-bold rounded-md transition-all whitespace-nowrap ${listFilter === key ? 'bg-white/10 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
                          >
                            {key}
                          </button>
                       ))}
                    </div>

                    <div className="flex gap-2 w-full md:w-auto">
                        <div className="relative w-full md:w-64">
                          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                          <input 
                            type="text" 
                            placeholder="Filter..." 
                            className="w-full bg-surfaceHighlight border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-primary"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                          />
                        </div>
                        <button 
                           onClick={() => setShowFilters(!showFilters)}
                           className="lg:hidden p-2 bg-surfaceHighlight border border-white/10 rounded-lg text-white"
                        >
                           <FilterIcon className="w-5 h-5" />
                        </button>
                    </div>
                 </div>

                 {/* Grid View */}
                 <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {currentListEntries.map((entry: any) => (
                       <div 
                          key={entry.id} 
                          className="group relative aspect-[2/3] rounded-xl overflow-hidden bg-surfaceHighlight cursor-pointer"
                          onClick={() => openEditModal(entry)}
                       >
                          <img 
                            src={entry.media.coverImage.large} 
                            className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-500" 
                          />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                             <h4 className="text-sm font-bold text-white line-clamp-2">{entry.media.title.english || entry.media.title.romaji}</h4>
                             <div className="flex justify-between items-center mt-2">
                                <span className="text-xs text-primary font-bold">{entry.progress} / {entry.media.chapters || '?'}</span>
                                {entry.score > 0 && <span className="text-xs text-yellow-500 font-bold">{entry.score}</span>}
                             </div>
                             <div className="text-[10px] text-gray-400 mt-1 text-center bg-white/10 rounded py-1">
                                Click to Edit
                             </div>
                          </div>
                          {/* Status Dot */}
                          <div className={`absolute top-2 right-2 w-3 h-3 rounded-full border-2 border-black ${
                             entry.status === 'CURRENT' ? 'bg-green-500' :
                             entry.status === 'PLANNING' ? 'bg-blue-500' :
                             entry.status === 'COMPLETED' ? 'bg-purple-500' : 'bg-gray-500'
                          }`} />
                       </div>
                    ))}
                 </div>
                 {currentListEntries.length === 0 && (
                    <div className="text-center py-20 text-gray-500">
                       No manga found matching filters.
                    </div>
                 )}
               </div>
            </motion.div>
         )}

         {/* --- STATS TAB --- */}
         {activeTab === 'Stats' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-12">
               {/* 1. Global Distributions */}
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Format Distribution Chart (CSS Circles) */}
                  <div className="bg-[#151f2e] p-6 rounded-2xl border border-white/5">
                     <h3 className="text-sm font-bold text-gray-400 mb-6">Format Distribution</h3>
                     <div className="flex items-center justify-center gap-6">
                        <div className="w-32 h-32 rounded-full border-[12px] border-primary flex items-center justify-center bg-primary/5">
                           <span className="text-xl font-bold text-white">Manga</span>
                        </div>
                        <div className="space-y-2">
                           {stats?.formats?.map((f: any) => (
                             <div key={f.format} className="flex items-center gap-2 text-xs">
                                <div className="w-3 h-3 rounded-full bg-primary" />
                                <span className="text-gray-300">{f.format}</span>
                                <span className="font-bold text-white ml-auto">{f.count}</span>
                             </div>
                           ))}
                        </div>
                     </div>
                  </div>

                  {/* Status Distribution (Bars) */}
                  <div className="bg-[#151f2e] p-6 rounded-2xl border border-white/5 col-span-2">
                     <h3 className="text-sm font-bold text-gray-400 mb-6">Status Distribution</h3>
                     <div className="space-y-4">
                        {stats?.statuses?.map((s: any) => {
                           const max = Math.max(...stats.statuses.map((x: any) => x.count));
                           const pct = (s.count / max) * 100;
                           const color = s.status === 'CURRENT' ? 'bg-green-500' : s.status === 'COMPLETED' ? 'bg-purple-500' : s.status === 'PLANNING' ? 'bg-blue-500' : 'bg-red-500';
                           return (
                             <div key={s.status} className="group">
                                <div className="flex justify-between text-xs font-bold mb-1 text-gray-400">
                                   <span className="capitalize">{s.status.toLowerCase()}</span>
                                   <span>{s.count} Entries</span>
                                </div>
                                <div className="w-full h-3 bg-surfaceHighlight rounded-full overflow-hidden">
                                   <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
                                </div>
                             </div>
                           )
                        })}
                     </div>
                  </div>
               </div>

               {/* 2. Genre Cards */}
               <div>
                  <h3 className="text-xl font-bold text-white mb-6">Genre Overview</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                     {genreStats.map((genre: any) => (
                        <GenreCard 
                           key={genre.genre}
                           genre={genre.genre}
                           count={genre.count}
                           meanScore={genre.meanScore}
                           timeRead={genre.minutesRead}
                           images={getGenreImages(genre.genre)}
                        />
                     ))}
                  </div>
               </div>
            </motion.div>
         )}

      </div>

      {/* Edit Modal */}
      <AnimatePresence>
         {editingEntry && (
            <EditEntryModal 
              entry={editingEntry.entry}
              media={editingEntry.media}
              onClose={() => setEditingEntry(null)}
              onUpdate={() => {
                 loadData(); // Reload data after update
              }}
            />
         )}
      </AnimatePresence>

    </div>
  );
};

export default Library;
