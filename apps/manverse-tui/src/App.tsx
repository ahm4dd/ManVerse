import React from 'react';
import { useAppStore } from './state/store.js';
import { useGlobalKeyboard } from './hooks/useKeyboard.js';

// Screens
import { WelcomeScreen } from './components/screens/WelcomeScreen.js';
import { DashboardScreen } from './components/screens/DashboardScreen.js';
import { SearchScreen } from './components/screens/SearchScreen.js';
import { LibraryScreen } from './components/screens/LibraryScreen.js';

import { MangaDetailScreen } from './components/screens/MangaDetailScreen.js';

import { DownloadsScreen } from './components/screens/DownloadsScreen.js';

import { SyncScreen } from './components/screens/SyncScreen.js';

import { ProvidersScreen } from './components/screens/ProvidersScreen.js';
import { SettingsScreen } from './components/screens/SettingsScreen.js';

export const App: React.FC = () => {
  const { currentScreen } = useAppStore();

  // Global keyboard shortcuts
  useGlobalKeyboard();

  // Render current screen
  switch (currentScreen) {
    case 'welcome':
      return <WelcomeScreen />;
    case 'dashboard':
      return <DashboardScreen />;
    case 'search':
      return <SearchScreen />;
    case 'library':
      return <LibraryScreen />;
    case 'manga-detail':
      return <MangaDetailScreen />;
    case 'downloads':
      return <DownloadsScreen />;
    case 'sync':
      return <SyncScreen />;
    case 'providers':
      return <ProvidersScreen />;
    case 'settings':
      return <SettingsScreen />;
    default:
      return <WelcomeScreen />;
  }
};
