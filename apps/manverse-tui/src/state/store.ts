import { create } from 'zustand';

interface User {
  id: number;
  username: string;
  avatar?: string;
}

interface AppState {
  // Authentication
  isAuthenticated: boolean;
  user: User | null;
  accessToken: string | null;

  // UI State
  sidebarCollapsed: boolean;
  currentScreen: string;

  // Actions
  login: (user: User, token: string) => void;
  logout: () => void;
  toggleSidebar: () => void;
  setScreen: (screen: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Initial state
  isAuthenticated: false,
  user: null,
  accessToken: null,
  sidebarCollapsed: false,
  currentScreen: 'dashboard',

  // Actions
  login: (user, token) => set({ isAuthenticated: true, user, accessToken: token }),
  logout: () => set({ isAuthenticated: false, user: null, accessToken: null }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setScreen: (screen) => set({ currentScreen: screen }),
}));
