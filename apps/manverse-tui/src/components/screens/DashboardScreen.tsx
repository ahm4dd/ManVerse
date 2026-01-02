import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { Layout } from '../common/Layout.js';
import { ProgressBar } from '../common/ProgressBar.js';
import { useLibraryStore } from '../../state/library-store.js';
import { useDownloadStore } from '../../state/download-store.js';
import { useAppStore } from '../../state/store.js';
import { getLibraryStats, getRecentlyRead, getNeedsSyncList } from '@manverse/database';
import type { UserLibraryDb } from '@manverse/database';
import { formatRelativeTime } from '../../utils/formatting.js';

export const DashboardScreen: React.FC = () => {
  const { user, isAuthenticated, setScreen } = useAppStore();
  const { stats, setStats } = useLibraryStore();
  const { queue } = useDownloadStore();

  const [recentlyRead, setRecentlyRead] = useState<UserLibraryDb[]>([]);
  const [syncStatus, setSyncStatus] = useState({ synced: 0, needsSync: 0, lastSync: 0 });

  // Load dashboard data
  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      // Load stats
      const libraryStats = getLibraryStats();
      setStats(libraryStats);

      // Load recently read
      const recent = getRecentlyRead(5);
      setRecentlyRead(recent);

      // Load sync status (if authenticated)
      if (isAuthenticated) {
        const needsSync = getNeedsSyncList();
        setSyncStatus({
          synced: libraryStats.total - needsSync.length,
          needsSync: needsSync.length,
          lastSync: Date.now() - 2 * 60 * 60 * 1000, // Placeholder: 2 hours ago
        });
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    }
  };

  // Keyboard shortcuts
  useInput((input) => {
    if (input === 's') setScreen('search');
    if (input === 'l') setScreen('library');
    if (input === 'd') setScreen('downloads');
    if (input === 'y' && isAuthenticated) setScreen('sync');
    if (input === 'p') setScreen('providers');
  });

  return (
    <Layout title="Dashboard" showSidebar>
      <Box flexDirection="column" padding={1}>
        {/* Welcome Message */}
        <Box marginBottom={1}>
          <Text>
            Welcome back,{' '}
            <Text bold color="cyan">
              {user?.username || 'Guest'}
            </Text>
            !
          </Text>
        </Box>

        <Box flexDirection="row" gap={2}>
          {/* Left Column */}
          <Box flexDirection="column" width="50%">
            {/* Library Overview */}
            <Box
              borderStyle="round"
              borderColor="cyan"
              flexDirection="column"
              padding={1}
              marginBottom={1}
            >
              <Text bold color="cyan">
                📊 Library Overview
              </Text>
              <Box flexDirection="column" marginTop={1}>
                <Text>📚 Total Manga: {stats?.total || 0}</Text>
                <Text>📖 Currently Reading: {stats?.reading || 0}</Text>
                <Text>✅ Completed: {stats?.completed || 0}</Text>
                <Text>📝 Plan to Read: {stats?.plan_to_read || 0}</Text>
                <Text>⭐ Favorites: {stats?.favorites || 0}</Text>
              </Box>
            </Box>

            {/* Sync Status (if authenticated) */}
            {isAuthenticated && (
              <Box
                borderStyle="round"
                borderColor="yellow"
                flexDirection="column"
                padding={1}
                marginBottom={1}
              >
                <Text bold color="yellow">
                  🔄 Sync Status
                </Text>
                <Box flexDirection="column" marginTop={1}>
                  <Text>✓ Synced: {syncStatus.synced} manga</Text>
                  <Text color={syncStatus.needsSync > 0 ? 'yellow' : 'green'}>
                    {syncStatus.needsSync > 0 ? '⚠' : '✓'} Needs Sync: {syncStatus.needsSync} manga
                  </Text>
                  <Text dimColor>⚡ Last synced: {formatRelativeTime(syncStatus.lastSync)}</Text>
                </Box>
              </Box>
            )}

            {/* Recent Downloads */}
            <Box borderStyle="round" borderColor="green" flexDirection="column" padding={1}>
              <Text bold color="green">
                📥 Recent Downloads
              </Text>
              <Box flexDirection="column" marginTop={1}>
                {queue.slice(0, 3).map((job) => (
                  <Box key={job.id} marginBottom={0} flexDirection="column">
                    {job.status === 'completed' && (
                      <Text>
                        ✓ {job.mangaTitle} Ch {job.chapterNumber}
                      </Text>
                    )}
                    {job.status === 'downloading' && (
                      <Box flexDirection="column">
                        <Text>
                          ⏳ {job.mangaTitle} Ch {job.chapterNumber}
                        </Text>
                        <Box>
                          <ProgressBar current={job.progress} total={100} width={15} />
                          <Text> {job.progress}%</Text>
                        </Box>
                      </Box>
                    )}
                  </Box>
                ))}
                {queue.length === 0 && <Text dimColor>No recent downloads</Text>}
              </Box>
            </Box>
          </Box>

          {/* Right Column */}
          <Box flexDirection="column" width="50%">
            {/* Recently Read */}
            <Box
              borderStyle="round"
              borderColor="magenta"
              flexDirection="column"
              padding={1}
              marginBottom={1}
            >
              <Text bold color="magenta">
                🔥 Recently Read
              </Text>
              <Box flexDirection="column" marginTop={1}>
                {recentlyRead.length > 0 ? (
                  <Text>📖 {recentlyRead.length} manga read recently</Text>
                ) : (
                  <Text dimColor>Start reading to see your history here</Text>
                )}
              </Box>
            </Box>

            {/* Quick Actions */}
            <Box borderStyle="round" borderColor="blue" flexDirection="column" padding={1}>
              <Text bold color="blue">
                🎯 Quick Actions
              </Text>
              <Box flexDirection="column" marginTop={1}>
                <Text>[S] Search Manga</Text>
                <Text>[L] View Library</Text>
                <Text>[D] Download Manager</Text>
                {isAuthenticated && <Text>[Y] Sync with AniList</Text>}
                <Text>[P] Provider Settings</Text>
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    </Layout>
  );
};
