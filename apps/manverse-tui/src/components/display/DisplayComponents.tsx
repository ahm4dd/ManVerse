import React from 'react';
import { Box, Text } from 'ink';

interface EmptyStateProps {
  icon?: string;
  title: string;
  message: string;
  actionHint?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = '📭',
  title,
  message,
  actionHint,
}) => {
  return (
    <Box
      borderStyle="round"
      borderColor="gray"
      padding={2}
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
    >
      <Text>{icon}</Text>
      <Box marginTop={1}>
        <Text bold dimColor>
          {title}
        </Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>{message}</Text>
      </Box>
      {actionHint && (
        <Box marginTop={1}>
          <Text color="cyan">{actionHint}</Text>
        </Box>
      )}
    </Box>
  );
};

interface ErrorDisplayProps {
  error: Error | string;
  onRetry?: () => void;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ error, onRetry }) => {
  const errorMessage = error instanceof Error ? error.message : error;

  return (
    <Box borderStyle="round" borderColor="red" padding={2} flexDirection="column">
      <Text bold color="red">
        ✗ Error
      </Text>
      <Box marginTop={1}>
        <Text color="red">{errorMessage}</Text>
      </Box>
      {onRetry && (
        <Box marginTop={2}>
          <Box borderStyle="single" borderColor="yellow" padding={1}>
            <Text color="yellow">[R] Retry</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
};

interface StatsCardProps {
  title: string;
  value: number | string;
  icon?: string;
  color?: string;
}

export const StatsCard: React.FC<StatsCardProps> = ({ title, value, icon, color = 'cyan' }) => {
  return (
    <Box borderStyle="round" borderColor={color} padding={1} flexDirection="column">
      {icon && <Text>{icon}</Text>}
      <Text bold color={color}>
        {value}
      </Text>
      <Text dimColor>{title}</Text>
    </Box>
  );
};
