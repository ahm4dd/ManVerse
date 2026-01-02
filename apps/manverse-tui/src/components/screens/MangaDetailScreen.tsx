import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { Layout } from '../common/Layout.js';
import { LoadingSpinner } from '../common/LoadingSpinner.js';
import { ProgressBar } from '../common/ProgressBar.js';
import { useAppStore } from '../../state/store.js';
import { useDownloadStore } from '../../state/download-store.js';
import { getAnilistManga, getLibraryEntry, getMapping } from '@manverse/database';
import { AsuraScansScarper } from '@manverse/scrapers';
import { ChapterList } from '../manga/ChapterList.js';
import type { Manhwa } from '@manverse/core';

type ChapterItem = Manhwa['chapters'][number];

interface MangaDetailProps {
  anilistId?: number;
  provider?: string;
  providerMangaId?: number;
}

export const MangaDetailScreen: React.FC = () => {

  const { setScreen, browser, addToast, selectedManga } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [anilistData, setAnilistData] = useState<any>(null);
  const [providerData, setProviderData] = useState<Manhwa | null>(null);
  const [chapters, setChapters] = useState<ChapterItem[]>([]);
  const [libraryEntry, setLibraryEntry] = useState<any>(null);
  const { addToQueue, queue } = useDownloadStore();
  const [selectedChapterIndex, setSelectedChapterIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'info' | 'chapters' | 'providers'>('info');

  useEffect(() => {
    if (selectedManga) {
      loadMangaDetails();
    }
  }, [selectedManga]);

  const loadMangaDetails = async () => {
    setLoading(true);
    try {
      let mapping = null;
      
      // 1. Load AniList data if ID is present
      if (selectedManga?.id) {
        const anilist = getAnilistManga(selectedManga.id);
        setAnilistData(anilist);
        
        if (anilist) {
           mapping = getMapping(anilist.id);
           if (mapping) {
             const library = getLibraryEntry(mapping.provider, mapping.provider_manga_id);
             setLibraryEntry(library);
           }
        }
      }

      // 2. Determine provider URL (from mapping or direct selection)
      let providerUrl = selectedManga?.providerUrl;
      if (mapping) {
          // TODO: Use provider specific URL builder
          providerUrl = `https://asuracomic.net/series/${mapping.provider_manga_id}`;
      }

      // 3. Scrape provider data if URL is available
      if (providerUrl && browser) {
        const page = await browser.newPage();
        try {
          const scraper = new AsuraScansScarper();
          const manhwa = await scraper.checkManhwa(page, providerUrl);
          setProviderData(manhwa);
          setChapters(manhwa.chapters || []);
        } catch (error) {
          console.error('Failed to load provider data:', error);
          if (!anilistData) { // If this was our only source, show error
             addToast({ type: 'error', message: 'Failed to load provider details' });
          }
        } finally {
          await page.close();
        }
      }
    } catch (error) {
      console.error('Failed to load manga details:', error);
      addToast({ type: 'error', message: 'Failed to load manga details' });
    } finally {
      setLoading(false);
    }
  };
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

        const alreadyQueued = queue.some((j) => j.chapterUrl === selected.chapterUrl);
        if (alreadyQueued) {
          addToast({ type: 'warning', message: 'Chapter already in download queue' });
          return;
        }

        addToQueue({
          mangaTitle: anilistData?.title_romaji || providerData?.title || 'Unknown',
          chapterNumber: selected.chapterNumber,
          chapterUrl: selected.chapterUrl,
          provider: 'asura',
          providerMangaId: 0,
          totalFiles: 0,
        });

        addToast({
          type: 'success',
          message: `Added Chapter ${selected.chapterNumber} to queue`,
        });
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
              <Text>[A] Add to Library</Text>
              <Text>[S] Sync with AniList</Text>
              <Text>[D] Download Chapters</Text>
              <Text>[M] Map to Provider</Text>
            </Box>
          </Box>
        )}

        {/* Chapters View */}
        {viewMode === 'chapters' && (
          <Box flexDirection="column">
            {chapters.length === 0 ? (
              <Text dimColor>No chapters found</Text>
            ) : (
              <Box flexDirection="column">
                <ChapterList
                  chapters={chapters.slice(
                    Math.max(0, Math.min(
                        selectedChapterIndex - 7,
                        chapters.length - 15
                    )),
                    Math.max(0, Math.min(
                        selectedChapterIndex - 7,
                        chapters.length - 15
                    )) + 15
                  ).map(c => c)} // slice returns correct type
                  selectedIndex={selectedChapterIndex - Math.max(0, Math.min(
                        selectedChapterIndex - 7,
                        chapters.length - 15
                    ))}
                />
                
                {chapters.length > 15 && (
                    <Box marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
                       <Text dimColor>
                         {Math.floor((selectedChapterIndex / chapters.length) * 100)}% 
                         ({selectedChapterIndex + 1}/{chapters.length})
                       </Text>
                    </Box>
                )}
              </Box>
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
