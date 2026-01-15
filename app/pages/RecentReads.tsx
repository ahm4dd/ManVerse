import React, { useEffect, useMemo, useState } from 'react';
import { history, type HistoryItem } from '../lib/history';
import { api } from '../lib/api';
import HistoryCard from '../components/HistoryCard';
import { ChevronLeft, SearchIcon } from '../components/Icons';
import { Providers, type Source, isProviderSource, providerOptions, providerShortLabel } from '../lib/providers';

interface RecentReadsProps {
  onNavigate: (view: string, data?: any) => void;
  onBack: () => void;
}

type SourceFilter = 'All' | Source;
type SortOrder = 'Recent' | 'Oldest' | 'Tracked' | 'Local';

interface CardItem {
  id: string;
  anilistId?: string;
  providerSeriesId?: string;
  title: string;
  image: string;
  chapterNumber: string;
  chapterId?: string;
  timestamp: number;
  source: Source;
  progressSource: 'AniList' | 'Local';
}

const RecentReads: React.FC<RecentReadsProps> = ({ onNavigate, onBack }) => {
  const [entries, setEntries] = useState<HistoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('All');
  const [sortOrder, setSortOrder] = useState<SortOrder>('Recent');

  useEffect(() => {
    setEntries(history.get());
  }, []);

  const cards = useMemo<CardItem[]>(() => {
    let items = [...entries];
    if (sourceFilter !== 'All') {
      items = items.filter((entry) => entry.source === sourceFilter);
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      items = items.filter((entry) => entry.seriesTitle.toLowerCase().includes(query));
    }
    items.sort((a, b) => {
      if (sortOrder === 'Recent') return b.timestamp - a.timestamp;
      if (sortOrder === 'Oldest') return a.timestamp - b.timestamp;
      const aTracked = Boolean(a.anilistId);
      const bTracked = Boolean(b.anilistId);
      if (sortOrder === 'Tracked') {
        if (aTracked !== bTracked) return aTracked ? -1 : 1;
        return b.timestamp - a.timestamp;
      }
      if (sortOrder === 'Local') {
        if (aTracked !== bTracked) return aTracked ? 1 : -1;
        return b.timestamp - a.timestamp;
      }
      return 0;
    });
    return items.map((entry) => ({
      id: entry.seriesId,
      anilistId: entry.anilistId,
      providerSeriesId: entry.providerSeriesId,
      title: entry.seriesTitle,
      image: entry.seriesImage,
      chapterNumber: entry.chapterNumber,
      chapterId: entry.chapterId,
      timestamp: entry.timestamp,
      source: entry.source,
      progressSource: entry.anilistId ? 'Local' : 'AniList',
    }));
  }, [entries, searchQuery, sourceFilter, sortOrder]);

  const handleResume = async (item?: CardItem) => {
    if (!item) return;
    const anilistId = item.anilistId || (/^\d+$/.test(item.id) ? item.id : undefined);

    if (!item.chapterId) {
      onNavigate('details', anilistId || item.id);
      return;
    }

    try {
      let providerDetails = null;
      const provider = isProviderSource(item.source) ? item.source : Providers.AsuraScans;
      if (item.providerSeriesId) {
        providerDetails = await api.getSeriesDetails(item.providerSeriesId, provider);
      } else if (!anilistId && isProviderSource(item.source)) {
        providerDetails = await api.getSeriesDetails(item.id, provider);
      } else if (anilistId) {
        providerDetails = await api.getMappedProviderDetails(anilistId, provider);
      }

      if (!providerDetails) {
        onNavigate('details', anilistId || item.id);
        return;
      }

      const chapterNum = parseFloat(item.chapterNumber.replace(/[^0-9.]/g, ''));
      onNavigate('reader', {
        chapterId: item.chapterId,
        seriesId: anilistId || item.id,
        anilistId,
        providerSeriesId: providerDetails.id,
        providerMangaId: providerDetails.providerMangaId,
        chapterNumber: !isNaN(chapterNum) ? chapterNum : undefined,
        chapters: providerDetails.chapters,
        seriesTitle: item.title,
        seriesImage: item.image,
        source: providerDetails.source || item.source,
        seriesStatus: providerDetails.status,
      });
    } catch (e) {
      console.warn('Failed to open recent read item', e);
      onNavigate('details', anilistId || item.id);
    }
  };

  const handleInfo = (item?: CardItem) => {
    if (!item) return;
    const anilistId = item.anilistId || (/^\d+$/.test(item.id) ? item.id : undefined);
    onNavigate('details', anilistId || item.id);
  };

  return (
    <div className="min-h-[100dvh] min-h-app bg-background pb-20">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 pt-5 sm:pt-8">
        <button
          onClick={onBack}
          className="mb-6 flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
          Back
        </button>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white">Recent Reads</h1>
            <p className="text-gray-400 mt-1">Everything you have read locally on this device.</p>
          </div>
          <div className="text-sm text-gray-500">
            {cards.length} item{cards.length === 1 ? '' : 's'}
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-4 mb-8">
          <div className="relative w-full lg:w-80">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title..."
              className="w-full bg-surfaceHighlight border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-primary"
            />
          </div>

          <div className="flex gap-3">
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as SourceFilter)}
              className="bg-surfaceHighlight border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
            >
              <option value="All">All Sources</option>
              <option value="AniList">AniList</option>
              {providerOptions.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {providerShortLabel(provider.id)}
                </option>
              ))}
            </select>

            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as SortOrder)}
              className="bg-surfaceHighlight border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
            >
              <option value="Recent">Most Recent</option>
              <option value="Oldest">Oldest</option>
              <option value="Tracked">Tracked First</option>
              <option value="Local">Local First</option>
            </select>
          </div>
        </div>

        {cards.length === 0 ? (
          <div className="py-20 text-center text-gray-500">
            No recent reads match your filters.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {cards.map((item) => (
              <div
                key={`${item.id}-${item.chapterId ?? 'latest'}`}
                className="aspect-[4/3] sm:aspect-video"
              >
                <HistoryCard item={item} onResume={handleResume} onInfo={handleInfo} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RecentReads;
