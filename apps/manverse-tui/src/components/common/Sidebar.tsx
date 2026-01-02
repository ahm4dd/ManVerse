import React from 'react';
import { Box, Text } from 'ink';
import { useAppStore, type Screen } from '../../state/store.js';

interface MenuItem {
  icon: string;
  label: string;
  screen: Screen;
  needsAuth?: boolean;
}

const menuItems: MenuItem[] = [
  { icon: '🏠', label: 'Dashboard', screen: 'dashboard' },
  { icon: '🔍', label: 'Search', screen: 'search' },
  { icon: '📚', label: 'Library', screen: 'library' },
  { icon: '⬇️', label: 'Downloads', screen: 'downloads' },
  { icon: '🔄', label: 'Sync', screen: 'sync', needsAuth: true },
  { icon: '🔌', label: 'Providers', screen: 'providers' },
  { icon: '⚙️', label: 'Settings', screen: 'settings' },
];

export const Sidebar: React.FC = () => {
  const { currentScreen, isAuthenticated, sidebarCollapsed } = useAppStore();

  const visibleItems = menuItems.filter((item) => !item.needsAuth || isAuthenticated);

  if (sidebarCollapsed) {
    return (
      <Box width={3} borderStyle="single" borderColor="cyan" flexDirection="column" paddingY={1}>
        {visibleItems.map((item) => (
          <Box key={item.screen} marginY={0}>
            <Text color={currentScreen === item.screen ? 'cyan' : 'gray'}>{item.icon}</Text>
          </Box>
        ))}
      </Box>
    );
  }

  return (
    <Box
      width={20}
      borderStyle="single"
      borderColor="cyan"
      flexDirection="column"
      paddingX={1}
      paddingY={1}
    >
      <Text bold color="cyan" marginBottom={1}>
        Navigation
      </Text>
      {visibleItems.map((item) => (
        <Box key={item.screen} marginY={0}>
          <Text
            bold={currentScreen === item.screen}
            color={currentScreen === item.screen ? 'cyan' : 'white'}
          >
            {item.icon} {item.label}
          </Text>
          {currentScreen === item.screen && <Text color="cyan"> ←</Text>}
        </Box>
      ))}
    </Box>
  );
};
