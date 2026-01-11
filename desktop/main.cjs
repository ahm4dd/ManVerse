const { app, BrowserWindow, dialog, Notification, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const { spawn, spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const isDev = process.env.MANVERSE_DEV === 'true' || !app.isPackaged;
const rootDir = path.resolve(__dirname, '..');
const resourcesDir = app.isPackaged ? process.resourcesPath : rootDir;

const apiPort = Number(process.env.MANVERSE_API_PORT || 3001);
const uiPort = Number(process.env.MANVERSE_UI_PORT || 3000);
const apiUrl = `http://localhost:${apiPort}`;
const uiUrl = `http://localhost:${uiPort}`;
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
    await killProcessTree(apiProcess, 'API');
    apiProcess = null;
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
    if (!app.isQuitting) {
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

function startUiStaticServer() {
  if (isDev) return;

  const distDir = path.join(rootDir, 'app', 'dist');
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

  uiServer.listen(uiPort, '127.0.0.1');
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
    backgroundColor: '#0b0b0f',
    autoHideMenuBar: true,
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  if (isDev) {
    win.webContents.openDevTools({ mode: 'detach' });
  }

  await win.loadURL(uiUrl);
  mainWindow = win;
  win.webContents.on('did-finish-load', () => {
    broadcastUpdateStatus();
    broadcastNotifierEvents();
  });
  win.on('closed', () => {
    mainWindow = null;
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
  startApi();
  startUiDevServer();
  startUiStaticServer();

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
