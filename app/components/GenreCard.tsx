import React from 'react';
import { StarIcon } from './Icons';

interface GenreCardProps {
  genre: string;
  count: number;
  meanScore: number;
  timeRead: number; // minutes
  images: string[];
}

const GenreCard: React.FC<GenreCardProps> = ({ genre, count, meanScore, timeRead, images }) => {
  // Convert minutes to readable hours/days
  const timeDisplay = timeRead > 1440 
     ? `${(timeRead / 1440).toFixed(1)} Days` 
     : `${(timeRead / 60).toFixed(1)} Hours`;

  return (
    <div className="bg-surface border border-white/5 rounded-2xl overflow-hidden hover:border-white/10 transition-colors group">
       <div className="p-4 flex justify-between items-start">
          <div>
             <h3 className="font-bold text-white text-lg">{genre}</h3>
             <div className="flex items-center gap-4 mt-1 text-xs font-bold text-gray-500">
                <span>{count} Titles</span>
                <span className="flex items-center gap-1 text-yellow-500">
                  <StarIcon className="w-3 h-3" fill />
                  {meanScore}%
                </span>
             </div>
             <div className="text-[10px] text-gray-600 mt-0.5 uppercase tracking-wide">
                {timeDisplay} Read
             </div>
          </div>
          <div className="w-6 h-6 rounded-full bg-surfaceHighlight flex items-center justify-center text-xs font-bold text-gray-400 group-hover:bg-primary group-hover:text-black transition-colors">
            {count}
          </div>
       </div>
       
       {/* Image Collage */}
       <div className="grid grid-cols-4 h-24 gap-px bg-surfaceHighlight/50 opacity-60 group-hover:opacity-100 transition-opacity">
          {images.slice(0, 4).map((img, i) => (
             <img key={i} src={img} className="w-full h-full object-cover" loading="lazy" />
          ))}
          {/* Fillers if not enough images */}
          {images.length < 4 && [...Array(4 - images.length)].map((_, i) => (
             <div key={`fill-${i}`} className="bg-surfaceHighlight" />
          ))}
       </div>
    </div>
  );
};

export default GenreCard;
