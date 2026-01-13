import React, { useEffect, useState, useMemo } from 'react';
import { anilistApi } from '../lib/anilist';
import { api, type DownloadedSeries } from '../lib/api';
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

function formatTimeAgo(timestamp?: number | null): string {
  if (!timestamp) return 'Unknown';
  const seconds = Math.floor(Date.now() / 1000) - timestamp;
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return 'last week';
  if (days < 30) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

function buildActivityHistoryFromEntries(entries: any[]) {
  const counts = new Map<number, number>();
  for (const entry of entries) {
    const updatedAt = entry.updatedAt;
    if (!updatedAt) continue;
    const day = Math.floor(updatedAt / 86400) * 86400;
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }

  const history = [];
  const now = new Date();
  for (let i = 0; i < 365; i += 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    date.setUTCDate(date.getUTCDate() - i);
    const unix = Math.floor(date.getTime() / 1000);
    const amount = counts.get(unix) ?? 0;
    const level = amount === 0 ? 0 : amount > 12 ? 4 : amount > 7 ? 3 : amount > 3 ? 2 : 1;
    history.unshift({ date: unix, amount, level });
  }
  return history;
}

function buildStatsFromEntries(entries: any[]) {
  const scores: number[] = [];
  const genres = new Map<string, { count: number; scoreTotal: number; scoreCount: number; chaptersRead: number }>();
  const statuses = new Map<
    string,
    { count: number; scoreTotal: number; scoreCount: number; chaptersRead: number }
  >();
  const formats = new Map<string, number>();
  const countries = new Map<string, number>();

  let chaptersRead = 0;
  let volumesRead = 0;

  for (const entry of entries) {
    const media = entry.media;
    if (!media) continue;
    const score = entry.score ?? null;
    const progress = entry.progress ?? 0;
    const progressVolumes = entry.progressVolumes ?? 0;
    chaptersRead += progress;
    volumesRead += progressVolumes;

    if (typeof score === 'number') {
      scores.push(score);
    }

    const status = entry.status;
    const statusBucket = statuses.get(status) ?? {
      count: 0,
      scoreTotal: 0,
      scoreCount: 0,
      chaptersRead: 0,
    };
    statusBucket.count += 1;
    statusBucket.chaptersRead += progress;
    if (typeof score === 'number') {
      statusBucket.scoreTotal += score;
      statusBucket.scoreCount += 1;
    }
    statuses.set(status, statusBucket);

    const genreList = media.genres ?? [];
    for (const genre of genreList) {
      const bucket = genres.get(genre) ?? {
        count: 0,
        scoreTotal: 0,
        scoreCount: 0,
        chaptersRead: 0,
      };
      bucket.count += 1;
      bucket.chaptersRead += progress;
      if (typeof score === 'number') {
        bucket.scoreTotal += score;
        bucket.scoreCount += 1;
      }
      genres.set(genre, bucket);
    }

    if (media.format) {
      formats.set(media.format, (formats.get(media.format) ?? 0) + 1);
    }
    if (media.countryOfOrigin) {
      countries.set(media.countryOfOrigin, (countries.get(media.countryOfOrigin) ?? 0) + 1);
    }
  }

  const meanScore =
    scores.length > 0 ? scores.reduce((acc, value) => acc + value, 0) / scores.length : null;
  const standardDeviation =
    scores.length > 1
      ? Math.sqrt(
          scores.reduce((sum, value) => sum + Math.pow(value - (meanScore ?? 0), 2), 0) /
            scores.length,
        )
      : null;

  return {
    count: entries.length,
    chaptersRead,
    volumesRead,
    meanScore,
    standardDeviation,
    minutesRead: chaptersRead * 5,
    genres: Array.from(genres.entries()).map(([genre, bucket]) => ({
      genre,
      count: bucket.count,
      meanScore: bucket.scoreCount ? bucket.scoreTotal / bucket.scoreCount : null,
      minutesRead: bucket.chaptersRead * 5,
      chaptersRead: bucket.chaptersRead,
    })),
    statuses: Array.from(statuses.entries()).map(([status, bucket]) => ({
      status,
      count: bucket.count,
      meanScore: bucket.scoreCount ? bucket.scoreTotal / bucket.scoreCount : null,
      chaptersRead: bucket.chaptersRead,
    })),
    formats: Array.from(formats.entries()).map(([format, count]) => ({ format, count })),
    countries: Array.from(countries.entries()).map(([country, count]) => ({ country, count })),
  };
}

const Library: React.FC<LibraryProps> = ({ onNavigate, user }) => {
  const [fullLibrary, setFullLibrary] = useState<any>(null);
  const [userStats, setUserStats] = useState<any>(null);
  const [userActivity, setUserActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Tabs
  const [activeTab, setActiveTab] = useState<'Overview' | 'Manga List' | 'Stats' | 'Offline'>('Overview');
  const [listFilter, setListFilter] = useState('Reading'); // For Manga List tab

  const [offlineSeries, setOfflineSeries] = useState<DownloadedSeries[]>([]);
  const [offlineLoading, setOfflineLoading] = useState(false);
  
  // Edit Modal State
  const [editingEntry, setEditingEntry] = useState<{entry: any, media: any} | null>(null);
  const [localProgress, setLocalProgress] = useState<Record<number, number>>({});
  const [progressUpdating, setProgressUpdating] = useState<Record<number, boolean>>({});

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
           const [libResult, statsResult, activityResult] = await Promise.allSettled([
             anilistApi.getFullUserLibrary(user.id),
             anilistApi.getUserStats(user.id),
             anilistApi.getUserActivity(user.id)
           ]);
           if (libResult.status === 'fulfilled') {
             setFullLibrary(libResult.value);
           }
           if (statsResult.status === 'fulfilled') {
             setUserStats(statsResult.value);
           }
           if (activityResult.status === 'fulfilled') {
             setUserActivity(activityResult.value || []);
           }
        } catch (e) {
          console.error(e);
        }
      }
      setLoading(false);
  };

  const loadOfflineLibrary = async () => {
    setOfflineLoading(true);
    try {
      const data = await api.listOfflineLibrary();
      setOfflineSeries(data);
    } catch (error) {
      console.warn('Failed to load offline library', error);
      setOfflineSeries([]);
    } finally {
      setOfflineLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  useEffect(() => {
    if (activeTab === 'Offline') {
      void loadOfflineLibrary();
    }
  }, [activeTab]);

  const flattenedEntries = useMemo(() => {
     if (!fullLibrary?.lists) return [];
     return fullLibrary.lists.flatMap((list: any) => list.entries ?? []);
  }, [fullLibrary]);

  const derivedStats = useMemo(() => {
     if (flattenedEntries.length === 0) return null;
     return buildStatsFromEntries(flattenedEntries);
  }, [flattenedEntries]);

  const derivedHistory = useMemo(() => {
     if (flattenedEntries.length === 0) return null;
     return buildActivityHistoryFromEntries(flattenedEntries);
  }, [flattenedEntries]);

  // Derive Data
  const apiStats = userStats?.statistics?.manga;
  const stats = apiStats && (apiStats.count ?? 0) > 0 ? apiStats : derivedStats;
  const genreStats = stats?.genres || [];
  const activityHistory =
    userStats?.stats?.mangaActivityHistory ||
    userStats?.stats?.activityHistory ||
    derivedHistory ||
    [];
  
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

  const getProgressValue = (entry: any) => {
    const mediaId = entry.media.id;
    return localProgress[mediaId] ?? entry.progress ?? 0;
  };

  const updateProgressValue = async (entry: any, nextProgress: number) => {
    const mediaId = entry.media.id;
    const maxChapters = typeof entry.media.chapters === 'number' ? entry.media.chapters : Infinity;
    const clamped = Math.max(0, Math.min(nextProgress, maxChapters));

    setLocalProgress((prev) => ({ ...prev, [mediaId]: clamped }));
    setProgressUpdating((prev) => ({ ...prev, [mediaId]: true }));

    const success = await anilistApi.updateProgress(mediaId, clamped);
    setProgressUpdating((prev) => ({ ...prev, [mediaId]: false }));

    if (success) {
      setFullLibrary((prev: any) => {
        if (!prev?.lists) return prev;
        const updatedLists = prev.lists.map((list: any) => ({
          ...list,
          entries: list.entries.map((item: any) => {
            if (item.media.id !== mediaId) return item;
            return {
              ...item,
              progress: clamped,
              updatedAt: Math.floor(Date.now() / 1000),
            };
          }),
        }));
        return { ...prev, lists: updatedLists };
      });
    } else {
      setLocalProgress((prev) => {
        const next = { ...prev };
        delete next[mediaId];
        return next;
      });
    }
  };

  const handleQuickProgress = (entry: any, delta: number) => {
    const current = getProgressValue(entry);
    const next = current + delta;
    if (next < 0) return;
    if (progressUpdating[entry.media.id]) return;
    void updateProgressValue(entry, next);
  };

  if (!user) {
    return (
      <div className="min-h-[100dvh] min-h-app flex flex-col items-center justify-center p-6 text-center">
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
    <div className="min-h-[100dvh] min-h-app pb-20 max-w-[1400px] mx-auto">
      
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
            {['Overview', 'Manga List', 'Stats', 'Offline'].map(tab => (
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
                     {activityHistory.length > 0 && (
                        <ActivityHeatmap history={activityHistory} />
                     )}
                  </div>

                  {/* Summary Stats Strip */}
                  <div className="grid grid-cols-3 bg-[#151f2e] rounded-2xl border border-white/5 divide-x divide-white/5 overflow-hidden">
                      <div className="p-6 text-center">
                         <div className="text-2xl font-black text-primary mb-1">{stats?.count || 0}</div>
                         <div className="text-xs font-bold text-gray-500 uppercase">Total Manga</div>
                      </div>
                      <div className="p-6 text-center">
                         <div className="text-2xl font-black text-purple-400 mb-1">
                           {stats?.minutesRead ? (stats.minutesRead / 60 / 24).toFixed(1) : '0.0'}
                         </div>
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
                    {currentListEntries.map((entry: any) => {
                       const title = entry.media.title.english || entry.media.title.romaji;
                       const latestCh = entry.media.status === 'FINISHED' ? entry.media.chapters : null;
                       const lastReadAgo = formatTimeAgo(entry.updatedAt ?? entry.createdAt);
                       const latestUpdateAgo = formatTimeAgo(entry.media.updatedAt ?? entry.updatedAt);
                       const progressValue = getProgressValue(entry);
                       const maxChapters =
                         typeof entry.media.chapters === 'number' ? entry.media.chapters : null;
                       const isUpdating = progressUpdating[entry.media.id] === true;
                       return (
                          <div 
                             key={entry.id} 
                             className="group relative aspect-[2/3] rounded-xl overflow-hidden bg-surfaceHighlight cursor-pointer"
                             onClick={() => onNavigate('details', entry.media.id.toString())}
                          >
                             <img 
                               src={entry.media.coverImage.extraLarge || entry.media.coverImage.large || entry.media.coverImage.medium || ''} 
                               className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-500" 
                             />
                             <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                             <div className="absolute inset-x-0 bottom-0 p-3">
                                <div className="rounded-lg bg-black/70 backdrop-blur-md border border-white/10 px-3 py-2.5 space-y-2">
                                   <h4 className="text-[13px] font-bold text-white leading-snug line-clamp-2">
                                     {title}
                                   </h4>
                                   <div className="flex items-center gap-2">
                                     <button
                                       onClick={(event) => {
                                         event.stopPropagation();
                                         openEditModal(entry);
                                       }}
                                       className="px-3 py-1.5 rounded-full bg-primary text-black text-[11px] font-extrabold uppercase tracking-wide shadow-sm hover:brightness-110"
                                     >
                                       Edit
                                     </button>
                                     <button
                                       onClick={(event) => {
                                         event.stopPropagation();
                                         onNavigate('details', entry.media.id.toString());
                                       }}
                                       className="px-3 py-1.5 rounded-full bg-white/10 text-white text-[11px] font-bold uppercase tracking-wide border border-white/10 hover:bg-white/20"
                                     >
                                       Info
                                     </button>
                                   </div>
                                   <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-200">
                                     <div className="flex flex-col gap-1">
                                       <span className="text-[10px] uppercase tracking-wide text-gray-400">Reading</span>
                                       <div className="flex items-center gap-2">
                                         <span className="font-semibold text-white/90">Ch {progressValue}</span>
                                         <div className="flex items-center gap-1">
                                           <button
                                             onClick={(event) => {
                                               event.stopPropagation();
                                               handleQuickProgress(entry, -1);
                                             }}
                                             disabled={isUpdating || progressValue <= 0}
                                             className={`h-6 w-6 rounded-full text-[12px] font-bold border transition-colors ${
                                               isUpdating || progressValue <= 0
                                                 ? 'border-white/10 text-gray-600'
                                                 : 'border-white/15 text-white/80 hover:text-white hover:border-white/30'
                                             }`}
                                             aria-label="Decrease progress"
                                           >
                                             -
                                           </button>
                                           <button
                                             onClick={(event) => {
                                               event.stopPropagation();
                                               handleQuickProgress(entry, 1);
                                             }}
                                             disabled={isUpdating || (maxChapters !== null && progressValue >= maxChapters)}
                                             className={`h-6 w-6 rounded-full text-[12px] font-bold border transition-colors ${
                                               isUpdating || (maxChapters !== null && progressValue >= maxChapters)
                                                 ? 'border-white/10 text-gray-600'
                                                 : 'border-white/15 text-white/80 hover:text-white hover:border-white/30'
                                             }`}
                                             aria-label="Increase progress"
                                           >
                                             +
                                           </button>
                                         </div>
                                       </div>
                                     </div>
                                     <div className="flex flex-col gap-1 text-right">
                                       <span className="text-[10px] uppercase tracking-wide text-gray-400">Latest</span>
                                       <span className="text-primary/90">
                                         {latestCh ? `Ch ${latestCh}` : 'Updated'}
                                       </span>
                                     </div>
                                   </div>
                                   <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-400">
                                     <span>Last read {lastReadAgo}</span>
                                     <span className="text-right">Updated {latestUpdateAgo}</span>
                                   </div>
                                </div>
                             </div>
                             {/* Status Dot */}
                             <div className={`absolute top-3 right-3 w-5 h-5 rounded-full ring-2 ring-black/80 shadow-lg ${
                                entry.status === 'CURRENT' ? 'bg-green-500' :
                                entry.status === 'PLANNING' ? 'bg-blue-500' :
                                entry.status === 'COMPLETED' ? 'bg-purple-500' : 'bg-gray-500'
                             }`} />
                          </div>
                       );
                    })}
                 </div>
                 {currentListEntries.length === 0 && (
                    <div className="text-center py-20 text-gray-500">
                       No manga found matching filters.
                    </div>
                 )}
               </div>
            </motion.div>
         )}

         {/* --- OFFLINE TAB --- */}
         {activeTab === 'Offline' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
               <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                  <div>
                     <h3 className="text-2xl font-extrabold text-white">Offline Library</h3>
                     <p className="text-sm text-gray-400">Downloaded chapters available for offline reading.</p>
                  </div>
                  <div className="text-xs text-gray-500">
                     {offlineSeries.length} series
                  </div>
               </div>

               {offlineLoading ? (
                  <div className="py-16 text-center text-gray-400">
                     Loading downloads...
                  </div>
               ) : offlineSeries.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                     {offlineSeries.map((series) => (
                        <div
                           key={`${series.provider}-${series.providerMangaId}`}
                           onClick={() => onNavigate('details', series.providerSeriesId)}
                           className="group relative aspect-[2/3] rounded-xl overflow-hidden bg-surfaceHighlight cursor-pointer"
                        >
                           <img
                             src={series.image || ''}
                             className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-500"
                           />
                           <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                           <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-primary/90 text-black text-[10px] font-bold uppercase tracking-wider shadow-lg">
                             Downloaded
                           </div>
                           <div className="absolute inset-x-0 bottom-0 p-3">
                              <div className="rounded-lg bg-black/70 backdrop-blur-md border border-white/10 px-3 py-2.5 space-y-2">
                                 <h4 className="text-[13px] font-bold text-white leading-snug line-clamp-2">
                                   {series.title}
                                 </h4>
                                 <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-200">
                                   <div className="flex flex-col gap-1">
                                     <span className="text-[10px] uppercase tracking-wide text-gray-400">Chapters</span>
                                     <span className="font-semibold text-white/90">{series.chaptersDownloaded}</span>
                                   </div>
                                   <div className="flex flex-col gap-1 text-right">
                                     <span className="text-[10px] uppercase tracking-wide text-gray-400">Size</span>
                                     <span className="text-primary/90">{formatBytes(series.totalSize)}</span>
                                   </div>
                                 </div>
                                 <div className="text-[10px] text-gray-400">
                                   Last downloaded {formatTimeAgo(series.lastDownloaded)}
                                 </div>
                              </div>
                           </div>
                        </div>
                     ))}
                  </div>
               ) : (
                  <div className="py-16 text-center text-gray-500">
                     No downloads yet. Download chapters from a series to see them here.
                  </div>
               )}
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
