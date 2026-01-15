import React, { useEffect, useState, useRef } from 'react';
import { Series } from '../types';
import { anilistApi } from '../lib/anilist';
import SeriesCard from '../components/SeriesCard';

interface RecommendationsProps {
  onNavigate: (view: string, data?: any) => void;
}

type RecommendationSectionKey = 'trending' | 'popular' | 'topRated';

interface RecommendationSectionProps {
  title: string;
  data: Series[];
  section: RecommendationSectionKey;
  page: number;
  hasMore: boolean;
  loadingMore: boolean;
  pageInput: string;
  onPageInputChange: (section: RecommendationSectionKey, value: string) => void;
  onPageChange: (section: RecommendationSectionKey, page: number) => void;
  onJumpToPage: (section: RecommendationSectionKey, value: string) => void;
  onNavigate: (view: string, data?: any) => void;
}

const RecommendationSection: React.FC<RecommendationSectionProps> = ({
  title,
  data,
  section,
  page,
  hasMore,
  loadingMore,
  pageInput,
  onPageInputChange,
  onPageChange,
  onJumpToPage,
  onNavigate,
}) => {
  const canPrev = page > 1;
  const canNext = hasMore;
  const safeData = data.filter((series) => Boolean(series?.id && series.title));
  const measureRef = useRef<HTMLDivElement | null>(null);
  const [cardHeight, setCardHeight] = useState<number | null>(null);

  useEffect(() => {
    if (safeData.length === 0) {
      setCardHeight(null);
      return;
    }
    if (typeof window === 'undefined') return;
    const updateHeight = () => {
      if (!measureRef.current) return;
      const rect = measureRef.current.getBoundingClientRect();
      if (!rect.height) return;
      const next = Math.round(rect.height);
      setCardHeight((prev) => (prev === next ? prev : next));
    };
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, [safeData.length]);

  const gridMaxHeight = cardHeight ? cardHeight * 2 + 32 : undefined;

  return (
    <div className="mb-14 animate-fade-in">
      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-surface/80 via-surfaceHighlight/60 to-surface/80 px-4 py-6 md:px-6 md:py-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <h2 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
             <span className="w-1.5 h-6 md:h-7 bg-primary rounded-full"></span>
             {title}
          </h2>
          <div className="flex flex-wrap items-center gap-2 justify-start sm:justify-end">
            <button
              type="button"
              onClick={() => onPageChange(section, 1)}
              disabled={!canPrev || loadingMore}
              className="text-sm font-semibold text-gray-200 px-4 py-2 rounded-full border border-white/10 hover:bg-white/5 disabled:opacity-50"
            >
              First
            </button>
            <button
              type="button"
              onClick={() => onPageChange(section, page - 1)}
              disabled={!canPrev || loadingMore}
              className="text-sm font-semibold text-gray-200 px-4 py-2 rounded-full border border-white/10 hover:bg-white/5 disabled:opacity-50"
            >
              Prev
            </button>
            <span className="text-sm font-semibold text-gray-400 px-2">Page {page}</span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={pageInput}
                onChange={(event) =>
                  onPageInputChange(section, event.target.value.replace(/[^\d]/g, ''))
                }
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void onJumpToPage(section, pageInput);
                  }
                }}
                className="w-20 px-3 py-2 rounded-full bg-white/5 border border-white/10 text-sm font-semibold text-white text-center focus:outline-none focus:border-primary/60"
                placeholder="1"
              />
              <button
                type="button"
                onClick={() => onJumpToPage(section, pageInput)}
                disabled={loadingMore}
                className="text-sm font-semibold text-gray-200 px-4 py-2 rounded-full border border-white/10 hover:bg-white/5 disabled:opacity-50"
              >
                Go
              </button>
            </div>
            <button
              type="button"
              onClick={() => onPageChange(section, page + 1)}
              disabled={!canNext || loadingMore}
              className="text-sm font-semibold text-gray-200 px-4 py-2 rounded-full border border-white/10 hover:bg-white/5 disabled:opacity-50"
            >
              {loadingMore ? 'Loading...' : 'Next'}
            </button>
          </div>
        </div>
        <div
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-4 gap-y-8 overflow-y-auto pr-2"
          style={gridMaxHeight ? { maxHeight: gridMaxHeight } : undefined}
        >
          {safeData.length > 0 ? (
            safeData.map((series, index) => (
              <div
                key={`${section}-${series.id}`}
                ref={index === 0 ? measureRef : undefined}
              >
                <SeriesCard
                  series={series}
                  index={index}
                  layoutId={`recommendations-${section}-${series.id}`}
                  onClick={() => onNavigate('details', series.id)}
                />
              </div>
            ))
          ) : (
            <div className="col-span-full py-10 text-center text-gray-500">
              No titles found for this section.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const Recommendations: React.FC<RecommendationsProps> = ({ onNavigate }) => {
  const [trending, setTrending] = useState<Series[]>([]);
  const [popular, setPopular] = useState<Series[]>([]);
  const [topRated, setTopRated] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);
  const [pages, setPages] = useState({ trending: 1, popular: 1, topRated: 1 });
  const [hasMore, setHasMore] = useState({ trending: true, popular: true, topRated: true });
  const [loadingMore, setLoadingMore] = useState({ trending: false, popular: false, topRated: false });
  const [recommendationsHydrated, setRecommendationsHydrated] = useState(false);
  const [pageInputs, setPageInputs] = useState({ trending: '1', popular: '1', topRated: '1' });
  const sectionCacheRef = useRef<Record<string, Record<number, Series[]>>>({
    trending: {},
    popular: {},
    topRated: {},
  });
  const scrollYRef = useRef(0);
  const RECOMMEND_STATE_KEY = 'manverse_recommendations_state_v1';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onScroll = () => {
      scrollYRef.current = window.scrollY;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      try {
        const [t, p, tr] = await Promise.all([
          anilistApi.getTrending(1),
          anilistApi.getPopular(1),
          anilistApi.getTopRated(1),
        ]);
        setTrending(t);
        setPopular(p);
        setTopRated(tr);
        sectionCacheRef.current = {
          trending: { 1: t },
          popular: { 1: p },
          topRated: { 1: tr },
        };
        setPages({ trending: 1, popular: 1, topRated: 1 });
        setPageInputs({ trending: '1', popular: '1', topRated: '1' });
        setHasMore({
          trending: t.length > 0,
          popular: p.length > 0,
          topRated: tr.length > 0,
        });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
        if (!cancelled) setRecommendationsHydrated(true);
      }
    };

    if (typeof window !== 'undefined') {
      const raw = sessionStorage.getItem(RECOMMEND_STATE_KEY);
      if (raw) {
        try {
          const saved = JSON.parse(raw);
          const hasData =
            (Array.isArray(saved.trending) && saved.trending.length > 0) ||
            (Array.isArray(saved.popular) && saved.popular.length > 0) ||
            (Array.isArray(saved.topRated) && saved.topRated.length > 0);
          if (hasData) {
            if (Array.isArray(saved.trending)) setTrending(saved.trending);
            if (Array.isArray(saved.popular)) setPopular(saved.popular);
            if (Array.isArray(saved.topRated)) setTopRated(saved.topRated);
            if (saved.pages) {
              setPages(saved.pages);
              setPageInputs({
                trending: String(saved.pages.trending ?? 1),
                popular: String(saved.pages.popular ?? 1),
                topRated: String(saved.pages.topRated ?? 1),
              });
            }
            if (saved.hasMore) setHasMore(saved.hasMore);
            if (saved.sectionCache) {
              sectionCacheRef.current = saved.sectionCache;
            }
            if (typeof saved.scrollY === 'number') {
              requestAnimationFrame(() => window.scrollTo(0, saved.scrollY));
            }
            setLoading(false);
            if (!cancelled) setRecommendationsHydrated(true);
            return;
          }
        } catch {
          // fall through to fetch
        }
      }
    }
    void fetchData();

    return () => {
      cancelled = true;
    };
  }, []);

  const persistRecommendationsState = () => {
    if (typeof window === 'undefined' || !recommendationsHydrated) return;
    const payload = {
      trending,
      popular,
      topRated,
      pages,
      hasMore,
      sectionCache: sectionCacheRef.current,
      scrollY: scrollYRef.current,
    };
    try {
      sessionStorage.setItem(RECOMMEND_STATE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage issues
    }
  };

  useEffect(() => {
    if (!recommendationsHydrated) return;
    persistRecommendationsState();
    return () => {
      persistRecommendationsState();
    };
  }, [trending, popular, topRated, pages, hasMore, recommendationsHydrated]);

  const handlePageChange = async (section: RecommendationSectionKey, page: number) => {
    if (page < 1) return;
    if (loadingMore[section]) return;
    const cached = sectionCacheRef.current[section]?.[page];
    setPages((prev) => ({ ...prev, [section]: page }));
    setPageInputs((prev) => ({ ...prev, [section]: String(page) }));
    if (cached) {
      if (section === 'trending') setTrending(cached);
      if (section === 'popular') setPopular(cached);
      if (section === 'topRated') setTopRated(cached);
      setHasMore((prev) => ({ ...prev, [section]: cached.length > 0 }));
      return;
    }
    setLoadingMore((prev) => ({ ...prev, [section]: true }));
    try {
      let data: Series[] = [];
      if (section === 'trending') {
        data = await anilistApi.getTrending(page);
        setTrending(data);
      } else if (section === 'popular') {
        data = await anilistApi.getPopular(page);
        setPopular(data);
      } else {
        data = await anilistApi.getTopRated(page);
        setTopRated(data);
      }
      if (!sectionCacheRef.current[section]) {
        sectionCacheRef.current[section] = {};
      }
      sectionCacheRef.current[section][page] = data;
      setHasMore((prev) => ({ ...prev, [section]: data.length > 0 }));
    } finally {
      setLoadingMore((prev) => ({ ...prev, [section]: false }));
    }
  };

  const handleJumpToPage = async (section: RecommendationSectionKey, value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const target = Number(trimmed);
    if (!Number.isFinite(target) || target < 1) return;
    if (target === pages[section]) return;
    await handlePageChange(section, target);
  };

  const handlePageInputChange = (section: RecommendationSectionKey, value: string) => {
    setPageInputs((prev) => ({ ...prev, [section]: value }));
  };

  return (
    <div className="min-h-[100dvh] min-h-app pt-5 sm:pt-8 pb-20 max-w-[1600px] mx-auto md:px-8">
       <div className="px-4 md:px-0 mb-10">
         <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-3 tracking-tight">Discover</h1>
         <p className="text-gray-400 font-medium">Curated lists from the AniList community.</p>
       </div>
       
       {loading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4">
             <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
             <p className="text-gray-500 font-medium">Fetching best manga...</p>
          </div>
       ) : (
          <>
            <RecommendationSection
              title="Trending Now"
              data={trending}
              section="trending"
              page={pages.trending}
              hasMore={hasMore.trending}
              loadingMore={loadingMore.trending}
              pageInput={pageInputs.trending}
              onPageInputChange={handlePageInputChange}
              onPageChange={handlePageChange}
              onJumpToPage={handleJumpToPage}
              onNavigate={onNavigate}
            />
            <RecommendationSection
              title="All Time Popular"
              data={popular}
              section="popular"
              page={pages.popular}
              hasMore={hasMore.popular}
              loadingMore={loadingMore.popular}
              pageInput={pageInputs.popular}
              onPageInputChange={handlePageInputChange}
              onPageChange={handlePageChange}
              onJumpToPage={handleJumpToPage}
              onNavigate={onNavigate}
            />
            <RecommendationSection
              title="Top Rated"
              data={topRated}
              section="topRated"
              page={pages.topRated}
              hasMore={hasMore.topRated}
              loadingMore={loadingMore.topRated}
              pageInput={pageInputs.topRated}
              onPageInputChange={handlePageInputChange}
              onPageChange={handlePageChange}
              onJumpToPage={handleJumpToPage}
              onNavigate={onNavigate}
            />
          </>
       )}
    </div>
  );
}

export default Recommendations;
