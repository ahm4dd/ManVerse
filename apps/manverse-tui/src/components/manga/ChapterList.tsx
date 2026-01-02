import React from 'react';
import { Box, Text } from 'ink';
import type { Manhwa } from '@manverse/core';

type ChapterItem = Manhwa['chapters'][number];

interface ChapterListProps {
  chapters: ChapterItem[];
  selectedIndex: number;
  onSelect?: (index: number) => void;
}

export const ChapterList: React.FC<ChapterListProps> = ({ chapters, selectedIndex }) => {
  return (
    <Box flexDirection="column">
      {chapters.map((chapter, idx) => (
        <Box
          key={idx}
          borderStyle={selectedIndex === idx ? 'round' : 'single'}
          borderColor={selectedIndex === idx ? 'cyan' : 'gray'}
          padding={1}
          marginBottom={1}
        >
          <Box flexDirection="column">
            <Text bold={selectedIndex === idx} color={selectedIndex === idx ? 'cyan' : 'white'}>
              {selectedIndex === idx ? '› ' : '  '}
              Chapter {chapter.chapterNumber}
              {chapter.chapterTitle && `: ${chapter.chapterTitle}`}
            </Text>
            {chapter.releaseDate && (
              <Box marginTop={1}>
                <Text dimColor>Released: {chapter.releaseDate}</Text>
              </Box>
            )}
          </Box>
        </Box>
      ))}
    </Box>
  );
};
