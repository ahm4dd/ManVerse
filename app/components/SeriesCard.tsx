import React from 'react';
import { Series } from '../types';
import { StarIcon } from './Icons';
import { motion } from 'framer-motion';
import { isProviderSource, providerShortLabel } from '../lib/providers';

interface SeriesCardProps {
  series: Series;
  onClick: (series: Series) => void;
  index?: number; // Added for staggered delay calculation
  layoutId?: string;
}

function timeAgo(timestamp?: number): string {
  if (!timestamp) return '';
  const seconds = Math.floor((Date.now() / 1000) - timestamp);
  
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + (Math.floor(interval) === 1 ? " year ago" : " years ago");
  
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + (Math.floor(interval) === 1 ? " month ago" : " months ago");
  
  interval = seconds / 604800; // Weeks
  if (interval > 1) return Math.floor(interval) + (Math.floor(interval) === 1 ? " week ago" : " weeks ago");

  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + (Math.floor(interval) === 1 ? " day ago" : " days ago");
  
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + "h ago";
  
  return "Just now";
}

const getStatusStyle = (status: string) => {
  switch(status?.toUpperCase()) {
    case 'RELEASING': return 'bg-green-500 shadow-green-500/30';
    case 'FINISHED': return 'bg-blue-500 shadow-blue-500/30';
    case 'HIATUS': return 'bg-orange-500 shadow-orange-500/30';
    case 'CANCELLED': 
    case 'DROPPED': return 'bg-red-500 shadow-red-500/30';
    case 'NOT_YET_RELEASED': return 'bg-pink-500 shadow-pink-500/30';
    default: return 'bg-gray-600 shadow-gray-500/30';
  }
}

const getStatusLabel = (status: string) => {
   if (status === 'RELEASING') return 'Ongoing';
   if (status === 'NOT_YET_RELEASED') return 'Upcoming';
   return status; // Finished, Hiatus, etc.
}

const SeriesCard: React.FC<SeriesCardProps> = ({ series, onClick, index = 0, layoutId }) => {
  const relativeTime = timeAgo(series.updatedAt);
  let latestLabel = series.latestChapter;
  const resolvedLayoutId = layoutId ?? `series-${series.id}`;
  const providerBadge =
    series.source && isProviderSource(series.source) ? providerShortLabel(series.source) : null;
  if (series.source === 'AniList' && latestLabel) {
    const lowered = latestLabel.toLowerCase();
    if (lowered.includes('chapter') || lowered.includes('progress')) {
      latestLabel = 'Updated';
    }
  }

  return (
    <motion.div 
      layoutId={resolvedLayoutId}
      className="group relative cursor-pointer flex flex-col gap-2.5"
      onClick={() => onClick(series)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        delay: index * 0.05, // Staggered entrance
        duration: 0.5,
        ease: "easeOut" 
      }}
      whileHover={{ y: -5 }}
    >
      <motion.div 
        className="relative aspect-[2/3] w-full overflow-hidden rounded-2xl bg-surfaceHighlight shadow-lg border border-white/5"
        whileHover={{ 
          scale: 1.02,
          boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.3), 0 8px 10px -6px rgb(0 0 0 / 0.3)"
        }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        <img
          src={series.image}
          alt={series.title}
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />
        
        {/* Floating Status Badge (Top Left) */}
        <div className="absolute top-2.5 left-2.5">
          <span className={`rounded-lg backdrop-blur-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white border border-white/10 shadow-lg ${getStatusStyle(series.status)}`}>
            {getStatusLabel(series.status)}
          </span>
        </div>

        {/* Top Right Badge (Type) */}
        <div className="absolute top-2.5 right-2.5">
          <span className="rounded-lg backdrop-blur-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white bg-black/60 border border-white/10 shadow-sm">
            {series.type || 'Manga'}
          </span>
        </div>

        {/* Bottom: Rating (Minimalist) */}
        <div className="absolute bottom-0 p-3 w-full">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-yellow-400">
              <StarIcon className="h-3.5 w-3.5" fill />
              <span className="text-[13px] font-extrabold text-white">{series.rating}</span>
            </div>
            {providerBadge && (
              <span className="rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white border border-white/10">
                {providerBadge}
              </span>
            )}
          </div>
        </div>
      </motion.div>

      {/* Info Section */}
      <div>
        <h3 className="text-[15px] font-bold text-white group-hover:text-primary transition-colors line-clamp-1 leading-snug tracking-tight">
          {series.title}
        </h3>
        {/* Chapter Info + Date */}
        <div className="flex items-center justify-between mt-1.5 text-xs font-medium text-gray-400">
           <span className="text-gray-300 truncate max-w-[60%]">{latestLabel}</span>
           {relativeTime && (
             <span className="text-[10px] text-gray-500 whitespace-nowrap">{relativeTime}</span>
           )}
        </div>
      </div>
    </motion.div>
  );
};

export default SeriesCard;
