import React from 'react';
import { Box, Text } from 'ink';
import type { UserLibraryDb } from '@manverse/database';
import { ProgressBar } from '../common/ProgressBar.js';

interface MangaListProps {
  items: UserLibraryDb[];
  selectedIndex: number;
  onSelect?: (index: number) => void;
}

export const MangaList: React.FC<MangaListProps> = ({ items, selectedIndex }) => {
  return (
    <Box flexDirection="column">
      {items.map((item, idx) => (
        <Box
          key={item.id}
          borderStyle={selectedIndex === idx ? 'round' : 'single'}
          borderColor={selectedIndex === idx ? 'cyan' : 'gray'}
          padding={1}
          marginBottom={1}
        >
          <Box flexDirection="column" flexGrow={1}>
            <Text bold color={selectedIndex === idx ? 'cyan' : 'white'}>
              {selectedIndex === idx ? '› ' : '  '}
              Manga ID: {item.provider_manga_id}
            </Text>
            {item.progress !== undefined && (
              <Box marginTop={1}>
                <Text dimColor>Progress: </Text>
                <ProgressBar current={item.progress} total={100} width={15} />
                <Text> {item.progress} chapters</Text>
              </Box>
            )}
            <Box marginTop={1}>
              <Text dimColor>
                Status: {item.status} | Score: {item.score || 'N/A'}
                {item.is_favorite ? ' | ⭐ Favorite' : ''}
              </Text>
            </Box>
          </Box>
        </Box>
      ))}
    </Box>
  );
};
