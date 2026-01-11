export type DesktopSettings = {
  notifierEnabled: boolean;
  launchOnStartup: boolean;
  pollBaseMinutes: number;
  pollJitterMinutes: number;
};

type DesktopBridge = {
  getSettings: () => Promise<DesktopSettings>;
  updateSetting: (key: keyof DesktopSettings, value: unknown) => Promise<DesktopSettings>;
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
};
