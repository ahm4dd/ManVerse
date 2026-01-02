import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { Layout } from '../common/Layout.js';
import { useAppStore } from '../../state/store.js';

export const ProvidersScreen: React.FC = () => {
  const { setScreen, addToast } = useAppStore();
  const [selectedIndex, setSelectedIndex] = useState(0);

  const providers = [
    { name: 'AsuraScans', status: 'active', priority: 1, chapters: 1250 },
    { name: 'Reaper Scans', status: 'inactive', priority: 2, chapters: 0 },
    { name: 'Flame Scans', status: 'inactive', priority: 3, chapters: 0 },
  ];

  // Keyboard navigation
  useInput((input, key) => {
    if (key.escape) {
      setScreen('dashboard');
      return;
    }

    if (key.upArrow) {
      setSelectedIndex(Math.max(0, selectedIndex - 1));
    } else if (key.downArrow) {
      setSelectedIndex(Math.min(providers.length - 1, selectedIndex + 1));
    } else if (key.return) {
      const selected = providers[selectedIndex];
      addToast({
        type: 'info',
        message: `Selected: ${selected?.name}`,
      });
    } else if (input === 'e') {
      addToast({
        type: 'info',
        message: 'Edit provider (feature coming soon)',
      });
    }
  });

  return (
    <Layout title="Providers" showSidebar>
      <Box flexDirection="column" padding={1}>
        {/* Info Box */}
        <Box borderStyle="round" borderColor="cyan" padding={1} marginBottom={1}>
          <Text>
            🔌 Manage scraping providers | Active:{' '}
            {providers.filter((p) => p.status === 'active').length}/{providers.length}
          </Text>
        </Box>

        {/* Provider List */}
        <Box flexDirection="column">
          {providers.map((provider, idx) => (
            <Box
              key={idx}
              borderStyle={selectedIndex === idx ? 'round' : 'single'}
              borderColor={selectedIndex === idx ? 'cyan' : 'gray'}
              padding={1}
              marginBottom={1}
            >
              <Box flexDirection="column" flexGrow={1}>
                <Box justifyContent="space-between">
                  <Text bold color={selectedIndex === idx ? 'cyan' : 'white'}>
                    {selectedIndex === idx ? '› ' : '  '}
                    {provider.name}
                  </Text>
                  <Text
                    color={provider.status === 'active' ? 'green' : 'gray'}
                    bold={provider.status === 'active'}
                  >
                    {provider.status === 'active' ? '✓ Active' : '○ Inactive'}
                  </Text>
                </Box>
                <Box marginTop={1}>
                  <Text dimColor>
                    Priority: {provider.priority} | Chapters cached: {provider.chapters}
                  </Text>
                </Box>
              </Box>
            </Box>
          ))}
        </Box>

        {/* Actions */}
        <Box borderStyle="round" borderColor="yellow" padding={1} marginTop={1}>
          <Text bold color="yellow">
            ⚡ Actions
          </Text>
          <Text>[E] Edit Provider</Text>
          <Text>[A] Add New Provider</Text>
          <Text>[T] Toggle Active/Inactive</Text>
          <Text>[P] Set Priority</Text>
        </Box>

        {/* Help Text */}
        <Box marginTop={1}>
          <Text dimColor>↑/↓ Navigate | ⏎ Select | E Edit | Esc Back</Text>
        </Box>
      </Box>
    </Layout>
  );
};
