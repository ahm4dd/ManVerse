import { create } from 'zustand';

export interface DownloadJob {
  id: string;
  mangaTitle: string;
  chapterNumber: string;
  chapterUrl: string;
  provider: string;
  providerMangaId: number;
  libraryId?: number;
  status: 'queued' | 'downloading' | 'completed' | 'failed' | 'cancelled';
  progress: number; // 0-100
  currentFile?: string;
  totalFiles: number;
  downloadedFiles: number;
  speed?: string; // "1.2 MB/s"
  error?: string;
  startTime?: number;
  endTime?: number;
}

interface DownloadState {
  queue: DownloadJob[];
  activeDownloads: number;
  maxConcurrent: number;

  // Actions
  addToQueue: (job: Omit<DownloadJob, 'id' | 'progress' | 'downloadedFiles' | 'status'>) => void;
  updateJob: (id: string, updates: Partial<DownloadJob>) => void;
  removeJob: (id: string) => void;
  cancelJob: (id: string) => void;
  clearCompleted: () => void;
  setMaxConcurrent: (max: number) => void;
}

export const useDownloadStore = create<DownloadState>((set) => ({
  queue: [],
  activeDownloads: 0,
  maxConcurrent: 3,

  addToQueue: (job) =>
    set((state) => ({
      queue: [
        ...state.queue,
        {
          ...job,
          id: `dl-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          status: 'queued' as const,
          progress: 0,
          downloadedFiles: 0,
        },
      ],
    })),

  updateJob: (id, updates) =>
    set((state) => ({
      queue: state.queue.map((job) => (job.id === id ? { ...job, ...updates } : job)),
      activeDownloads: state.queue.filter((j) => j.status === 'downloading').length,
    })),

  removeJob: (id) =>
    set((state) => ({
      queue: state.queue.filter((job) => job.id !== id),
    })),

  cancelJob: (id) =>
    set((state) => ({
      queue: state.queue.map((job) =>
        job.id === id ? { ...job, status: 'cancelled' as const } : job,
      ),
    })),

  clearCompleted: () =>
    set((state) => ({
      queue: state.queue.filter((job) => job.status !== 'completed' && job.status !== 'cancelled'),
    })),

  setMaxConcurrent: (max) => set({ maxConcurrent: max }),
}));
