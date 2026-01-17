const { spawn, spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const archiver = require('archiver');

const preflightTempDir = path.join(os.homedir(), '.config', 'ManVerse', 'tmp');
if (process.platform === 'linux') {
  try {
    fs.mkdirSync(preflightTempDir, { recursive: true });
    process.env.TMPDIR = preflightTempDir;
    process.env.TEMP = preflightTempDir;
    process.env.TMP = preflightTempDir;
  } catch {
    // ignore
  }
}

const {
  app,
  BrowserWindow,
  dialog,
  Notification,
  ipcMain,
  session,
  crashReporter,
  shell,
} = require('electron');
const { autoUpdater } = require('electron-updater');

const isDev = process.env.MANVERSE_DEV === 'true' || !app.isPackaged;
const rootDir = path.resolve(__dirname, '..');
const resourcesDir = app.isPackaged ? process.resourcesPath : rootDir;

const apiPort = Number(process.env.MANVERSE_API_PORT || 3001);
const apiUrl = `http://localhost:${apiPort}`;

const normalizeHost = (raw, fallbackHost, fallbackPort) => {
  if (!raw) return { host: fallbackHost, port: fallbackPort };
  const trimmed = String(raw).trim();
  try {
    if (trimmed.includes('://')) {
      const parsed = new URL(trimmed);
      return {
        host: parsed.hostname || fallbackHost,
        port: parsed.port ? Number(parsed.port) : fallbackPort,
      };
    }
  } catch {
    // ignore
  }
  const noProtocol = trimmed.replace(/^https?:\/\//, '');
  const hostPort = noProtocol.split('/')[0];
  if (hostPort.includes(':')) {
    const [host, port] = hostPort.split(':');
    return { host: host || fallbackHost, port: Number(port) || fallbackPort };
  }
  return { host: hostPort || fallbackHost, port: fallbackPort };
};

const defaultUiHost = '127.0.0.1';
const defaultUiPort = Number(process.env.MANVERSE_UI_PORT || 3000);
const normalizedUi = normalizeHost(process.env.MANVERSE_UI_HOST, defaultUiHost, defaultUiPort);
let uiBindHost = normalizedUi.host;
let uiAdvertisedHost = normalizedUi.host;
let uiPort = normalizedUi.port;
let uiUrl = `http://${uiAdvertisedHost}:${uiPort}`;
let apiBindHost = normalizedUi.host;

const getBundledBunPath = () => {
  if (!app.isPackaged) return null;
  const platformDir =
    process.platform === 'win32' ? 'windows-x64' : process.platform === 'linux' ? 'linux-x64' : null;
  if (!platformDir) return null;
  const binaryName = process.platform === 'win32' ? 'bun.exe' : 'bun';
  const candidate = path.join(process.resourcesPath, 'bun', platformDir, binaryName);
  return fs.existsSync(candidate) ? candidate : null;
};

const bunPath = process.env.BUN_PATH || getBundledBunPath() || 'bun';
let apiProcess = null;
let uiProcess = null;
let uiServer = null;
let mainWindow = null;
let isShuttingDown = false;
let allowBackgroundClose = false;
let apiRestarting = false;
let isMaximized = false;
let pendingAuthToken = null;

const DESKTOP_LOG_MAX_EVENTS = 200;
const DESKTOP_LOG_DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const DESKTOP_LOG_DEFAULT_MAX_FILES = 5;
const DESKTOP_LOG_NAME = 'desktop.log';
const DESKTOP_LOG_CONFIG = 'desktop-logging.json';

const getUserDataPath = () => {
  try {
    return app.getPath('userData');
  } catch {
    return path.join(os.homedir(), '.config', 'ManVerse');
  }
};

const redactMessage = (value) => {
  if (!value) return value;
  return String(value)
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer REDACTED')
    .replace(/(access_token|token|authorization|client_secret|client_id)=([^\s&]+)/gi, '$1=REDACTED')
    .replace(/(https?:\/\/[^\s?]+)\?[^\s]+/gi, '$1?[redacted]');
};

const createDesktopLogger = () => {
  const logDir = getUserDataPath();
  const logFile = path.join(logDir, DESKTOP_LOG_NAME);
  const configFile = path.join(logDir, DESKTOP_LOG_CONFIG);
  const events = [];
  let config = {
    enabled: false,
    maxBytes: DESKTOP_LOG_DEFAULT_MAX_BYTES,
    maxFiles: DESKTOP_LOG_DEFAULT_MAX_FILES,
  };

  const loadConfig = () => {
    try {
      if (!fs.existsSync(configFile)) return config;
      const raw = fs.readFileSync(configFile, 'utf-8');
      const parsed = JSON.parse(raw);
      config = {
        enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : config.enabled,
        maxBytes:
          typeof parsed.maxBytes === 'number' && parsed.maxBytes > 0
            ? parsed.maxBytes
            : config.maxBytes,
        maxFiles:
          typeof parsed.maxFiles === 'number' && parsed.maxFiles > 0
            ? parsed.maxFiles
            : config.maxFiles,
      };
      return config;
    } catch {
      return config;
    }
  };

  const persistConfig = () => {
    try {
      fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
    } catch {
      // ignore config write failures
    }
  };

  const rotateLogs = () => {
    try {
      if (!fs.existsSync(logFile)) return;
      const stats = fs.statSync(logFile);
      if (stats.size <= config.maxBytes) return;
      for (let index = config.maxFiles - 1; index >= 1; index -= 1) {
        const source = `${logFile}.${index}`;
        const target = `${logFile}.${index + 1}`;
        if (!fs.existsSync(source)) continue;
        if (index + 1 > config.maxFiles) {
          fs.unlinkSync(source);
        } else {
          fs.renameSync(source, target);
        }
      }
      fs.renameSync(logFile, `${logFile}.1`);
    } catch {
      // ignore rotation failures
    }
  };

  const appendLine = (line) => {
    try {
      fs.mkdirSync(logDir, { recursive: true });
      rotateLogs();
      fs.appendFileSync(logFile, `${line}\n`);
    } catch {
      // ignore write failures
    }
  };

  loadConfig();

  return {
    log: (message, data = null, level = 'info') => {
      const event = {
        id: crypto.randomUUID(),
        ts: new Date().toISOString(),
        level,
        message: redactMessage(message),
        data: data ?? null,
      };
      events.push(event);
      if (events.length > DESKTOP_LOG_MAX_EVENTS) {
        events.splice(0, events.length - DESKTOP_LOG_MAX_EVENTS);
      }
      if (config.enabled) {
        appendLine(JSON.stringify(event));
      }
      return event;
    },
    list: (limit = 50) => {
      if (limit <= 0) return [];
      return events.slice(-limit).reverse();
    },
    clearBuffer: () => {
      events.length = 0;
    },
    setEnabled: (enabled) => {
      config.enabled = Boolean(enabled);
      persistConfig();
      return getStatus();
    },
    getStatus: () => getStatus(),
    getLogDir: () => logDir,
    getLogFile: () => logFile,
  };

  function getStatus() {
    let sizeBytes = 0;
    try {
      if (fs.existsSync(logFile)) {
        sizeBytes = fs.statSync(logFile).size;
      }
    } catch {
      sizeBytes = 0;
    }
    return {
      enabled: config.enabled,
      logFile: config.enabled ? logFile : null,
      logDir,
      sizeBytes,
      maxBytes: config.maxBytes,
      maxFiles: config.maxFiles,
      eventCount: events.length,
    };
  }
};

let desktopLogger = null;

const getDesktopLogger = () => {
  if (!desktopLogger) {
    desktopLogger = createDesktopLogger();
  }
  return desktopLogger;
};

function logDesktop(message, data = null, level = 'info') {
  try {
    return getDesktopLogger().log(message, data ?? null, level);
  } catch {
    return null;
  }
}

const getCrashDumpDir = () => {
  return path.join(getUserDataPath(), 'crashDumps');
};

const startCrashReporter = () => {
  try {
    const crashDir = getCrashDumpDir();
    fs.mkdirSync(crashDir, { recursive: true });
    app.setPath('crashDumps', crashDir);
    crashReporter.start({
      companyName: 'ManVerse',
      productName: 'ManVerse',
      submitURL: 'https://example.invalid',
      uploadToServer: false,
      compress: true,
    });
    logDesktop('crashReporter.started', { crashDir });
  } catch (error) {
    logDesktop('crashReporter.failed', { message: error?.message || String(error) }, 'warn');
  }
};

const getCrashStatus = () => {
  const crashDumpDir = getCrashDumpDir();
  let crashReportCount = 0;
  let lastCrashTime = null;
  try {
    const entries = fs.readdirSync(crashDumpDir, { withFileTypes: true });
    entries.forEach((entry) => {
      if (!entry.isFile()) return;
      crashReportCount += 1;
      try {
        const stats = fs.statSync(path.join(crashDumpDir, entry.name));
        const timestamp = stats.mtimeMs;
        if (!lastCrashTime || timestamp > lastCrashTime) {
          lastCrashTime = timestamp;
        }
      } catch {
        // ignore
      }
    });
  } catch {
    // ignore
  }
  return {
    crashDumpDir,
    crashReportCount,
    lastCrashTime: lastCrashTime ? new Date(lastCrashTime).toISOString() : null,
  };
};

const fetchJson = async (url) => {
  if (typeof fetch !== 'function') {
    throw new Error('fetch unavailable in this runtime');
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
};

const createSupportBundle = async (rendererBundle) => {
  const bundleDir = path.join(getUserDataPath(), 'support-bundles');
  fs.mkdirSync(bundleDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const bundlePath = path.join(bundleDir, `manverse-support-${timestamp}.zip`);

  const output = fs.createWriteStream(bundlePath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  const archiveDone = new Promise((resolve, reject) => {
    output.on('close', resolve);
    output.on('error', reject);
    archive.on('error', reject);
    archive.on('warning', (error) => {
      logDesktop('supportBundle.warning', { message: error?.message || String(error) }, 'warn');
    });
  });

  archive.pipe(output);

  const metadata = {
    generatedAt: new Date().toISOString(),
    appVersion: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    node: process.versions.node,
    electron: process.versions.electron,
  };
  archive.append(JSON.stringify(metadata, null, 2), { name: 'metadata.json' });

  const logger = getDesktopLogger();
  const desktopBundle = {
    generatedAt: new Date().toISOString(),
    status: logger.getStatus(),
    recentEvents: logger.list(200).reverse(),
  };
  archive.append(JSON.stringify(desktopBundle, null, 2), {
    name: 'desktop/desktop-logs.json',
  });
  const desktopLogFile = logger.getLogFile();
  if (desktopLogFile && fs.existsSync(desktopLogFile)) {
    archive.file(desktopLogFile, { name: 'desktop/desktop.log.jsonl' });
  }

  const crashStatus = getCrashStatus();
  archive.append(JSON.stringify(crashStatus, null, 2), {
    name: 'desktop/crash-status.json',
  });
  try {
    const crashFiles = fs.readdirSync(crashStatus.crashDumpDir, { withFileTypes: true });
    crashFiles.forEach((entry) => {
      if (!entry.isFile()) return;
      const filePath = path.join(crashStatus.crashDumpDir, entry.name);
      archive.file(filePath, { name: `desktop/crash-dumps/${entry.name}` });
    });
  } catch {
    // ignore crash dump read failures
  }

  if (rendererBundle) {
    archive.append(JSON.stringify(rendererBundle, null, 2), {
      name: 'renderer/renderer-logs.json',
    });
  }

  const apiBase = process.env.MANVERSE_RENDERER_API_URL || apiUrl;
  try {
    const apiBundle = await fetchJson(`${apiBase}/api/scraper/logging/export`);
    archive.append(JSON.stringify(apiBundle, null, 2), {
      name: 'api/scraper-logs.json',
    });
  } catch (error) {
    archive.append(
      JSON.stringify(
        { message: error?.message || String(error), url: `${apiBase}/api/scraper/logging/export` },
        null,
        2,
      ),
      { name: 'api/scraper-logs-error.json' },
    );
  }

  await archive.finalize();
  await archiveDone;
  return bundlePath;
};

async function clearAniListSession() {
  try {
    const origins = ['https://anilist.co'];
    await Promise.all(
      origins.map((origin) =>
        session.defaultSession.clearStorageData({
          origin,
          storages: ['cookies', 'localstorage', 'cachestorage'],
        }),
      ),
    );
    logDesktop('auth.session.cleared', { origins });
    return { ok: true };
  } catch (error) {
    logDesktop('auth.session.clear_failed', { message: error?.message || String(error) });
    return { ok: false };
  }
}

const shouldDisableSandbox =
  process.platform === 'linux' &&
  app.isPackaged &&
  process.env.MANVERSE_DISABLE_SANDBOX !== 'false';

if (shouldDisableSandbox) {
  app.commandLine.appendSwitch('no-sandbox');
  app.commandLine.appendSwitch('disable-setuid-sandbox');
}
if (process.platform === 'linux' && app.isPackaged) {
  app.commandLine.appendSwitch('disable-dev-shm-usage');
}

function ensureWritableTemp() {
  let fallbackBase = null;
  try {
    fallbackBase = app.getPath('userData');
  } catch {
    fallbackBase = path.join(os.homedir(), '.config', 'ManVerse');
  }
  const tempDir = path.join(fallbackBase, 'tmp');
  try {
    fs.mkdirSync(tempDir, { recursive: true });
  } catch {
    // ignore
  }
  app.setPath('temp', tempDir);
  process.env.TMPDIR = tempDir;
  process.env.TEMP = tempDir;
  process.env.TMP = tempDir;
  return tempDir;
}

if (process.platform === 'linux' && app.isPackaged) {
  ensureWritableTemp();
}

const readDirSafe = (target) => {
  try {
    return fs.readdirSync(target, { withFileTypes: true });
  } catch {
    return [];
  }
};

const firstExisting = (paths) => paths.find((candidate) => candidate && fs.existsSync(candidate));

function resolvePuppeteerExecutable(cacheDir) {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  const cacheDirs = [cacheDir].filter(Boolean);
  for (const base of cacheDirs) {
    const chromeRoot = path.join(base, 'chrome');
    const entries = readDirSafe(chromeRoot).filter((entry) => entry.isDirectory());
    for (const entry of entries) {
      const name = entry.name;
      const platformPath =
        process.platform === 'win32'
          ? path.join(chromeRoot, name, 'chrome-win64', 'chrome.exe')
          : path.join(chromeRoot, name, 'chrome-linux', 'chrome');
      if (fs.existsSync(platformPath)) {
        return platformPath;
      }
    }
  }

  if (process.platform === 'win32') {
    return firstExisting([
      'C:\\\\Program Files\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe',
      'C:\\\\Program Files (x86)\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe',
      'C:\\\\Program Files\\\\Microsoft\\\\Edge\\\\Application\\\\msedge.exe',
      'C:\\\\Program Files (x86)\\\\Microsoft\\\\Edge\\\\Application\\\\msedge.exe',
    ]);
  }

  if (process.platform === 'linux') {
    return firstExisting([
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/usr/bin/brave-browser',
    ]);
  }

  return null;
}

const settingsPath = path.join(app.getPath('userData'), 'settings.json');
const notifierEventsPath = path.join(app.getPath('userData'), 'notifier-events.json');
const NOTIFIER_EVENTS_LIMIT = 80;
const defaultSettings = {
  notifierEnabled: false,
  launchOnStartup: false,
  pollBaseMinutes: 60,
  pollJitterMinutes: 15,
  jwtSecret: '',
  anilistClientId: '',
  anilistClientSecret: '',
  anilistRedirectUri: '',
  lanAccessEnabled: false,
  lanHost: '',
};
let appSettings = null;
let notifierTimer = null;
let notifierRunning = false;
let notifierEvents = null;
let updateStatus = {
  state: 'idle',
  version: null,
  message: null,
};

function broadcastUpdateStatus() {
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send('manverse:update-status', updateStatus);
  });
}

function setUpdateStatus(next) {
  updateStatus = { ...updateStatus, ...next };
  broadcastUpdateStatus();
}

function spawnProcess(command, args, options) {
  const child = spawn(command, args, options);
  child.on('error', (error) => {
    dialog.showErrorBox('ManVerse process error', error.message);
  });
  return child;
}

function loadSettings() {
  if (appSettings) return appSettings;
  try {
    if (fs.existsSync(settingsPath)) {
      const raw = fs.readFileSync(settingsPath, 'utf8');
      appSettings = { ...defaultSettings, ...JSON.parse(raw) };
      if (!appSettings.jwtSecret) {
        appSettings.jwtSecret = crypto.randomBytes(32).toString('hex');
        saveSettings(appSettings);
      }
      return appSettings;
    }
  } catch {
    // ignore
  }
  appSettings = { ...defaultSettings };
  appSettings.jwtSecret = crypto.randomBytes(32).toString('hex');
  saveSettings(appSettings);
  return appSettings;
}

function saveSettings(settings) {
  appSettings = settings;
  try {
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  } catch {
    // ignore
  }
}

function formatHostForUrl(host) {
  if (!host) return host;
  if (host.startsWith('[') && host.endsWith(']')) return host;
  return host.includes(':') ? `[${host}]` : host;
}

function buildUrl(host, port) {
  return `http://${formatHostForUrl(host)}:${port}`;
}

function updateRendererApiUrl() {
  process.env.MANVERSE_RENDERER_API_URL = buildUrl(uiAdvertisedHost, apiPort);
}

function getLanAddresses() {
  const nets = os.networkInterfaces();
  const results = [];
  Object.entries(nets).forEach(([name, entries]) => {
    if (!entries) return;
    entries.forEach((net) => {
      const family = typeof net.family === 'string' ? net.family : net.family === 4 ? 'IPv4' : 'IPv6';
      if (net.internal) return;
      if (!net.address) return;
      if (family === 'IPv4' && net.address.startsWith('169.254.')) return;
      if (family === 'IPv6' && net.address.startsWith('fe80:')) return;
      results.push({ name, address: net.address, family });
    });
  });
  return results;
}

function resolveLanHost(preferredHost) {
  const trimmed = String(preferredHost || '').trim();
  const addresses = getLanAddresses();
  if (trimmed) {
    const match = addresses.find((entry) => entry.address === trimmed);
    return match ? match.address : trimmed;
  }
  return addresses[0]?.address || normalizedUi.host;
}

function applyLanConfigFromSettings() {
  const settings = getSettings();
  if (settings.lanAccessEnabled) {
    const resolvedHost = resolveLanHost(settings.lanHost);
    uiBindHost = resolvedHost.includes(':') ? '::' : '0.0.0.0';
    uiAdvertisedHost = resolvedHost;
    apiBindHost = uiBindHost;
  } else {
    uiBindHost = normalizedUi.host;
    uiAdvertisedHost = normalizedUi.host;
    apiBindHost = normalizedUi.host;
  }
  uiUrl = buildUrl(uiAdvertisedHost, uiPort);
}

function buildCorsOrigins(settings) {
  const origins = new Set();
  origins.add(buildUrl(normalizedUi.host, uiPort));
  origins.add(buildUrl('localhost', uiPort));
  if (settings.lanAccessEnabled) {
    origins.add(buildUrl(resolveLanHost(settings.lanHost), uiPort));
  }
  return Array.from(origins).join(',');
}

function loadNotifierEvents() {
  if (notifierEvents) return notifierEvents;
  try {
    if (fs.existsSync(notifierEventsPath)) {
      const raw = fs.readFileSync(notifierEventsPath, 'utf8');
      const parsed = JSON.parse(raw);
      notifierEvents = Array.isArray(parsed) ? parsed : [];
      return notifierEvents;
    }
  } catch {
    // ignore
  }
  notifierEvents = [];
  return notifierEvents;
}

function saveNotifierEvents(list) {
  notifierEvents = list;
  try {
    fs.mkdirSync(path.dirname(notifierEventsPath), { recursive: true });
    fs.writeFileSync(notifierEventsPath, JSON.stringify(list, null, 2));
  } catch {
    // ignore
  }
}

function broadcastNotifierEvents() {
  const list = loadNotifierEvents();
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send('manverse:notifier-events', list);
  });
}

function addNotifierEvents(updates) {
  if (!updates?.length) return loadNotifierEvents();
  const existing = loadNotifierEvents();
  const seen = new Set(existing.map((item) => item.id));
  const timestamp = Date.now();
  const next = [...existing];

  updates.forEach((update, index) => {
    const chapterLabel = update.chapterNumber ? `Chapter ${update.chapterNumber}` : 'New chapter';
    const id = `${update.providerMangaId}-${update.chapterNumber}-${update.releaseDate || ''}`;
    if (seen.has(id)) return;
    seen.add(id);
    next.unshift({
      id,
      type: 'CHAPTER_RELEASE',
      title: update.seriesTitle || 'New chapter available',
      message: update.chapterTitle ? `${chapterLabel} — ${update.chapterTitle}` : chapterLabel,
      time: new Date(timestamp + index).toISOString(),
      timestamp: timestamp + index,
      read: false,
      provider: update.provider,
      providerMangaId: update.providerMangaId,
    });
  });

  const limited = next.slice(0, NOTIFIER_EVENTS_LIMIT);
  saveNotifierEvents(limited);
  broadcastNotifierEvents();
  return limited;
}

function markAllNotifierRead() {
  const next = loadNotifierEvents().map((item) => ({ ...item, read: true }));
  saveNotifierEvents(next);
  broadcastNotifierEvents();
  return next;
}

function setLinuxAutoStart(enabled) {
  const autostartDir = path.join(app.getPath('home'), '.config', 'autostart');
  const desktopFile = path.join(autostartDir, 'manverse.desktop');
  if (!enabled) {
    if (fs.existsSync(desktopFile)) {
      fs.unlinkSync(desktopFile);
    }
    return;
  }
  fs.mkdirSync(autostartDir, { recursive: true });
  const content = [
    '[Desktop Entry]',
    'Type=Application',
    'Name=ManVerse',
    'Comment=ManVerse background notifier',
    `Exec=${process.execPath}`,
    'Terminal=false',
    'X-GNOME-Autostart-enabled=true',
  ].join('\n');
  fs.writeFileSync(desktopFile, content);
}

function applyStartupSetting(enabled) {
  if (process.platform === 'win32') {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      path: process.execPath,
    });
    return;
  }
  if (process.platform === 'linux') {
    setLinuxAutoStart(enabled);
  }
}

function getSettings() {
  return loadSettings();
}

async function restartApiProcess() {
  if (apiProcess) {
    apiRestarting = true;
    await killProcessTree(apiProcess, 'API');
    apiProcess = null;
    apiRestarting = false;
  }
  startApi();
}

async function restartUiServer() {
  if (uiProcess) {
    await killProcessTree(uiProcess, 'UI');
    uiProcess = null;
  }
  if (uiServer) {
    await new Promise((resolve) => {
      uiServer.close(() => resolve());
    });
    uiServer = null;
  }
  if (isDev) {
    startUiDevServer();
    return;
  }
  await startUiStaticServer();
}

async function updateSetting(key, value) {
  const settings = { ...loadSettings(), [key]: value };
  saveSettings(settings);
  if (key === 'launchOnStartup') {
    applyStartupSetting(Boolean(value));
  }
  if (key === 'notifierEnabled' && !value && BrowserWindow.getAllWindows().length === 0) {
    app.quit();
  }
  if (key === 'notifierEnabled') {
    if (value) {
      scheduleNotifierCheck(5 * 60 * 1000);
    } else {
      clearNotifierTimer();
    }
  }
  if (
    key === 'anilistClientId' ||
    key === 'anilistClientSecret' ||
    key === 'anilistRedirectUri'
  ) {
    await restartApiProcess();
  }
  return settings;
}

function getLanInfo() {
  const settings = getSettings();
  const addresses = getLanAddresses();
  const selectedHost = typeof settings.lanHost === 'string' ? settings.lanHost.trim() : '';
  const lanEnabled = Boolean(settings.lanAccessEnabled);
  const savedHost = selectedHost || null;
  const displayHost = lanEnabled ? selectedHost || addresses[0]?.address || null : savedHost;
  const resolvedHost = resolveLanHost(selectedHost);
  const uiHost = lanEnabled ? displayHost || uiAdvertisedHost : uiAdvertisedHost;
  const apiHost = lanEnabled ? displayHost || resolvedHost : 'localhost';
  const uiRunning = Boolean(uiProcess && uiProcess.exitCode == null) || Boolean(uiServer?.listening);
  const apiRunning = Boolean(apiProcess && apiProcess.exitCode == null);

  return {
    enabled: lanEnabled,
    host: displayHost,
    uiPort,
    apiPort,
    uiUrl: buildUrl(uiHost, uiPort),
    apiUrl: buildUrl(apiHost, apiPort),
    bindHost: uiBindHost,
    addresses,
    uiRunning,
    apiRunning,
  };
}

async function setLanAccess(payload) {
  const settings = loadSettings();
  const enabled = Boolean(payload?.enabled);
  const hostProvided = Object.prototype.hasOwnProperty.call(payload || {}, 'host');
  const host = hostProvided && typeof payload.host === 'string' ? payload.host.trim() : settings.lanHost;
  const previousUiUrl = uiUrl;
  const nextSettings = {
    ...settings,
    lanAccessEnabled: enabled,
    lanHost: host || '',
  };
  saveSettings(nextSettings);
  applyLanConfigFromSettings();
  await restartUiServer();
  await restartApiProcess();
  if (previousUiUrl !== uiUrl) {
    void reloadMainWindow('lan-toggle');
  } else {
    updateRendererApiUrl();
  }
  return getLanInfo();
}

async function checkUrlOk(url, timeoutMs = 2000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { method: 'GET', signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function checkLanHealth(payload) {
  const settings = getSettings();
  const customHost = typeof payload?.host === 'string' ? payload.host.trim() : '';
  const resolvedHost = customHost || (settings.lanAccessEnabled ? resolveLanHost(settings.lanHost) : 'localhost');
  const uiCheckUrl = buildUrl(resolvedHost, uiPort);
  const apiCheckUrl = `${buildUrl(resolvedHost, apiPort)}/health`;
  const [uiOk, apiOk] = await Promise.all([checkUrlOk(uiCheckUrl), checkUrlOk(apiCheckUrl)]);
  return { ui: uiOk, api: apiOk };
}

function killProcessTree(child, label) {
  if (!child || child.killed || !child.pid) {
    return Promise.resolve();
  }

  const pid = child.pid;

  return new Promise((resolve) => {
    let resolved = false;
    const finish = () => {
      if (resolved) return;
      resolved = true;
      resolve();
    };

    const timeout = setTimeout(() => {
      if (process.platform === 'win32') {
        spawnSync('taskkill', ['/PID', String(pid), '/T', '/F']);
      } else {
        try {
          process.kill(-pid, 'SIGKILL');
        } catch {
          try {
            process.kill(pid, 'SIGKILL');
          } catch {
            // ignore
          }
        }
      }
      finish();
    }, 2500);

    child.once('exit', () => {
      clearTimeout(timeout);
      finish();
    });

    try {
      if (process.platform === 'win32') {
        child.kill('SIGTERM');
      } else {
        process.kill(-pid, 'SIGTERM');
      }
    } catch {
      try {
        child.kill('SIGTERM');
      } catch {
        // ignore
      }
    }
  });
}

function startApi() {
  const apiDir = path.join(resourcesDir, 'api');
  const args = isDev ? ['run', 'dev'] : ['src/index.ts'];
  const bunDir = path.dirname(bunPath);
  const apiLogPath = path.join(app.getPath('userData'), 'api.log');
  const apiLogStream = fs.createWriteStream(apiLogPath, { flags: 'a' });
  const settings = getSettings();
  const puppeteerCacheDir = path.join(app.getPath('userData'), 'puppeteer');
  const puppeteerExecutable = resolvePuppeteerExecutable(puppeteerCacheDir);
  const redirectUri = [
    settings.anilistRedirectUri,
    process.env.ANILIST_REDIRECT_URI,
  ]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .find((value) => value);
  const env = {
    ...process.env,
    PORT: String(apiPort),
    MANVERSE_API_HOST: apiBindHost,
    FRONTEND_URL: uiUrl,
    FRONTEND_AUTH_PATH: process.env.FRONTEND_AUTH_PATH || '/',
    CORS_ORIGIN: buildCorsOrigins(settings),
    PATH: bunDir + path.delimiter + (process.env.PATH || ''),
    NODE_PATH: path.join(apiDir, 'node_modules'),
    JWT_SECRET: settings.jwtSecret,
    ANILIST_CLIENT_ID: settings.anilistClientId || process.env.ANILIST_CLIENT_ID || '',
    ANILIST_CLIENT_SECRET: settings.anilistClientSecret || process.env.ANILIST_CLIENT_SECRET || '',
    PUPPETEER_CACHE_DIR: puppeteerCacheDir,
    ...(puppeteerExecutable ? { PUPPETEER_EXECUTABLE_PATH: puppeteerExecutable } : {}),
    ...(process.platform === 'win32' ? { PUPPETEER_DISABLE_GPU: 'true' } : {}),
  };
  if (redirectUri) {
    env.ANILIST_REDIRECT_URI = redirectUri;
  }

  apiProcess = spawnProcess(bunPath, args, {
    cwd: apiDir,
    env,
    stdio: isDev ? 'inherit' : ['ignore', 'pipe', 'pipe'],
    detached: process.platform !== 'win32',
  });

  if (!isDev && apiProcess.stdout && apiProcess.stderr) {
    apiProcess.stdout.pipe(apiLogStream);
    apiProcess.stderr.pipe(apiLogStream);
  }

  apiProcess.on('exit', (code) => {
    if (!app.isQuitting && !apiRestarting) {
      dialog.showErrorBox(
        'ManVerse API stopped',
        `The API process exited with code ${code ?? 'unknown'}. Check api.log in your app data folder.`,
      );
    }
  });
}

function startUiDevServer() {
  if (!isDev) return;
  if (process.env.MANVERSE_EXTERNAL_UI === 'true') return;

  const appDir = path.join(rootDir, 'app');
  const args = ['run', 'dev', '--', '--host', uiBindHost, '--port', String(uiPort)];
  const env = {
    ...process.env,
    VITE_API_URL: apiUrl,
  };

  uiProcess = spawnProcess(bunPath, args, {
    cwd: appDir,
    env,
    stdio: 'inherit',
    detached: process.platform !== 'win32',
  });
}

function clearNotifierTimer() {
  if (notifierTimer) {
    clearTimeout(notifierTimer);
    notifierTimer = null;
  }
}

function scheduleNotifierCheck(delayMs) {
  clearNotifierTimer();
  if (!getSettings().notifierEnabled) return;
  notifierTimer = setTimeout(runNotifierCheck, delayMs);
}

async function runNotifierCheck() {
  if (notifierRunning || !getSettings().notifierEnabled) {
    return;
  }
  notifierRunning = true;
  try {
    const response = await fetch(`${apiUrl}/api/notifications/chapters`);
    if (response.ok) {
      const payload = await response.json();
      const updates = payload?.data ?? [];
      const iconPath = path.join(__dirname, 'assets', 'icon.png');
      addNotifierEvents(updates);
      updates.forEach((update) => {
        const title = update.seriesTitle || 'New chapter available';
        const chapterLabel = update.chapterNumber ? `Chapter ${update.chapterNumber}` : 'New chapter';
        const body = update.releaseDate
          ? `${chapterLabel} • ${update.releaseDate}`
          : chapterLabel;
        new Notification({
          title,
          body,
          icon: fs.existsSync(iconPath) ? iconPath : undefined,
        }).show();
      });
    }
  } catch (error) {
    console.warn('Notifier check failed:', error?.message || error);
  } finally {
    notifierRunning = false;
    const { pollBaseMinutes, pollJitterMinutes } = getSettings();
    const jitter = Math.floor(Math.random() * Math.max(1, pollJitterMinutes));
    const delayMs = (pollBaseMinutes + jitter) * 60 * 1000;
    scheduleNotifierCheck(delayMs);
  }
}

async function startUiStaticServer() {
  if (isDev) return;

  const distDir = path.join(resourcesDir, 'app', 'dist');
  if (!fs.existsSync(distDir)) {
    dialog.showErrorBox(
      'Missing build',
      'Frontend build not found. Run "bun run --cwd app build" first.',
    );
    return;
  }

  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.json': 'application/json; charset=utf-8',
    '.ico': 'image/x-icon',
  };

  uiServer = http.createServer((req, res) => {
    const requestUrl = new URL(req.url || '/', 'http://localhost');
    let filePath = path.join(distDir, decodeURIComponent(requestUrl.pathname));

    if (filePath.endsWith(path.sep)) {
      filePath = path.join(filePath, 'index.html');
    }

    if (!filePath.startsWith(distDir)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(distDir, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    res.end(fs.readFileSync(filePath));
  });

  const listenOnPort = (port, host) =>
    new Promise((resolve, reject) => {
      const onError = (error) => {
        uiServer.off('listening', onListening);
        reject(error);
      };
      const onListening = () => {
        uiServer.off('error', onError);
        const address = uiServer.address();
        if (address && typeof address === 'object') {
          uiPort = address.port;
          if (host) {
            uiBindHost = host;
          }
          uiUrl = buildUrl(uiAdvertisedHost, uiPort);
        }
        resolve();
      };
      uiServer.once('error', onError);
      uiServer.once('listening', onListening);
      uiServer.listen(port, host);
    });

  try {
    await listenOnPort(uiPort, uiBindHost);
  } catch (error) {
    if (error && error.code === 'EADDRINUSE') {
      await listenOnPort(0, uiBindHost);
      return;
    }
    if (error && (error.code === 'EADDRNOTAVAIL' || error.code === 'EAFNOSUPPORT')) {
      uiBindHost = '127.0.0.1';
      uiAdvertisedHost = '127.0.0.1';
      await listenOnPort(0, uiBindHost);
      return;
    }
    dialog.showErrorBox('ManVerse UI failed', error.message || String(error));
    throw error;
  }
}

async function waitForUrl(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url, { method: 'GET' });
      if (response.ok) return;
    } catch {
      // ignore
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function createWindow() {
  updateRendererApiUrl();
  logDesktop('window.create', {
    isDev,
    uiUrl,
    apiUrl: process.env.MANVERSE_RENDERER_API_URL,
  });
  const iconPath = path.join(__dirname, 'assets', 'icon.png');
  const win = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    resizable: true,
    maximizable: true,
    fullscreenable: true,
    frame: process.platform === 'darwin',
    backgroundColor: '#0b0b0f',
    autoHideMenuBar: true,
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  const normalizeAuthRedirect = (targetUrl) => {
    try {
      const parsed = new URL(targetUrl);
      const base = new URL(uiUrl);
      const token = parsed.searchParams.get('token');
      const hasAuthToken = Boolean(token) || parsed.searchParams.get('error') === 'AUTH_ERROR';
      const isAuthPath = parsed.pathname === '/auth/callback';
      if (!hasAuthToken && !isAuthPath) return null;
      if (token) {
        pendingAuthToken = token;
      }
      logDesktop('auth.redirect', {
        origin: parsed.origin,
        path: parsed.pathname,
        hasToken: Boolean(token),
        tokenLength: token ? token.length : 0,
        error: parsed.searchParams.get('error') || null,
      });
      if (parsed.origin === base.origin) return null;
      parsed.protocol = base.protocol;
      parsed.host = base.host;
      return parsed.toString();
    } catch {
      return null;
    }
  };

  if (isDev) {
    win.webContents.openDevTools({ mode: 'detach' });
  }

  win.webContents.on('will-redirect', (event, url) => {
    const rewritten = normalizeAuthRedirect(url);
    if (!rewritten) return;
    event.preventDefault();
    win.loadURL(rewritten);
  });

  win.webContents.on('will-navigate', (event, url) => {
    const rewritten = normalizeAuthRedirect(url);
    if (!rewritten) return;
    event.preventDefault();
    win.loadURL(rewritten);
  });

  await win.loadURL(uiUrl);
  mainWindow = win;
  win.webContents.on('did-finish-load', () => {
    broadcastUpdateStatus();
    broadcastNotifierEvents();
    win.webContents.send('manverse:window-state', { isMaximized: win.isMaximized() });
  });
  win.on('close', async (event) => {
    if (app.isQuitting || allowBackgroundClose) return;
    if (!getSettings().notifierEnabled) return;
    event.preventDefault();
    const response = await dialog.showMessageBox(win, {
      type: 'question',
      buttons: ['Keep running', 'Quit'],
      defaultId: 0,
      cancelId: 0,
      title: 'Keep ManVerse running?',
      message: 'Chapter release checks are enabled.',
      detail:
        'If you quit, background checks will stop until you reopen ManVerse.',
    });
    if (response.response === 0) {
      allowBackgroundClose = true;
      win.close();
      allowBackgroundClose = false;
      return;
    }
    app.quit();
  });
  win.on('closed', () => {
    mainWindow = null;
  });

  win.on('maximize', () => {
    isMaximized = true;
    win.webContents.send('manverse:window-state', { isMaximized });
  });
  win.on('unmaximize', () => {
    isMaximized = false;
    win.webContents.send('manverse:window-state', { isMaximized });
  });
}

async function reloadMainWindow(reason) {
  if (!mainWindow || mainWindow.isDestroyed() || isShuttingDown || app.isQuitting) return;
  updateRendererApiUrl();
  let targetUrl = uiUrl;
  try {
    const currentUrl = mainWindow.webContents.getURL();
    if (currentUrl && currentUrl.startsWith('http')) {
      const parsed = new URL(currentUrl);
      const base = new URL(uiUrl);
      parsed.protocol = base.protocol;
      parsed.host = base.host;
      if (reason === 'lan-toggle') {
        parsed.searchParams.set('redirect', 'confirm');
      }
      targetUrl = parsed.toString();
    }
  } catch {
    targetUrl = uiUrl;
  }
  logDesktop('window.reload', {
    reason,
    uiUrl: targetUrl,
    apiUrl: process.env.MANVERSE_RENDERER_API_URL,
  });
  if (!pendingAuthToken) {
    try {
      const token = await mainWindow.webContents.executeJavaScript(
        "localStorage.getItem('manverse_token')",
        true,
      );
      if (typeof token === 'string' && token) {
        pendingAuthToken = token;
        logDesktop('auth.token.capture', { tokenLength: token.length });
      }
    } catch (error) {
      logDesktop('auth.token.capture_failed', { message: error?.message || String(error) });
    }
  }
  try {
    await waitForUrl(targetUrl, 15000);
  } catch (error) {
    logDesktop('window.reload.wait_failed', {
      reason,
      uiUrl: targetUrl,
      message: error?.message || String(error),
    });
  }
  if (!mainWindow || mainWindow.isDestroyed() || isShuttingDown || app.isQuitting) return;
  try {
    await mainWindow.loadURL(targetUrl);
  } catch (error) {
    logDesktop('window.reload.failed', {
      reason,
      uiUrl: targetUrl,
      message: error?.message || String(error),
    });
  }
}

function initAutoUpdates() {
  if (isDev || process.env.MANVERSE_DISABLE_UPDATES === 'true') {
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    setUpdateStatus({ state: 'checking', message: null });
  });

  autoUpdater.on('update-available', (info) => {
    setUpdateStatus({ state: 'available', version: info?.version ?? null, message: null });
  });

  autoUpdater.on('update-not-available', () => {
    setUpdateStatus({ state: 'idle', version: null, message: null });
  });

  autoUpdater.on('update-downloaded', async (info) => {
    setUpdateStatus({ state: 'downloaded', version: info?.version ?? updateStatus.version });
    const response = await dialog.showMessageBox(mainWindow ?? undefined, {
      type: 'info',
      buttons: ['Restart now', 'Later'],
      defaultId: 0,
      cancelId: 1,
      title: 'Update ready',
      message: 'A new version of ManVerse is ready to install.',
      detail: 'Restart to apply the update.',
    });

    if (response.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });

  autoUpdater.on('error', (error) => {
    console.warn('Auto-update error:', error?.message || error);
    setUpdateStatus({
      state: 'error',
      message: error?.message || 'Update failed',
    });
  });

  autoUpdater.checkForUpdatesAndNotify();
}

async function bootstrap() {
  ensureWritableTemp();
  applyLanConfigFromSettings();
  startUiDevServer();
  await startUiStaticServer();
  startApi();

  await Promise.all([waitForUrl(`${apiUrl}/health`), waitForUrl(uiUrl)]);
  await createWindow();
  initAutoUpdates();
  const settings = getSettings();
  applyStartupSetting(settings.launchOnStartup);
  if (settings.notifierEnabled) {
    scheduleNotifierCheck(5 * 60 * 1000);
  }
}

async function shutdownApp(exitCode = 0) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  app.isQuitting = true;

  if (uiServer && typeof uiServer.closeAllConnections === 'function') {
    uiServer.closeAllConnections();
  }

  const shutdownTasks = [];
  if (uiServer) {
    shutdownTasks.push(
      new Promise((resolve) => {
        uiServer.close(() => resolve());
      }),
    );
  }
  shutdownTasks.push(killProcessTree(apiProcess, 'API'));
  shutdownTasks.push(killProcessTree(uiProcess, 'UI'));

  await Promise.allSettled(shutdownTasks);
  uiServer = null;
  apiProcess = null;
  uiProcess = null;
  app.exit(exitCode);
}

async function restartApp() {
  if (isShuttingDown) return { ok: false };
  try {
    const args = process.argv.slice(1);
    logDesktop('app.restart', { args });
    app.relaunch({ args });
  } catch (error) {
    logDesktop('app.restart.failed', { message: error?.message || String(error) });
  }
  await shutdownApp(0);
  return { ok: true };
}

const handleShutdownSignal = () => {
  if (isShuttingDown) return;
  if (!app.isReady()) {
    process.exit(0);
    return;
  }
  void shutdownApp(0);
};

app.on('before-quit', (event) => {
  if (isShuttingDown) return;
  event.preventDefault();
  void shutdownApp(0);
});

process.on('SIGTERM', handleShutdownSignal);
process.on('SIGINT', handleShutdownSignal);

app.whenReady().then(() => {
  app.setAppUserModelId('com.ahm4dd.manverse');
  startCrashReporter();
  ipcMain.handle('manverse:getSettings', () => getSettings());
  ipcMain.handle('manverse:updateSetting', async (_event, payload) =>
    updateSetting(payload?.key, payload?.value),
  );
  ipcMain.handle('manverse:getLanInfo', () => getLanInfo());
  ipcMain.handle('manverse:setLanAccess', async (_event, payload) => setLanAccess(payload));
  ipcMain.handle('manverse:checkLanHealth', async (_event, payload) => checkLanHealth(payload));
  ipcMain.handle('manverse:window-minimize', () => {
    mainWindow?.minimize();
    return { ok: true };
  });
  ipcMain.handle('manverse:window-toggle-maximize', () => {
    if (!mainWindow) return { ok: false, isMaximized: false };
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
      return { ok: true, isMaximized: false };
    }
    mainWindow.maximize();
    return { ok: true, isMaximized: true };
  });
  ipcMain.handle('manverse:window-close', () => {
    mainWindow?.close();
    return { ok: true };
  });
  ipcMain.handle('manverse:getWindowState', () => ({
    isMaximized: mainWindow?.isMaximized() ?? false,
  }));
  ipcMain.handle('manverse:getUpdateStatus', () => updateStatus);
  ipcMain.handle('manverse:installUpdate', () => {
    autoUpdater.quitAndInstall();
    return { ok: true };
  });
  ipcMain.handle('manverse:clearAniListSession', async () => clearAniListSession());
  ipcMain.handle('manverse:restartApp', async () => restartApp());
  ipcMain.handle('manverse:consumeAuthToken', () => {
    const token = pendingAuthToken;
    pendingAuthToken = null;
    logDesktop('auth.consume', {
      tokenPresent: Boolean(token),
      tokenLength: token ? token.length : 0,
    });
    return token;
  });
  ipcMain.handle('manverse:log', (_event, payload) => {
    if (payload?.message) {
      logDesktop(payload.message, payload.data ?? null);
    }
    return { ok: true };
  });
  ipcMain.handle('manverse:desktop-log-status', () => getDesktopLogger().getStatus());
  ipcMain.handle('manverse:desktop-log-events', (_event, payload) =>
    getDesktopLogger().list(Number(payload?.limit) || 50),
  );
  ipcMain.handle('manverse:desktop-log-enabled', (_event, payload) =>
    getDesktopLogger().setEnabled(Boolean(payload?.enabled)),
  );
  ipcMain.handle('manverse:desktop-log-clear', () => {
    getDesktopLogger().clearBuffer();
    return { ok: true };
  });
  ipcMain.handle('manverse:desktop-log-open', () => {
    const logger = getDesktopLogger();
    const status = logger.getStatus();
    const target = status.logFile || logger.getLogFile();
    if (target) {
      shell.showItemInFolder(target);
    } else {
      shell.openPath(logger.getLogDir());
    }
    return { ok: true };
  });
  ipcMain.handle('manverse:desktop-crash-status', () => getCrashStatus());
  ipcMain.handle('manverse:desktop-crash-open', () => {
    shell.openPath(getCrashDumpDir());
    return { ok: true };
  });
  ipcMain.handle('manverse:export-support-bundle', async (_event, payload) => {
    try {
      const bundlePath = await createSupportBundle(payload?.rendererBundle ?? null);
      shell.showItemInFolder(bundlePath);
      return { ok: true, path: bundlePath };
    } catch (error) {
      logDesktop('supportBundle.failed', { message: error?.message || String(error) }, 'error');
      return { ok: false, error: error?.message || String(error) };
    }
  });
  ipcMain.handle('manverse:getNotifierEvents', () => loadNotifierEvents());
  ipcMain.handle('manverse:markAllNotifierRead', () => markAllNotifierRead());
  bootstrap().catch((error) => {
    dialog.showErrorBox('ManVerse startup failed', error.message || String(error));
    app.quit();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (!getSettings().notifierEnabled) {
      app.quit();
    }
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createWindow();
  }
});
