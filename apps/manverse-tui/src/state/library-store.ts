import { create } from 'zustand';
import type { UserLibraryDb } from '@manverse/database';

interface LibraryState {
  // Data
  library: UserLibraryDb[];
  selectedStatus: string | null;
  searchQuery: string;

  // Stats
  stats: {
    total: number;
    reading: number;
    completed: number;
    plan_to_read: number;
    paused: number;
    dropped: number;
    favorites: number;
  } | null;

  // UI State
  viewMode: 'grid' | 'list';
  sortBy: 'title' | 'last_read' | 'progress' | 'added_at';
  sortOrder: 'asc' | 'desc';

  // Actions
  setLibrary: (library: UserLibraryDb[]) => void;
  setSelectedStatus: (status: string | null) => void;
  setSearchQuery: (query: string) => void;
  setStats: (stats: LibraryState['stats']) => void;
  setViewMode: (mode: 'grid' | 'list') => void;
  setSortBy: (sortBy: LibraryState['sortBy']) => void;
  toggleSortOrder: () => void;
}

export const useLibraryStore = create<LibraryState>((set) => ({
  // Initial state
  library: [],
  selectedStatus: null,
  searchQuery: '',
  stats: null,
  viewMode: 'list',
  sortBy: 'last_read',
  sortOrder: 'desc',

  // Actions
  setLibrary: (library) => set({ library }),
  setSelectedStatus: (status) => set({ selectedStatus: status }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setStats: (stats) => set({ stats }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setSortBy: (sortBy) => set({ sortBy }),
  toggleSortOrder: () =>
    set((state) => ({
      sortOrder: state.sortOrder === 'asc' ? 'desc' : 'asc',
    })),
}));
