import React, {
  useEffect,
  useState,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { ChapterPage, Chapter } from "../types";
import { api } from "../lib/api";
import { anilistApi } from "../lib/anilist";
import { history } from "../lib/history";
import { Providers, type Source, isProviderSource } from "../lib/providers";
import { desktopApi } from "../lib/desktop";
import { useMediaQuery } from "../lib/useMediaQuery";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  SearchIcon,
} from "../components/Icons";
import { motion, AnimatePresence } from "framer-motion";

interface ReaderProps {
  data: {
    chapterId: string;
    seriesId: string;
    anilistId?: string;
    providerSeriesId?: string;
    providerMangaId?: number;
    chapterNumber?: number;
    chapters?: Chapter[];
    // Passed for history context
    seriesTitle?: string;
    seriesImage?: string;
    source?: Source;
    seriesStatus?: string;
  };
  onBack: () => void;
  onNavigate: (view: string, data?: any, options?: { replace?: boolean }) => void;
}

// Custom Gear Icon for Reader settings
const GearIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const Reader: React.FC<ReaderProps> = ({
  data: readerData,
  onBack,
  onNavigate,
}) => {
  const [pages, setPages] = useState<ChapterPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [chapterList, setChapterList] = useState<Chapter[]>(
    readerData.chapters ?? []
  );
  const [resolvedTitle, setResolvedTitle] = useState<string | undefined>(
    readerData.seriesTitle
  );
  const [resolvedImage, setResolvedImage] = useState<string | undefined>(
    readerData.seriesImage
  );
  const [resolvedSource, setResolvedSource] = useState<Source | undefined>(
    readerData.source
  );
  const [resolvedStatus, setResolvedStatus] = useState<string | undefined>(
    readerData.seriesStatus
  );
  const [resolvedProviderMangaId, setResolvedProviderMangaId] = useState<
    number | undefined
  >(readerData.providerMangaId);

  // Controls Visibility State
  const [controlsVisible, setControlsVisible] = useState(true);
  const [chapterListAnchor, setChapterListAnchor] = useState<
    "top" | "bottom" | null
  >(null);
  const [showSettings, setShowSettings] = useState(false);
  const lastScrollY = useRef(0);
  const isDesktop =
    desktopApi.isAvailable &&
    !(typeof navigator !== "undefined" && navigator.platform.toLowerCase().includes("mac"));
  const isPhoneLayout = useMediaQuery("(max-width: 768px)");
  const isMobileReader = isPhoneLayout && !isDesktop;
  const showChapterList = chapterListAnchor !== null;

  // Settings (Persisted)
  const [maxWidth, setMaxWidth] = useState<"100%" | "75%" | "50%">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("reader_maxWidth") as any) || "50%";
    }
    return "50%";
  });

  const [pageGap, setPageGap] = useState<"0px" | "8px" | "24px">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("reader_pageGap") as any) || "0px";
    }
    return "0px";
  });

  const [prefetchEnabled, setPrefetchEnabled] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("reader_prefetch_enabled") === "true";
    }
    return false;
  });

  const [prefetchCount, setPrefetchCount] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const raw = localStorage.getItem("reader_prefetch_count");
      const parsed = raw ? Number.parseInt(raw, 10) : 2;
      return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 5) : 2;
    }
    return 2;
  });

  // Save Settings
  useEffect(() => {
    localStorage.setItem("reader_maxWidth", maxWidth);
  }, [maxWidth]);

  useEffect(() => {
    localStorage.setItem("reader_pageGap", pageGap);
  }, [pageGap]);

  useEffect(() => {
    localStorage.setItem("reader_prefetch_enabled", String(prefetchEnabled));
  }, [prefetchEnabled]);

  useEffect(() => {
    localStorage.setItem("reader_prefetch_count", String(prefetchCount));
  }, [prefetchCount]);

  // Chapter Menu State
  const [chapterSearchQuery, setChapterSearchQuery] = useState("");
  const [visibleChapterCount, setVisibleChapterCount] = useState(50);
  const [readChapters, setReadChapters] = useState<Set<string>>(new Set());

  // Progress State
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [trackStatus, setTrackStatus] = useState<
    "idle" | "synced" | "error" | "syncing"
  >("idle");

  // Refs
  const imageRefs = useRef<(HTMLImageElement | null)[]>([]);
  // FIX: Using ReturnType<typeof setTimeout> instead of NodeJS.Timeout for compatibility
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldScrollRef = useRef<number | null>(null);
  const lastSeriesIdRef = useRef(readerData.seriesId);
  const activeChapterRef = useRef<HTMLButtonElement | null>(null);
  const prefetchedChaptersRef = useRef<Record<string, number>>({});

  // Calculate Navigation
  const currentChapterIndex =
    chapterList.length > 0
      ? chapterList.findIndex((c) => c.id === readerData.chapterId)
      : -1;
  const currentChapter =
    currentChapterIndex !== -1 ? chapterList[currentChapterIndex] : null;
  const historyKey = readerData.anilistId ?? readerData.seriesId;
  const historyMatch = {
    seriesId: historyKey,
    anilistId: readerData.anilistId,
    providerSeriesId: readerData.providerSeriesId,
    title: resolvedTitle,
  };
  const PREFETCH_HISTORY_KEY = "reader_prefetch_history_v1";
  const PREFETCH_WINDOW_MS = 24 * 60 * 60 * 1000;
  const ACTIVE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
  const providerSeriesId =
    readerData.providerSeriesId ||
    (!/^\d+$/.test(readerData.seriesId) ? readerData.seriesId : undefined);

  const isSeriesFinished = (status?: string) =>
    status ? /complete|finished|ended/i.test(status) : false;

  const savePrefetchHistory = () => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(
        PREFETCH_HISTORY_KEY,
        JSON.stringify(prefetchedChaptersRef.current)
      );
    } catch {
      // Ignore storage errors
    }
  };

  const wasPrefetchedRecently = (chapterId: string) => {
    const last = prefetchedChaptersRef.current[chapterId] ?? 0;
    return Date.now() - last < PREFETCH_WINDOW_MS;
  };

  const markPrefetched = (chapterId: string) => {
    prefetchedChaptersRef.current[chapterId] = Date.now();
    savePrefetchHistory();
  };

  const nextChapter =
    currentChapterIndex > 0 ? chapterList[currentChapterIndex - 1] : null;
  const prevChapter =
    currentChapterIndex !== -1 && currentChapterIndex < chapterList.length - 1
      ? chapterList[currentChapterIndex + 1]
      : null;

  useEffect(() => {
    setChapterList(readerData.chapters ?? []);

    if (readerData.seriesId !== lastSeriesIdRef.current) {
      lastSeriesIdRef.current = readerData.seriesId;
      setResolvedTitle(readerData.seriesTitle);
      setResolvedImage(readerData.seriesImage);
      setResolvedSource(readerData.source);
      setResolvedStatus(readerData.seriesStatus);
      setResolvedProviderMangaId(readerData.providerMangaId);
      return;
    }

    if (readerData.seriesTitle) setResolvedTitle(readerData.seriesTitle);
    if (readerData.seriesImage) setResolvedImage(readerData.seriesImage);
    if (readerData.source) setResolvedSource(readerData.source);
    if (readerData.seriesStatus) setResolvedStatus(readerData.seriesStatus);
    if (readerData.providerMangaId)
      setResolvedProviderMangaId(readerData.providerMangaId);
  }, [
    readerData.seriesId,
    readerData.chapters,
    readerData.seriesTitle,
    readerData.seriesImage,
    readerData.source,
    readerData.seriesStatus,
    readerData.providerMangaId,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(PREFETCH_HISTORY_KEY);
      prefetchedChaptersRef.current = raw
        ? (JSON.parse(raw) as Record<string, number>)
        : {};
    } catch {
      prefetchedChaptersRef.current = {};
    }
  }, []);

  useEffect(() => {
    if (chapterList.length > 0) return;
    let cancelled = false;

    const loadChapters = async () => {
      try {
        let details = null;
        const providerSource =
          readerData.source ?? resolvedSource ?? 'AniList';
        const provider = isProviderSource(providerSource)
          ? providerSource
          : Providers.AsuraScans;
        if (readerData.providerSeriesId) {
          details = await api.getSeriesDetails(
            readerData.providerSeriesId,
            provider
          );
        } else if (readerData.anilistId) {
          details = await api.getMappedProviderDetails(
            readerData.anilistId,
            provider
          );
        } else if (readerData.seriesId) {
          const isAniListId = /^\d+$/.test(readerData.seriesId);
          details = isAniListId
            ? await api.getMappedProviderDetails(
                readerData.seriesId,
                provider
              )
            : await api.getSeriesDetails(readerData.seriesId, provider);
        }

        if (!cancelled && details) {
          setChapterList(details.chapters || []);
          setResolvedTitle((prev) => prev || details.title);
          setResolvedImage((prev) => prev || details.image);
          setResolvedSource((prev) => prev || details.source);
          setResolvedStatus((prev) => prev || details.status);
          setResolvedProviderMangaId((prev) => prev || details.providerMangaId);
        }
      } catch (e) {
        console.warn("Failed to hydrate chapters for reader", e);
      }
    };

    void loadChapters();
    return () => {
      cancelled = true;
    };
  }, [
    chapterList.length,
    readerData.providerSeriesId,
    readerData.anilistId,
    readerData.seriesId,
  ]);

  // Initial Load and Resume Position
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setPages([]);
      setCurrentPage(1);
      setTrackStatus("idle");
      setControlsVisible(true);
      setChapterListAnchor(null);
      setShowSettings(false);
      shouldScrollRef.current = null;

      try {
        const data = await api.getChapterImages(readerData.chapterId);
        setPages(data);
        setTotalPages(data.length);

        // Check history for saved page
        const savedPage = history.getPage(historyKey, readerData.chapterId);
        if (savedPage > 1 && savedPage <= data.length) {
          setCurrentPage(savedPage);
          shouldScrollRef.current = savedPage;
        } else {
          shouldScrollRef.current = 1;
        }

        // Initialize read chapters set
        const readIds = new Set(history.getReadChapters(historyMatch));
        setReadChapters(readIds);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [readerData.chapterId, historyKey]);

  // Handle Scroll Restoration
  useEffect(() => {
    if (!loading && pages.length > 0 && shouldScrollRef.current) {
      const pageToScroll = shouldScrollRef.current;
      shouldScrollRef.current = null; // Consume

      // Small timeout to allow render
      setTimeout(() => {
        const el = imageRefs.current[pageToScroll];
        if (el) {
          el.scrollIntoView({ behavior: "instant", block: "start" });
        }
      }, 100);
    }
  }, [loading, pages]);

  // Unified Progress Saving (Local + AniList)
  const saveProgress = useCallback(
    (forceSync = false) => {
      if (!currentChapter || loading) return;

      // 1. Always Save to Local Storage (Instant)
      if (resolvedTitle) {
        history.add({
          seriesId: historyKey,
          anilistId: readerData.anilistId,
          providerSeriesId: readerData.providerSeriesId,
          seriesTitle: resolvedTitle,
          seriesImage: resolvedImage || "",
          chapterId: readerData.chapterId,
          chapterNumber: currentChapter.number,
          chapterTitle: currentChapter.title,
          source: resolvedSource || Providers.AsuraScans,
          page: currentPage,
        });

        // Update local read state
        setReadChapters((prev) => {
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
        const shouldSync =
          forceSync || (totalPages > 0 && currentPage > totalPages * 0.8);

        if (shouldSync && trackStatus !== "synced") {
          // Debounce API call by 2 seconds to group rapid scroll events
          // unless forced, then short delay
          const delay = forceSync ? 100 : 2000;

          syncTimeoutRef.current = setTimeout(async () => {
            setTrackStatus("syncing");
            const success = await anilistApi.updateProgress(
              parseInt(readerData.anilistId!),
              readerData.chapterNumber!
            );

            if (success) {
              setTrackStatus("synced");
            } else {
              setTrackStatus("error");
            }
          }, delay);
        }
      }
    },
    [currentPage, totalPages, readerData, currentChapter, loading, trackStatus]
  );

  // Trigger Save on Page Change
  useEffect(() => {
    saveProgress(false);
  }, [currentPage, saveProgress]);

  useEffect(() => {
    if (!prefetchEnabled) return;
    if (!providerSeriesId) return;
    if (chapterList.length === 0) return;
    if (currentChapterIndex <= 0) return;
    if (isSeriesFinished(resolvedStatus)) return;

    const lastReadAt = history.getItem(historyMatch)?.timestamp ?? 0;
    if (lastReadAt && Date.now() - lastReadAt > ACTIVE_WINDOW_MS) {
      return;
    }

    const candidates: Chapter[] = [];
    for (let i = 1; i <= prefetchCount; i += 1) {
      const next = chapterList[currentChapterIndex - i];
      if (!next) continue;
      if (readChapters.has(next.id)) continue;
      if (wasPrefetchedRecently(next.id)) continue;
      candidates.push(next);
    }

    if (candidates.length === 0) return;

    const prefetch = async () => {
      for (const chapter of candidates) {
        try {
          await api.queueDownload({
            providerSeriesId,
            chapterId: chapter.id,
            chapterUrl: chapter.url,
            chapterNumber: chapter.number,
            chapterTitle: chapter.title,
            seriesTitle: resolvedTitle,
            seriesImage: resolvedImage,
            seriesStatus: resolvedStatus,
            seriesChapters: chapterList.length
              ? String(chapterList.length)
              : undefined,
          });
          markPrefetched(chapter.id);
        } catch (error) {
          console.warn("Prefetch failed", error);
        }
      }
    };

    void prefetch();
  }, [
    prefetchEnabled,
    prefetchCount,
    chapterList,
    currentChapterIndex,
    readChapters,
    providerSeriesId,
    resolvedStatus,
    resolvedTitle,
    resolvedImage,
  ]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT") return;

      if (e.key.toLowerCase() === "n") {
        if (nextChapter) handleNavigateChapter(nextChapter);
      }
      if (e.key.toLowerCase() === "p") {
        if (prevChapter) handleNavigateChapter(prevChapter);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [nextChapter, prevChapter]);

  // Reset chapter menu state when opened
  useEffect(() => {
    if (showChapterList) {
      setChapterSearchQuery("");
      setShowSettings(false);
    }
  }, [showChapterList]);

  useEffect(() => {
    if (!showChapterList) return;
    const timeout = window.setTimeout(() => {
      activeChapterRef.current?.scrollIntoView({ block: "center" });
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [showChapterList, visibleChapterCount, currentChapterIndex]);

  // Scroll Visibility Logic
  useEffect(() => {
    if (isMobileReader) return;
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const lastY = lastScrollY.current;
      lastScrollY.current = currentScrollY;

      if (Math.abs(currentScrollY - lastY) < 10) return;

      if (currentScrollY > lastY) {
        setControlsVisible(false);
        setChapterListAnchor(null);
        setShowSettings(false);
      } else {
        setControlsVisible(true);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isMobileReader]);

  // Intersection Observer
  useEffect(() => {
    if (loading || pages.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const pageNum = Number(entry.target.getAttribute("data-page"));
            if (!isNaN(pageNum)) {
              setCurrentPage(pageNum);
            }
          }
        });
      },
      {
        root: null,
        rootMargin: "0px 0px -50% 0px",
        threshold: 0,
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

    const chapterNum = parseFloat(chapter.number.replace(/[^0-9.]/g, ""));
    setChapterListAnchor(null);
    onNavigate(
      "reader",
      {
        ...readerData,
        chapters: chapterList,
        seriesTitle: resolvedTitle ?? readerData.seriesTitle,
        seriesImage: resolvedImage ?? readerData.seriesImage,
        source: resolvedSource ?? readerData.source,
        seriesStatus: resolvedStatus ?? readerData.seriesStatus,
        providerMangaId: resolvedProviderMangaId ?? readerData.providerMangaId,
        chapterId: chapter.id,
        chapterNumber: !isNaN(chapterNum) ? chapterNum : undefined,
      },
      { replace: true },
    );
  };

  const toggleControls = (e: React.MouseEvent) => {
    if (isMobileReader) {
      if (showSettings) setShowSettings(false);
      if (showChapterList) setChapterListAnchor(null);
      return;
    }
    setControlsVisible((prev) => {
      const next = !prev;
      if (next) {
        setChapterListAnchor(null);
        setShowSettings(false);
      }
      return next;
    });
  };

  const toggleChapterList = (anchor: "top" | "bottom") => {
    setChapterListAnchor((prev) => (prev === anchor ? null : anchor));
    setShowSettings(false);
  };

  const filteredChapters = useMemo(() => {
    if (!chapterSearchQuery) return chapterList;
    const lowerQuery = chapterSearchQuery.toLowerCase();
    const filtered = chapterList.filter(
      (ch) =>
        ch.number.toLowerCase().includes(lowerQuery) ||
        ch.title.toLowerCase().includes(lowerQuery)
    );
    const queryNum = parseFloat(chapterSearchQuery);
    return filtered.sort((a, b) => {
      if (a.number === chapterSearchQuery) return -1;
      if (b.number === chapterSearchQuery) return 1;

      const aNum = parseFloat(a.number);
      const bNum = parseFloat(b.number);

      if (!isNaN(queryNum) && !isNaN(aNum) && !isNaN(bNum)) {
        const distA = Math.abs(aNum - queryNum);
        const distB = Math.abs(bNum - queryNum);
        if (distA !== distB) return distA - distB;
      }
      return 0;
    });
  }, [chapterList, chapterSearchQuery]);

  const chaptersToRender = filteredChapters.slice(0, visibleChapterCount);

  useEffect(() => {
    if (!showChapterList) return;
    if (chapterSearchQuery) {
      setVisibleChapterCount(Math.max(1, filteredChapters.length));
      return;
    }
    const baseCount = isMobileReader ? 24 : 50;
    const buffer = isMobileReader ? 6 : 10;
    setVisibleChapterCount(Math.max(baseCount, currentChapterIndex + buffer));
  }, [
    chapterSearchQuery,
    currentChapterIndex,
    filteredChapters.length,
    isMobileReader,
    showChapterList,
  ]);

  const handleChapterListScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 200) {
      if (visibleChapterCount < filteredChapters.length) {
        setVisibleChapterCount((prev) => prev + 50);
      }
    }
  };

  const topHeaderContent = (
    <div className="max-w-4xl mx-auto flex items-center justify-between relative">
      <button
        onClick={onBack}
        className="text-gray-300 hover:text-white flex items-center gap-2 px-2 py-1 rounded-md hover:bg-white/5 transition-colors"
      >
        <ChevronLeft className="w-5 h-5" />
        <span className="hidden sm:inline font-medium">Back</span>
      </button>

      <div className="flex flex-col items-center absolute left-1/2 -translate-x-1/2">
        <div className="text-sm font-bold text-white max-w-[150px] sm:max-w-xs truncate">
          {currentChapter ? `Chapter ${currentChapter.number}` : ""}
        </div>
        <div className="text-xs text-gray-400">
          Page {currentPage}/{totalPages}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {trackStatus === "syncing" && (
          <span className="hidden sm:inline text-[10px] text-blue-400 font-medium tracking-wide mr-2 animate-pulse">
            Syncing...
          </span>
        )}
        {trackStatus === "synced" && (
          <span className="hidden sm:inline text-[10px] text-green-400 font-medium tracking-wide mr-2">
            Synced
          </span>
        )}
        {trackStatus === "error" && (
          <span className="hidden sm:inline text-[10px] text-red-400 font-medium tracking-wide mr-2">
            Sync Fail
          </span>
        )}

        {/* Settings Toggle */}
        <div className="relative">
          <button
            onClick={() => {
              setShowSettings(!showSettings);
              setChapterListAnchor(null);
            }}
            className={`p-2 rounded-full transition-colors ${
              showSettings
                ? "bg-white/10 text-white"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <GearIcon className="w-5 h-5" />
          </button>

          {/* Settings Popup */}
          {showSettings && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-surface rounded-xl shadow-2xl border border-white/10 ring-1 ring-black/50 p-4 animate-fade-in flex flex-col gap-4 z-50">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">
                  Image Width
                </label>
                <div className="flex bg-surfaceHighlight rounded-lg p-1 border border-white/5">
                  {["100%", "75%", "50%"].map((w) => (
                    <button
                      key={w}
                      onClick={() => setMaxWidth(w as any)}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${
                        maxWidth === w
                          ? "bg-primary text-white shadow-sm"
                          : "text-gray-400 hover:text-white"
                      }`}
                    >
                      {w === "100%" ? "Full" : w}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">
                  Page Gap
                </label>
                <div className="flex bg-surfaceHighlight rounded-lg p-1 border border-white/5">
                  {["0px", "8px", "24px"].map((g) => (
                    <button
                      key={g}
                      onClick={() => setPageGap(g as any)}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${
                        pageGap === g
                          ? "bg-primary text-white shadow-sm"
                          : "text-gray-400 hover:text-white"
                      }`}
                    >
                      {g === "0px" ? "None" : g === "8px" ? "S" : "L"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">
                  Smart Prefetch
                </label>
                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => setPrefetchEnabled((prev) => !prev)}
                    className={`px-3 py-2 rounded-lg text-xs font-bold border transition-colors ${
                      prefetchEnabled
                        ? "bg-primary text-white border-primary"
                        : "bg-surfaceHighlight text-gray-400 border-white/10 hover:text-white"
                    }`}
                  >
                    {prefetchEnabled ? "On" : "Off"}
                  </button>
                  <div className="flex bg-surfaceHighlight rounded-lg p-1 border border-white/5 flex-1">
                    {[1, 2, 3, 5].map((count) => (
                      <button
                        key={count}
                        onClick={() => setPrefetchCount(count)}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${
                          prefetchCount === count
                            ? "bg-primary text-white shadow-sm"
                            : "text-gray-400 hover:text-white"
                        }`}
                      >
                        {count}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="mt-2 text-[10px] text-gray-500">
                  Downloads the next N chapters when you are actively reading.
                </p>
              </div>
              <div className="pt-2 border-t border-white/5 text-[10px] text-gray-500 text-center">
                Pro tip: Use 'N' and 'P' keys
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderChapterNav = (
    placement: "top" | "bottom",
    variant: "fixed" | "inline"
  ) => {
    const isFixed = variant === "fixed";
    const isTop = placement === "top";
    const isListOpen = chapterListAnchor === placement;
    const shellClass = isMobileReader
      ? "bg-surface"
      : "bg-surface/90 backdrop-blur-md";
    const wrapperClass = isFixed
      ? `fixed bottom-0 left-0 right-0 z-50 ${shellClass} border-t border-white/10 px-4 py-4 transition-transform duration-300 ease-in-out ${
          controlsVisible ? "translate-y-0" : "translate-y-full"
        }`
      : `w-full ${shellClass} ${
          isTop ? "border-b" : "border-t"
        } border-white/10 px-4 py-4`;
    const wrapperStyle = !isDesktop
      ? isFixed
        ? {
            paddingBottom: "calc(var(--safe-bottom) + 0.5rem)",
            paddingLeft: "var(--safe-left)",
            paddingRight: "var(--safe-right)",
          }
        : {
            paddingLeft: "var(--safe-left)",
            paddingRight: "var(--safe-right)",
            ...(isTop
              ? {}
              : { paddingBottom: "calc(var(--safe-bottom) + 0.5rem)" }),
          }
      : undefined;
    const popupOffset = isTop ? -10 : 10;
    const popupPosition = isTop ? "top-full mt-4" : "bottom-full mb-4";

    return (
      <div
        className={wrapperClass}
        style={wrapperStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
          <button
            onClick={() => prevChapter && handleNavigateChapter(prevChapter)}
            disabled={!prevChapter}
            className={`p-3 rounded-full transition-all ${
              prevChapter
                ? "bg-surfaceHighlight hover:bg-white/20 text-white"
                : "bg-transparent text-gray-700 cursor-not-allowed"
            }`}
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          <div className="relative flex-1 max-w-xs">
            <div className="mb-2 text-center text-[11px] uppercase tracking-wider text-gray-500">
              {currentChapter
                ? `Current: Ch ${currentChapter.number} of ${chapterList.length}`
                : "Current: --"}
            </div>
            <button
              onClick={() => toggleChapterList(placement)}
              className="w-full flex items-center justify-center gap-2 bg-surfaceHighlight hover:bg-white/10 border border-white/10 text-white font-medium py-3 px-4 rounded-xl transition-all active:scale-95"
            >
              <span className="truncate max-w-[150px] sm:max-w-[200px]">
                {currentChapter
                  ? `Chapter ${currentChapter.number}`
                  : "Select Chapter"}
              </span>
              <ChevronDown
                className={`w-4 h-4 transition-transform duration-300 ${
                  isListOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {/* Chapter List Popup */}
            <AnimatePresence>
              {showChapterList && isListOpen && (
                <motion.div
                  initial={{ opacity: 0, y: popupOffset, x: "-50%" }}
                  animate={{ opacity: 1, y: 0, x: "-50%" }}
                  exit={{ opacity: 0, y: popupOffset, x: "-50%" }}
                  transition={{ duration: 0.2 }}
                  className={`absolute ${popupPosition} left-1/2 w-64 xs:w-72 max-h-[45vh] sm:max-h-[60vh] flex flex-col bg-surface rounded-xl shadow-2xl border border-white/10 ring-1 ring-black/50 z-50`}
                >
                  <div className="p-3 border-b border-white/10 bg-surface rounded-t-xl z-20">
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-gray-500">
                        <SearchIcon className="w-3.5 h-3.5" />
                      </div>
                      <input
                        autoFocus={!isMobileReader}
                        type="text"
                        placeholder="Search chapter..."
                        className="w-full bg-surfaceHighlight/50 border border-white/5 rounded-lg py-2.5 pl-9 pr-3 text-[16px] sm:text-xs text-white focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all placeholder-gray-500"
                        value={chapterSearchQuery}
                        onChange={(e) => setChapterSearchQuery(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        inputMode="search"
                        autoCorrect="off"
                        spellCheck={false}
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
                          const isCurrent = ch.id === readerData.chapterId;
                          return (
                            <button
                              key={ch.id}
                              ref={isCurrent ? activeChapterRef : undefined}
                              onClick={() => handleNavigateChapter(ch)}
                              className={`w-full text-left px-4 py-3 text-sm hover:bg-white/5 transition-colors border-l-2 ${
                                isCurrent
                                  ? "border-primary text-primary bg-primary/10 font-semibold"
                                  : "border-transparent text-gray-300"
                              }`}
                            >
                              <div className="flex justify-between items-baseline">
                                <span className={isRead ? "opacity-50" : ""}>
                                  Chapter {ch.number}
                                  {isCurrent && (
                                    <span className="ml-2 text-[9px] uppercase tracking-wider text-primary">
                                      Current
                                    </span>
                                  )}
                                  {isRead && (
                                    <span className="ml-2 text-[9px] uppercase tracking-wider text-gray-500">
                                      Read
                                    </span>
                                  )}
                                </span>
                                <span className="text-[10px] text-gray-600 ml-2">
                                  {ch.date}
                                </span>
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
                ? "bg-surfaceHighlight hover:bg-white/20 text-white"
                : "bg-transparent text-gray-700 cursor-not-allowed"
            }`}
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] min-h-app bg-background flex items-center justify-center">
        <div className="text-primary animate-pulse">Loading Chapter...</div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] min-h-app bg-background flex flex-col items-center relative">

      {/* Safe-area scrims for reader controls */}
      {!isDesktop && !isMobileReader && (
        <>
          <div
            className={`fixed top-0 left-0 right-0 z-40 bg-background transition-opacity duration-300 pointer-events-none ${
              controlsVisible ? "opacity-100" : "opacity-0"
            }`}
            style={{ height: controlsVisible ? "var(--safe-top)" : "0px" }}
          />
          <div
            className={`fixed bottom-0 left-0 right-0 z-40 bg-background transition-opacity duration-300 pointer-events-none ${
              controlsVisible ? "opacity-100" : "opacity-0"
            }`}
            style={{
              height: controlsVisible ? "var(--safe-bottom)" : "0px",
            }}
          />
        </>
      )}

      {!isMobileReader && (
        <div
          className={`fixed ${
            isDesktop ? "top-9" : "top-0"
          } left-0 right-0 z-50 bg-surface/90 backdrop-blur-md border-b border-white/10 px-4 py-3 transition-transform duration-300 ease-in-out ${
            controlsVisible ? "translate-y-0" : "-translate-y-full"
          }`}
          style={
            isDesktop
              ? undefined
              : {
                  paddingTop: "calc(var(--safe-top) + 0.5rem)",
                  paddingLeft: "var(--safe-left)",
                  paddingRight: "var(--safe-right)",
                }
          }
          onClick={(e) => e.stopPropagation()}
        >
          {topHeaderContent}
        </div>
      )}

      {!isMobileReader && renderChapterNav("bottom", "fixed")}

      {/* --- Main Reader Content --- */}
      <div
        className="w-full min-h-[100dvh] min-h-app flex flex-col items-center transition-all duration-300"
        style={{
          paddingTop: "0px",
          paddingBottom: "0px",
        }}
        onClick={toggleControls}
      >
        {isMobileReader && (
          <div className="w-full">
            <div
              className="w-full bg-surface border-b border-white/10 px-4 py-3"
              style={{
                paddingTop: "calc(var(--safe-top) + 0.5rem)",
                paddingLeft: "var(--safe-left)",
                paddingRight: "var(--safe-right)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {topHeaderContent}
            </div>
            {renderChapterNav("top", "inline")}
          </div>
        )}

        <div
          className="w-full flex flex-col items-center transition-[max-width] duration-300"
          style={{
            maxWidth: isMobileReader
              ? "100%"
              : maxWidth === "100%"
                ? "100%"
                : maxWidth === "75%"
                  ? "1000px"
                  : "700px",
            gap: pageGap,
          }}
        >
          {pages.map((page) => (
            <img
              key={page.page}
              ref={(el) => {
                imageRefs.current[page.page] = el;
              }}
              data-page={page.page}
              src={page.src}
              alt={`Page ${page.page}`}
              className="w-full h-auto select-none bg-transparent min-h-[500px]"
              loading="lazy"
            />
          ))}
        </div>

        {isMobileReader && renderChapterNav("bottom", "inline")}

        {/* End of Chapter Navigation */}
        <div className="w-full px-4 py-12 flex flex-col items-center gap-6 text-center">
          <h3 className="text-white font-medium text-lg">
            {nextChapter
              ? "Continue to next chapter?"
              : "You have reached the latest chapter."}
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
