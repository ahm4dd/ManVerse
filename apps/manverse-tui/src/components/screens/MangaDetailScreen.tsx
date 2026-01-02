import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { Layout } from '../common/Layout.js';
import { LoadingSpinner } from '../common/LoadingSpinner.js';
import { ProgressBar } from '../common/ProgressBar.js';
import { useAppStore } from '../../state/store.js';
import { useDownloadStore } from '../../state/download-store.js';
import { getAnilistManga, getLibraryEntry, getMapping } from '@manverse/database';
import type { AniListMangaDb, UserLibraryDb } from '@manverse/database';
import { AsuraScansScarper } from '@manverse/scrapers';
import type { Manhwa } from '@manverse/core';

interface MangaDetailProps {
  anilistId?: number;
  provider?: string;
  providerMangaId?: number;
}

export const MangaDetailScreen: React.FC = () => {
  const { setScreen, browser, addToast } = useAppStore();
  const { addToQueue } = useDownloadStore();
  const [loading, setLoading] = useState(true);
  const [anilistData, setAnilistData] = useState<AniListMangaDb | null>(null);
  const [providerData, setProviderData] = useState<Manhwa | null>(null);
  const [chapters, setChapters] = useState<
    Array<{
      chapterNumber: string;
      chapterUrl: string;
      chapterTitle?: string;
      releaseDate?: string;
    }>
  >([]);
  const [libraryEntry, setLibraryEntry] = useState<UserLibraryDb | null>(null);
  const [selectedChapterIndex, setSelectedChapterIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'info' | 'chapters' | 'providers'>('info');

  // TODO: Get manga ID from props/navigation
  const mangaId = 1; // Placeholder
  const provider = 'asura'; // TODO: Get from navigation/context

  useEffect(() => {
    loadMangaDetails();
  }, []);

  const loadMangaDetails = async () => {
    setLoading(true);
    try {
      // Load from database
      const anilist = getAnilistManga(mangaId);
      setAnilistData(anilist);

      // Check if in library
      if (anilist) {
        const mapping = getMapping(anilist.id);
        if (mapping) {
          const library = getLibraryEntry(mapping.provider, mapping.provider_manga_id);
          setLibraryEntry(library);

          // Load provider data
          if (browser) {
            const page = await browser.newPage();
            try {
              const scraper = new AsuraScansScarper();
              // TODO: Get provider URL from mapping
              const providerUrl = `https://asuracomic.net/series/${mapping.provider_manga_id}`;
              const manhwa = await scraper.checkManhwa(page, providerUrl);
              setProviderData(manhwa);
              setChapters(manhwa.chapters || []);
            } catch (error) {
              console.error('Failed to load provider data:', error);
            } finally {
              await page.close();
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to load manga details:', error);
      addToast({ type: 'error', message: 'Failed to load manga details' });
    } finally {
      setLoading(false);
    }
  };

  // Keyboard navigation
  useInput((input, key) => {
    if (key.escape) {
      setScreen('search');
      return;
    }

    if (input === 'i') setViewMode('info');
    if (input === 'c') setViewMode('chapters');
    if (input === 'p') setViewMode('providers');

    if (viewMode === 'chapters') {
      if (key.upArrow) {
        setSelectedChapterIndex(Math.max(0, selectedChapterIndex - 1));
      } else if (key.downArrow) {
        setSelectedChapterIndex(Math.min(chapters.length - 1, selectedChapterIndex + 1));
      } else if (key.return && chapters.length > 0) {
        const selected = chapters[selectedChapterIndex];
        // Add to download queue
        if (providerData && selected) {
          addToQueue({
            mangaTitle: providerData.title,
            chapterNumber: selected.chapterNumber,
            chapterUrl: selected.chapterUrl,
            provider: provider, // Use dynamic provider
            providerMangaId: parseInt(providerData.id, 10),
            libraryId: libraryEntry?.id,
            totalFiles: 0,
          });
          addToast({
            type: 'success',
            message: `Added Chapter ${selected.chapterNumber} to download queue`,
          });
        }
      }
    }
  });

  if (loading) {
    return (
      <Layout title="Manga Details" showSidebar>
        <Box padding={2} justifyContent="center" alignItems="center">
          <LoadingSpinner message="Loading manga details..." />
        </Box>
      </Layout>
    );
  }

  return (
    <Layout title={anilistData?.title_romaji || 'Manga Details'} showSidebar>
      <Box flexDirection="column" padding={1}>
        {/* Tab Navigation */}
        <Box borderStyle="round" borderColor="cyan" padding={1} marginBottom={1}>
          <Text color={viewMode === 'info' ? 'cyan' : 'gray'} bold={viewMode === 'info'}>
            [I] Info
          </Text>
          <Text> | </Text>
          <Text color={viewMode === 'chapters' ? 'cyan' : 'gray'} bold={viewMode === 'chapters'}>
            [C] Chapters ({chapters.length})
          </Text>
          <Text> | </Text>
          <Text color={viewMode === 'providers' ? 'cyan' : 'gray'} bold={viewMode === 'providers'}>
            [P] Providers
          </Text>
        </Box>

        {/* Info View */}
        {viewMode === 'info' && (
          <Box flexDirection="column">
            {/* Title */}
            <Box marginBottom={1}>
              <Text bold color="cyan">
                {anilistData?.title_romaji || providerData?.title}
              </Text>
            </Box>

            {/* Description */}
            {anilistData?.description && (
              <Box borderStyle="round" borderColor="gray" padding={1} marginBottom={1}>
                <Text>{anilistData.description.substring(0, 200)}...</Text>
              </Box>
            )}

            {/* Stats */}
            <Box flexDirection="row" gap={2} marginBottom={1}>
              <Box borderStyle="round" borderColor="green" padding={1} width="50%">
                <Text bold color="green">
                  📊 Stats
                </Text>
                <Text>Status: {anilistData?.status || 'Unknown'}</Text>
                <Text>Chapters: {anilistData?.chapters || '?'}</Text>
                <Text>Score: {anilistData?.average_score || 'N/A'}/100</Text>
              </Box>

              {libraryEntry && (
                <Box borderStyle="round" borderColor="magenta" padding={1} width="50%">
                  <Text bold color="magenta">
                    📚 Your Progress
                  </Text>
                  <Box marginTop={1}>
                    <ProgressBar current={libraryEntry.progress} total={100} width={15} />
                    <Text> {libraryEntry.progress} chapters</Text>
                  </Box>
                  <Text>Status: {libraryEntry.status}</Text>
                  <Text>Score: {libraryEntry.score || 'Not rated'}</Text>
                </Box>
              )}
            </Box>

            {/* Actions */}
            <Box borderStyle="round" borderColor="yellow" padding={1}>
              <Text bold color="yellow">
                ⚡ Actions
              </Text>
              {!libraryEntry && anilistData && <Text>[A] Add to Library</Text>}
              {libraryEntry && (
                <>
                  <Text>[+] Increase Progress</Text>
                  <Text>[-] Decrease Progress</Text>
                  <Text>[R] Rate (1-10)</Text>
                  <Text>[F] Toggle Favorite</Text>
                </>
              )}
              <Text>[D] Download All</Text>
            </Box>
          </Box>
        )}

        {/* Chapters View */}
        {viewMode === 'chapters' && (
          <Box flexDirection="column">
            {chapters.length === 0 ? (
              <Text dimColor>No chapters found</Text>
            ) : (
              chapters.slice(0, 15).map((chapter, idx) => (
                <Box
                  key={idx}
                  borderStyle={selectedChapterIndex === idx ? 'round' : 'single'}
                  borderColor={selectedChapterIndex === idx ? 'cyan' : 'gray'}
                  padding={1}
                  marginBottom={1}
                >
                  <Text bold={selectedChapterIndex === idx}>
                    {selectedChapterIndex === idx ? '› ' : '  '}
                    Chapter {chapter.chapterNumber}
                    {chapter.chapterTitle && `: ${chapter.chapterTitle}`}
                  </Text>
                  {chapter.releaseDate && <Text dimColor> • {chapter.releaseDate}</Text>}
                </Box>
              ))
            )}
          </Box>
        )}

        {/* Providers View */}
        {viewMode === 'providers' && (
          <Box flexDirection="column">
            <Box borderStyle="round" borderColor="blue" padding={1} marginBottom={1}>
              <Text bold color="blue">
                🔌 Provider Mappings
              </Text>
              {providerData ? (
                <Box marginTop={1}>
                  <Text>✓ AsuraScans - Mapped</Text>
                  <Text dimColor>{providerData.title}</Text>
                </Box>
              ) : (
                <Text dimColor>No providers mapped</Text>
              )}
            </Box>

            <Box borderStyle="round" borderColor="yellow" padding={1}>
              <Text bold color="yellow">
                ➕ Add Provider
              </Text>
              <Text>[Enter URL] Manual link entry</Text>
              <Text>[Auto Search] Search providers for this manga</Text>
            </Box>
          </Box>
        )}

        {/* Help Text */}
        <Box marginTop={1}>
          <Text dimColor>I/C/P Switch views | ↑/↓ Navigate | ⏎ Select | Esc Back</Text>
        </Box>
      </Box>
    </Layout>
  );
};
