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

export type DesktopWindowState = {
  isMaximized: boolean;
};

export type LanAddress = {
  address: string;
  family: 'IPv4' | 'IPv6';
  name: string;
};

export type LanAccessInfo = {
  enabled: boolean;
  host: string | null;
  uiPort: number;
  apiPort: number;
  uiUrl: string;
  apiUrl: string;
  bindHost: string;
  addresses: LanAddress[];
  uiRunning: boolean;
  apiRunning: boolean;
};

export type LanHealth = {
  api: boolean;
  ui: boolean;
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
  consumeAuthToken?: () => Promise<string | null>;
  log?: (payload: { message: string; data?: Record<string, unknown> | null }) => Promise<{ ok: boolean }>;
  minimizeWindow?: () => Promise<{ ok: boolean }>;
  toggleMaximize?: () => Promise<{ ok: boolean; isMaximized: boolean }>;
  closeWindow?: () => Promise<{ ok: boolean }>;
  restartApp?: () => Promise<{ ok: boolean }>;
  clearAniListSession?: () => Promise<{ ok: boolean }>;
  getWindowState?: () => Promise<DesktopWindowState>;
  onWindowState?: (callback: (state: DesktopWindowState) => void) => () => void;
  getLanInfo?: () => Promise<LanAccessInfo>;
  setLanAccess?: (payload: { enabled: boolean; host?: string | null }) => Promise<LanAccessInfo>;
  checkLanHealth?: (payload: { host?: string | null }) => Promise<LanHealth>;
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
  consumeAuthToken: async (): Promise<string | null> => {
    if (!bridge?.consumeAuthToken) {
      return null;
    }
    return bridge.consumeAuthToken();
  },
  log: async (message: string, data?: Record<string, unknown> | null): Promise<void> => {
    if (!bridge?.log) {
      return;
    }
    await bridge.log({ message, data: data ?? null });
  },
  minimizeWindow: async (): Promise<void> => {
    if (!bridge?.minimizeWindow) return;
    await bridge.minimizeWindow();
  },
  toggleMaximize: async (): Promise<DesktopWindowState | null> => {
    if (!bridge?.toggleMaximize) return null;
    return bridge.toggleMaximize();
  },
  closeWindow: async (): Promise<void> => {
    if (!bridge?.closeWindow) return;
    await bridge.closeWindow();
  },
  restartApp: async (): Promise<void> => {
    if (!bridge?.restartApp) return;
    await bridge.restartApp();
  },
  clearAniListSession: async (): Promise<void> => {
    if (!bridge?.clearAniListSession) return;
    await bridge.clearAniListSession();
  },
  getWindowState: async (): Promise<DesktopWindowState | null> => {
    if (!bridge?.getWindowState) return null;
    return bridge.getWindowState();
  },
  onWindowState: (callback: (state: DesktopWindowState) => void): (() => void) => {
    if (!bridge?.onWindowState) {
      return () => {};
    }
    return bridge.onWindowState(callback);
  },
  getLanInfo: async (): Promise<LanAccessInfo> => {
    if (!bridge?.getLanInfo) {
      throw new Error('Desktop bridge unavailable');
    }
    return bridge.getLanInfo();
  },
  setLanAccess: async (
    payload: { enabled: boolean; host?: string | null },
  ): Promise<LanAccessInfo> => {
    if (!bridge?.setLanAccess) {
      throw new Error('Desktop bridge unavailable');
    }
    return bridge.setLanAccess(payload);
  },
  checkLanHealth: async (payload: { host?: string | null }): Promise<LanHealth> => {
    if (!bridge?.checkLanHealth) {
      throw new Error('Desktop bridge unavailable');
    }
    return bridge.checkLanHealth(payload);
  },
};
