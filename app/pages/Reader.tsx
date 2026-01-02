import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { ChapterPage, Chapter } from '../types';
import { api } from '../lib/api';
import { anilistApi } from '../lib/anilist';
import { history } from '../lib/history';
import { ChevronLeft, ChevronRight, ChevronDown, MenuIcon, SearchIcon } from '../components/Icons';
import { motion, AnimatePresence } from 'framer-motion';

interface ReaderProps {
  data: {
    chapterId: string;
    seriesId: string;
    anilistId?: string;
    chapterNumber?: number;
    chapters: Chapter[];
    // Passed for history context
    seriesTitle?: string;
    seriesImage?: string; 
    source?: 'AniList' | 'AsuraScans';
  };
  onBack: () => void;
  onNavigate: (view: string, data?: any) => void;
}

// Custom Gear Icon for Reader settings
const GearIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const Reader: React.FC<ReaderProps> = ({ data: readerData, onBack, onNavigate }) => {
  const [pages, setPages] = useState<ChapterPage[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Controls Visibility State
  const [controlsVisible, setControlsVisible] = useState(true);
  const [showChapterList, setShowChapterList] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const lastScrollY = useRef(0);
  
  // Settings (Persisted)
  const [maxWidth, setMaxWidth] = useState<'100%' | '75%' | '50%'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('reader_maxWidth') as any) || '100%';
    }
    return '100%';
  });
  
  const [pageGap, setPageGap] = useState<'0px' | '8px' | '24px'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('reader_pageGap') as any) || '0px';
    }
    return '0px';
  });

  // Save Settings
  useEffect(() => {
    localStorage.setItem('reader_maxWidth', maxWidth);
  }, [maxWidth]);

  useEffect(() => {
    localStorage.setItem('reader_pageGap', pageGap);
  }, [pageGap]);

  // Chapter Menu State
  const [chapterSearchQuery, setChapterSearchQuery] = useState('');
  const [visibleChapterCount, setVisibleChapterCount] = useState(50);
  const [readChapters, setReadChapters] = useState<Set<string>>(new Set());
  
  // Progress State
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [trackStatus, setTrackStatus] = useState<'idle' | 'synced' | 'error' | 'syncing'>('idle');

  // Refs
  const imageRefs = useRef<(HTMLImageElement | null)[]>([]);
  const progressBarRef = useRef<HTMLDivElement>(null);
  // FIX: Using ReturnType<typeof setTimeout> instead of NodeJS.Timeout for compatibility
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldScrollRef = useRef<number | null>(null);

  // Calculate Navigation
  const currentChapterIndex = readerData.chapters ? readerData.chapters.findIndex(c => c.id === readerData.chapterId) : -1;
  const currentChapter = currentChapterIndex !== -1 ? readerData.chapters[currentChapterIndex] : null;
  
  const nextChapter = currentChapterIndex > 0 ? readerData.chapters[currentChapterIndex - 1] : null;
  const prevChapter = currentChapterIndex !== -1 && currentChapterIndex < readerData.chapters.length - 1 
    ? readerData.chapters[currentChapterIndex + 1] 
    : null;

  // Initial Load and Resume Position
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setPages([]);
      setCurrentPage(1);
      setTrackStatus('idle');
      setControlsVisible(true);
      setShowChapterList(false);
      setShowSettings(false);
      shouldScrollRef.current = null;
      
      try {
        const data = await api.getChapterImages(readerData.chapterId);
        setPages(data);
        setTotalPages(data.length);

        // Check history for saved page
        const savedPage = history.getPage(readerData.seriesId, readerData.chapterId);
        if (savedPage > 1 && savedPage <= data.length) {
            setCurrentPage(savedPage);
            shouldScrollRef.current = savedPage;
        }

        // Initialize read chapters set
        const localHistory = history.get();
        const readIds = new Set(localHistory.filter(h => h.seriesId === readerData.seriesId).map(h => h.chapterId));
        setReadChapters(readIds);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [readerData.chapterId]);

  // Handle Scroll Restoration
  useEffect(() => {
     if (!loading && pages.length > 0 && shouldScrollRef.current) {
        const pageToScroll = shouldScrollRef.current;
        shouldScrollRef.current = null; // Consume
        
        // Small timeout to allow render
        setTimeout(() => {
           const el = imageRefs.current[pageToScroll];
           if (el) {
              el.scrollIntoView({ behavior: 'instant', block: 'start' });
           }
        }, 100);
     }
  }, [loading, pages]);

  // Unified Progress Saving (Local + AniList)
  const saveProgress = useCallback((forceSync = false) => {
    if (!currentChapter || loading) return;

    // 1. Always Save to Local Storage (Instant)
    if (readerData.seriesTitle) {
      history.add({
        seriesId: readerData.seriesId,
        seriesTitle: readerData.seriesTitle,
        seriesImage: readerData.seriesImage || '',
        chapterId: readerData.chapterId,
        chapterNumber: currentChapter.number,
        chapterTitle: currentChapter.title,
        source: readerData.source || 'AsuraScans',
        page: currentPage
      });

      // Update local read state
      setReadChapters(prev => {
        if (!prev.has(readerData.chapterId)) {
            const next = new Set(prev);
            next.add(readerData.chapterId);
            return next;
        }
        return prev;
      });
    }

    // 2. Save to AniList (Debounced)
    if (readerData.anilistId && readerData.chapterNumber) {
      // Clear any pending sync to avoid spamming API
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);

      // Determine if we should attempt a sync
      // Threshold: 80% of pages read OR forceSync is true
      const shouldSync = forceSync || (totalPages > 0 && currentPage > (totalPages * 0.8));

      if (shouldSync && trackStatus !== 'synced') {
        // Debounce API call by 2 seconds to group rapid scroll events
        // unless forced, then short delay
        const delay = forceSync ? 100 : 2000;

        syncTimeoutRef.current = setTimeout(async () => {
          setTrackStatus('syncing');
          const success = await anilistApi.updateProgress(
            parseInt(readerData.anilistId!), 
            readerData.chapterNumber!
          );
          
          if (success) {
            setTrackStatus('synced');
          } else {
            setTrackStatus('error');
          }
        }, delay);
      }
    }
  }, [currentPage, totalPages, readerData, currentChapter, loading, trackStatus]);

  // Trigger Save on Page Change
  useEffect(() => {
    saveProgress(false);
  }, [currentPage, saveProgress]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;

      if (e.key.toLowerCase() === 'n') {
        if (nextChapter) handleNavigateChapter(nextChapter);
      }
      if (e.key.toLowerCase() === 'p') {
        if (prevChapter) handleNavigateChapter(prevChapter);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextChapter, prevChapter]);

  // Reset chapter menu state when opened
  useEffect(() => {
    if (showChapterList) {
      setChapterSearchQuery('');
      setVisibleChapterCount(50);
      setShowSettings(false);
    }
  }, [showChapterList]);

  // Scroll Visibility Logic
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const lastY = lastScrollY.current;
      lastScrollY.current = currentScrollY;

      if (progressBarRef.current) {
        const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
        const progress = totalHeight > 0 ? (currentScrollY / totalHeight) * 100 : 0;
        progressBarRef.current.style.width = `${Math.min(100, Math.max(0, progress))}%`;
      }

      if (currentScrollY < 100) {
        setControlsVisible(true);
        return;
      }
      
      if (Math.abs(currentScrollY - lastY) < 10) return;

      if (currentScrollY > lastY) {
        setControlsVisible(false);
        setShowChapterList(false);
        setShowSettings(false);
      } else {
        setControlsVisible(true);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Intersection Observer
  useEffect(() => {
    if (loading || pages.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const pageNum = Number(entry.target.getAttribute('data-page'));
            if (!isNaN(pageNum)) {
              setCurrentPage(pageNum);
            }
          }
        });
      },
      {
        root: null,
        rootMargin: '0px 0px -50% 0px',
        threshold: 0
      }
    );

    imageRefs.current.forEach((img) => {
      if (img) observer.observe(img);
    });

    return () => observer.disconnect();
  }, [loading, pages]);

  const handleNavigateChapter = (chapter: Chapter) => {
    // Force a sync before leaving if we haven't synced yet
    saveProgress(true);

    const chapterNum = parseFloat(chapter.number.replace(/[^0-9.]/g, ''));
    setShowChapterList(false);
    onNavigate('reader', {
      ...readerData,
      chapterId: chapter.id,
      chapterNumber: !isNaN(chapterNum) ? chapterNum : undefined
    });
  };

  const toggleControls = (e: React.MouseEvent) => {
    setControlsVisible(prev => !prev);
    if (controlsVisible) {
      setShowChapterList(false);
      setShowSettings(false);
    }
  };

  const filteredChapters = useMemo(() => {
    if (!chapterSearchQuery) return readerData.chapters;
    const lowerQuery = chapterSearchQuery.toLowerCase();
    return readerData.chapters.filter(ch => 
      ch.number.toLowerCase().includes(lowerQuery) || 
      ch.title.toLowerCase().includes(lowerQuery)
    );
  }, [readerData.chapters, chapterSearchQuery]);

  const chaptersToRender = filteredChapters.slice(0, visibleChapterCount);

  const handleChapterListScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 200) {
       if (visibleChapterCount < filteredChapters.length) {
         setVisibleChapterCount(prev => prev + 50);
       }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-primary animate-pulse">Loading Chapter...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center relative">
      
      {/* Scroll Progress Bar */}
      <div className="fixed bottom-0 left-0 right-0 h-1 z-[60] pointer-events-none">
        <div className="h-full w-full bg-transparent">
          <div 
            ref={progressBarRef}
            className="h-full bg-primary shadow-[0_0_10px_rgba(var(--c-primary),0.8)] transition-all duration-75 ease-out rounded-r-full"
            style={{ width: '0%' }}
          />
        </div>
      </div>

      {/* --- Top Header (Floating) --- */}
      <div 
        className={`fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-md border-b border-white/10 px-4 py-3 transition-transform duration-300 ease-in-out ${controlsVisible ? 'translate-y-0' : '-translate-y-full'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button onClick={onBack} className="text-gray-300 hover:text-white flex items-center gap-2 px-2 py-1 rounded-md hover:bg-white/5 transition-colors">
            <ChevronLeft className="w-5 h-5" />
            <span className="hidden sm:inline font-medium">Back</span>
          </button>
          
          <div className="flex flex-col items-center absolute left-1/2 -translate-x-1/2">
             <div className="text-sm font-bold text-white max-w-[150px] sm:max-w-xs truncate">
                {currentChapter ? `Chapter ${currentChapter.number}` : ''}
             </div>
             <div className="text-xs text-gray-400">
                Page {currentPage}/{totalPages}
             </div>
          </div>

          <div className="flex items-center gap-2">
             {trackStatus === 'syncing' && (
                <span className="hidden sm:inline text-[10px] text-blue-400 font-medium tracking-wide mr-2 animate-pulse">Syncing...</span>
             )}
             {trackStatus === 'synced' && (
               <span className="hidden sm:inline text-[10px] text-green-400 font-medium tracking-wide mr-2">Synced</span>
             )}
             {trackStatus === 'error' && (
               <span className="hidden sm:inline text-[10px] text-red-400 font-medium tracking-wide mr-2">Sync Fail</span>
             )}
             
             {/* Settings Toggle */}
             <div className="relative">
                <button 
                  onClick={() => { setShowSettings(!showSettings); setShowChapterList(false); }}
                  className={`p-2 rounded-full transition-colors ${showSettings ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                >
                  <GearIcon className="w-5 h-5" />
                </button>
                
                {/* Settings Popup */}
                {showSettings && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-[#18181b] rounded-xl shadow-2xl border border-white/10 ring-1 ring-black/50 p-4 animate-fade-in flex flex-col gap-4 z-50">
                     <div>
                       <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Image Width</label>
                       <div className="flex bg-surfaceHighlight rounded-lg p-1 border border-white/5">
                          {['100%', '75%', '50%'].map(w => (
                             <button
                               key={w}
                               onClick={() => setMaxWidth(w as any)}
                               className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${maxWidth === w ? 'bg-primary text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
                             >
                               {w === '100%' ? 'Full' : w}
                             </button>
                          ))}
                       </div>
                     </div>
                     <div>
                       <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Page Gap</label>
                       <div className="flex bg-surfaceHighlight rounded-lg p-1 border border-white/5">
                          {['0px', '8px', '24px'].map(g => (
                             <button
                               key={g}
                               onClick={() => setPageGap(g as any)}
                               className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${pageGap === g ? 'bg-primary text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
                             >
                               {g === '0px' ? 'None' : g === '8px' ? 'S' : 'L'}
                             </button>
                          ))}
                       </div>
                     </div>
                     <div className="pt-2 border-t border-white/5 text-[10px] text-gray-500 text-center">
                        Pro tip: Use 'N' and 'P' keys
                     </div>
                  </div>
                )}
             </div>
          </div>
        </div>
      </div>

      {/* --- Bottom Navigation Bar (Floating) --- */}
      <div 
        className={`fixed bottom-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-md border-t border-white/10 px-4 py-4 transition-transform duration-300 ease-in-out ${controlsVisible ? 'translate-y-0' : 'translate-y-full'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
            <button 
              onClick={() => prevChapter && handleNavigateChapter(prevChapter)}
              disabled={!prevChapter}
              className={`p-3 rounded-full transition-all ${
                prevChapter 
                  ? 'bg-surfaceHighlight hover:bg-white/20 text-white' 
                  : 'bg-transparent text-gray-700 cursor-not-allowed'
              }`}
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            <div className="relative flex-1 max-w-xs">
              <button 
                onClick={() => { setShowChapterList(!showChapterList); setShowSettings(false); }}
                className="w-full flex items-center justify-center gap-2 bg-surfaceHighlight hover:bg-white/10 border border-white/10 text-white font-medium py-3 px-4 rounded-xl transition-all active:scale-95"
              >
                <span className="truncate max-w-[150px] sm:max-w-[200px]">
                  {currentChapter ? `Chapter ${currentChapter.number}` : 'Select Chapter'}
                </span>
                <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${showChapterList ? 'rotate-180' : ''}`} />
              </button>

              {/* Chapter List Popup */}
              <AnimatePresence>
                {showChapterList && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, x: '-50%' }}
                    animate={{ opacity: 1, y: 0, x: '-50%' }}
                    exit={{ opacity: 0, y: 10, x: '-50%' }}
                    transition={{ duration: 0.2 }}
                    className="absolute bottom-full left-1/2 mb-4 w-64 xs:w-72 max-h-[60vh] flex flex-col bg-[#18181b] rounded-xl shadow-2xl border border-white/10 ring-1 ring-black/50 z-50"
                  >
                    
                    <div className="p-3 border-b border-white/10 bg-[#18181b] rounded-t-xl z-20">
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-gray-500">
                          <SearchIcon className="w-3.5 h-3.5" />
                        </div>
                        <input 
                          autoFocus
                          type="text" 
                          placeholder="Search chapter..." 
                          className="w-full bg-surfaceHighlight/50 border border-white/5 rounded-lg py-2 pl-9 pr-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all placeholder-gray-500"
                          value={chapterSearchQuery}
                          onChange={(e) => setChapterSearchQuery(e.target.value)}
                          onClick={(e) => e.stopPropagation()} 
                        />
                      </div>
                    </div>

                    <div 
                      className="overflow-y-auto flex-1 min-h-0"
                      onScroll={handleChapterListScroll}
                    >
                      <div className="py-1">
                        {chaptersToRender.length > 0 ? (
                          chaptersToRender.map((ch) => {
                            const isRead = readChapters.has(ch.id);
                            return (
                              <button
                                key={ch.id}
                                onClick={() => handleNavigateChapter(ch)}
                                className={`w-full text-left px-4 py-3 text-sm hover:bg-white/5 transition-colors border-l-2 ${
                                  ch.id === readerData.chapterId 
                                    ? 'border-primary text-primary bg-primary/5 font-medium' 
                                    : 'border-transparent text-gray-300'
                                }`}
                              >
                                <div className="flex justify-between items-baseline">
                                  <span className={isRead ? 'opacity-50' : ''}>
                                    Chapter {ch.number}
                                    {isRead && <span className="ml-2 text-[9px] uppercase tracking-wider text-gray-500">Read</span>}
                                  </span>
                                  <span className="text-[10px] text-gray-600 ml-2">{ch.date}</span>
                                </div>
                              </button>
                            );
                          })
                        ) : (
                          <div className="py-6 text-center text-gray-500 text-sm">
                             No chapters found.
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button 
              onClick={() => nextChapter && handleNavigateChapter(nextChapter)}
              disabled={!nextChapter}
              className={`p-3 rounded-full transition-all ${
                nextChapter 
                  ? 'bg-surfaceHighlight hover:bg-white/20 text-white' 
                  : 'bg-transparent text-gray-700 cursor-not-allowed'
              }`}
            >
              <ChevronRight className="w-6 h-6" />
            </button>
        </div>
      </div>

      {/* --- Main Reader Content --- */}
      <div 
        className="w-full min-h-screen pt-20 pb-32 flex flex-col items-center transition-all duration-300" 
        style={{ gap: pageGap }}
        onClick={toggleControls}
      >
        <div 
          className="w-full flex flex-col items-center transition-[max-width] duration-300"
          style={{ maxWidth: maxWidth === '100%' ? '100%' : maxWidth === '75%' ? '1000px' : '700px' }}
        >
          {pages.map((page) => (
            <img
              key={page.page}
              ref={(el) => { imageRefs.current[page.page] = el; }}
              data-page={page.page}
              src={page.src}
              alt={`Page ${page.page}`}
              className="w-full h-auto select-none bg-surfaceHighlight/10 min-h-[500px]"
              loading="lazy"
            />
          ))}
        </div>

        {/* End of Chapter Navigation */}
        <div className="w-full px-4 py-12 flex flex-col items-center gap-6 text-center">
            <h3 className="text-white font-medium text-lg">
               {nextChapter ? 'Continue to next chapter?' : 'You have reached the latest chapter.'}
            </h3>
            
            <div className="flex gap-4">
              {prevChapter && (
                <button 
                  onClick={() => handleNavigateChapter(prevChapter)}
                  className="px-6 py-3 bg-surfaceHighlight hover:bg-white/10 border border-white/10 rounded-lg text-white transition-colors"
                >
                  Previous Chapter
                </button>
              )}
              
              {nextChapter ? (
                <button 
                  onClick={() => handleNavigateChapter(nextChapter)}
                  className="px-6 py-3 bg-primary hover:bg-primaryHover text-onPrimary font-bold rounded-lg shadow-lg shadow-primary/20 transition-transform transform hover:scale-105"
                >
                  Next Chapter
                </button>
              ) : (
                <button 
                   onClick={onBack}
                   className="px-6 py-3 bg-surfaceHighlight hover:bg-white/10 border border-white/10 rounded-lg text-white transition-colors"
                >
                   Return to Series
                </button>
              )}
            </div>
        </div>
      </div>

    </div>
  );
};

export default Reader;