import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { Layout } from '../common/Layout.js';
import { useAppStore } from '../../state/store.js';

export const SettingsScreen: React.FC = () => {
  const { setScreen, theme, addToast } = useAppStore();
  const [selectedIndex, setSelectedIndex] = useState(0);

  const settings = [
    { category: 'Appearance', name: 'Theme', value: theme, options: ['dark', 'light'] },
    { category: 'Downloads', name: 'Download Path', value: '~/Downloads/ManVerse', options: [] },
    {
      category: 'Downloads',
      name: 'Concurrent Downloads',
      value: '3',
      options: ['1', '3', '5', '10'],
    },
    { category: 'Sync', name: 'Auto Sync', value: 'enabled', options: ['enabled', 'disabled'] },
    {
      category: 'Sync',
      name: 'Sync Interval',
      value: '30 min',
      options: ['15 min', '30 min', '1 hour', 'manual'],
    },
    { category: 'General', name: 'Language', value: 'English', options: ['English', 'Japanese'] },
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
      setSelectedIndex(Math.min(settings.length - 1, selectedIndex + 1));
    } else if (key.return) {
      const selected = settings[selectedIndex];
      addToast({
        type: 'info',
        message: `Edit: ${selected?.name}`,
      });
    }
  });

  // Group settings by category
  const groupedSettings = settings.reduce(
    (acc, setting) => {
      if (!acc[setting.category]) {
        acc[setting.category] = [];
      }
      acc[setting.category].push(setting);
      return acc;
    },
    {} as Record<string, typeof settings>,
  );

  let currentIndex = 0;

  return (
    <Layout title="Settings" showSidebar>
      <Box flexDirection="column" padding={1}>
        {/* Info Box */}
        <Box borderStyle="round" borderColor="cyan" padding={1} marginBottom={1}>
          <Text>⚙️ Configure ManVerse TUI</Text>
        </Box>

        {/* Settings Groups */}
        {Object.entries(groupedSettings).map(([category, items]) => (
          <Box
            key={category}
            borderStyle="round"
            borderColor="gray"
            flexDirection="column"
            padding={1}
            marginBottom={1}
          >
            <Box marginBottom={1}>
              <Text bold color="cyan">
                {category}
              </Text>
            </Box>
            {items.map((setting) => {
              const idx = currentIndex++;
              return (
                <Box
                  key={setting.name}
                  justifyContent="space-between"
                  marginBottom={1}
                  paddingLeft={1}
                >
                  <Text bold={selectedIndex === idx}>
                    {selectedIndex === idx ? '› ' : '  '}
                    {setting.name}
                  </Text>
                  <Text color={selectedIndex === idx ? 'cyan' : 'white'}>{setting.value}</Text>
                </Box>
              );
            })}
          </Box>
        ))}

        {/* Actions */}
        <Box borderStyle="round" borderColor="yellow" padding={1}>
          <Text bold color="yellow">
            ⚡ Actions
          </Text>
          <Text>[⏎] Edit Setting</Text>
          <Text>[R] Reset to Defaults</Text>
          <Text>[E] Export Settings</Text>
          <Text>[I] Import Settings</Text>
        </Box>

        {/* Help Text */}
        <Box marginTop={1}>
          <Text dimColor>↑/↓ Navigate | ⏎ Edit | R Reset | Esc Back</Text>
        </Box>
      </Box>
    </Layout>
  );
};
