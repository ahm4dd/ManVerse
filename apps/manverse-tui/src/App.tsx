import React, { useState } from 'react';
import { Box } from 'ink';
import WelcomeScreen from './components/screens/WelcomeScreen.js';
import DashboardScreen from './components/screens/DashboardScreen.js';
import { useAppStore } from './state/store.js';
import type { Config } from './config/types.js';

interface AppProps {
  config: Config;
}

type Screen =
  | 'welcome'
  | 'dashboard'
  | 'search'
  | 'library'
  | 'downloads'
  | 'sync'
  | 'providers'
  | 'settings';

const App: React.FC<AppProps> = ({ config }) => {
  const { isAuthenticated } = useAppStore();
  const [currentScreen, setCurrentScreen] = useState<Screen>(
    config.firstLaunch ? 'welcome' : 'dashboard',
  );

  const navigateTo = (screen: Screen) => {
    setCurrentScreen(screen);
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 'welcome':
        return <WelcomeScreen onComplete={() => navigateTo('dashboard')} />;
      case 'dashboard':
        return <DashboardScreen onNavigate={navigateTo} />;
      // TODO: Other screens
      default:
        return <DashboardScreen onNavigate={navigateTo} />;
    }
  };

  return (
    <Box flexDirection="column" width="100%">
      {renderScreen()}
    </Box>
  );
};

export default App;
