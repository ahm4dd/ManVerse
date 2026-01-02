import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { Layout } from '../common/Layout.js';
import { ProgressBar } from '../common/ProgressBar.js';
import { useLibraryStore } from '../../state/library-store.js';
import { useAppStore } from '../../state/store.js';
import { getLibrary, getLibraryStats } from '@manverse/database';
import type { UserLibraryDb } from '@manverse/database';

export const LibraryScreen: React.FC = () => {
  const { setScreen } = useAppStore();
  const { stats, setStats, selectedStatus, setSelectedStatus } = useLibraryStore();
  const [library, setLibrary] = useState<UserLibraryDb[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filterMode, setFilterMode] = useState(false);

  // Load library data
  useEffect(() => {
    loadLibrary();
  }, [selectedStatus]);

  const loadLibrary = async () => {
    try {
      const libraryStats = getLibraryStats();
      setStats(libraryStats);

      const libraryData = selectedStatus ? getLibrary(selectedStatus) : getLibrary();
      setLibrary(libraryData);
      setSelectedIndex(0);
    } catch (error) {
      console.error('Failed to load library:', error);
    }
  };

  // Keyboard navigation
  useInput((input, key) => {
    if (filterMode) {
      // Filter by status
      if (input === 'a') {
        setSelectedStatus(null); // All
        setFilterMode(false);
      } else if (input === 'r') {
        setSelectedStatus('reading');
        setFilterMode(false);
      } else if (input === 'c') {
        setSelectedStatus('completed');
        setFilterMode(false);
      } else if (input === 'p') {
        setSelectedStatus('plan_to_read');
        setFilterMode(false);
      } else if (input === 'h') {
        setSelectedStatus('paused');
        setFilterMode(false);
      } else if (input === 'd') {
        setSelectedStatus('dropped');
        setFilterMode(false);
      } else if (key.escape) {
        setFilterMode(false);
      }
      return;
    }

    // Normal navigation
    if (key.escape) {
      setScreen('dashboard');
      return;
    }

    if (input === 'f') {
      setFilterMode(true);
      return;
    }

    if (key.upArrow) {
      setSelectedIndex(Math.max(0, selectedIndex - 1));
    } else if (key.downArrow) {
      setSelectedIndex(Math.min(library.length - 1, selectedIndex + 1));
    } else if (key.return && library.length > 0) {
      const selected = library[selectedIndex];
      console.log('Selected:', selected);
      // TODO: Navigate to manga detail
    }
  });

  return (
    <Layout title="Library" showSidebar>
      <Box flexDirection="column" padding={1}>
        {/* Stats Bar */}
        <Box
          borderStyle="round"
          borderColor="cyan"
          padding={1}
          marginBottom={1}
          justifyContent="space-between"
        >
          <Text>
            📚 Total: {stats?.total || 0} | 📖 Reading: {stats?.reading || 0} | ✅ Completed:{' '}
            {stats?.completed || 0}
          </Text>
          <Text dimColor>[F] Filter</Text>
        </Box>

        {/* Filter Bar */}
        {filterMode && (
          <Box borderStyle="round" borderColor="yellow" padding={1} marginBottom={1}>
            <Text color="yellow" bold>
              Filter by:{' '}
            </Text>
            <Text>
              [A]ll | [R]eading | [C]ompleted | [P]lan to Read | [H]iatus | [D]ropped | Esc Cancel
            </Text>
          </Box>
        )}

        {/* Active Filter */}
        {selectedStatus && !filterMode && (
          <Box marginBottom={1}>
            <Text>
              Showing:{' '}
              <Text bold color="cyan">
                {selectedStatus.replace('_', ' ').toUpperCase()}
              </Text>
              <Text dimColor> (F to change)</Text>
            </Text>
          </Box>
        )}

        {/* Library List */}
        <Box flexDirection="column">
          {library.length === 0 ? (
            <Box
              borderStyle="round"
              borderColor="gray"
              padding={2}
              justifyContent="center"
              alignItems="center"
            >
              <Text dimColor>Your library is empty. Add manga from Search (S)!</Text>
            </Box>
          ) : (
            library.slice(0, 15).map((entry, idx) => (
              <Box
                key={entry.id}
                borderStyle={selectedIndex === idx ? 'round' : 'single'}
                borderColor={selectedIndex === idx ? 'cyan' : 'gray'}
                padding={1}
                marginBottom={1}
              >
                <Box flexDirection="column" flexGrow={1}>
                  <Text bold color={selectedIndex === idx ? 'cyan' : 'white'}>
                    {selectedIndex === idx ? '› ' : '  '}
                    {entry.provider_manga_id} - {entry.provider}
                  </Text>
                  <Box marginTop={1}>
                    <Text dimColor>Progress: </Text>
                    <ProgressBar current={entry.progress} total={100} width={15} />
                    <Text> {entry.progress} chapters</Text>
                  </Box>
                  <Box marginTop={1}>
                    <Text dimColor>
                      Status: {entry.status} | Score: {entry.score || 'N/A'} |{' '}
                      {entry.is_favorite ? '⭐ Favorite' : ''}
                    </Text>
                  </Box>
                </Box>
              </Box>
            ))
          )}
        </Box>

        {/* Help Text */}
        <Box marginTop={1}>
          <Text dimColor>
            ↑/↓ Navigate | ⏎ Select | F Filter | Esc Back | Showing {library.length} manga
          </Text>
        </Box>
      </Box>
    </Layout>
  );
};
