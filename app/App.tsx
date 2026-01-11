import React, { useState, useEffect, useRef } from 'react';
import Home from './pages/Home';
import Details from './pages/Details';
import Reader from './pages/Reader';
import Login from './pages/Login';
import Library from './pages/Library';
import Recommendations from './pages/Recommendations';
import RecentReads from './pages/RecentReads';
import { PaletteIcon, BellIcon, SearchIcon, FilterIcon, XIcon, ChevronDown, SyncIcon, MenuIcon } from './components/Icons';
import NotificationsMenu from './components/NotificationsMenu';
import { anilistApi } from './lib/anilist';
import { Chapter } from './types';
import { ThemeProvider, useTheme, themes } from './lib/theme';
import { NotificationProvider } from './lib/notifications';
import { AnimatePresence, motion } from 'framer-motion';
import PageTransition from './components/PageTransition';
import SearchFilters, { FilterState } from './components/SearchFilters';
import { providerOptions, type Source, isProviderSource } from './lib/providers';

type View = 'home' | 'details' | 'reader' | 'login' | 'library' | 'recommendations' | 'recent-reads';

interface ReaderViewData {
  chapterId: string;
  seriesId: string; // for back navigation
  anilistId?: string; // for tracking
  providerSeriesId?: string;
  chapterNumber?: number; // for tracking
  chapters?: Chapter[]; // Full list for navigation
  seriesTitle?: string;
  seriesImage?: string;
  source?: Source;
}

type NavState = {
  app: true;
  view: View;
  data?: any;
  index: number;
};

type NavOptions = {
  replace?: boolean;
};

const NAV_STATE_KEY = 'manverse_nav_state_v1';
const HOME_STATE_KEY = 'manverse_home_state_v2';
const RECOMMEND_STATE_KEY = 'manverse_recommendations_state_v1';

const DEFAULT_FILTERS: FilterState = {
  format: 'All',
  status: 'All',
  genre: 'All',
  country: 'All',
  sort: 'Popularity',
};

const SORT_OPTIONS_ANILIST = [
  'Popularity',
  'Title',
  'Score',
  'Progress',
  'Last Updated',
  'Last Added',
  'Start Date',
];

const SORT_OPTIONS_PROVIDER = ['Relevance', 'Chapters (High)', 'Chapters (Low)', 'Title'];

const AVAILABLE_GENRES = [
  'Action', 'Adventure', 'Comedy', 'Drama', 'Ecchi', 'Fantasy', 'Horror', 'Mahou Shoujo', 'Mecha', 'Music', 'Mystery', 'Psychological', 'Romance', 'Sci-Fi', 'Slice of Life', 'Sports', 'Supernatural', 'Thriller'
];

const AppContent: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('home');
  const [viewData, setViewData] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const { theme, setTheme } = useTheme();
  
  // Menus
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showLoginMenu, setShowLoginMenu] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNavMenu, setShowNavMenu] = useState(false);
  const [syncPending, setSyncPending] = useState(0);
  const [syncLoading, setSyncLoading] = useState(false);

  // Global Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [searchSource, setSearchSource] = useState<Source>('AniList');

  // Animation State
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const historyIndexRef = useRef(0);

  const persistScrollForView = (view: View) => {
    if (typeof window === 'undefined') return;
    if (view === 'home') {
      try {
        const raw = sessionStorage.getItem(HOME_STATE_KEY);
        if (!raw) return;
        const saved = JSON.parse(raw);
        const scrollY = window.scrollY;
        saved.scrollY = scrollY;
        saved.searchScrollY = scrollY;
        sessionStorage.setItem(HOME_STATE_KEY, JSON.stringify(saved));
      } catch {
        // Ignore storage errors
      }
      return;
    }
    if (view === 'recommendations') {
      try {
        const raw = sessionStorage.getItem(RECOMMEND_STATE_KEY);
        if (!raw) return;
        const saved = JSON.parse(raw);
        saved.scrollY = window.scrollY;
        sessionStorage.setItem(RECOMMEND_STATE_KEY, JSON.stringify(saved));
      } catch {
        // Ignore storage errors
      }
    }
  };

  const loadStoredNavState = () => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = sessionStorage.getItem(NAV_STATE_KEY);
      return raw ? (JSON.parse(raw) as NavState) : null;
    } catch {
      return null;
    }
  };

  const saveNavState = (state: NavState) => {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.setItem(NAV_STATE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage errors
    }
  };

  const buildUrl = (view: View, data?: any) => {
    const params = new URLSearchParams();
    if (view !== 'home') {
      params.set('view', view);
    }
    if (view === 'details' && typeof data === 'string') {
      params.set('id', data);
    }
    if (view === 'reader' && data) {
      if (data.chapterId) params.set('chapterId', data.chapterId);
      if (data.seriesId) params.set('seriesId', data.seriesId);
      if (data.anilistId) params.set('anilistId', data.anilistId);
      if (data.providerSeriesId) params.set('providerSeriesId', data.providerSeriesId);
      if (data.chapterNumber !== undefined) params.set('chapterNumber', String(data.chapterNumber));
      if (data.source) params.set('source', data.source);
    }
    const query = params.toString();
    return query ? `/?${query}` : '/';
  };

  const parseRouteFromParams = (params: URLSearchParams) => {
    const rawView = params.get('view') as View | null;
    const view: View = rawView || 'home';
    const allowedViews: View[] = [
      'home',
      'details',
      'reader',
      'login',
      'library',
      'recommendations',
      'recent-reads',
    ];

    if (!allowedViews.includes(view)) {
      return { view: 'home' as View };
    }

    if (view === 'details') {
      const id = params.get('id');
      if (!id) return { view: 'home' as View };
      return { view, data: id };
    }

    if (view === 'reader') {
      const chapterId = params.get('chapterId');
      const seriesId = params.get('seriesId');
      if (!chapterId || !seriesId) return { view: 'home' as View };
      const chapterNumberRaw = params.get('chapterNumber');
      const chapterNumber = chapterNumberRaw ? Number(chapterNumberRaw) : undefined;
      const sourceParam = params.get('source');
      const source =
        sourceParam === 'AniList'
          ? ('AniList' as Source)
          : providerOptions.some((provider) => provider.id === sourceParam)
            ? (sourceParam as Source)
            : undefined;
      return {
        view,
        data: {
          chapterId,
          seriesId,
          anilistId: params.get('anilistId') || undefined,
          providerSeriesId: params.get('providerSeriesId') || undefined,
          chapterNumber: Number.isFinite(chapterNumber) ? chapterNumber : undefined,
          source,
        },
      };
    }

    return { view };
  };

  const mergeReaderState = (routeState: { view: View; data?: any }, storedState: NavState | null) => {
    if (routeState.view !== 'reader' || storedState?.view !== 'reader') {
      return routeState;
    }
    const routeData = routeState.data as ReaderViewData | undefined;
    const storedData = storedState.data as ReaderViewData | undefined;
    if (!routeData || !storedData) return routeState;
    if (routeData.chapterId !== storedData.chapterId || routeData.seriesId !== storedData.seriesId) {
      return routeState;
    }
    return {
      ...routeState,
      data: {
        ...storedData,
        ...routeData,
      },
    };
  };

  const resolveInitialState = (params: URLSearchParams) => {
    const historyState = window.history.state as NavState | null;
    if (historyState?.app) {
      return historyState;
    }
    const storedState = loadStoredNavState();
    const parsed = parseRouteFromParams(params);
    const merged = mergeReaderState(parsed, storedState);
    if ((merged.view === 'home' && !merged.data) && storedState?.app) {
      return {
        ...storedState,
        index: 0,
      } as NavState;
    }
    return {
      app: true,
      view: merged.view,
      data: merged.data ?? null,
      index: 0,
    } as NavState;
  };

  // Check if filters are active (dirty)
  const defaultSort = isProviderSource(searchSource) ? 'Relevance' : 'Popularity';
  const isFiltersDirty = 
    filters.format !== 'All' || 
    filters.status !== 'All' || 
    filters.genre !== 'All' || 
    filters.country !== 'All' || 
    filters.sort !== defaultSort;

  // Load User Function (Extracted for re-use)
  const loadUser = async () => {
    const u = await anilistApi.getCurrentUser();
    setUser(u);
    if (u) {
      const status = await anilistApi.getSyncStatus();
      setSyncPending(status.pending ?? 0);
      if ((status.pending ?? 0) > 0) {
        void anilistApi.syncPending().then(async () => {
          const nextStatus = await anilistApi.getSyncStatus();
          setSyncPending(nextStatus.pending ?? 0);
        });
      }
    } else {
      setSyncPending(0);
    }
    setIsVerifying(false); 
  };

  const refreshSyncStatus = async () => {
    if (!user) return;
    const status = await anilistApi.getSyncStatus();
    setSyncPending(status.pending ?? 0);
  };

  const handleSyncNow = async () => {
    if (!user || syncLoading) return;
    setSyncLoading(true);
    await anilistApi.syncPending();
    await refreshSyncStatus();
    setSyncLoading(false);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const authError = params.get('error');

    if (token) {
      setIsVerifying(true);
      anilistApi.setToken(token);
    }

    if (token || authError) {
      params.delete('token');
      params.delete('error');
    }

    const initialState = resolveInitialState(params);
    setCurrentView(initialState.view);
    setViewData(initialState.data ?? null);
    historyIndexRef.current = initialState.index ?? 0;
    saveNavState(initialState);
    window.history.replaceState(initialState, '', buildUrl(initialState.view, initialState.data));

    loadUser();
  }, []);

  useEffect(() => {
    if (!user) return;
    void refreshSyncStatus();
    const interval = window.setInterval(() => {
      void refreshSyncStatus();
    }, 60000);
    return () => window.clearInterval(interval);
  }, [user]);

  const navigate = (view: View, data?: any, options: NavOptions = {}) => {
    if (!options.replace && view === currentView && data === viewData) {
      window.scrollTo(0, 0);
      return;
    }
    setShowNavMenu(false);
    persistScrollForView(currentView);
    window.scrollTo(0, 0);
    const nextIndex = options.replace ? historyIndexRef.current : historyIndexRef.current + 1;
    const state: NavState = {
      app: true,
      view,
      data,
      index: nextIndex,
    };
    const url = buildUrl(view, data);

    if (options.replace) {
      window.history.replaceState(state, '', url);
    } else {
      window.history.pushState(state, '', url);
    }

    historyIndexRef.current = nextIndex;
    saveNavState(state);
    setViewData(data ?? null);
    setCurrentView(view);
  };

  const handleBack = () => {
    if (historyIndexRef.current > 0) {
      window.history.back();
      return;
    }
    navigate('home', undefined, { replace: true });
  };

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const state = (event.state as NavState | null)?.app ? (event.state as NavState) : null;
      const storedState = loadStoredNavState();
      const fallback = mergeReaderState(
        parseRouteFromParams(new URLSearchParams(window.location.search)),
        storedState,
      );
      const nextState: NavState = state
        ? state
        : ({
            app: true,
            view: fallback.view,
            data: fallback.data,
            index: Math.max(0, historyIndexRef.current - 1),
          } as NavState);

      historyIndexRef.current = nextState.index ?? 0;
      saveNavState(nextState);
      setCurrentView(nextState.view);
      setViewData(nextState.data ?? null);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleLogout = () => {
    anilistApi.logout();
    setUser(null);
    setShowProfileMenu(false);
    navigate('home', undefined, { replace: true });
  };

  const handleLoginSuccess = async () => {
    await loadUser();
    setShowLoginMenu(false);
    navigate('home', undefined, { replace: true });
  };

  const handleOAuthLogin = async () => {
    try {
      const authUrl = await anilistApi.getLoginUrl();
      window.location.href = authUrl;
    } catch (error) {
      console.error('Failed to start AniList login', error);
    }
  };

  const handleDemoLogin = () => {
    anilistApi.setToken('DEMO_MODE_TOKEN');
    handleLoginSuccess();
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentView !== 'home') {
       navigate('home', undefined, { replace: true });
    }
    // Optional: Open filters automatically on search if you want
    // setShowFilters(true);
  };

  useEffect(() => {
    const options = isProviderSource(searchSource) ? SORT_OPTIONS_PROVIDER : SORT_OPTIONS_ANILIST;
    setFilters((prev) => {
      if (options.includes(prev.sort)) return prev;
      return { ...prev, sort: options[0] };
    });
  }, [searchSource]);

  const clearFilters = () => {
    setFilters({ ...DEFAULT_FILTERS, sort: defaultSort });
    setSearchQuery('');
    setShowFilters(false);
  };

  if (isVerifying) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-400 font-medium animate-pulse">Verifying with AniList...</p>
      </div>
    );
  }

  return (
    <div className="bg-background text-white min-h-screen font-sans selection:bg-primary/30 transition-colors duration-300 flex flex-col">
      {/* Top Navigation Bar - Global - Hidden in Reader Mode */}
      {currentView !== 'reader' && (
        <nav className="sticky top-0 z-[60] bg-surface/95 backdrop-blur-md border-b border-white/5 shadow-sm relative">
          <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8">
            {/* Grid Layout: [Left Content] [Search Bar] [Right Actions] */}
            <div className="flex flex-col gap-3 py-3 md:flex-row md:items-center md:gap-4 md:py-0 md:h-20 [@media(min-width:1800px)]:grid [@media(min-width:1800px)]:grid-cols-[minmax(420px,1.6fr)_minmax(520px,2.1fr)_minmax(240px,1fr)]">
              
              {/* Left Section: Logo & Links */}
              <div className="flex items-center gap-4 md:gap-6 justify-start min-w-0 w-full md:w-auto md:flex-none">
                <div 
                  className="flex items-center gap-3 cursor-pointer group flex-shrink-0"
                  onClick={() => navigate('home')}
                >
                  <img 
                    src="/logo.png" 
                    alt="ManVerse Logo" 
                    className="w-10 h-10 rounded-xl object-contain shadow-lg group-hover:scale-105 transition-transform duration-300"
                  />
                  <span className="font-bold text-xl tracking-tight text-white group-hover:text-[#FF6B4A] transition-colors hidden lg:block">
                    ManVerse
                  </span>
                </div>

                {/* Hide navigation links earlier (xl) to prioritize search bar space */}
                <button
                  onClick={() => setShowNavMenu(!showNavMenu)}
                  className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#1a1a1a] px-3 py-2 text-sm font-semibold text-gray-300 hover:text-white hover:bg-white/5 transition-colors [@media(min-width:1800px)]:hidden"
                >
                  <MenuIcon className="w-4 h-4" />
                  Menu
                </button>

                <div className="hidden [@media(min-width:1800px)]:flex items-center gap-5 min-w-0 flex-nowrap">
                  <button 
                    onClick={() => navigate('home')} 
                    className={`text-[16px] font-semibold transition-colors whitespace-nowrap ${currentView === 'home' && !searchQuery ? 'text-white' : 'text-gray-400 hover:text-white'}`}
                  >
                    Browse
                  </button>
                  <button 
                    onClick={() => navigate('recommendations')} 
                    className={`text-[16px] font-semibold transition-colors whitespace-nowrap ${currentView === 'recommendations' ? 'text-white' : 'text-gray-400 hover:text-white'}`}
                  >
                    Recommendations
                  </button>
                  <button 
                    onClick={() => navigate('recent-reads')} 
                    className={`text-[16px] font-semibold transition-colors whitespace-nowrap ${currentView === 'recent-reads' ? 'text-white' : 'text-gray-400 hover:text-white'}`}
                  >
                    Recent Reads
                  </button>
                  {user && (
                    <button 
                      onClick={() => navigate('library')} 
                      className={`text-[16px] font-semibold transition-colors whitespace-nowrap ${currentView === 'library' ? 'text-white' : 'text-gray-400 hover:text-white'}`}
                    >
                      Library
                    </button>
                  )}
                </div>
              </div>

              {/* Center Section: Search Bar */}
              <div className="flex items-center justify-center w-full md:flex-1 md:min-w-[320px] px-0 md:px-2 [@media(min-width:1800px)]:max-w-2xl">
                 <div className="relative w-full flex items-center gap-3">
                    <form onSubmit={handleSearchSubmit} className="relative w-full group flex items-center shadow-lg rounded-xl m-0">
                        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-gray-500 group-focus-within:text-primary transition-colors z-10">
                          <SearchIcon className="h-5 w-5" />
                        </div>
                        <input
                          type="text"
                          placeholder={searchSource === 'AniList' ? "Search ManVerse..." : "Search Provider..."}
                          className="w-full h-12 bg-[#1a1a1a] border border-[#333] hover:border-[#444] rounded-xl pl-12 pr-28 md:pr-32 text-base text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary transition-all font-medium"
                          value={searchQuery}
                          onChange={(e) => {
                            setSearchQuery(e.target.value);
                            if (currentView !== 'home') navigate('home', undefined, { replace: true });
                          }}
                        />
                        {/* Search Source Selector (Embedded) */}
                        <div className="absolute right-1.5 top-1.5 bottom-1.5 z-10">
                           <div className="h-full bg-surface/50 hover:bg-surface rounded-lg flex items-center px-1 border border-white/5 transition-colors">
                             <select
                               value={searchSource}
                               onChange={(e) => setSearchSource(e.target.value as Source)}
                               className="bg-transparent text-gray-300 text-xs font-bold px-3 py-1 outline-none cursor-pointer appearance-none hover:text-white"
                             >
                               <option value="AniList">AniList</option>
                               {providerOptions.map((provider) => (
                                 <option key={provider.id} value={provider.id}>
                                   {provider.shortLabel}
                                 </option>
                               ))}
                             </select>
                             <ChevronDown className="w-3 h-3 text-gray-500 mr-2 pointer-events-none" />
                           </div>
                        </div>
                    </form>
                    
                    {/* Filter Toggle (Navbar) */}
                    <button 
                      onClick={() => setShowFilters(!showFilters)}
                      className={`h-12 w-12 flex items-center justify-center rounded-xl border transition-all flex-shrink-0 shadow-lg ${
                        showFilters || isFiltersDirty 
                          ? 'bg-primary text-black border-primary shadow-primary/20' 
                          : 'bg-[#1a1a1a] text-gray-400 border-[#333] hover:bg-[#222] hover:text-white hover:border-[#555]'
                      }`}
                      title="Toggle Filters"
                    >
                      <FilterIcon className="w-5 h-5" />
                    </button>

                    {/* Clear Button (if dirty) */}
                    {(searchQuery || isFiltersDirty) && (
                       <button 
                         onClick={clearFilters}
                         className="h-12 w-12 flex items-center justify-center rounded-xl bg-[#1a1a1a] border border-[#333] text-gray-400 hover:text-white hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400 transition-colors flex-shrink-0"
                         title="Clear Search & Filters"
                       >
                         <XIcon className="w-5 h-5" />
                       </button>
                    )}
                 </div>
              </div>

              {/* Right Section: Actions & Profile */}
              <div className="flex items-center gap-3 sm:gap-4 justify-end w-full md:w-auto md:pl-4 md:border-l md:border-white/10">
                {/* Theme Switcher */}
                  <div className="relative hidden md:block">
                    <button 
                      onClick={() => setShowThemeMenu(!showThemeMenu)}
                      className="p-2.5 rounded-xl hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
                    >
                      <PaletteIcon className="w-5 h-5" />
                    </button>

                    {showThemeMenu && (
                      <>
                        <div 
                          className="fixed inset-0 z-10" 
                          onClick={() => setShowThemeMenu(false)}
                        />
                        <div className="absolute right-0 mt-2 w-64 bg-surface border border-white/10 rounded-2xl shadow-xl z-20 py-3 overflow-hidden animate-fade-in ring-1 ring-black/50">
                          {/* Theme items */}
                           <div className="px-5 py-2 text-[11px] font-bold text-gray-500 uppercase tracking-widest opacity-80">
                             Appearance
                           </div>
                           {themes.map(t => (
                             <button
                               key={t.id}
                               onClick={() => { setTheme(t.id); setShowThemeMenu(false); }}
                               className={`w-full text-left px-5 py-3 text-[15px] font-medium flex items-center gap-3 hover:bg-white/5 transition-colors ${theme === t.id ? 'text-primary bg-primary/5' : 'text-gray-300'}`}
                             >
                               <div className="w-3.5 h-3.5 rounded-full border border-white/10 shadow-sm" style={{ backgroundColor: t.color }} />
                               {t.name}
                             </button>
                           ))}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Notifications */}
                  <div className="relative">
                    <button 
                      onClick={() => setShowNotifications(!showNotifications)}
                      className="p-2.5 rounded-xl hover:bg-white/10 text-gray-300 hover:text-white transition-colors relative"
                    >
                      <BellIcon className="w-5 h-5" />
                      {/* Notification Dot (Mock) */}
                      <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-red-500 rounded-full border border-surface"></span>
                    </button>
                    {showNotifications && (
                      <NotificationsMenu onClose={() => setShowNotifications(false)} user={user} />
                    )}
                  </div>

                  {user && (
                    <button
                      onClick={handleSyncNow}
                      className={`p-2.5 rounded-xl transition-colors relative ${
                        syncLoading
                          ? 'text-primary'
                          : 'text-gray-300 hover:text-white hover:bg-white/10'
                      }`}
                      title={syncPending > 0 ? `${syncPending} pending sync` : 'All synced'}
                    >
                      <SyncIcon className={`w-5 h-5 ${syncLoading ? 'animate-spin' : ''}`} />
                      {syncPending > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-[10px] font-bold text-black flex items-center justify-center">
                          {syncPending}
                        </span>
                      )}
                    </button>
                  )}

                {user ? (
                  <div className="relative flex items-center gap-3 ml-2">
                    <button
                      onClick={() => setShowProfileMenu(!showProfileMenu)}
                      className="flex items-center gap-2"
                    >
                      <img
                        src={user?.avatar?.large || '/logo.png'}
                        alt="avatar"
                        className="w-10 h-10 rounded-full border border-surfaceHighlight cursor-pointer hover:ring-2 ring-primary transition-all object-cover aspect-square shrink-0"
                      />
                      <ChevronDown className="w-4 h-4 text-gray-400 hidden sm:block" />
                    </button>

                    {showProfileMenu && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setShowProfileMenu(false)}
                        />
                        <div className="absolute right-0 top-full mt-2 w-56 bg-surface border border-white/10 rounded-2xl shadow-xl z-20 py-2 overflow-hidden animate-fade-in ring-1 ring-black/50">
                          <div className="px-4 py-3 border-b border-white/10">
                            <div className="text-sm font-semibold text-white">
                              {user?.name || 'Account'}
                            </div>
                            <div className="text-xs text-gray-500">
                              {user?.name ? 'AniList connected' : 'Session active'}
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              setShowProfileMenu(false);
                              navigate('library');
                            }}
                            className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                          >
                            Library
                          </button>
                          <button
                            onClick={() => {
                              setShowProfileMenu(false);
                              navigate('recent-reads');
                            }}
                            className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                          >
                            Recent Reads
                          </button>
                          <button
                            onClick={handleLogout}
                            className="w-full text-left px-4 py-2.5 text-sm text-red-300 hover:text-red-200 hover:bg-red-500/10 transition-colors"
                          >
                            Sign out
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="relative">
                    <button
                      onClick={() => setShowLoginMenu(!showLoginMenu)}
                      className="hidden sm:flex text-xs font-bold bg-[#3DB4F2] hover:bg-[#3DB4F2]/90 text-white px-5 py-2.5 rounded-xl transition-colors items-center gap-2 shadow-lg shadow-blue-500/20"
                    >
                      Login
                      <ChevronDown className="w-4 h-4" />
                    </button>

                    {showLoginMenu && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setShowLoginMenu(false)}
                        />
                        <div className="absolute right-0 top-full mt-2 w-64 bg-surface border border-white/10 rounded-2xl shadow-xl z-20 py-2 overflow-hidden animate-fade-in ring-1 ring-black/50">
                          <div className="px-4 py-2 text-[11px] font-bold text-gray-500 uppercase tracking-widest">
                            Sign in
                          </div>
                          <button
                            onClick={() => {
                              setShowLoginMenu(false);
                              handleOAuthLogin();
                            }}
                            className="mx-2 mb-1 flex w-[calc(100%-1rem)] items-center justify-center rounded-lg bg-gradient-to-r from-[#02A9FF] to-[#7AD9FF] px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-500/30 transition hover:brightness-110"
                          >
                            Continue with AniList
                          </button>
                          <button
                            onClick={() => {
                              setShowLoginMenu(false);
                              handleDemoLogin();
                            }}
                            className="w-full text-left px-4 py-3 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                          >
                            Try demo account
                          </button>
                          <button
                            onClick={() => {
                              setShowLoginMenu(false);
                              navigate('login');
                            }}
                            className="w-full text-left px-4 py-2.5 text-xs text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors"
                          >
                            Learn more
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Nav Menu (Responsive) */}
          {showNavMenu && (
            <div className="2xl:hidden">
              <div
                className="fixed inset-0 z-20"
                onClick={() => setShowNavMenu(false)}
              />
              <div className="absolute left-4 right-4 top-full mt-2 z-30 rounded-2xl border border-white/10 bg-[#0f0f12]/95 backdrop-blur-xl shadow-2xl">
                <div className="p-4 grid gap-2 text-sm font-semibold text-gray-200">
                  <button
                    onClick={() => navigate('home')}
                    className={`w-full rounded-xl px-4 py-3 text-left transition-colors ${
                      currentView === 'home' && !searchQuery
                        ? 'bg-primary/15 text-white'
                        : 'bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    Browse
                  </button>
                  <button
                    onClick={() => navigate('recommendations')}
                    className={`w-full rounded-xl px-4 py-3 text-left transition-colors ${
                      currentView === 'recommendations'
                        ? 'bg-primary/15 text-white'
                        : 'bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    Recommendations
                  </button>
                  <button
                    onClick={() => navigate('recent-reads')}
                    className={`w-full rounded-xl px-4 py-3 text-left transition-colors ${
                      currentView === 'recent-reads'
                        ? 'bg-primary/15 text-white'
                        : 'bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    Recent Reads
                  </button>
                  {user && (
                    <button
                      onClick={() => navigate('library')}
                      className={`w-full rounded-xl px-4 py-3 text-left transition-colors ${
                        currentView === 'library'
                          ? 'bg-primary/15 text-white'
                          : 'bg-white/5 hover:bg-white/10'
                      }`}
                    >
                      Library
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Horizontal Filter Bar (Sticky below Nav) */}
          <AnimatePresence>
             {showFilters && (
                <motion.div 
                   initial={{ height: 0, opacity: 0 }}
                   animate={{ height: 'auto', opacity: 1 }}
                   exit={{ height: 0, opacity: 0 }}
                   transition={{ duration: 0.2, ease: "easeInOut" }}
                   className="border-t border-white/5 bg-[#0a0a0a]/95 backdrop-blur-xl overflow-visible"
                >
                   <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
                     <SearchFilters 
                       filters={filters}
                       onChange={setFilters}
                       availableGenres={AVAILABLE_GENRES}
                       sortOptions={
                         isProviderSource(searchSource)
                           ? SORT_OPTIONS_PROVIDER
                           : SORT_OPTIONS_ANILIST
                       }
                       defaultSort={defaultSort}
                     />
                   </div>
                </motion.div>
             )}
          </AnimatePresence>
        </nav>
      )}

      <main className="flex-1">
        <AnimatePresence mode="wait">
          {currentView === 'home' && (
            <PageTransition key="home">
              <Home 
                onNavigate={navigate} 
                user={user} 
                globalSearchQuery={searchQuery}
                globalFilters={filters}
                globalSearchSource={searchSource}
                toggleFilters={() => setShowFilters(!showFilters)}
              />
            </PageTransition>
          )}
          
          {currentView === 'library' && (
            <PageTransition key="library">
              <Library onNavigate={navigate} user={user} />
            </PageTransition>
          )}

          {currentView === 'recommendations' && (
            <PageTransition key="recommendations">
              <Recommendations onNavigate={navigate} />
            </PageTransition>
          )}

          {currentView === 'recent-reads' && (
            <PageTransition key="recent-reads">
              <RecentReads onNavigate={navigate} onBack={handleBack} />
            </PageTransition>
          )}

          {currentView === 'details' && (
            <PageTransition key={`details-${viewData ?? 'empty'}`}>
              <Details
                key={viewData ?? 'details'}
                seriesId={viewData}
                onNavigate={navigate}
                onBack={handleBack}
                user={user}
              />
            </PageTransition>
          )}

          {currentView === 'reader' && (
            <PageTransition key="reader">
              <Reader 
                data={viewData as ReaderViewData}
                onBack={handleBack}
                onNavigate={navigate}
              />
            </PageTransition>
          )}

          {currentView === 'login' && (
            <PageTransition key="login">
              <Login onLoginSuccess={handleLoginSuccess} />
            </PageTransition>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <NotificationProvider>
        <AppContent />
      </NotificationProvider>
    </ThemeProvider>
  );
};

export default App;
