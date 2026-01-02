import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { Layout } from '../common/Layout.js';
import { LoadingSpinner } from '../common/LoadingSpinner.js';
import { useAppStore } from '../../state/store.js';
import { useMangaSearch } from '../../hooks/useMangaSearch.js';
import type { SearchedManhwa } from '@manverse/core';

export const SearchScreen: React.FC = () => {
  const { setScreen, addToast, setSelectedManga } = useAppStore();
  const [query, setQuery] = useState('');
  const { results, loading, error, search, clear } = useMangaSearch();
  const [selectedPane, setSelectedPane] = useState<'anilist' | 'provider'>('anilist');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchFocused, setSearchFocused] = useState(true);

  // Debounced search
  useEffect(() => {
    if (!query || query.length < 2) {
      clear();
      return;
    }

    const timer = setTimeout(() => {
      search(query);
      setSelectedIndex(0);
    }, 500);

    return () => clearTimeout(timer);
  }, [query, search, clear]);

  // Keyboard navigation
  useInput((input, key) => {
    if (searchFocused) {
      if (key.escape) {
        setSearchFocused(false);
      }
      return;
    }

    // Navigation
    if (key.escape) {
      setScreen('dashboard');
      return;
    }

    if (input === '/') {
      setSearchFocused(true);
      return;
    }

    if (key.tab) {
      setSelectedPane(selectedPane === 'anilist' ? 'provider' : 'anilist');
      setSelectedIndex(0);
      return;
    }

    const currentList = selectedPane === 'anilist' ? results.anilist : results.provider;

    if (key.upArrow) {
      setSelectedIndex(Math.max(0, selectedIndex - 1));
    } else if (key.downArrow) {
      setSelectedIndex(Math.min(currentList.length - 1, selectedIndex + 1));
    } else if (key.return && currentList.length > 0) {
      const selected = currentList[selectedIndex];
      if (selected) {
        addToast({
          type: 'info',
          message: `Selected: ${selectedPane === 'anilist' ? selected.title : (selected as SearchedManhwa).title}`,
        });
        // Navigate to manga detail screen
        if (selectedPane === 'anilist') {
          const m = selected as { id: number; title: string };
          setSelectedManga({ id: m.id, title: m.title });
        } else {
          const m = selected as SearchedManhwa;
          setSelectedManga({ providerUrl: m.id, title: m.title });
        }
        setScreen('manga-detail');
      }
    }
  });

  const anilistList = results.anilist || [];
  const providerList = results.provider || [];

  return (
    <Layout title="Search" showSidebar>
      <Box flexDirection="column" padding={1}>
        {/* Search Input */}
        <Box marginBottom={1}>
          <Text bold color="cyan">
            🔍 Search:{' '}
          </Text>
          <TextInput
            value={query}
            onChange={setQuery}
            placeholder="Enter manga title..."
            focus={searchFocused}
            onSubmit={() => setSearchFocused(false)}
          />
          {searchFocused && <Text dimColor> (Esc to navigate results)</Text>}
        </Box>

        {/* Loading State */}
        {loading && (
          <Box marginBottom={1}>
            <LoadingSpinner message="Searching..." />
          </Box>
        )}

        {/* Error State */}
        {error && (
          <Box borderStyle="round" borderColor="red" padding={1} marginBottom={1}>
            <Text color="red">✗ {error}</Text>
          </Box>
        )}

        {/* Results */}
        {!loading && !error && query.length >= 2 && (
          <Box flexDirection="row" gap={2}>
            {/* AniList Results */}
            <Box
              borderStyle="round"
              borderColor={selectedPane === 'anilist' ? 'cyan' : 'gray'}
              flexDirection="column"
              width="50%"
              padding={1}
            >
              <Box marginBottom={1}>
                <Text bold color="cyan">
                  📚 AniList ({anilistList.length})
                </Text>
              </Box>
              {anilistList.length === 0 ? (
                <Text dimColor>No results</Text>
              ) : (
                <Box flexDirection="column">
                  {anilistList.slice(0, 10).map((item, idx) => (
                    <Text
                      key={item.id}
                      color={selectedPane === 'anilist' && selectedIndex === idx ? 'cyan' : 'white'}
                      bold={selectedPane === 'anilist' && selectedIndex === idx}
                    >
                      {selectedPane === 'anilist' && selectedIndex === idx ? '› ' : '  '}
                      {item.title}
                    </Text>
                  ))}
                </Box>
              )}
            </Box>

            {/* Provider Results */}
            <Box
              borderStyle="round"
              borderColor={selectedPane === 'provider' ? 'magenta' : 'gray'}
              flexDirection="column"
              width="50%"
              padding={1}
            >
              <Box marginBottom={1}>
                <Text bold color="magenta">
                  🔌 AsuraScans ({providerList.length})
                </Text>
              </Box>
              {providerList.length === 0 ? (
                <Text dimColor>No results</Text>
              ) : (
                <Box flexDirection="column">
                  {providerList.slice(0, 10).map((item, idx) => (
                    <Text
                      key={item.id}
                      color={
                        selectedPane === 'provider' && selectedIndex === idx ? 'magenta' : 'white'
                      }
                      bold={selectedPane === 'provider' && selectedIndex === idx}
                    >
                      {selectedPane === 'provider' && selectedIndex === idx ? '› ' : '  '}
                      {item.title}
                    </Text>
                  ))}
                </Box>
              )}
            </Box>
          </Box>
        )}

        {/* Help Text */}
        {!searchFocused && (
          <Box marginTop={1}>
            <Text dimColor>
              / Focus search | Tab Switch panes | ↑/↓ Navigate | ⏎ Select | Esc Back
            </Text>
          </Box>
        )}
      </Box>
    </Layout>
  );
};
