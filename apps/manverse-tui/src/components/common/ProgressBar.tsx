import React from 'react';
import { Box, Text } from 'ink';

interface ProgressBarProps {
  current: number;
  total: number;
  width?: number;
  showPercentage?: boolean;
  color?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  current,
  total,
  width = 20,
  showPercentage = false,
  color = 'cyan',
}) => {
  const percentage = total > 0 ? Math.floor((current / total) * 100) : 0;
  const filled = Math.floor((percentage / 100) * width);
  const empty = width - filled;

  return (
    <Box>
      <Text color={color}>{'▓'.repeat(filled)}</Text>
      <Text dimColor>{'░'.repeat(empty)}</Text>
      {showPercentage && <Text> {percentage}%</Text>}
    </Box>
  );
};
