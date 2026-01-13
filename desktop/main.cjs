const { spawn, spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

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

const { app, BrowserWindow, dialog, Notification, ipcMain } = require('electron');
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
const uiHost = normalizedUi.host;
let uiPort = normalizedUi.port;
let uiUrl = `http://${uiHost}:${uiPort}`;
const defaultRedirectUri = `http://localhost:${apiPort}/api/auth/anilist/callback`;

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
  const redirectUri =
    settings.anilistRedirectUri && settings.anilistRedirectUri.trim().length > 0
      ? settings.anilistRedirectUri.trim()
      : defaultRedirectUri;
  const env = {
    ...process.env,
    PORT: String(apiPort),
    FRONTEND_URL: uiUrl,
    FRONTEND_AUTH_PATH: process.env.FRONTEND_AUTH_PATH || '/',
    CORS_ORIGIN: uiUrl,
    PATH: bunDir + path.delimiter + (process.env.PATH || ''),
    NODE_PATH: path.join(apiDir, 'node_modules'),
    JWT_SECRET: settings.jwtSecret,
    ANILIST_CLIENT_ID: settings.anilistClientId || process.env.ANILIST_CLIENT_ID || '',
    ANILIST_CLIENT_SECRET: settings.anilistClientSecret || process.env.ANILIST_CLIENT_SECRET || '',
    ANILIST_REDIRECT_URI: redirectUri,
    PUPPETEER_CACHE_DIR: puppeteerCacheDir,
    ...(puppeteerExecutable ? { PUPPETEER_EXECUTABLE_PATH: puppeteerExecutable } : {}),
    ...(process.platform === 'win32' ? { PUPPETEER_DISABLE_GPU: 'true' } : {}),
  };

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
  const args = ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(uiPort)];
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
          uiUrl = `http://${uiHost}:${uiPort}`;
        }
        resolve();
      };
      uiServer.once('error', onError);
      uiServer.once('listening', onListening);
      uiServer.listen(port, host);
    });

  try {
    await listenOnPort(uiPort, uiHost);
  } catch (error) {
    if (error && error.code === 'EADDRINUSE') {
      await listenOnPort(0, uiHost);
      return;
    }
    if (error && (error.code === 'EADDRNOTAVAIL' || error.code === 'EAFNOSUPPORT')) {
      await listenOnPort(0, '127.0.0.1');
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
      const hasAuthToken =
        parsed.searchParams.has('token') || parsed.searchParams.get('error') === 'AUTH_ERROR';
      const isAuthPath = parsed.pathname === '/auth/callback';
      if (!hasAuthToken && !isAuthPath) return null;
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

app.on('before-quit', (event) => {
  if (isShuttingDown) return;
  event.preventDefault();
  isShuttingDown = true;
  app.isQuitting = true;

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

  Promise.all(shutdownTasks)
    .catch(() => {})
    .finally(() => {
      app.exit(0);
    });
});

app.whenReady().then(() => {
  app.setAppUserModelId('com.ahm4dd.manverse');
  ipcMain.handle('manverse:getSettings', () => getSettings());
  ipcMain.handle('manverse:updateSetting', async (_event, payload) =>
    updateSetting(payload?.key, payload?.value),
  );
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
