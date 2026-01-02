import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { Layout } from '../common/Layout.js';
import { LoadingSpinner } from '../common/LoadingSpinner.js';
import { useAppStore } from '../../state/store.js';
import { getNeedsSyncList } from '@manverse/database';
import type { AnilistSyncStateDb } from '@manverse/database';

export const SyncScreen: React.FC = () => {
  const { setScreen, isAuthenticated, addToast } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [needsSync, setNeedsSync] = useState<AnilistSyncStateDb[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    loadSyncData();
  }, []);

  const loadSyncData = async () => {
    setLoading(true);
    try {
      const syncList = getNeedsSyncList();
      setNeedsSync(syncList);
    } catch (error) {
      console.error('Failed to load sync data:', error);
    } finally {
      setLoading(false);
    }
  };

  const syncAll = async () => {
    setSyncing(true);
    addToast({ type: 'info', message: 'Starting sync...' });
    // TODO: Implement actual sync
    setTimeout(() => {
      setSyncing(false);
      addToast({ type: 'success', message: 'Sync completed!' });
      loadSyncData();
    }, 2000);
  };

  // Keyboard navigation
  useInput((input, key) => {
    if (key.escape) {
      setScreen('dashboard');
      return;
    }

    if (input === 's' && !syncing) {
      syncAll();
    }

    if (key.upArrow) {
      setSelectedIndex(Math.max(0, selectedIndex - 1));
    } else if (key.downArrow) {
      setSelectedIndex(Math.min(needsSync.length - 1, selectedIndex + 1));
    }
  });

  if (loading) {
    return (
      <Layout title="AniList Sync" showSidebar>
        <Box padding={2} justifyContent="center" alignItems="center">
          <LoadingSpinner message="Loading sync status..." />
        </Box>
      </Layout>
    );
  }

  if (!isAuthenticated) {
    return (
      <Layout title="AniList Sync" showSidebar>
        <Box padding={2} justifyContent="center" alignItems="center">
          <Box borderStyle="round" borderColor="yellow" padding={2}>
            <Text color="yellow">⚠️ AniList authentication required for sync</Text>
            <Text dimColor>Please login from Welcome screen</Text>
          </Box>
        </Box>
      </Layout>
    );
  }

  return (
    <Layout title="AniList Sync" showSidebar>
      <Box flexDirection="column" padding={1}>
        {/* Stats Bar */}
        <Box borderStyle="round" borderColor="cyan" padding={1} marginBottom={1}>
          <Text>
            🔄 Needs Sync: {needsSync.length} | ✅ Synced: {0} | Last Sync: Never
          </Text>
        </Box>

        {/* Sync Actions */}
        <Box borderStyle="round" borderColor="green" padding={1} marginBottom={1}>
          <Text bold color="green">
            ⚡ Actions
          </Text>
          <Text>{syncing ? '⏳ Syncing...' : '[S] Sync All'}</Text>
          <Text>[P] Pull from AniList</Text>
          <Text>[U] Push to AniList</Text>
        </Box>

        {/* Sync List */}
        {needsSync.length === 0 ? (
          <Box
            borderStyle="round"
            borderColor="gray"
            padding={2}
            justifyContent="center"
            alignItems="center"
          >
            <Text color="green">✓ Everything is synced!</Text>
          </Box>
        ) : (
          <Box borderStyle="round" borderColor="yellow" padding={1}>
            <Box marginBottom={1}>
              <Text bold color="yellow">
                📋 Pending Sync ({needsSync.length})
              </Text>
            </Box>
            {needsSync.slice(0, 10).map((item, idx) => (
              <Box key={idx} marginBottom={1}>
                <Text bold={selectedIndex === idx}>
                  {selectedIndex === idx ? '› ' : '  '}
                  AniList ID: {item.anilist_id}
                </Text>
                <Text dimColor>
                  {' '}
                  Direction: {item.sync_direction} | Local: {item.local_progress} | AniList:{' '}
                  {item.anilist_progress}
                </Text>
              </Box>
            ))}
          </Box>
        )}

        {/* Help Text */}
        <Box marginTop={1}>
          <Text dimColor>S Sync all | P Pull | U Push | ↑/↓ Navigate | Esc Back</Text>
        </Box>
      </Box>
    </Layout>
  );
};
