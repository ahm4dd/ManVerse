import React from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, XIcon } from './Icons';
import { isProviderSource, providerShortLabel, type Source } from '../lib/providers';
import { useMediaQuery } from '../lib/useMediaQuery';

interface HistoryItem {
  id: string;
  title: string;
  image: string;
  chapterNumber: string | number;
  chapterId?: string;
  timestamp: number;
  source: Source;
  progressSource: 'AniList' | 'Local';
}

interface HistoryCardProps {
  item?: HistoryItem;
  onClick?: (item?: HistoryItem) => void;
  onResume?: (item?: HistoryItem) => void;
  onInfo?: (item?: HistoryItem) => void;
  onRemove?: (id: string) => void;
  isViewMore?: boolean;
  viewLabel?: string;
  disableClick?: boolean;
}

const HistoryCard: React.FC<HistoryCardProps> = ({
  item,
  onClick,
  onResume,
  onInfo,
  onRemove,
  isViewMore = false,
  viewLabel,
  disableClick = false,
}) => {
  const isPhoneLayout = useMediaQuery('(max-width: 768px)');

  if (isViewMore) {
    return (
      <div 
        className="relative h-full w-full rounded-xl border border-white/10 bg-surfaceHighlight/30 flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition-colors group aspect-video"
        onClick={() => {
          if (disableClick) return;
          onClick && onClick(item);
        }}
      >
        <div className="w-12 h-12 rounded-full bg-surfaceHighlight flex items-center justify-center mb-3 group-hover:scale-110 transition-transform border border-white/5 shadow-lg">
           <span className="text-gray-400 group-hover:text-white transition-colors">View</span>
        </div>
        <span className="text-sm font-bold text-gray-400 group-hover:text-white transition-colors">
          {viewLabel || 'View Library'}
        </span>
      </div>
    );
  }

  if (!item) return null;

  const handleCardClick = () => {
    if (disableClick) return;
    if (isPhoneLayout && onResume) {
      onResume(item);
      return;
    }
    (onInfo || onClick)?.(item);
  };

  return (
    <motion.div 
      layout
      className="relative group cursor-pointer overflow-hidden rounded-xl border border-white/5 bg-surfaceHighlight shadow-lg w-full h-full aspect-video"
      onClick={handleCardClick}
      whileHover={isPhoneLayout ? undefined : { scale: 1.01 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      {/* Background Image */}
      <img 
        src={item.image} 
        alt={item.title} 
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-80"
      />
      
      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent" />

      {/* Close Button (Visual only unless handler provided) */}
      {onRemove && (
        <button 
          className="absolute top-3 right-3 p-1.5 rounded-full bg-black/40 hover:bg-red-500/80 text-white/70 hover:text-white backdrop-blur-md transition-colors opacity-0 group-hover:opacity-100 z-10"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(item.id);
          }}
        >
           <XIcon className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Content Overlay */}
      <div className="absolute inset-0 p-4 sm:p-5 flex flex-col justify-end items-start z-10">
        
        {/* Chapter Badge */}
        <div className="mb-2">
           <span className="bg-primary text-black text-[10px] font-extrabold px-2.5 py-1 rounded shadow-sm uppercase tracking-wide">
              {String(item.chapterNumber).toLowerCase().includes('chapter') ? item.chapterNumber : `EP ${item.chapterNumber}`}
           </span>
        </div>

        {/* Title */}
        <h3 className="font-bold text-white text-lg leading-tight line-clamp-2 drop-shadow-md mb-1.5">
          {item.title}
        </h3>
        
        {/* Source / Subtitle */}
        <div className="text-[10px] font-bold text-gray-300 uppercase tracking-wider opacity-80 mb-3 flex gap-2">
          <span>{isProviderSource(item.source) ? providerShortLabel(item.source) : 'AniList'}</span>
          <span>•</span>
          <span className={item.progressSource === 'Local' ? 'text-green-400' : 'text-gray-300'}>
            {item.progressSource === 'Local' ? 'Synced' : 'Tracked'}
          </span>
        </div>

        {/* Actions */}
        {(onResume || onInfo || onClick) && (
          <div
            className={`mb-3 w-full ${
              isPhoneLayout ? 'flex flex-col gap-2' : 'flex items-center gap-2 flex-wrap'
            }`}
          >
            {(onResume || onClick) && (
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  if (disableClick) return;
                  (onResume || onClick)?.(item);
                }}
                className={`rounded-full bg-primary text-black font-extrabold uppercase tracking-wide shadow-sm hover:brightness-110 ${
                  isPhoneLayout
                    ? 'px-4 py-2 text-xs w-full'
                    : 'px-3 py-1.5 text-[11px] flex-1 min-w-0 truncate'
                }`}
              >
                Resume {String(item.chapterNumber).toLowerCase().includes('chapter') ? item.chapterNumber : `Ch ${item.chapterNumber}`}
              </button>
            )}
            <button
              onClick={(event) => {
                event.stopPropagation();
                if (disableClick) return;
                (onInfo || onClick)?.(item);
              }}
              className={`rounded-full bg-white/10 text-white font-bold uppercase tracking-wide border border-white/10 hover:bg-white/20 ${
                isPhoneLayout ? 'px-4 py-2 text-xs w-full' : 'px-3 py-1.5 text-[11px] flex-shrink-0'
              }`}
            >
              Info
            </button>
          </div>
        )}

        {/* Progress Bar */}
        <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
            <div className="h-full bg-primary w-[90%] shadow-[0_0_10px_rgba(var(--c-primary),0.8)]" />
        </div>
      </div>

      {/* Hover Play Icon */}
       <div
         className={`absolute top-3 ${onRemove ? 'right-12' : 'right-3'} opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-0`}
       >
          <div className="w-12 h-12 rounded-full bg-primary/90 backdrop-blur-sm border border-white/20 flex items-center justify-center text-black shadow-xl transform scale-75 group-hover:scale-100 transition-transform">
             <ChevronRight className="w-6 h-6 ml-0.5" />
          </div>
       </div>
    </motion.div>
  );
};

export default HistoryCard;
