import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, FilterIcon, SortIcon, XIcon, CheckCircleIcon } from './Icons';
import { motion, AnimatePresence } from 'framer-motion';

export interface FilterState {
  format: string;
  status: string;
  genre: string;
  country: string;
  sort: string;
}

interface SearchFiltersProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  availableGenres: string[];
  layout?: 'row' | 'column';
}

const SearchFilters: React.FC<SearchFiltersProps> = ({ 
  filters, 
  onChange, 
  availableGenres,
  layout = 'row' 
}) => {
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  // Close dropdowns when clicking outside
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (key: keyof FilterState, value: string) => {
    onChange({ ...filters, [key]: value });
    setActiveDropdown(null);
  };

  const handleReset = () => {
    onChange({
      format: 'All',
      status: 'All',
      genre: 'All',
      country: 'All',
      sort: 'Popularity'
    });
  };

  const FilterDropdown = ({ 
    label, 
    filterKey, 
    options, 
    value 
  }: { 
    label: string, 
    filterKey: keyof FilterState, 
    options: string[], 
    value: string 
  }) => (
    <div className="relative group min-w-[140px] flex-1">
      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 block ml-1">{label}</label>
      <button
        onClick={() => setActiveDropdown(activeDropdown === filterKey ? null : filterKey)}
        className={`w-full flex items-center justify-between px-3 py-2.5 bg-[#1a1a1a] border rounded-lg transition-all ${
          activeDropdown === filterKey 
            ? 'border-primary text-white ring-1 ring-primary/20' 
            : value !== 'All' && value !== 'Popularity' && value !== 'Last Updated'
              ? 'border-gray-600 text-white' 
              : 'border-[#333] text-gray-400 hover:border-gray-500 hover:text-gray-200'
        }`}
      >
        <span className="text-sm font-medium truncate pr-2">{value}</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${activeDropdown === filterKey ? 'rotate-180 text-primary' : 'opacity-50'}`} />
      </button>

      <AnimatePresence>
        {activeDropdown === filterKey && (
          <motion.div
            initial={{ opacity: 0, y: 5, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.98 }}
            transition={{ duration: 0.1 }}
            className="absolute top-full left-0 w-full min-w-[160px] mt-2 bg-[#1a1a1a] border border-[#333] rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[300px]"
            style={{ zIndex: 100 }} // Ensure dropdowns are always on top
          >
            <div className="overflow-y-auto py-1 custom-scrollbar">
              {options.map((opt) => (
                <button
                  key={opt}
                  onClick={() => handleSelect(filterKey, opt)}
                  className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors flex items-center justify-between ${
                    value === opt 
                      ? 'bg-primary/10 text-primary' 
                      : 'text-gray-300 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  {opt}
                  {value === opt && <CheckCircleIcon className="w-3.5 h-3.5" />}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <div 
      ref={containerRef} 
      className={
        layout === 'row' 
          ? "w-full flex flex-col lg:flex-row items-start lg:items-end gap-4 lg:gap-6"
          : "w-full flex flex-col gap-5"
      }
    >
      
      {/* Filters Container */}
      <div className={
        layout === 'row' 
          ? "flex-1 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 w-full"
          : "flex flex-col gap-4 w-full"
      }>
         <FilterDropdown 
            label="Genres" 
            filterKey="genre" 
            value={filters.genre} 
            options={availableGenres} 
         />
         <FilterDropdown 
            label="Status" 
            filterKey="status" 
            value={filters.status} 
            options={['All', 'Releasing', 'Finished', 'Hiatus', 'Cancelled', 'Not Yet Released']} 
         />
         <FilterDropdown 
            label="Format" 
            filterKey="format" 
            value={filters.format} 
            options={['All', 'Manga', 'Novel', 'One Shot']} 
         />
         <FilterDropdown 
            label="Country" 
            filterKey="country" 
            value={filters.country} 
            options={['All', 'JP', 'KR', 'CN', 'TW']} 
         />
         <FilterDropdown 
            label="Sort By" 
            filterKey="sort" 
            value={filters.sort} 
            options={['Popularity', 'Title', 'Score', 'Progress', 'Last Updated', 'Last Added', 'Start Date']} 
         />
      </div>

      {/* Actions */}
      <div className={
        layout === 'row'
          ? "flex items-center gap-3 w-full lg:w-auto"
          : "w-full pt-2"
      }>
         <button 
           onClick={handleReset}
           className={`rounded-lg border border-[#333] bg-[#1a1a1a] text-gray-400 text-sm font-bold hover:bg-white/5 hover:text-white hover:border-gray-500 transition-all flex items-center gap-2 justify-center ${
             layout === 'row' ? "px-6 py-2.5 flex-1 lg:flex-none" : "w-full py-3"
           }`}
         >
           <XIcon className="w-4 h-4" />
           Reset
         </button>
      </div>
    </div>
  );
};

export default SearchFilters;