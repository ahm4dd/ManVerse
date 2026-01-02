import React, { useState, useEffect } from 'react';
import { Series } from '../types';
import { StarIcon, ChevronRight } from './Icons';
import { motion, AnimatePresence, PanInfo, wrap } from 'framer-motion';

interface HeroCarouselProps {
  items: Series[];
  onNavigate: (seriesId: string) => void;
}

const variants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 1000 : -1000,
    opacity: 0,
    scale: 0.95,
    zIndex: 0
  }),
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1,
    scale: 1
  },
  exit: (direction: number) => ({
    zIndex: 0,
    x: direction < 0 ? 1000 : -1000,
    opacity: 0,
    scale: 0.95
  })
};

const swipeConfidenceThreshold = 10000;
const swipePower = (offset: number, velocity: number) => {
  return Math.abs(offset) * velocity;
};

// Helper to format remaining time
const formatTimeUntil = (seconds: number) => {
  const days = Math.floor(seconds / (3600 * 24));
  const hours = Math.floor((seconds % (3600 * 24)) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h`;
};

const HeroCarousel: React.FC<HeroCarouselProps> = ({ items, onNavigate }) => {
  const [[page, direction], setPage] = useState([0, 0]);
  const [isDragging, setIsDragging] = useState(false);

  // We wrap the index so it loops infinitely
  const imageIndex = wrap(0, items.length, page);
  const current = items[imageIndex];

  const paginate = (newDirection: number) => {
    setPage([page + newDirection, newDirection]);
  };

  // Auto-rotate (pauses if dragging)
  useEffect(() => {
    if (isDragging) return;
    const timer = setInterval(() => {
      paginate(1);
    }, 6000);
    return () => clearInterval(timer);
  }, [page, isDragging]);

  if (!items || items.length === 0) return null;

  // Prefer banner image for landscape carousel, fallback to cover image
  const displayImage = current.bannerImage || current.image;

  return (
    <div className="relative w-full h-[45vh] sm:h-[55vh] overflow-hidden rounded-3xl bg-surfaceHighlight shadow-2xl mb-10 group">
       
       <AnimatePresence initial={false} custom={direction}>
        <motion.div
          key={page}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{
            x: { type: "spring", stiffness: 300, damping: 30 },
            opacity: { duration: 0.2 }
          }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={1}
          onDragStart={() => setIsDragging(true)}
          onDragEnd={(e, { offset, velocity }: PanInfo) => {
            setIsDragging(false);
            const swipe = swipePower(offset.x, velocity.x);

            if (swipe < -swipeConfidenceThreshold) {
              paginate(1);
            } else if (swipe > swipeConfidenceThreshold) {
              paginate(-1);
            }
          }}
          className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing"
          style={{
            backgroundImage: `url(${displayImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
          onClick={() => !isDragging && onNavigate(current.id)}
        >
           <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/50 to-transparent" />
           <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
        </motion.div>
       </AnimatePresence>

       {/* Floating "Next Ep" Badge (Top Left) - Only shown if data exists */}
       {current.nextAiringEpisode && (
         <div className="absolute top-6 left-6 z-30 pointer-events-none">
            <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-lg text-white font-bold text-xs shadow-lg animate-fade-in">
               <span className="w-2 h-2 rounded-full bg-primary animate-pulse"/>
               EP {current.nextAiringEpisode.episode} in {formatTimeUntil(current.nextAiringEpisode.timeUntilAiring)}
            </div>
         </div>
       )}

       {/* Content Overlay (High Z-Index to stay above transitions) */}
       <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-12 pb-16 pointer-events-none z-30">
          <div className="max-w-3xl animate-fade-in space-y-4">
             <div className="flex items-center gap-3">
               <span className="px-2.5 py-1 rounded-md bg-white/10 backdrop-blur-md text-[10px] font-bold uppercase tracking-wider text-white border border-white/10">
                 Trending
               </span>
               <div className="flex items-center gap-1 text-yellow-400">
                  <StarIcon className="w-3.5 h-3.5" fill />
                  <span className="text-sm font-bold">{current.rating}</span>
               </div>
             </div>
             
             <h2 className="text-3xl sm:text-5xl md:text-6xl font-extrabold text-white leading-tight line-clamp-2 text-shadow max-w-2xl drop-shadow-xl">
               {current.title}
             </h2>

             <div className="flex flex-wrap gap-2">
                {current.genres?.slice(0, 3).map(g => (
                   <span key={g} className="text-xs font-semibold text-gray-300 shadow-black drop-shadow-md">{g}</span>
                ))}
             </div>
             
             <div className="pt-6 flex gap-4 pointer-events-auto">
                <button 
                  onClick={(e) => { e.stopPropagation(); onNavigate(current.id); }}
                  className="bg-primary hover:bg-primaryHover text-onPrimary px-8 py-3.5 rounded-xl font-bold text-sm shadow-md hover:shadow-lg hover:shadow-primary/40 flex items-center gap-2 transition-all active:scale-95"
                >
                  Start Reading
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); onNavigate(current.id); }}
                  className="bg-white/10 hover:bg-white/20 backdrop-blur-md text-white px-6 py-3.5 rounded-xl font-bold text-sm border border-white/10 transition-colors"
                >
                  Details
                </button>
             </div>
          </div>
       </div>

       {/* Indicators */}
       <div className="absolute bottom-6 right-6 sm:right-12 flex gap-2 z-30 pointer-events-auto">
         {items.map((_, idx) => (
           <button 
             key={idx}
             onClick={() => setPage([idx, idx > page ? 1 : -1])}
             className={`h-1.5 rounded-full transition-all duration-300 ${idx === imageIndex ? 'w-8 bg-primary' : 'w-2 bg-white/30 hover:bg-white/50'}`}
           />
         ))}
       </div>
    </div>
  );
};

export default HeroCarousel;