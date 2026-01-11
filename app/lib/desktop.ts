export type DesktopSettings = {
  notifierEnabled: boolean;
  launchOnStartup: boolean;
  pollBaseMinutes: number;
  pollJitterMinutes: number;
  jwtSecret?: string;
  anilistClientId?: string;
  anilistClientSecret?: string;
  anilistRedirectUri?: string;
};

export type UpdateStatus = {
  state: 'idle' | 'checking' | 'available' | 'downloaded' | 'error';
  version: string | null;
  message: string | null;
};

export type NotifierEvent = {
  id: string;
  type: 'CHAPTER_RELEASE';
  title: string;
  message: string;
  time: string;
  timestamp?: number;
  read: boolean;
  provider?: string;
  providerMangaId?: number;
};

type DesktopBridge = {
  getSettings: () => Promise<DesktopSettings>;
  updateSetting: (key: keyof DesktopSettings, value: unknown) => Promise<DesktopSettings>;
  getUpdateStatus?: () => Promise<UpdateStatus>;
  installUpdate?: () => Promise<{ ok: boolean }>;
  onUpdateStatus?: (callback: (status: UpdateStatus) => void) => () => void;
  getNotifierEvents?: () => Promise<NotifierEvent[]>;
  markAllNotifierRead?: () => Promise<NotifierEvent[]>;
  onNotifierEvents?: (callback: (events: NotifierEvent[]) => void) => () => void;
};

const bridge = typeof window !== 'undefined' ? (window as any).manverse : null;

export const desktopApi = {
  isAvailable: Boolean(bridge?.getSettings && bridge?.updateSetting),
  getSettings: async (): Promise<DesktopSettings> => {
    if (!bridge?.getSettings) {
      throw new Error('Desktop bridge unavailable');
    }
    return bridge.getSettings();
  },
  updateSetting: async (
    key: keyof DesktopSettings,
    value: unknown,
  ): Promise<DesktopSettings> => {
    if (!bridge?.updateSetting) {
      throw new Error('Desktop bridge unavailable');
    }
    return bridge.updateSetting(key, value);
  },
  getUpdateStatus: async (): Promise<UpdateStatus | null> => {
    if (!bridge?.getUpdateStatus) {
      return null;
    }
    return bridge.getUpdateStatus();
  },
  installUpdate: async (): Promise<void> => {
    if (!bridge?.installUpdate) {
      throw new Error('Desktop bridge unavailable');
    }
    await bridge.installUpdate();
  },
  onUpdateStatus: (callback: (status: UpdateStatus) => void): (() => void) => {
    if (!bridge?.onUpdateStatus) {
      return () => {};
    }
    return bridge.onUpdateStatus(callback);
  },
  getNotifierEvents: async (): Promise<NotifierEvent[]> => {
    if (!bridge?.getNotifierEvents) {
      return [];
    }
    return bridge.getNotifierEvents();
  },
  markAllNotifierRead: async (): Promise<NotifierEvent[]> => {
    if (!bridge?.markAllNotifierRead) {
      return [];
    }
    return bridge.markAllNotifierRead();
  },
  onNotifierEvents: (callback: (events: NotifierEvent[]) => void): (() => void) => {
    if (!bridge?.onNotifierEvents) {
      return () => {};
    }
    return bridge.onNotifierEvents(callback);
  },
};
