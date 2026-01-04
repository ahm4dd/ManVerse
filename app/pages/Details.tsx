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

const parseAniListId = (input: string) => {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/anilist\.co\/manga\/(\d+)/i);
  if (match?.[1]) return match[1];
  return null;
};

const Details: React.FC<DetailsProps> = ({ seriesId, onNavigate, onBack, user }) => {
  const [data, setData] = useState<SeriesDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const { notify } = useNotification();
  
  // View State
  const [activeTab, setActiveTab] = useState<'Chapters' | 'Recommendations'>('Chapters');

  // Provider Reading State
  const [providerLoading, setProviderLoading] = useState(false);
  const [providerResults, setProviderResults] = useState<Series[] | null>(null);
  const [activeProviderSeries, setActiveProviderSeries] = useState<SeriesDetails | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string>('AsuraScans');
  const [showProviderMenu, setShowProviderMenu] = useState(false);
  const [manualQuery, setManualQuery] = useState('');
  const [manualProviderUrl, setManualProviderUrl] = useState('');
  const [historyMatch, setHistoryMatch] = useState<HistoryItem | null>(null);
  const [readChapterIds, setReadChapterIds] = useState<Set<string>>(new Set());
  const [anilistQuery, setAnilistQuery] = useState('');
  const [anilistResults, setAnilistResults] = useState<Series[]>([]);
  const [anilistManualInput, setAnilistManualInput] = useState('');
  const [anilistSearchLoading, setAnilistSearchLoading] = useState(false);
  const [linkingAniList, setLinkingAniList] = useState(false);
  const [linkedAniList, setLinkedAniList] = useState<{ id: string; title: string; image?: string } | null>(null);
  const [showAniListRemap, setShowAniListRemap] = useState(false);
  const [showProviderRemap, setShowProviderRemap] = useState(false);

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
      setActiveProviderSeries(null);
      setProviderResults(null);
      setProviderLoading(false);
      setManualQuery('');
      setManualProviderUrl('');
      setShowProviderMenu(false);
      setHistoryMatch(null);
      setReadChapterIds(new Set());
      setAnilistQuery('');
      setAnilistResults([]);
      setAnilistManualInput('');
      setAnilistSearchLoading(false);
      setLinkingAniList(false);
      setLinkedAniList(null);
      setShowAniListRemap(false);
      setShowProviderRemap(false);
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
    setProviderResults(null);
    setShowProviderMenu(false);
    setSelectedProvider(providerId);

    try {
      const results = await api.searchSeries(query, 'AsuraScans');
      setProviderResults(results);

      if (results.length === 1) {
        handleSelectProviderSeries(results[0].id);
        notify(`Found match on ${providerId}`, 'success');
      } else if (results.length === 0) {
        notify(`No matches found on ${providerId}`, 'warning');
      }
    } catch (e) {
      console.error(e);
      notify("Failed to search provider.", 'error');
    } finally {
      setProviderLoading(false);
    }
  };

  const handleSearchOnProvider = async (providerId: string) => {
    if (!data) return;
    await searchProvider(providerId, data.title);
  };

  const handleSelectProviderSeries = async (id: string) => {
    setProviderLoading(true);
    const normalizedId = normalizeAsuraInput(id);
    try {
      const details = await api.getSeriesDetails(normalizedId, 'AsuraScans');
      setActiveProviderSeries(details);
      setProviderResults(null); // Clear list to show chapters
      setShowProviderRemap(false);

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

  const startProviderRemap = () => {
    if (!data) return;
    setShowProviderRemap(true);
    setProviderResults([]);
    setManualQuery('');
    setManualProviderUrl('');
    setShowProviderMenu(false);
  };

  const cancelProviderRemap = () => {
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
      chapterNumber: !isNaN(chapterNum) ? chapterNum : undefined,
      chapters: activeProviderSeries.chapters, // Pass the full chapter list for navigation
      seriesTitle: data?.title,
      seriesImage: data?.image,
      source: activeProviderSeries.source || 'AsuraScans'
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

  const handleMarkAllRead = async () => {
    if (!data || !activeProviderSeries) return;
    const chapters = activeProviderSeries.chapters;
    if (chapters.length === 0) return;

    const latest = getLatestChapter(chapters);
    const allIds = chapters.map((chapter) => chapter.id);
    setReadChapterIds(new Set(allIds));

    history.add({
      seriesId: data.source === 'AniList' ? data.id : activeProviderSeries.id,
      anilistId: data.source === 'AniList' ? data.id : linkedAniList?.id,
      providerSeriesId: activeProviderSeries.id,
      seriesTitle: data.title,
      seriesImage: data.image,
      chapterId: latest.id,
      chapterNumber: latest.number,
      chapterTitle: latest.title,
      source: activeProviderSeries.source || 'AsuraScans',
      readChapters: allIds,
    });

    const anilistId = data.source === 'AniList' ? data.id : linkedAniList?.id;
    const numericProgress = parseChapterNumber(latest.number);
    if (user && anilistId && numericProgress !== null) {
      await anilistApi.updateProgress(parseInt(anilistId, 10), Math.floor(numericProgress));
    }

    notify('Marked all chapters as read.', 'success');
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
            <motion.div variants={{ hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1 } }} className="flex flex-col xl:flex-row gap-4 pt-4 items-center xl:items-start border-t border-white/5 mt-6">
              <div className="flex flex-wrap justify-center xl:justify-start gap-4 w-full">
                  {showChapters ? (
                    // Reading Actions
                    <>
                      {resumeChapter && (
                        <button 
                          onClick={() => navigateToReader(resumeChapter)}
                          className="flex-1 min-w-[160px] px-8 py-4 bg-primary/90 hover:bg-primary text-onPrimary font-bold text-lg rounded-xl shadow-lg shadow-primary/25 transition-all transform hover:scale-[1.02] active:scale-95 text-left flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2"
                        >
                          <span className="truncate">
                            {historyMatch ? 'Resume' : 'Continue'} Ch {resumeChapter.number}
                          </span>
                          {historyMatch?.timestamp ? (
                            <span className="text-xs font-semibold text-black/70">
                              {formatTimeAgo(historyMatch.timestamp)}
                            </span>
                          ) : data?.mediaListEntry?.progress ? (
                            <span className="text-xs font-semibold text-black/70">AniList</span>
                          ) : null}
                        </button>
                      )}
                      <button 
                        onClick={() => navigateToReader(activeProviderSeries!.chapters[activeProviderSeries!.chapters.length - 1])}
                        className="flex-1 min-w-[160px] px-8 py-4 bg-primary hover:bg-primaryHover text-onPrimary font-bold text-lg rounded-xl shadow-lg shadow-primary/25 transition-all transform hover:scale-[1.02] active:scale-95 whitespace-nowrap"
                      >
                        Read First
                      </button>
                      <button 
                        onClick={() => navigateToReader(activeProviderSeries!.chapters[0])}
                        className="flex-1 min-w-[160px] px-8 py-4 bg-surfaceHighlight hover:bg-white/10 text-white font-bold text-lg rounded-xl border border-white/10 transition-all hover:border-white/20 whitespace-nowrap"
                      >
                        Read Latest
                      </button>
                    </>
                  ) : (
                    // Source Selection Dropdown
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
                 <div className="text-center py-16 text-gray-400 font-medium animate-pulse text-lg">Searching {selectedProvider} repository...</div>
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
                  <h3 className="text-2xl font-extrabold text-white mb-3">
                    {showProviderRemap ? 'Remap Provider Series' : `Select Series from ${selectedProvider}`}
                  </h3>
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
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8">
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
                    
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto">
                      <button
                        onClick={handleMarkAllRead}
                        className="px-4 py-2.5 rounded-xl bg-white/10 text-sm font-semibold text-white border border-white/10 hover:bg-white/20"
                      >
                        Mark All Read
                      </button>

                      {/* Chapter Search Bar */}
                      <div className="relative w-full sm:w-72 group">
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
                  </div>
                  
                  {filteredChapters.length > 0 ? (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {filteredChapters.slice(0, visibleChapters).map((chapter, idx) => (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx < 20 ? idx * 0.03 : 0 }}
                            key={chapter.id}
                            onClick={() => navigateToReader(chapter)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                navigateToReader(chapter);
                              }
                            }}
                            role="button"
                            tabIndex={0}
                            aria-label={`Open ${chapter.title}`}
                            className="flex items-center justify-between p-4 rounded-xl bg-surface hover:bg-surfaceHighlight border border-white/5 hover:border-white/10 transition-all group text-left cursor-pointer"
                            whileHover={{ x: 5 }}
                          >
                            <div className="flex-1 min-w-0 pr-4">
                              <h4 className={`font-bold text-[15px] transition-colors truncate ${readChapterIds.has(chapter.id) ? 'text-gray-500' : 'text-gray-200 group-hover:text-primary'}`}>
                                {chapter.title.toLowerCase().includes('chapter') || chapter.title.toLowerCase().includes('episode') 
                                  ? chapter.title 
                                  : `Chapter ${chapter.number}${chapter.title ? ` - ${chapter.title}` : ''}`}
                                {readChapterIds.has(chapter.id) && (
                                  <span className="ml-2 text-[9px] uppercase tracking-wider text-gray-500">Read</span>
                                )}
                              </h4>
                              <p className="text-xs font-medium text-gray-500 mt-1.5">{chapter.date}</p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleChapterRead(chapter);
                                }}
                                className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border transition-colors ${
                                  readChapterIds.has(chapter.id)
                                    ? 'border-emerald-400/40 text-emerald-300 bg-emerald-500/10'
                                    : 'border-white/10 text-gray-400 hover:text-white hover:border-white/20'
                                }`}
                              >
                                {readChapterIds.has(chapter.id) ? 'Read' : 'Mark'}
                              </button>
                              <ChevronLeft className="w-5 h-5 text-gray-600 group-hover:text-primary rotate-180 transition-colors" />
                            </div>
                          </motion.div>
                        ))}
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
    </div>
  );
};

export default Details;
