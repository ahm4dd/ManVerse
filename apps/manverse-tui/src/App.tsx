import React from 'react';
import { useAppStore } from './state/store.js';
import { useGlobalKeyboard } from './hooks/useKeyboard.js';

// Screens
import { WelcomeScreen } from './components/screens/WelcomeScreen.js';
import { DashboardScreen } from './components/screens/DashboardScreen.js';

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
      // TODO: Implement SearchScreen
      return <DashboardScreen />;
    case 'library':
      // TODO: Implement LibraryScreen
      return <DashboardScreen />;
    case 'downloads':
      // TODO: Implement DownloadsScreen
      return <DashboardScreen />;
    case 'sync':
      // TODO: Implement SyncScreen
      return <DashboardScreen />;
    case 'providers':
      // TODO: Implement ProvidersScreen
      return <DashboardScreen />;
    case 'settings':
      // TODO: Implement SettingsScreen
      return <DashboardScreen />;
    case 'manga-detail':
      // TODO: Implement MangaDetailScreen
      return <DashboardScreen />;
    default:
      return <WelcomeScreen />;
  }
};
