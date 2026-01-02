import React from 'react';
import { Box, Text } from 'ink';

export const StatusBar: React.FC = () => {
  return (
    <Box borderStyle="single" borderColor="gray" paddingX={1}>
      <Text dimColor>↑/↓ Navigate | ⏎ Select | Tab Switch | Esc Back | q Quit | ? Help</Text>
    </Box>
  );
};
