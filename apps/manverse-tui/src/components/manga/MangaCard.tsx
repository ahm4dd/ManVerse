import React from 'react';
import { Box, Text } from 'ink';
import type { SearchedManhwa } from '@manverse/core';

interface MangaCardProps {
  manga: SearchedManhwa | { id: number; title: string; coverImage?: string };
  selected?: boolean;
  compact?: boolean;
}

export const MangaCard: React.FC<MangaCardProps> = ({
  manga,
  selected = false,
  compact = false,
}) => {
  const title = 'title' in manga ? manga.title : '';
  const image =
    'image' in manga ? manga.image : 'coverImage' in manga ? manga.coverImage : undefined;

  if (compact) {
    return (
      <Box>
        <Text bold={selected} color={selected ? 'cyan' : 'white'}>
          {selected ? '› ' : '  '}
          {title}
        </Text>
      </Box>
    );
  }

  return (
    <Box
      borderStyle={selected ? 'round' : 'single'}
      borderColor={selected ? 'cyan' : 'gray'}
      flexDirection="column"
      padding={1}
    >
      <Text bold color={selected ? 'cyan' : 'white'}>
        {title}
      </Text>
      {image && (
        <Box marginTop={1}>
          <Text dimColor>Cover: {image.substring(0, 40)}...</Text>
        </Box>
      )}
    </Box>
  );
};
