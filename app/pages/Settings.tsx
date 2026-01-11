import React, { useEffect, useState } from 'react';
import { ChevronLeft } from '../components/Icons';
import { desktopApi, type DesktopSettings, type UpdateStatus } from '../lib/desktop';

interface SettingsProps {
  onBack: () => void;
  onOpenSetup?: () => void;
}

const Settings: React.FC<SettingsProps> = ({ onBack, onOpenSetup }) => {
  const [desktopSettings, setDesktopSettings] = useState<DesktopSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [credentials, setCredentials] = useState({
    clientId: '',
    clientSecret: '',
    redirectUri: '',
  });
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    if (!desktopApi.isAvailable) return;
    const load = async () => {
      setLoading(true);
      try {
        const settings = await desktopApi.getSettings();
        setDesktopSettings(settings);
        setCredentials({
          clientId: settings.anilistClientId || '',
          clientSecret: settings.anilistClientSecret || '',
          redirectUri: settings.anilistRedirectUri || '',
        });
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  useEffect(() => {
    if (!desktopApi.isAvailable) return;
    let unsubscribe = () => {};
    desktopApi
      .getUpdateStatus()
      .then((status) => {
        if (status) {
          setUpdateStatus(status);
        }
      })
      .catch(() => {});
    unsubscribe = desktopApi.onUpdateStatus((status) => {
      setUpdateStatus(status);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const toggleSetting = async (key: keyof DesktopSettings) => {
    if (!desktopApi.isAvailable || !desktopSettings) return;
    const next = await desktopApi.updateSetting(key, !desktopSettings[key]);
    setDesktopSettings(next);
  };

  const notifierEnabled = Boolean(desktopSettings?.notifierEnabled);
  const launchOnStartup = Boolean(desktopSettings?.launchOnStartup);
  const updateReady = updateStatus?.state === 'downloaded';
  const defaultRedirectUri = 'http://localhost:3001/api/auth/anilist/callback';

  const handleSaveCredentials = async () => {
    if (!desktopApi.isAvailable) return;
    setSaveState('saving');
    try {
      let next = await desktopApi.updateSetting('anilistClientId', credentials.clientId.trim());
      next = await desktopApi.updateSetting(
        'anilistClientSecret',
        credentials.clientSecret.trim(),
      );
      next = await desktopApi.updateSetting(
        'anilistRedirectUri',
        credentials.redirectUri.trim() || defaultRedirectUri,
      );
      setDesktopSettings(next);
      setSaveState('saved');
      window.setTimeout(() => setSaveState('idle'), 1500);
    } catch {
      setSaveState('error');
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <button
          onClick={onBack}
          className="mb-6 flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
          Back
        </button>

        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white">Settings</h1>
          <p className="text-gray-400 mt-2">
            Control background behavior and system startup preferences.
          </p>
        </div>

        <div className="space-y-6">
          <div className="bg-surface border border-white/10 rounded-2xl p-6 shadow-xl">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">AniList setup</h2>
                <p className="text-sm text-gray-400 mt-1">
                  One-time setup to connect your AniList account and sync progress.
                </p>
              </div>
              <button
                onClick={() => onOpenSetup?.()}
                className="px-4 py-2 rounded-lg text-xs font-bold bg-primary text-black shadow-lg shadow-primary/30 transition hover:brightness-110"
              >
                Open setup guide
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-gray-400">AniList Client ID</label>
                <input
                  value={credentials.clientId}
                  onChange={(e) =>
                    setCredentials((prev) => ({ ...prev, clientId: e.target.value }))
                  }
                  placeholder="e.g. 12345"
                  className="mt-2 w-full rounded-lg border border-white/10 bg-surfaceHighlight px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-400">AniList Client Secret</label>
                <input
                  type="password"
                  value={credentials.clientSecret}
                  onChange={(e) =>
                    setCredentials((prev) => ({ ...prev, clientSecret: e.target.value }))
                  }
                  placeholder="Paste your secret"
                  className="mt-2 w-full rounded-lg border border-white/10 bg-surfaceHighlight px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-gray-400">Redirect URL</label>
                <input
                  value={credentials.redirectUri || defaultRedirectUri}
                  onChange={(e) =>
                    setCredentials((prev) => ({ ...prev, redirectUri: e.target.value }))
                  }
                  className="mt-2 w-full rounded-lg border border-white/10 bg-surfaceHighlight px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-primary"
                />
                <p className="text-[11px] text-gray-500 mt-2">
                  Stored locally on this device. ManVerse never uploads your secret.
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-gray-500">
                {saveState === 'saved' && 'Saved. You can sign in now.'}
                {saveState === 'error' && 'Could not save. Please try again.'}
                {saveState === 'saving' && 'Saving...'}
              </div>
              <button
                onClick={handleSaveCredentials}
                className="px-4 py-2 rounded-lg text-xs font-bold bg-white/10 text-white border border-white/10 hover:bg-white/20 transition"
              >
                Save credentials
              </button>
            </div>
          </div>
          {desktopApi.isAvailable && updateReady && (
            <div className="bg-surface border border-white/10 rounded-2xl p-6 shadow-xl">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">Update ready</h2>
                  <p className="text-sm text-gray-400 mt-1">
                    {updateStatus?.version
                      ? `Version ${updateStatus.version} is ready to install.`
                      : 'A new version is ready to install.'}
                  </p>
                </div>
                <button
                  onClick={() => desktopApi.installUpdate().catch(() => {})}
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-primary text-black shadow-lg shadow-primary/30 transition hover:brightness-110"
                >
                  Restart & install
                </button>
              </div>
            </div>
          )}
          <div className="bg-surface border border-white/10 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-white">Desktop</h2>
                <p className="text-sm text-gray-500">Manage notifications and background tasks.</p>
              </div>
              <div className="text-xs text-gray-500 font-semibold uppercase tracking-widest">
                Preferences
              </div>
            </div>

            {!desktopApi.isAvailable ? (
              <div className="rounded-xl border border-white/10 bg-surfaceHighlight/40 p-4 text-sm text-gray-400">
                Desktop settings are available in the Electron app only.
              </div>
            ) : loading ? (
              <div className="text-sm text-gray-500">Loading desktop settings…</div>
            ) : (
              <div className="space-y-5">
                <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-surfaceHighlight/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-white">Chapter release checks</div>
                    <div className="text-[11px] text-gray-500">
                      Runs about once per hour with a small random delay.
                    </div>
                  </div>
                  <button
                    onClick={() => toggleSetting('notifierEnabled')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold border transition-colors ${
                      notifierEnabled
                        ? 'bg-primary text-black border-primary'
                        : 'bg-surface text-gray-300 border-white/10 hover:text-white'
                    }`}
                  >
                    {notifierEnabled ? 'On' : 'Off'}
                  </button>
                </div>
                <p className="text-[11px] text-amber-300/80">
                  Leaving this on keeps ManVerse running in the background after you close the
                  window.
                </p>
                <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-surfaceHighlight/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-white">Start on system login</div>
                    <div className="text-[11px] text-gray-500">
                      Appears in Windows startup and KDE autostart.
                    </div>
                  </div>
                  <button
                    onClick={() => toggleSetting('launchOnStartup')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold border transition-colors ${
                      launchOnStartup
                        ? 'bg-primary text-black border-primary'
                        : 'bg-surface text-gray-300 border-white/10 hover:text-white'
                    }`}
                  >
                    {launchOnStartup ? 'On' : 'Off'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
