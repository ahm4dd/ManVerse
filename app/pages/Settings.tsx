import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft } from '../components/Icons';
import {
  desktopApi,
  type DesktopSettings,
  type UpdateStatus,
  type LanAccessInfo,
  type LanHealth,
} from '../lib/desktop';
import { apiRequest, getApiUrl } from '../lib/api-client';
import { buildRedirectUri } from '../lib/anilist-redirect';
import { useTheme, themes, type Theme, type ThemeOverrides, type CustomTheme } from '../lib/theme';

export type SettingsSection = 'account' | 'app' | 'hosting' | 'themes';

interface SettingsProps {
  onBack: () => void;
  onOpenSetup?: () => void;
  onLanChange?: (info: LanAccessInfo) => void;
  onCredentialsSaved?: () => void;
  initialSection?: SettingsSection;
  sectionRequestId?: number;
}

const SETTINGS_SECTIONS: Array<{
  id: SettingsSection;
  label: string;
  description: string;
}> = [
  { id: 'account', label: 'Account', description: 'AniList credentials and login status.' },
  { id: 'app', label: 'App', description: 'Desktop background checks and updates.' },
  { id: 'hosting', label: 'Self-hosting', description: 'Run on your network for phones/tablets.' },
  { id: 'themes', label: 'Themes', description: 'Pick a look that fits your vibe.' },
];

const Settings: React.FC<SettingsProps> = ({
  onBack,
  onOpenSetup,
  onLanChange,
  onCredentialsSaved,
  initialSection,
  sectionRequestId,
}) => {
  const [desktopSettings, setDesktopSettings] = useState<DesktopSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [credentials, setCredentials] = useState({
    clientId: '',
    clientSecret: '',
    redirectUri: '',
  });
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [credentialStatus, setCredentialStatus] = useState<{
    configured: boolean;
    source: 'env' | 'runtime' | 'none';
    redirectUri?: string;
  } | null>(null);
  const [activeSection, setActiveSection] = useState<SettingsSection>(
    initialSection ?? 'account',
  );
  const {
    theme,
    setTheme,
    themeOverrides,
    setThemeOverrides,
    setThemePreview,
    customThemes,
    setCustomThemes,
    activeCustomThemeId,
    setActiveCustomThemeId,
  } = useTheme();
  const [lanInfo, setLanInfo] = useState<LanAccessInfo | null>(null);
  const [lanHostInput, setLanHostInput] = useState('');
  const [lanHealth, setLanHealth] = useState<LanHealth | null>(null);
  const [lanBusy, setLanBusy] = useState(false);
  const [lanError, setLanError] = useState<string | null>(null);
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null);
  const [customThemeName, setCustomThemeName] = useState('');
  const [editingThemeId, setEditingThemeId] = useState<string | null>(null);
  const [draftOverrides, setDraftOverrides] = useState<ThemeOverrides>(themeOverrides);
  const [overridesDirty, setOverridesDirty] = useState(false);
  const [pendingDeleteTheme, setPendingDeleteTheme] = useState<CustomTheme | null>(null);

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
        try {
          const info = await desktopApi.getLanInfo();
          setLanInfo(info);
          setLanHostInput(info.host || '');
        } catch {
          // ignore
        }
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  useEffect(() => {
    if (initialSection) {
      setActiveSection(initialSection);
    }
  }, [initialSection, sectionRequestId]);

  useEffect(() => {
    if (desktopApi.isAvailable) return;
    apiRequest<{ configured: boolean; source: 'env' | 'runtime' | 'none'; redirectUri?: string }>(
      '/api/auth/anilist/status',
      { skipAuth: true },
    )
      .then((status) => setCredentialStatus(status))
      .catch(() => {});
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

  useEffect(() => {
    if (overridesDirty) return;
    setDraftOverrides(themeOverrides);
  }, [themeOverrides, overridesDirty]);

  useEffect(() => {
    if (!overridesDirty) {
      setThemePreview(null);
      return;
    }
    setThemePreview(draftOverrides);
  }, [draftOverrides, overridesDirty, setThemePreview]);

  useEffect(() => {
    return () => {
      setThemePreview(null);
    };
  }, [setThemePreview]);

  const toggleSetting = async (key: keyof DesktopSettings) => {
    if (!desktopApi.isAvailable || !desktopSettings) return;
    const next = await desktopApi.updateSetting(key, !desktopSettings[key]);
    setDesktopSettings(next);
  };

  const notifierEnabled = Boolean(desktopSettings?.notifierEnabled);
  const launchOnStartup = Boolean(desktopSettings?.launchOnStartup);
  const updateReady = updateStatus?.state === 'downloaded';
  const apiUrl = getApiUrl();
  const defaultRedirectUri = buildRedirectUri(apiUrl);
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';

  const handleSaveCredentials = async () => {
    if (!credentials.clientId.trim() || !credentials.clientSecret.trim()) {
      setSaveState('error');
      return;
    }
    setSaveState('saving');
    try {
      if (desktopApi.isAvailable) {
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
      } else {
        await apiRequest('/api/auth/anilist/credentials', {
          method: 'POST',
          skipAuth: true,
          body: JSON.stringify({
            clientId: credentials.clientId.trim(),
            clientSecret: credentials.clientSecret.trim(),
            redirectUri: credentials.redirectUri.trim() || defaultRedirectUri,
          }),
        });
        const status = await apiRequest<{
          configured: boolean;
          source: 'env' | 'runtime' | 'none';
          redirectUri?: string;
        }>('/api/auth/anilist/status', { skipAuth: true });
        setCredentialStatus(status);
      }
      try {
        await onCredentialsSaved?.();
      } catch {
        // ignore downstream refresh failures
      }
      setSaveState('saved');
      window.setTimeout(() => setSaveState('idle'), 1500);
    } catch {
      setSaveState('error');
    }
  };
  const lanEnabled = Boolean(lanInfo?.enabled);
  const lanAddresses = lanInfo?.addresses ?? [];
  const lanUiUrl = lanInfo?.enabled ? lanInfo.uiUrl : '';
  const lanApiUrl = lanInfo?.enabled ? lanInfo.apiUrl : '';
  const localRedirectUri = buildRedirectUri(apiUrl);
  const lanRedirectUri = lanApiUrl ? buildRedirectUri(lanApiUrl) : '';
  const showLanRedirectWarning = lanEnabled && Boolean(lanRedirectUri);
  const requiredRedirectUri =
    lanEnabled && lanRedirectUri ? lanRedirectUri : localRedirectUri;

  const refreshLanInfo = async () => {
    if (!desktopApi.isAvailable) return;
    setLanBusy(true);
    setLanError(null);
    try {
      const info = await desktopApi.getLanInfo();
      setLanInfo(info);
      if (!lanHostInput) {
        setLanHostInput(info.host || '');
      }
    } catch {
      setLanError('Unable to load LAN details.');
    } finally {
      setLanBusy(false);
    }
  };

  const handleLanToggle = async () => {
    if (!desktopApi.isAvailable) return;
    setLanBusy(true);
    setLanError(null);
    try {
      const nextEnabled = !lanEnabled;
      const payload: { enabled: boolean; host?: string | null } = { enabled: nextEnabled };
      if (nextEnabled) {
        payload.host = lanHostInput.trim();
      }
      const info = await desktopApi.setLanAccess(payload);
      setLanInfo(info);
      setLanHostInput(info.host || lanHostInput);
      onLanChange?.(info);
    } catch {
      setLanError('Failed to update LAN access.');
    } finally {
      setLanBusy(false);
    }
  };

  const handleLanApplyHost = async () => {
    if (!desktopApi.isAvailable) return;
    setLanBusy(true);
    setLanError(null);
    try {
      const info = await desktopApi.setLanAccess({
        enabled: lanEnabled,
        host: lanHostInput.trim(),
      });
      setLanInfo(info);
      setLanHostInput(info.host || lanHostInput);
      onLanChange?.(info);
    } catch {
      setLanError('Failed to update the LAN host.');
    } finally {
      setLanBusy(false);
    }
  };

  const handleLanHealthCheck = async () => {
    if (!desktopApi.isAvailable) return;
    setLanBusy(true);
    setLanError(null);
    try {
      const result = await desktopApi.checkLanHealth({ host: lanHostInput.trim() });
      setLanHealth(result);
    } catch {
      setLanError('Health check failed.');
    } finally {
      setLanBusy(false);
    }
  };

  const handleCopy = async (value: string, label: string) => {
    if (!value || typeof window === 'undefined') return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const fallback = document.createElement('textarea');
      fallback.value = value;
      fallback.style.position = 'fixed';
      fallback.style.opacity = '0';
      document.body.appendChild(fallback);
      fallback.select();
      document.execCommand('copy');
      document.body.removeChild(fallback);
    }
    setCopiedLabel(label);
    window.setTimeout(() => setCopiedLabel(null), 1200);
  };

  const displayOverrides = overridesDirty ? draftOverrides : themeOverrides;
  const baseThemeOptions = useMemo(
    () => themes.filter((option) => option.id !== 'custom'),
    [],
  );

  const persistCustomTheme = (next: CustomTheme[]) => {
    setCustomThemes(next);
  };

  const renderAccountSection = () => (
    <div className="space-y-6">
      <div className="bg-surface border border-white/10 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">AniList setup</h2>
            <p className="text-base text-gray-300 mt-1">
              One-time setup to connect your AniList account and sync progress.
            </p>
          </div>
          <button
            onClick={() => onOpenSetup?.()}
            className="px-4 py-2 rounded-lg text-sm font-bold bg-primary text-black shadow-lg shadow-primary/30 transition hover:brightness-110"
          >
            Open setup guide
          </button>
        </div>

        {!desktopApi.isAvailable && (
          <div className="mt-4 rounded-xl border border-white/10 bg-surfaceHighlight/40 px-4 py-3 text-sm text-gray-300">
            You are editing the server credentials from this browser. The values are saved on the
            host machine running the API.
          </div>
        )}
        {!desktopApi.isAvailable && credentialStatus && (
          <div
            className={`mt-3 rounded-xl border border-white/10 px-4 py-3 text-sm ${
              credentialStatus.configured
                ? 'bg-emerald-500/10 text-emerald-200'
                : 'bg-amber-500/10 text-amber-200'
            }`}
          >
            {credentialStatus.configured
              ? `AniList is already configured on the server (${credentialStatus.source}).`
              : 'AniList is not configured on the server yet.'}
          </div>
        )}

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-semibold text-gray-300">AniList Client ID</label>
            <input
              value={credentials.clientId}
              onChange={(e) =>
                setCredentials((prev) => ({ ...prev, clientId: e.target.value }))
              }
              placeholder="e.g. 12345"
              className="mt-2 w-full rounded-lg border border-white/10 bg-surfaceHighlight px-3 py-2.5 text-base text-white focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-300">AniList Client Secret</label>
            <input
              type="password"
              value={credentials.clientSecret}
              onChange={(e) =>
                setCredentials((prev) => ({ ...prev, clientSecret: e.target.value }))
              }
              placeholder="Paste your secret"
              className="mt-2 w-full rounded-lg border border-white/10 bg-surfaceHighlight px-3 py-2.5 text-base text-white focus:outline-none focus:border-primary"
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm font-semibold text-gray-300">Redirect URL</label>
            <input
              value={credentials.redirectUri || defaultRedirectUri}
              onChange={(e) =>
                setCredentials((prev) => ({ ...prev, redirectUri: e.target.value }))
              }
              className="mt-2 w-full rounded-lg border border-white/10 bg-surfaceHighlight px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-primary"
            />
            <p className="text-xs text-gray-500 mt-2">
              {desktopApi.isAvailable
                ? 'Stored locally on this device. ManVerse never uploads your secret.'
                : 'Saved on the host running the API. ManVerse never uploads your secret.'}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-gray-400">
            {saveState === 'saved' && 'Saved. You can sign in now.'}
            {saveState === 'error' &&
              (!credentials.clientId.trim() || !credentials.clientSecret.trim()
                ? 'Enter both Client ID and Client Secret.'
                : 'Could not save. Please try again.')}
            {saveState === 'saving' && 'Saving...'}
          </div>
          <button
            onClick={handleSaveCredentials}
            className="px-4 py-2 rounded-lg text-sm font-bold bg-white/10 text-white border border-white/10 hover:bg-white/20 transition"
          >
            Save credentials
          </button>
        </div>
      </div>
    </div>
  );

  const renderAppSection = () => (
    <div className="space-y-6">
      {desktopApi.isAvailable && updateReady && (
        <div className="bg-surface border border-white/10 rounded-2xl p-6 shadow-xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">Update ready</h2>
              <p className="text-base text-gray-300 mt-1">
                {updateStatus?.version
                  ? `Version ${updateStatus.version} is ready to install.`
                  : 'A new version is ready to install.'}
              </p>
            </div>
            <button
              onClick={() => desktopApi.installUpdate().catch(() => {})}
              className="px-4 py-2 rounded-lg text-sm font-bold bg-primary text-black shadow-lg shadow-primary/30 transition hover:brightness-110"
            >
              Restart & install
            </button>
          </div>
        </div>
      )}
      <div className="bg-surface border border-white/10 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-white">Desktop</h2>
            <p className="text-base text-gray-300">Manage notifications and background tasks.</p>
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
                <div className="text-base font-semibold text-white">Chapter release checks</div>
                <div className="text-sm text-gray-400">
                  Runs about once per hour with a small random delay.
                </div>
              </div>
              <button
                onClick={() => toggleSetting('notifierEnabled')}
                className={`px-4 py-2 rounded-lg text-sm font-bold border transition-colors ${
                  notifierEnabled
                    ? 'bg-primary text-black border-primary'
                    : 'bg-surface text-gray-300 border-white/10 hover:text-white'
                }`}
              >
                {notifierEnabled ? 'On' : 'Off'}
              </button>
            </div>
            <p className="text-sm text-amber-300/80">
              Leaving this on keeps ManVerse running in the background after you close the window.
            </p>
            <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-surfaceHighlight/40 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-base font-semibold text-white">Start on system login</div>
                <div className="text-sm text-gray-400">
                  Appears in Windows startup and KDE autostart.
                </div>
              </div>
              <button
                onClick={() => toggleSetting('launchOnStartup')}
                className={`px-4 py-2 rounded-lg text-sm font-bold border transition-colors ${
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
  );

  const renderHostingSection = () => {
    const docsBase = 'https://github.com/ahm4dd/ManVerse/blob/main';
    const guideUrl = `${docsBase}/Self-hosting-guide.md`;
    const quickStartUrl = `${docsBase}/docs/self-hosting-quick-start.md`;
    const productionUrl = `${docsBase}/docs/self-hosting-production.md`;
    const troubleshootingUrl = `${docsBase}/docs/self-hosting-troubleshooting.md`;

    return (
      <div className="space-y-6">
        <div className="bg-surface border border-white/10 rounded-2xl p-6 shadow-xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">Self-hosting guide</h2>
              <p className="text-base text-gray-300 mt-2">
                Use this when you want to open ManVerse on your phone or tablet while the API runs
                on your main machine.
              </p>
            </div>
            <a
              className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-bold text-black shadow-lg shadow-primary/30 transition hover:brightness-110"
              href={guideUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open full guide
            </a>
          </div>

          <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            Run these steps on the host machine (desktop/server). Don't try to set this up from a
            phone or tablet.
          </div>

          <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            This exposes the app on your local network. Do not forward ports to the public internet
            unless you know exactly what you are doing.
          </div>

          {desktopApi.isAvailable && (
            <div className="mt-4 rounded-xl border border-white/10 bg-surfaceHighlight/40 px-4 py-3 text-sm text-gray-300">
              Use the LAN Access section below to share the desktop app with devices on your Wi-Fi.
            </div>
          )}

          <div className="mt-6 grid gap-3 text-sm text-gray-300 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-surfaceHighlight/40 px-4 py-3">
              Host machine stays on and connected to the same Wi-Fi as your phone.
            </div>
            <div className="rounded-xl border border-white/10 bg-surfaceHighlight/40 px-4 py-3">
              The UI points to the API URL and AniList redirect matches the host.
            </div>
            <div className="rounded-xl border border-white/10 bg-surfaceHighlight/40 px-4 py-3">
              Firewall allows ports for UI and API (LAN only).
            </div>
            <div className="rounded-xl border border-white/10 bg-surfaceHighlight/40 px-4 py-3">
              Avoid public exposure unless you add HTTPS and auth.
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2 text-sm">
            <a
              className="rounded-lg border border-emerald-300/60 bg-emerald-400 px-3 py-2 font-semibold text-black shadow-md shadow-emerald-400/30 hover:brightness-110"
              href={quickStartUrl}
              target="_blank"
              rel="noreferrer"
            >
              Quick start (LAN)
            </a>
            <a
              className="rounded-lg border border-white/15 bg-surface px-3 py-2 font-semibold text-gray-200 shadow-sm hover:bg-surfaceHighlight/60 hover:text-white"
              href={productionUrl}
              target="_blank"
              rel="noreferrer"
            >
              Production setup
            </a>
            <a
              className="rounded-lg border border-white/15 bg-surface px-3 py-2 font-semibold text-gray-200 shadow-sm hover:bg-surfaceHighlight/60 hover:text-white"
              href={troubleshootingUrl}
              target="_blank"
              rel="noreferrer"
            >
              Troubleshooting
            </a>
          </div>
        </div>

        {desktopApi.isAvailable && (
          <div className="bg-surface border border-white/10 rounded-2xl p-6 shadow-xl">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-white">LAN Access</h2>
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      lanEnabled ? 'bg-emerald-500/20 text-emerald-200' : 'bg-white/10 text-gray-300'
                    }`}
                  >
                    {lanEnabled ? 'Active' : 'Off'}
                  </span>
                </div>
                <p className="text-base text-gray-300 mt-2">
                  Expose the desktop UI and API to other devices on your local network.
                </p>
              </div>
              <button
                onClick={handleLanToggle}
                disabled={lanBusy || !lanInfo}
                className={`px-4 py-2 rounded-lg text-sm font-bold border transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                  lanEnabled
                    ? 'bg-rose-500/20 text-rose-200 border-rose-500/40'
                    : 'bg-primary text-black border-primary'
                }`}
              >
                {lanEnabled ? 'Stop LAN access' : 'Enable LAN access'}
              </button>
            </div>

            {!lanInfo && (
              <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                LAN access controls require the latest desktop app build.
              </div>
            )}

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div>
                <label className="text-sm font-semibold text-gray-300">Advertised host</label>
                <input
                  list="lan-hosts"
                  value={lanHostInput}
                  onChange={(e) => setLanHostInput(e.target.value)}
                  placeholder="e.g. 192.168.1.25 or my-pc.local"
                  className="mt-2 w-full rounded-lg border border-white/10 bg-surfaceHighlight px-3 py-2.5 text-base text-white focus:outline-none focus:border-primary"
                />
                <datalist id="lan-hosts">
                  {lanAddresses.map((entry) => (
                    <option
                      key={`${entry.name}-${entry.address}`}
                      value={entry.address}
                    >{`${entry.address} (${entry.name}, ${entry.family})`}</option>
                  ))}
                </datalist>
                <p className="mt-2 text-xs text-gray-500">
                  Pick the IP address your phone can reach. Hostnames like `my-pc.local` also work
                  if your network supports mDNS.
                </p>
                {lanAddresses.length === 0 && (
                  <div className="mt-2 text-xs text-amber-200">
                    No LAN addresses detected yet. Connect to Wi-Fi or enter a hostname manually.
                  </div>
                )}
              </div>
              <div className="rounded-xl border border-white/10 bg-surfaceHighlight/40 px-4 py-3 text-sm text-gray-300">
                <div className="font-semibold text-white">Status</div>
                <div className="mt-2 flex flex-col gap-1">
                  <div>
                    UI server:{' '}
                    <span className={lanInfo?.uiRunning ? 'text-emerald-200' : 'text-amber-200'}>
                      {lanInfo?.uiRunning ? 'Running' : 'Stopped'}
                    </span>
                  </div>
                  <div>
                    API server:{' '}
                    <span className={lanInfo?.apiRunning ? 'text-emerald-200' : 'text-amber-200'}>
                      {lanInfo?.apiRunning ? 'Running' : 'Stopped'}
                    </span>
                  </div>
                  {lanHealth && (
                    <div className="text-xs text-gray-400">
                      Last check: UI {lanHealth.ui ? 'ok' : 'down'} - API{' '}
                      {lanHealth.api ? 'ok' : 'down'}
                    </div>
                  )}
                </div>
                <div className="mt-3 text-xs text-gray-500">
                  Binding: {lanInfo?.bindHost || '--'} - UI port {lanInfo?.uiPort ?? 3000} - API port{' '}
                  {lanInfo?.apiPort ?? 3001}
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={handleLanApplyHost}
                disabled={lanBusy || !lanInfo}
                className="px-3 py-2 rounded-lg text-xs font-semibold border border-white/10 bg-surfaceHighlight/40 text-gray-300 hover:text-white disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Apply host
              </button>
              <button
                onClick={handleLanHealthCheck}
                disabled={lanBusy || !lanInfo}
                className="px-3 py-2 rounded-lg text-xs font-semibold border border-white/10 bg-surfaceHighlight/40 text-gray-300 hover:text-white disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Check health
              </button>
              <button
                onClick={refreshLanInfo}
                disabled={lanBusy || !lanInfo}
                className="px-3 py-2 rounded-lg text-xs font-semibold border border-white/10 bg-surfaceHighlight/40 text-gray-300 hover:text-white disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Refresh
              </button>
              {lanBusy && <span className="text-xs text-gray-400 self-center">Working...</span>}
            </div>

            {lanError && (
              <div className="mt-3 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {lanError}
              </div>
            )}

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-surfaceHighlight/40 px-4 py-3 text-sm text-gray-300">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  LAN UI URL
                </div>
                <div className="mt-1 text-sm text-white break-all">{lanUiUrl || '--'}</div>
                <button
                  onClick={() => handleCopy(lanUiUrl, 'ui')}
                  disabled={!lanUiUrl}
                  className="mt-2 text-xs font-semibold text-primary hover:text-white disabled:text-gray-500"
                >
                  {copiedLabel === 'ui' ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div className="rounded-xl border border-white/10 bg-surfaceHighlight/40 px-4 py-3 text-sm text-gray-300">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  LAN API URL
                </div>
                <div className="mt-1 text-sm text-white break-all">{lanApiUrl || '--'}</div>
                <button
                  onClick={() => handleCopy(lanApiUrl, 'api')}
                  disabled={!lanApiUrl}
                  className="mt-2 text-xs font-semibold text-primary hover:text-white disabled:text-gray-500"
                >
                  {copiedLabel === 'api' ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-white/10 bg-surfaceHighlight/40 px-4 py-3 text-sm text-gray-300">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                AniList redirect URLs
              </div>
              {showLanRedirectWarning && (
                <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                  LAN hosting is enabled. Use the LAN redirect URL for AniList so the desktop app
                  and other devices sign in through the same host.
                </div>
              )}
              <div className="mt-2 space-y-2">
                <div>
                  <div className="text-xs text-gray-500">
                    Local mode (LAN off){' '}
                    {requiredRedirectUri === localRedirectUri && (
                      <span className="text-emerald-300">• Required</span>
                    )}
                  </div>
                  <div className="text-sm text-white break-all">{localRedirectUri}</div>
                  <button
                    onClick={() => handleCopy(localRedirectUri, 'local-redirect')}
                    className="mt-1 text-xs font-semibold text-primary hover:text-white"
                  >
                    {copiedLabel === 'local-redirect' ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <div>
                  <div className="text-xs text-gray-500">
                    LAN mode (LAN on){' '}
                    {requiredRedirectUri === lanRedirectUri && lanRedirectUri && (
                      <span className="text-emerald-300">• Required</span>
                    )}
                  </div>
                  <div className="text-sm text-white break-all">
                    {lanRedirectUri || 'Enable LAN access to generate a LAN redirect URL.'}
                  </div>
                  <button
                    onClick={() => handleCopy(lanRedirectUri, 'lan-redirect')}
                    disabled={!lanRedirectUri}
                    className="mt-1 text-xs font-semibold text-primary hover:text-white disabled:text-gray-500"
                  >
                    {copiedLabel === 'lan-redirect' ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
              <div className="mt-3 text-xs text-gray-500">
                AniList supports one redirect URL at a time. When LAN is enabled, use the LAN URL
                for both the desktop app and other devices. When LAN is off, use the local URL.
              </div>
            </div>
          </div>
        )}

        <div className="bg-surface border border-white/10 rounded-2xl p-6 shadow-xl">
          <h2 className="text-xl font-bold text-white">Current runtime</h2>
          <p className="text-sm text-gray-400 mt-1">These are the URLs the app sees right now.</p>
          <div className="mt-4 grid gap-3 text-sm text-gray-300">
            <div>
              <span className="text-gray-500">Current UI:</span> {currentOrigin || 'Unknown'}
            </div>
            <div>
              <span className="text-gray-500">Current API:</span> {apiUrl}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const handleOverrideChange = (key: keyof ThemeOverrides, value: string | boolean) => {
    setDraftOverrides((prev) => ({ ...prev, [key]: value }));
    setOverridesDirty(true);
    if (theme !== 'custom') {
      setTheme('custom');
    }
  };

  const captureOverrides = (source: ThemeOverrides = draftOverrides): Omit<ThemeOverrides, 'enabled'> => ({
    primary: source.primary,
    background: source.background,
    surface: source.surface,
    surfaceHighlight: source.surfaceHighlight,
    textMain: source.textMain,
    contrastMode: source.contrastMode,
    contrastColor: source.contrastColor,
  });

  const resolveCustomOverrides = (
    overrides?: Partial<Omit<ThemeOverrides, 'enabled'>>,
  ): ThemeOverrides => ({
    ...themeOverrides,
    ...overrides,
    enabled: true,
  });

  const handleApplyOverrides = () => {
    setThemeOverrides(draftOverrides);
    setOverridesDirty(false);
    setThemePreview(null);
  };

  const handleDiscardOverrides = () => {
    setDraftOverrides(themeOverrides);
    setOverridesDirty(false);
    setThemePreview(null);
  };

  const handleApplyCustomTheme = (customTheme: CustomTheme) => {
    const overrides = resolveCustomOverrides(customTheme.overrides);
    setTheme('custom');
    setThemeOverrides(overrides);
    setDraftOverrides(overrides);
    setOverridesDirty(false);
    setThemePreview(null);
    setActiveCustomThemeId(customTheme.id);
  };

  const handleStartEditTheme = (customTheme: CustomTheme) => {
    const overrides = resolveCustomOverrides(customTheme.overrides);
    setEditingThemeId(customTheme.id);
    setCustomThemeName(customTheme.name);
    setTheme('custom');
    setDraftOverrides(overrides);
    setOverridesDirty(true);
    setActiveCustomThemeId(customTheme.id);
  };

  const handleSaveCustomTheme = () => {
    const name = customThemeName.trim() || `Custom ${customThemes.length + 1}`;
    const overrides = captureOverrides();
    if (editingThemeId) {
      const next = customThemes.map((theme) =>
        theme.id === editingThemeId ? { ...theme, name, overrides } : theme,
      );
      persistCustomTheme(next);
      setEditingThemeId(null);
      setCustomThemeName('');
      return;
    }
    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}`;
    persistCustomTheme([...customThemes, { id, name, overrides }]);
    setCustomThemeName('');
  };

  const handleDeleteCustomTheme = (customTheme: CustomTheme) => {
    setPendingDeleteTheme(customTheme);
  };

  const confirmDeleteCustomTheme = () => {
    if (!pendingDeleteTheme) return;
    const next = customThemes.filter((theme) => theme.id !== pendingDeleteTheme.id);
    persistCustomTheme(next);
    if (editingThemeId === pendingDeleteTheme.id) {
      setEditingThemeId(null);
      setCustomThemeName('');
    }
    if (activeCustomThemeId === pendingDeleteTheme.id) {
      setActiveCustomThemeId(null);
    }
    setPendingDeleteTheme(null);
  };

  const renderThemesSection = () => (
    <div className="space-y-6">
      <div className="bg-surface border border-white/10 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Themes</h2>
            <p className="text-base text-gray-300 mt-2">
              Pick a base theme, then customize every color in real time.
            </p>
          </div>
          {overridesDirty && (
            <div className="text-xs font-semibold text-amber-200 bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-full">
              Previewing changes
            </div>
          )}
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {baseThemeOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => {
                setTheme(option.id as Theme);
                setActiveCustomThemeId(null);
                if (themeOverrides.enabled) {
                  setThemeOverrides({ ...themeOverrides, enabled: false });
                }
                setDraftOverrides((prev) => ({ ...prev, enabled: false }));
                setOverridesDirty(false);
                setThemePreview(null);
              }}
              className={`rounded-2xl border px-4 py-5 text-left transition ${
                theme === option.id
                  ? 'border-primary bg-primary/10'
                  : 'border-white/10 bg-surfaceHighlight/40 hover:bg-white/10'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg font-bold text-white">{option.name}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    Primary: {option.color.toUpperCase()}
                  </div>
                </div>
                <div
                  className="h-8 w-8 rounded-full border border-white/20"
                  style={{ backgroundColor: option.color }}
                />
              </div>
              {theme === option.id && (
                <div className="mt-3 text-xs text-primary font-semibold">Active theme</div>
              )}
            </button>
          ))}
        </div>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-white/10" />
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
            Custom themes
          </div>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div
            className={`rounded-2xl border px-4 py-5 text-left transition ${
              theme === 'custom' && !activeCustomThemeId
                ? 'border-primary bg-primary/10'
                : 'border-white/10 bg-surfaceHighlight/40 hover:bg-white/10'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-bold text-white">Custom</div>
                <div className="text-xs text-gray-400 mt-1">
                  Primary: {displayOverrides.primary.toUpperCase()}
                </div>
              </div>
              <div
                className="h-8 w-8 rounded-full border border-white/20"
                style={{ backgroundColor: displayOverrides.primary }}
              />
            </div>
            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={() => {
                  setTheme('custom');
                  if (!themeOverrides.enabled) {
                    const next = { ...themeOverrides, enabled: true };
                    setThemeOverrides(next);
                    setDraftOverrides(next);
                  }
                  setActiveCustomThemeId(null);
                }}
                className="text-xs font-semibold text-primary hover:text-white transition"
              >
                Use current
              </button>
              <button
                onClick={() => {
                  setTheme('custom');
                  const next = { ...themeOverrides, enabled: true };
                  setThemeOverrides(next);
                  setDraftOverrides(next);
                  setOverridesDirty(false);
                }}
                className="text-xs font-semibold text-gray-300 hover:text-white transition"
              >
                Customize
              </button>
            </div>
            {theme === 'custom' && !activeCustomThemeId && (
              <div className="mt-3 text-xs text-primary font-semibold">Active theme</div>
            )}
          </div>

          {customThemes.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-surfaceHighlight/20 px-4 py-5 text-left text-sm text-gray-400">
              No custom themes saved yet. Build one below.
            </div>
          )}

          {customThemes.map((customTheme) => {
            const resolved = resolveCustomOverrides(customTheme.overrides);
            return (
              <div
                key={customTheme.id}
                onClick={() => handleApplyCustomTheme(customTheme)}
                className={`rounded-2xl border bg-surfaceHighlight/40 px-4 py-5 text-left transition hover:bg-white/10 cursor-pointer ${
                  theme === 'custom' && activeCustomThemeId === customTheme.id
                    ? 'border-primary bg-primary/10'
                    : 'border-white/10'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-lg font-bold text-white">{customTheme.name}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      Primary: {resolved.primary.toUpperCase()}
                    </div>
                  </div>
                  <div
                    className="h-8 w-8 rounded-full border border-white/20"
                    style={{ backgroundColor: resolved.primary }}
                  />
                </div>
                <div className="mt-4 flex items-center gap-2 flex-wrap">
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      handleStartEditTheme(customTheme);
                    }}
                    className="text-xs font-semibold text-gray-300 hover:text-white transition"
                  >
                    Edit
                  </button>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDeleteCustomTheme(customTheme);
                    }}
                    className="text-xs font-semibold text-red-300 hover:text-red-100 transition"
                  >
                    Delete
                  </button>
                </div>
                {theme === 'custom' && activeCustomThemeId === customTheme.id && (
                  <div className="mt-3 text-xs text-primary font-semibold">Active theme</div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-8 rounded-2xl border border-white/10 bg-surfaceHighlight/30 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">Theme builder</h3>
              <p className="text-sm text-gray-400 mt-1">
                Adjust colors live. Changes are previewed until you apply them.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleDiscardOverrides}
                disabled={!overridesDirty}
                className="px-3 py-2 rounded-lg text-xs font-semibold border border-white/10 text-gray-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Reset
              </button>
              <button
                onClick={handleApplyOverrides}
                disabled={!overridesDirty}
                className="px-4 py-2 rounded-lg text-xs font-bold bg-primary text-black shadow-lg shadow-primary/30 transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Apply changes
              </button>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-gray-300">
              Overrides are {draftOverrides.enabled ? 'enabled' : 'disabled'}.
            </div>
            <button
              onClick={() => handleOverrideChange('enabled', !draftOverrides.enabled)}
              className={`px-4 py-2 rounded-lg text-sm font-bold border transition-colors ${
                draftOverrides.enabled
                  ? 'bg-primary text-black border-primary'
                  : 'bg-surface text-gray-300 border-white/10 hover:text-white'
              }`}
            >
              {draftOverrides.enabled ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {[
              { key: 'primary', label: 'Primary', value: draftOverrides.primary },
              { key: 'background', label: 'Background', value: draftOverrides.background },
              { key: 'surface', label: 'Surface', value: draftOverrides.surface },
              { key: 'surfaceHighlight', label: 'Surface highlight', value: draftOverrides.surfaceHighlight },
              { key: 'textMain', label: 'Text', value: draftOverrides.textMain, full: true },
            ].map((item) => (
              <label
                key={item.key}
                className={`flex items-center justify-between rounded-xl border border-white/10 bg-surfaceHighlight/40 px-4 py-3 text-sm text-gray-200 ${
                  item.full ? 'md:col-span-2' : ''
                }`}
              >
                <div className="flex flex-col gap-1">
                  <span className="font-semibold">{item.label}</span>
                  <span className="text-xs font-mono text-gray-400">{item.value.toUpperCase()}</span>
                </div>
                <input
                  type="color"
                  value={item.value}
                  onInput={(e) =>
                    handleOverrideChange(item.key as keyof ThemeOverrides, e.currentTarget.value)
                  }
                  onChange={(e) =>
                    handleOverrideChange(item.key as keyof ThemeOverrides, e.target.value)
                  }
                  className="h-8 w-12 rounded border border-white/20 bg-transparent"
                />
              </label>
            ))}
          </div>

          <div className="mt-5 rounded-xl border border-white/10 bg-surfaceHighlight/40 px-4 py-4">
            <div className="text-sm font-semibold text-white">Shadow contrast</div>
            <p className="text-xs text-gray-400 mt-1">
              Adjust the dark/light shadow bias for cards and overlays.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {(['dark', 'light', 'custom'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => handleOverrideChange('contrastMode', mode)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                    draftOverrides.contrastMode === mode
                      ? 'bg-primary text-black border-primary'
                      : 'bg-surface text-gray-300 border-white/10 hover:text-white'
                  }`}
                >
                  {mode === 'dark' ? 'Dark' : mode === 'light' ? 'Light' : 'Custom'}
                </button>
              ))}
              {draftOverrides.contrastMode === 'custom' && (
                <div className="flex items-center gap-3 rounded-full border border-white/10 bg-surface px-3 py-1.5">
                  <span className="text-xs font-mono text-gray-300">
                    {draftOverrides.contrastColor.toUpperCase()}
                  </span>
                  <input
                    type="color"
                    value={draftOverrides.contrastColor}
                    onInput={(e) => handleOverrideChange('contrastColor', e.currentTarget.value)}
                    onChange={(e) => handleOverrideChange('contrastColor', e.target.value)}
                    className="h-6 w-8 rounded border border-white/20 bg-transparent"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <input
              value={customThemeName}
              onChange={(e) => setCustomThemeName(e.target.value)}
              placeholder="Theme name"
              className="w-full sm:max-w-xs rounded-lg border border-white/10 bg-surfaceHighlight px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary"
            />
            <div className="flex flex-wrap items-center gap-2">
              {editingThemeId && (
                <button
                  onClick={() => {
                    setEditingThemeId(null);
                    setCustomThemeName('');
                    setOverridesDirty(false);
                    setDraftOverrides(themeOverrides);
                  }}
                  className="text-xs text-gray-400 hover:text-white transition"
                >
                  Cancel edit
                </button>
              )}
              <button
                onClick={handleSaveCustomTheme}
                className="px-4 py-2 rounded-lg text-sm font-bold bg-primary text-black shadow-lg shadow-primary/30 transition hover:brightness-110"
              >
                {editingThemeId ? 'Save changes' : 'Save as new'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {pendingDeleteTheme && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-surface p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Delete theme?</h3>
            <p className="text-sm text-gray-400 mt-2">
              This will remove “{pendingDeleteTheme.name}” permanently.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setPendingDeleteTheme(null)}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-300 border border-white/10 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteCustomTheme}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-500 text-white hover:bg-red-400"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const sectionContent = () => {
    switch (activeSection) {
      case 'account':
        return renderAccountSection();
      case 'app':
        return renderAppSection();
      case 'hosting':
        return renderHostingSection();
      case 'themes':
        return renderThemesSection();
      default:
        return null;
    }
  };

  return (
    <div className="min-h-[100dvh] min-h-app bg-background pb-20">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 pt-5 sm:pt-8">
        <button
          onClick={onBack}
          className="mb-6 flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
          Back
        </button>

        <div className="mb-8">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white">Settings</h1>
          <p className="text-gray-300 mt-2 text-base">
            Manage account setup, desktop preferences, self-hosting, and themes.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[240px,1fr]">
          <aside className="space-y-3">
            <div className="flex gap-2 overflow-x-auto scrollbar-hide lg:flex-col lg:overflow-visible">
              {SETTINGS_SECTIONS.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`flex-1 rounded-xl px-4 py-3 text-left text-sm font-semibold transition-colors lg:flex-none ${
                    activeSection === section.id
                      ? 'bg-primary/15 text-white'
                      : 'bg-white/5 text-gray-300 hover:bg-white/10'
                  }`}
                >
                  <div>{section.label}</div>
                  <div className="text-[11px] text-gray-500 mt-1 hidden lg:block">
                    {section.description}
                  </div>
                </button>
              ))}
            </div>
          </aside>

          <section className="space-y-6">{sectionContent()}</section>
        </div>
      </div>
    </div>
  );
};

export default Settings;
