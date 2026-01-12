import React, { useEffect, useState, useRef } from 'react';
import { Series } from '../types';
import { anilistApi } from '../lib/anilist';
import SeriesCard from '../components/SeriesCard';

interface RecommendationsProps {
  onNavigate: (view: string, data?: any) => void;
}

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
            if (saved.pages) setPages(saved.pages);
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

  useEffect(() => {
    setPageInputs({
      trending: String(pages.trending),
      popular: String(pages.popular),
      topRated: String(pages.topRated),
    });
  }, [pages]);

  const handlePageChange = async (section: 'trending' | 'popular' | 'topRated', page: number) => {
    if (page < 1) return;
    if (loadingMore[section]) return;
    const cached = sectionCacheRef.current[section]?.[page];
    setPages((prev) => ({ ...prev, [section]: page }));
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

  const handleJumpToPage = async (section: 'trending' | 'popular' | 'topRated', value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const target = Number(trimmed);
    if (!Number.isFinite(target) || target < 1) return;
    if (target === pages[section]) return;
    await handlePageChange(section, target);
  };

  const Section = ({
    title,
    data,
    section,
  }: {
    title: string;
    data: Series[];
    section: 'trending' | 'popular' | 'topRated';
  }) => {
    const page = pages[section];
    const canPrev = page > 1;
    const canNext = hasMore[section];
    return (
    <div className="mb-12 animate-fade-in">
      <div className="flex items-center justify-between mb-6 px-4 md:px-0">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
           <span className="w-1.5 h-6 bg-primary rounded-full"></span>
           {title}
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handlePageChange(section, 1)}
            disabled={!canPrev || loadingMore[section]}
            className="text-xs font-semibold text-gray-300 px-3 py-1.5 rounded-full border border-white/10 hover:bg-white/5 disabled:opacity-50"
          >
            First
          </button>
          <button
            onClick={() => handlePageChange(section, page - 1)}
            disabled={!canPrev || loadingMore[section]}
            className="text-xs font-semibold text-gray-300 px-3 py-1.5 rounded-full border border-white/10 hover:bg-white/5 disabled:opacity-50"
          >
            Prev
          </button>
          <span className="text-xs font-semibold text-gray-500">Page {page}</span>
          <div className="flex items-center gap-1">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={pageInputs[section]}
              onChange={(event) =>
                setPageInputs((prev) => ({
                  ...prev,
                  [section]: event.target.value.replace(/[^\d]/g, ''),
                }))
              }
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  void handleJumpToPage(section, pageInputs[section]);
                }
              }}
              className="w-14 px-2 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-white text-center focus:outline-none focus:border-primary/60"
              placeholder="1"
            />
            <button
              onClick={() => handleJumpToPage(section, pageInputs[section])}
              disabled={loadingMore[section]}
              className="text-xs font-semibold text-gray-300 px-2 py-1 rounded-full border border-white/10 hover:bg-white/5 disabled:opacity-50"
            >
              Go
            </button>
          </div>
          <button
            onClick={() => handlePageChange(section, page + 1)}
            disabled={!canNext || loadingMore[section]}
            className="text-xs font-semibold text-gray-300 px-3 py-1.5 rounded-full border border-white/10 hover:bg-white/5 disabled:opacity-50"
          >
            {loadingMore[section] ? 'Loading...' : 'Next'}
          </button>
        </div>
      </div>
      <div className="overflow-x-auto pb-8 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-hide">
         <div className="flex gap-4 md:gap-6 w-max">
            {data.map(series => (
               <div key={series.id} className="w-[160px] md:w-[200px]">
                  <SeriesCard series={series} onClick={() => onNavigate('details', series.id)} />
               </div>
            ))}
         </div>
      </div>
    </div>
  )};

  return (
    <div className="min-h-[100dvh] pt-5 sm:pt-8 pb-20 max-w-[1600px] mx-auto md:px-8">
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
            <Section title="Trending Now" data={trending} section="trending" />
            <Section title="All Time Popular" data={popular} section="popular" />
            <Section title="Top Rated" data={topRated} section="topRated" />
          </>
       )}
    </div>
  );
}

export default Recommendations;
