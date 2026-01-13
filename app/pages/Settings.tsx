import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft } from '../components/Icons';
import { desktopApi, type DesktopSettings, type UpdateStatus } from '../lib/desktop';
import { API_URL, apiRequest } from '../lib/api-client';
import { useTheme, themes, type Theme, type ThemeOverrides } from '../lib/theme';

interface SettingsProps {
  onBack: () => void;
  onOpenSetup?: () => void;
}

type SettingsSection = 'account' | 'app' | 'hosting' | 'themes';

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

const HOSTING_STORAGE_KEY = 'manverse_self_host_config_v1';

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
  const [credentialStatus, setCredentialStatus] = useState<{
    configured: boolean;
    source: 'env' | 'runtime' | 'none';
    redirectUri?: string;
  } | null>(null);
  const [activeSection, setActiveSection] = useState<SettingsSection>('account');
  const { theme, setTheme, themeOverrides, setThemeOverrides } = useTheme();
  const [hostingConfig, setHostingConfig] = useState({
    host: '',
    apiPort: '3001',
    uiPort: '3000',
    allowedHosts: '',
  });

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
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(HOSTING_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setHostingConfig((prev) => ({ ...prev, ...parsed }));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(HOSTING_STORAGE_KEY, JSON.stringify(hostingConfig));
  }, [hostingConfig]);

  const toggleSetting = async (key: keyof DesktopSettings) => {
    if (!desktopApi.isAvailable || !desktopSettings) return;
    const next = await desktopApi.updateSetting(key, !desktopSettings[key]);
    setDesktopSettings(next);
  };

  const notifierEnabled = Boolean(desktopSettings?.notifierEnabled);
  const launchOnStartup = Boolean(desktopSettings?.launchOnStartup);
  const updateReady = updateStatus?.state === 'downloaded';
  const defaultRedirectUri = `${API_URL}/api/auth/anilist/callback`;
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
      setSaveState('saved');
      window.setTimeout(() => setSaveState('idle'), 1500);
    } catch {
      setSaveState('error');
    }
  };

  const hostingSummary = useMemo(() => {
    const host = hostingConfig.host.trim();
    if (!host) return null;
    const ui = `http://${host}:${hostingConfig.uiPort}`;
    const api = `http://${host}:${hostingConfig.apiPort}`;
    return { ui, api };
  }, [hostingConfig]);

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

  const renderHostingSection = () => (
    <div className="space-y-6">
      <div className="bg-surface border border-white/10 rounded-2xl p-6 shadow-xl">
        <h2 className="text-xl font-bold text-white">Self-hosting guide</h2>
        <p className="text-base text-gray-300 mt-2">
          Use this when you want to open ManVerse on your phone or tablet while the API runs on
          your main machine.
        </p>

        <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          This exposes the app on your local network. Do not forward ports to the public internet
          unless you know exactly what you are doing.
          <a
            className="ml-2 text-amber-100 underline underline-offset-2 hover:text-white"
            href="https://github.com/ahm4dd/ManVerse/blob/main/docs/configuration.md#self-hosting"
            target="_blank"
            rel="noreferrer"
          >
            Open the full guide
          </a>
          .
        </div>

        {desktopApi.isAvailable && (
          <div className="mt-4 rounded-xl border border-white/10 bg-surfaceHighlight/40 px-4 py-3 text-sm text-gray-300">
            The desktop app runs locally by default. For LAN access, use the web build and the
            commands below on the host machine.
          </div>
        )}

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-semibold text-gray-300">Host IP / hostname</label>
            <input
              value={hostingConfig.host}
              onChange={(e) => setHostingConfig((prev) => ({ ...prev, host: e.target.value }))}
              placeholder="e.g. 192.168.1.25 or my-pc.local"
              className="mt-2 w-full rounded-lg border border-white/10 bg-surfaceHighlight px-3 py-2.5 text-base text-white focus:outline-none focus:border-primary"
            />
            <p className="mt-2 text-xs text-gray-500">
              Use the LAN IP of the machine running the API + web app.
            </p>
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-300">Allowed hosts (Vite)</label>
            <input
              value={hostingConfig.allowedHosts}
              onChange={(e) =>
                setHostingConfig((prev) => ({ ...prev, allowedHosts: e.target.value }))
              }
              placeholder="ahm4dd-laptop.local,192.168.1.25"
              className="mt-2 w-full rounded-lg border border-white/10 bg-surfaceHighlight px-3 py-2.5 text-base text-white focus:outline-none focus:border-primary"
            />
            <p className="mt-2 text-xs text-gray-500">
              Comma-separated list. Add this to `VITE_ALLOWED_HOSTS` in `app/.env.local`.
            </p>
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-300">UI port</label>
            <input
              value={hostingConfig.uiPort}
              onChange={(e) => setHostingConfig((prev) => ({ ...prev, uiPort: e.target.value }))}
              className="mt-2 w-full rounded-lg border border-white/10 bg-surfaceHighlight px-3 py-2.5 text-base text-white focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-300">API port</label>
            <input
              value={hostingConfig.apiPort}
              onChange={(e) => setHostingConfig((prev) => ({ ...prev, apiPort: e.target.value }))}
              className="mt-2 w-full rounded-lg border border-white/10 bg-surfaceHighlight px-3 py-2.5 text-base text-white focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        {hostingSummary && (
          <div className="mt-5 rounded-xl border border-white/10 bg-surfaceHighlight/40 px-4 py-3 text-sm text-gray-300">
            <div className="font-semibold text-white">Suggested URLs</div>
            <div className="mt-2">Web UI: {hostingSummary.ui}</div>
            <div className="mt-1">API: {hostingSummary.api}</div>
          </div>
        )}

        <div className="mt-6 space-y-3 text-sm text-gray-300">
          <div className="font-semibold text-white">Quick steps</div>
          <ol className="list-decimal list-inside space-y-2 text-gray-300">
            <li>Run the API on your host machine (ensure port {hostingConfig.apiPort} is open).</li>
            <li>
              Start the web UI with:
              <span className="block mt-1 text-gray-200">
                `bun run dev:app -- --host 0.0.0.0 --port {hostingConfig.uiPort}`
              </span>
            </li>
            <li>
              Set `VITE_API_URL=http://&lt;host&gt;:{hostingConfig.apiPort}` in `app/.env.local`.
            </li>
            <li>
              Add your hostname/IPs to `VITE_ALLOWED_HOSTS` and open the UI from your phone.
            </li>
          </ol>
        </div>

        <div className="mt-6 rounded-xl border border-white/10 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          You may need to allow ports {hostingConfig.uiPort} and {hostingConfig.apiPort} in your
          firewall for LAN access.
        </div>
      </div>

      <div className="bg-surface border border-white/10 rounded-2xl p-6 shadow-xl">
        <h2 className="text-xl font-bold text-white">Current runtime</h2>
        <p className="text-sm text-gray-400 mt-1">These are the URLs the app sees right now.</p>
        <div className="mt-4 grid gap-3 text-sm text-gray-300">
          <div>
            <span className="text-gray-500">Current UI:</span> {currentOrigin || 'Unknown'}
          </div>
          <div>
            <span className="text-gray-500">Current API:</span> {API_URL}
          </div>
        </div>
      </div>
    </div>
  );

  const handleOverrideChange = (key: keyof ThemeOverrides, value: string | boolean) => {
    setThemeOverrides({ ...themeOverrides, [key]: value });
  };

  const renderThemesSection = () => (
    <div className="space-y-6">
      <div className="bg-surface border border-white/10 rounded-2xl p-6 shadow-xl">
        <h2 className="text-xl font-bold text-white">Themes</h2>
        <p className="text-base text-gray-300 mt-2">Pick a theme. Changes apply instantly.</p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {themes.map((option) => (
            <button
              key={option.id}
              onClick={() => setTheme(option.id as Theme)}
              className={`rounded-2xl border px-4 py-5 text-left transition ${
                theme === option.id
                  ? 'border-primary bg-primary/10'
                  : 'border-white/10 bg-surfaceHighlight/40 hover:bg-white/10'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg font-bold text-white">{option.name}</div>
                  <div className="text-xs text-gray-400 mt-1">Primary: {option.color}</div>
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
      </div>
      <div className="bg-surface border border-white/10 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-bold text-white">Custom theme overrides</h3>
            <p className="text-sm text-gray-400 mt-1">
              Customize your palette without slowing anything down. Overrides apply on top of the selected theme.
            </p>
          </div>
          <button
            onClick={() => handleOverrideChange('enabled', !themeOverrides.enabled)}
            className={`px-4 py-2 rounded-lg text-sm font-bold border transition-colors ${
              themeOverrides.enabled
                ? 'bg-primary text-black border-primary'
                : 'bg-surface text-gray-300 border-white/10 hover:text-white'
            }`}
          >
            {themeOverrides.enabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="flex items-center justify-between rounded-xl border border-white/10 bg-surfaceHighlight/40 px-4 py-3 text-sm text-gray-200">
            Primary
            <input
              type="color"
              value={themeOverrides.primary}
              onChange={(e) => handleOverrideChange('primary', e.target.value)}
              className="h-8 w-12 rounded border border-white/20 bg-transparent"
              disabled={!themeOverrides.enabled}
            />
          </label>
          <label className="flex items-center justify-between rounded-xl border border-white/10 bg-surfaceHighlight/40 px-4 py-3 text-sm text-gray-200">
            Background
            <input
              type="color"
              value={themeOverrides.background}
              onChange={(e) => handleOverrideChange('background', e.target.value)}
              className="h-8 w-12 rounded border border-white/20 bg-transparent"
              disabled={!themeOverrides.enabled}
            />
          </label>
          <label className="flex items-center justify-between rounded-xl border border-white/10 bg-surfaceHighlight/40 px-4 py-3 text-sm text-gray-200">
            Surface
            <input
              type="color"
              value={themeOverrides.surface}
              onChange={(e) => handleOverrideChange('surface', e.target.value)}
              className="h-8 w-12 rounded border border-white/20 bg-transparent"
              disabled={!themeOverrides.enabled}
            />
          </label>
          <label className="flex items-center justify-between rounded-xl border border-white/10 bg-surfaceHighlight/40 px-4 py-3 text-sm text-gray-200">
            Surface highlight
            <input
              type="color"
              value={themeOverrides.surfaceHighlight}
              onChange={(e) => handleOverrideChange('surfaceHighlight', e.target.value)}
              className="h-8 w-12 rounded border border-white/20 bg-transparent"
              disabled={!themeOverrides.enabled}
            />
          </label>
          <label className="flex items-center justify-between rounded-xl border border-white/10 bg-surfaceHighlight/40 px-4 py-3 text-sm text-gray-200 md:col-span-2">
            Text
            <input
              type="color"
              value={themeOverrides.textMain}
              onChange={(e) => handleOverrideChange('textMain', e.target.value)}
              className="h-8 w-12 rounded border border-white/20 bg-transparent"
              disabled={!themeOverrides.enabled}
            />
          </label>
        </div>

        <div className="mt-4 text-xs text-gray-500">
          Tip: use the Custom theme card as your base if you want full control.
        </div>
      </div>
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
