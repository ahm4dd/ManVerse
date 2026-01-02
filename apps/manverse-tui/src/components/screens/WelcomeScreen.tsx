import React, { useState } from 'react';
import { Box, Text } from 'ink';
import Gradient from 'ink-gradient';
import BigText from 'ink-big-text';
import SelectInput from 'ink-select-input';
import { LoadingSpinner } from '../common/LoadingSpinner.js';
import { AniListClient } from '@manverse/anilist';
import { useAppStore } from '../../state/store.js';

const options = [
  {
    label: '🌐 Login with AniList',
    value: 'anilist',
  },
  {
    label: '👤 Continue as Guest',
    value: 'guest',
  },
];

export const WelcomeScreen: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login, setScreen } = useAppStore();

  const handleSelect = async (item: { value: string }) => {
    if (item.value === 'guest') {
      // Skip authentication, go directly to dashboard
      setScreen('dashboard');
      return;
    }

    // AniList OAuth flow
    setLoading(true);
    setError(null);

    try {
      const clientId = process.env.ANILIST_CLIENT_ID;
      const clientSecret = process.env.ANILIST_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        throw new Error(
          'AniList credentials not configured. Please set ANILIST_CLIENT_ID and ANILIST_CLIENT_SECRET in your .env file.',
        );
      }

      const client = AniListClient.create({
        clientId,
        clientSecret,
      });

      // Start OAuth flow (opens browser)
      const token = await client.authenticate();

      // Get user info
      const user = await client.getCurrentUser();

      // Save to store (this will also navigate to dashboard)
      login(
        {
          id: user.id,
          username: user.name,
          avatar: user.avatar?.large,
        },
        token.accessToken,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
      setLoading(false);
    }
  };

  return (
    <Box flexDirection="column" padding={2}>
      {/* ASCII Art Title */}
      <Box justifyContent="center" marginBottom={1}>
        <Gradient name="rainbow">
          <BigText text="MANVERSE" font="block" />
        </Gradient>
      </Box>

      <Box justifyContent="center" marginBottom={1}>
        <Text color="cyan" bold>
          v0.1.0
        </Text>
      </Box>

      <Box justifyContent="center" marginBottom={2}>
        <Text dimColor>Your Ultimate Manga Reading Manager</Text>
      </Box>

      {/* Selection Menu */}
      {!loading && !error && (
        <Box flexDirection="column" paddingX={4}>
          <SelectInput items={options} onSelect={handleSelect} />
        </Box>
      )}

      {/* Loading State */}
      {loading && (
        <Box justifyContent="center">
          <LoadingSpinner message="Authenticating with AniList..." />
        </Box>
      )}

      {/* Error State */}
      {error && (
        <Box flexDirection="column" borderStyle="round" borderColor="red" padding={1} marginX={4}>
          <Text color="red" bold>
            ✗ Error
          </Text>
          <Text>{error}</Text>
          <Text dimColor>Press Esc to try again</Text>
        </Box>
      )}

      {/* Help Text */}
      {!loading && !error && (
        <Box justifyContent="center" marginTop={2}>
          <Text dimColor>↑/↓ Navigate | ⏎ Select | q Quit</Text>
        </Box>
      )}
    </Box>
  );
};
