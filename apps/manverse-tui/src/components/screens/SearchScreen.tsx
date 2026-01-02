import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { Layout } from '../common/Layout.js';
import { LoadingSpinner } from '../common/LoadingSpinner.js';
import { useAppStore } from '../../state/store.js';
import { AniListClient } from '@manverse/anilist';
import { AsuraScansScarper } from '@manverse/scrapers';
import { searchLocalAnilist } from '@manverse/database';
import type { SearchedManhwa } from '@manverse/core';
import type { AniListMangaDb } from '@manverse/database';

interface SearchResults {
  anilist: Array<{ id: number; title: string; coverImage?: string }>;
  provider: SearchedManhwa[];
  loading: boolean;
  error: string | null;
}

export const SearchScreen: React.FC = () => {
  const { setScreen, browser, isAuthenticated, accessToken, addToast } = useAppStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults>({
    anilist: [],
    provider: [],
    loading: false,
    error: null,
  });
  const [selectedPane, setSelectedPane] = useState<'anilist' | 'provider'>('anilist');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchFocused, setSearchFocused] = useState(true);

  // Debounced search
  useEffect(() => {
    if (!query || query.length < 2) {
      setResults({ anilist: [], provider: [], loading: false, error: null });
      return;
    }

    const timer = setTimeout(() => {
      performSearch(query);
    }, 500);

    return () => clearTimeout(timer);
  }, [query]);

  const performSearch = async (searchQuery: string) => {
    setResults((prev) => ({ ...prev, loading: true, error: null }));

    try {
      // Search AniList (local cache first)
      const localResults = searchLocalAnilist(searchQuery, 10);

      let anilistResults = localResults.map((item: AniListMangaDb) => ({
        id: item.id,
        title: item.title_romaji || item.title_english || 'Unknown',
        coverImage: item.cover_image_url || undefined,
      }));

      // If authenticated and no local results, search API
      if (anilistResults.length === 0 && isAuthenticated && accessToken) {
        const client = AniListClient.create({
          clientId: process.env.ANILIST_CLIENT_ID || '',
          clientSecret: process.env.ANILIST_CLIENT_SECRET || '',
        });
        // CORRECT: AuthToken needs tokenType and expiresIn
        client.setToken({
          accessToken,
          tokenType: 'Bearer',
          expiresIn: 3600,
          expiresAt: Date.now() + 3600000,
        });
        const apiResults = await client.searchManga(searchQuery);
        anilistResults = apiResults.media.map((item) => ({
          id: item.id,
          title: item.title?.romaji || item.title?.english || 'Unknown',
          coverImage: item.coverImage?.large,
        }));
      }

      // Search provider (AsuraScans)
      let providerResults: SearchedManhwa[] = [];
      if (browser) {
        const page = await browser.newPage();
        try {
          const scraper = new AsuraScansScarper();
          const searchResult = await scraper.search(false, page, searchQuery, 1);
          providerResults = searchResult.results as SearchedManhwa[];
        } catch (error) {
          console.error('Provider search failed:', error);
        } finally {
          await page.close();
        }
      }

      setResults({
        anilist: anilistResults,
        provider: providerResults,
        loading: false,
        error: null,
      });
      setSelectedIndex(0);
    } catch (error) {
      setResults({
        anilist: [],
        provider: [],
        loading: false,
        error: error instanceof Error ? error.message : 'Search failed',
      });
    }
  };

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
        // TODO: Navigate to manga detail screen
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
        {results.loading && (
          <Box marginBottom={1}>
            <LoadingSpinner message="Searching..." />
          </Box>
        )}

        {/* Error State */}
        {results.error && (
          <Box borderStyle="round" borderColor="red" padding={1} marginBottom={1}>
            <Text color="red">✗ {results.error}</Text>
          </Box>
        )}

        {/* Results */}
        {!results.loading && !results.error && query.length >= 2 && (
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
