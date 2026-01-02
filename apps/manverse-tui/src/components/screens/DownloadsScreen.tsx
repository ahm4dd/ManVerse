import React from 'react';
import { Box, Text, useInput } from 'ink';
import { Layout } from '../common/Layout.js';
import { ProgressBar } from '../common/ProgressBar.js';
import { useDownloadStore } from '../../state/download-store.js';
import { useAppStore } from '../../state/store.js';
import { formatFileSize } from '../../utils/formatting.js';

export const DownloadsScreen: React.FC = () => {
  const { setScreen } = useAppStore();
  const { queue, removeJob, clearCompleted, concurrency } = useDownloadStore();

  const activeDownloads = queue.filter((j) => j.status === 'downloading');
  const queuedDownloads = queue.filter((j) => j.status === 'queued');
  const completedDownloads = queue.filter((j) => j.status === 'completed');
  const failedDownloads = queue.filter((j) => j.status === 'failed');

  // Keyboard navigation
  useInput((input, key) => {
    if (key.escape) {
      setScreen('dashboard');
      return;
    }

    if (input === 'c') {
      clearCompleted();
    }
  });

  return (
    <Layout title="Downloads" showSidebar>
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
            ⬇️ Active: {activeDownloads.length} | 📋 Queued: {queuedDownloads.length} | ✅ Complete:{' '}
            {completedDownloads.length} | ❌ Failed: {failedDownloads.length}
          </Text>
          <Text dimColor>Concurrency: {concurrency}</Text>
        </Box>

        {/* Active Downloads */}
        {activeDownloads.length > 0 && (
          <Box borderStyle="round" borderColor="green" padding={1} marginBottom={1}>
            <Box marginBottom={1}>
              <Text bold color="green">
                ⚡ Active Downloads
              </Text>
            </Box>
            {activeDownloads.map((job) => (
              <Box key={job.id} flexDirection="column" marginBottom={1}>
                <Text>{job.title}</Text>
                <Box>
                  <ProgressBar current={job.progress} total={100} width={30} />
                  <Text> {job.progress}%</Text>
                </Box>
                {job.error && <Text color="red">Error: {job.error}</Text>}
              </Box>
            ))}
          </Box>
        )}

        {/* Queued Downloads */}
        {queuedDownloads.length > 0 && (
          <Box borderStyle="round" borderColor="yellow" padding={1} marginBottom={1}>
            <Box marginBottom={1}>
              <Text bold color="yellow">
                📋 Queued ({queuedDownloads.length})
              </Text>
            </Box>
            {queuedDownloads.slice(0, 5).map((job) => (
              <Box key={job.id}>
                <Text dimColor>• {job.title}</Text>
              </Box>
            ))}
            {queuedDownloads.length > 5 && (
              <Text dimColor>... and {queuedDownloads.length - 5} more</Text>
            )}
          </Box>
        )}

        {/* Completed Downloads */}
        {completedDownloads.length > 0 && (
          <Box borderStyle="round" borderColor="blue" padding={1} marginBottom={1}>
            <Box marginBottom={1} justifyContent="space-between">
              <Text bold color="blue">
                ✅ Completed ({completedDownloads.length})
              </Text>
              <Text dimColor>[C] Clear</Text>
            </Box>
            {completedDownloads.slice(0, 5).map((job) => (
              <Box key={job.id}>
                <Text>✓ {job.title}</Text>
              </Box>
            ))}
            {completedDownloads.length > 5 && (
              <Text dimColor>... and {completedDownloads.length - 5} more</Text>
            )}
          </Box>
        )}

        {/* Failed Downloads */}
        {failedDownloads.length > 0 && (
          <Box borderStyle="round" borderColor="red" padding={1} marginBottom={1}>
            <Box marginBottom={1}>
              <Text bold color="red">
                ❌ Failed ({failedDownloads.length})
              </Text>
            </Box>
            {failedDownloads.slice(0, 5).map((job) => (
              <Box key={job.id} flexDirection="column">
                <Text color="red">✗ {job.title}</Text>
                {job.error && <Text dimColor> {job.error}</Text>}
              </Box>
            ))}
          </Box>
        )}

        {/* Empty State */}
        {queue.length === 0 && (
          <Box
            borderStyle="round"
            borderColor="gray"
            padding={2}
            justifyContent="center"
            alignItems="center"
          >
            <Text dimColor>No downloads yet. Search for manga and start downloading!</Text>
          </Box>
        )}

        {/* Help Text */}
        <Box marginTop={1}>
          <Text dimColor>C Clear completed | Esc Back</Text>
        </Box>
      </Box>
    </Layout>
  );
};
