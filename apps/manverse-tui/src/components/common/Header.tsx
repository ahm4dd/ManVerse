import React from 'react';
import { Box, Text } from 'ink';
import { useAppStore } from '../../state/store.js';

export const Header: React.FC<{ title: string }> = ({ title }) => {
  const { user } = useAppStore();

  return (
    <Box borderStyle="single" borderColor="cyan" paddingX={1} justifyContent="space-between">
      <Text bold color="cyan">
        ManVerse › {title}
      </Text>
      {user && <Text dimColor>@{user.username}</Text>}
    </Box>
  );
};
