import React, { useEffect, useMemo, useState } from 'react';
import { history, type HistoryItem } from '../lib/history';
import { api } from '../lib/api';
import HistoryCard from '../components/HistoryCard';
import { ChevronLeft, SearchIcon } from '../components/Icons';

interface RecentReadsProps {
  onNavigate: (view: string, data?: any) => void;
  onBack: () => void;
}

type SourceFilter = 'All' | 'AniList' | 'AsuraScans';
type SortOrder = 'Recent' | 'Oldest';

interface CardItem {
  id: string;
  anilistId?: string;
  providerSeriesId?: string;
  title: string;
  image: string;
  chapterNumber: string;
  chapterId?: string;
  timestamp: number;
  source: 'AniList' | 'AsuraScans';
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
    items.sort((a, b) => (sortOrder === 'Recent' ? b.timestamp - a.timestamp : a.timestamp - b.timestamp));
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

  const handleOpen = async (item?: CardItem) => {
    if (!item) return;
    const anilistId = item.anilistId || (/^\d+$/.test(item.id) ? item.id : undefined);

    if (!item.chapterId) {
      onNavigate('details', anilistId || item.id);
      return;
    }

    try {
      let providerDetails = null;
      if (item.providerSeriesId) {
        providerDetails = await api.getSeriesDetails(item.providerSeriesId, 'AsuraScans');
      } else if (!anilistId && item.source === 'AsuraScans') {
        providerDetails = await api.getSeriesDetails(item.id, 'AsuraScans');
      } else if (anilistId) {
        providerDetails = await api.getMappedProviderDetails(anilistId, 'AsuraScans');
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
        chapterNumber: !isNaN(chapterNum) ? chapterNum : undefined,
        chapters: providerDetails.chapters,
        seriesTitle: item.title,
        seriesImage: item.image,
        source: providerDetails.source || item.source,
      });
    } catch (e) {
      console.warn('Failed to open recent read item', e);
      onNavigate('details', anilistId || item.id);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 pt-8">
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
              <option value="AsuraScans">Asura</option>
            </select>

            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as SortOrder)}
              className="bg-surfaceHighlight border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
            >
              <option value="Recent">Most Recent</option>
              <option value="Oldest">Oldest</option>
            </select>
          </div>
        </div>

        {cards.length === 0 ? (
          <div className="py-20 text-center text-gray-500">
            No recent reads match your filters.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {cards.map((item) => (
              <div key={`${item.id}-${item.chapterId ?? 'latest'}`} className="aspect-video">
                <HistoryCard item={item} onClick={handleOpen} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RecentReads;
