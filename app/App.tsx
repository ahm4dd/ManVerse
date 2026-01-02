import React, { useState, useEffect } from 'react';
import Home from './pages/Home';
import Details from './pages/Details';
import Reader from './pages/Reader';
import Login from './pages/Login';
import Library from './pages/Library';
import Recommendations from './pages/Recommendations';
import { PaletteIcon, BellIcon, SearchIcon, FilterIcon, XIcon, ChevronDown } from './components/Icons';
import NotificationsMenu from './components/NotificationsMenu';
import { anilistApi } from './lib/anilist';
import { Chapter } from './types';
import { ThemeProvider, useTheme, themes } from './lib/theme';
import { NotificationProvider } from './lib/notifications';
import { AnimatePresence, motion } from 'framer-motion';
import PageTransition from './components/PageTransition';
import SearchFilters, { FilterState } from './components/SearchFilters';
import { Source } from './lib/api';

type View = 'home' | 'details' | 'reader' | 'login' | 'library' | 'recommendations';

interface ReaderViewData {
  chapterId: string;
  seriesId: string; // for back navigation
  anilistId?: string; // for tracking
  chapterNumber?: number; // for tracking
  chapters: Chapter[]; // Full list for navigation
}

const DEFAULT_FILTERS: FilterState = {
  format: 'All',
  status: 'All',
  genre: 'All',
  country: 'All',
  sort: 'Popularity'
};

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

  // Global Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [searchSource, setSearchSource] = useState<Source>('AniList');

  // Animation State
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);

  // Check if filters are active (dirty)
  const isFiltersDirty = 
    filters.format !== 'All' || 
    filters.status !== 'All' || 
    filters.genre !== 'All' || 
    filters.country !== 'All' || 
    filters.sort !== 'Popularity';

  // Load User Function (Extracted for re-use)
  const loadUser = async () => {
    const u = await anilistApi.getCurrentUser();
    setUser(u);
    setIsVerifying(false); 
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (token) {
      setIsVerifying(true);
      anilistApi.setToken(token);
      params.delete('token');
      const nextUrl = `${window.location.pathname}${params.toString() ? `?${params}` : ''}`;
      window.history.replaceState(null, '', nextUrl);
    }

    loadUser();
  }, []);

  // Simple router logic
  const navigate = (view: View, data?: any) => {
    window.scrollTo(0, 0);
    setViewData(data);
    setCurrentView(view);
  };

  const handleLogout = () => {
    anilistApi.logout();
    setUser(null);
    navigate('home');
  };

  const handleLoginSuccess = async () => {
    await loadUser();
    navigate('home');
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentView !== 'home') {
       navigate('home');
    }
    // Optional: Open filters automatically on search if you want
    // setShowFilters(true);
  };

  const clearFilters = () => {
    setFilters(DEFAULT_FILTERS);
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
        <nav className="sticky top-0 z-[60] bg-surface/95 backdrop-blur-md border-b border-white/5 shadow-sm">
          <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8">
            {/* Grid Layout: [Left Content] [Search Bar] [Right Actions] */}
            <div className="grid grid-cols-[1fr_auto_1fr] items-center h-20 gap-4">
              
              {/* Left Section: Logo & Links */}
              <div className="flex items-center gap-6 justify-start min-w-0">
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
                <div className="hidden xl:flex items-center gap-6 flex-shrink-0">
                  <button 
                    onClick={() => navigate('home')} 
                    className={`text-[15px] font-bold transition-colors ${currentView === 'home' && !searchQuery ? 'text-white' : 'text-gray-400 hover:text-white'}`}
                  >
                    Browse
                  </button>
                  <button 
                    onClick={() => navigate('recommendations')} 
                    className={`text-[15px] font-bold transition-colors ${currentView === 'recommendations' ? 'text-white' : 'text-gray-400 hover:text-white'}`}
                  >
                    Recommendations
                  </button>
                  {user && (
                    <button 
                      onClick={() => navigate('library')} 
                      className={`text-[15px] font-bold transition-colors ${currentView === 'library' ? 'text-white' : 'text-gray-400 hover:text-white'}`}
                    >
                      Library
                    </button>
                  )}
                </div>
              </div>

              {/* Center Section: Search Bar */}
              <div className="flex items-center justify-center w-full max-w-2xl px-2">
                 <div className="relative w-full flex items-center gap-3">
                    <form onSubmit={handleSearchSubmit} className="relative w-full group flex items-center shadow-lg rounded-xl m-0">
                        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-gray-500 group-focus-within:text-primary transition-colors z-10">
                          <SearchIcon className="h-5 w-5" />
                        </div>
                        <input
                          type="text"
                          placeholder={searchSource === 'AniList' ? "Search ManVerse..." : "Search Asura..."}
                          className="w-full h-12 bg-[#1a1a1a] border border-[#333] hover:border-[#444] rounded-xl pl-12 pr-32 text-base text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary transition-all font-medium"
                          value={searchQuery}
                          onChange={(e) => {
                            setSearchQuery(e.target.value);
                            if (currentView !== 'home') navigate('home');
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
                               <option value="AsuraScans">Asura</option>
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
              <div className="flex items-center gap-3 sm:gap-4 justify-end pl-4 border-l border-white/10 md:border-l-0">
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

                {user ? (
                  <div className="flex items-center gap-3 ml-2">
                    <img src={user.avatar.large} alt="avatar" className="w-10 h-10 rounded-full border border-surfaceHighlight cursor-pointer hover:ring-2 ring-primary transition-all" onClick={() => navigate('library')} />
                  </div>
                ) : (
                  <button 
                    onClick={() => navigate('login')}
                    className="hidden sm:flex text-xs font-bold bg-[#3DB4F2] hover:bg-[#3DB4F2]/90 text-white px-5 py-2.5 rounded-xl transition-colors items-center gap-2 shadow-lg shadow-blue-500/20"
                  >
                     Login
                  </button>
                )}
              </div>
            </div>
          </div>
          
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

          {currentView === 'details' && (
            <PageTransition key="details">
              <Details 
                seriesId={viewData} 
                onNavigate={navigate} 
                onBack={() => navigate('home')}
                user={user}
              />
            </PageTransition>
          )}

          {currentView === 'reader' && (
            <PageTransition key="reader">
              <Reader 
                data={viewData as ReaderViewData}
                onBack={() => navigate('details', viewData.seriesId)} 
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
