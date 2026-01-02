import React from 'react';
import { Series } from '../types';
import { StarIcon } from './Icons';

interface SidebarListProps {
  title: string;
  items: Series[];
  onNavigate: (id: string) => void;
}

const SidebarList: React.FC<SidebarListProps> = ({ title, items, onNavigate }) => {
  return (
    <div className="bg-surfaceHighlight/30 rounded-2xl border border-white/5 p-5">
      <h3 className="text-lg font-bold text-white mb-5 flex items-center gap-2">
         <span className="w-1 h-5 bg-primary rounded-full"></span>
         {title}
      </h3>
      
      <div className="flex flex-col gap-4">
        {items.map((item, index) => (
          <div 
            key={item.id} 
            onClick={() => onNavigate(item.id)}
            className="group flex gap-4 cursor-pointer hover:bg-white/5 p-2 rounded-xl transition-colors -mx-2"
          >
            {/* Rank Number */}
            <div className={`w-6 flex-shrink-0 flex items-center justify-center text-lg font-black ${index < 3 ? 'text-primary' : 'text-gray-600'}`}>
              {index + 1}
            </div>

            {/* Image */}
            <div className="w-12 h-16 flex-shrink-0 rounded-md overflow-hidden bg-surfaceHighlight relative">
               <img src={item.image} alt={item.title} className="w-full h-full object-cover" loading="lazy" />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 flex flex-col justify-center">
               <h4 className="text-sm font-bold text-gray-200 group-hover:text-white line-clamp-2 leading-tight mb-1">
                 {item.title}
               </h4>
               <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                     <StarIcon className="w-3 h-3 text-yellow-500" fill />
                     {item.rating}
                  </span>
                  <span>{item.type || 'Manga'}</span>
               </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SidebarList;