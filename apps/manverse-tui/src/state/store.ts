import { create } from 'zustand';
import type { Browser } from 'puppeteer';

// Type definitions
export type Screen =
  | 'welcome'
  | 'dashboard'
  | 'search'
  | 'library'
  | 'manga-detail'
  | 'downloads'
  | 'sync'
  | 'providers'
  | 'settings';

export interface User {
  id: number;
  username: string;
  avatar?: string;
}

export interface SelectedManga {
  id?: number;
  providerUrl?: string;
  title?: string;
}

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  duration?: number;
}

interface AppState {
  // Authentication
  isAuthenticated: boolean;
  user: User | null;
  accessToken: string | null;

  // UI State
  currentScreen: Screen;
  sidebarCollapsed: boolean;
  theme: 'dark' | 'light';

  // Notifications
  toasts: Toast[];

  // Browser instance (for scrapers)
  browser: Browser | null;

  // Navigation Data
  selectedManga: SelectedManga | null;
  setSelectedManga: (manga: SelectedManga | null) => void;

  // Actions
  login: (user: User, token: string) => void;
  logout: () => void;
  setScreen: (screen: Screen) => void;
  toggleSidebar: () => void;
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  setBrowser: (browser: Browser | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Initial state
  isAuthenticated: false,
  user: null,
  accessToken: null,
  currentScreen: 'welcome',
  sidebarCollapsed: false,
  theme: 'dark',
  toasts: [],
  browser: null,
  selectedManga: null,

  // Actions
  login: (user, token) =>
    set({
      isAuthenticated: true,
      user,
      accessToken: token,
      currentScreen: 'dashboard',
    }),

  logout: () =>
    set({
      isAuthenticated: false,
      user: null,
      accessToken: null,
      currentScreen: 'welcome',
    }),

  setScreen: (screen) => set({ currentScreen: screen }),

  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  addToast: (toast) =>
    set((state) => ({
      toasts: [
        ...state.toasts,
        {
          ...toast,
          id: `toast-${Date.now()}-${Math.random()}`,
        },
      ],
    })),

  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  setBrowser: (browser) => set({ browser }),
  setSelectedManga: (manga) => set({ selectedManga: manga }),
}));
