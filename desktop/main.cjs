const { app, BrowserWindow, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const { spawn } = require('node:child_process');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const isDev = process.env.MANVERSE_DEV === 'true' || !app.isPackaged;
const rootDir = path.resolve(__dirname, '..');

const apiPort = Number(process.env.MANVERSE_API_PORT || 3001);
const uiPort = Number(process.env.MANVERSE_UI_PORT || 3000);
const apiUrl = `http://localhost:${apiPort}`;
const uiUrl = `http://localhost:${uiPort}`;

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

function spawnProcess(command, args, options) {
  const child = spawn(command, args, options);
  child.on('error', (error) => {
    dialog.showErrorBox('ManVerse process error', error.message);
  });
  return child;
}

function startApi() {
  const apiDir = path.join(rootDir, 'api');
  const args = isDev ? ['run', 'dev'] : ['src/index.ts'];
  const bunDir = path.dirname(bunPath);
  const env = {
    ...process.env,
    PORT: String(apiPort),
    FRONTEND_URL: uiUrl,
    FRONTEND_AUTH_PATH: process.env.FRONTEND_AUTH_PATH || '/',
    CORS_ORIGIN: uiUrl,
    PATH: bunDir + path.delimiter + (process.env.PATH || ''),
    NODE_PATH: path.join(rootDir, 'node_modules'),
  };

  apiProcess = spawnProcess(bunPath, args, {
    cwd: apiDir,
    env,
    stdio: 'inherit',
  });

  apiProcess.on('exit', (code) => {
    if (!app.isQuitting) {
      dialog.showErrorBox(
        'ManVerse API stopped',
        `The API process exited with code ${code ?? 'unknown'}.`,
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
  });
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

  autoUpdater.on('update-downloaded', async () => {
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
}

app.on('before-quit', () => {
  app.isQuitting = true;
  if (apiProcess) apiProcess.kill();
  if (uiProcess) uiProcess.kill();
  if (uiServer) uiServer.close();
});

app.whenReady().then(() => {
  app.setAppUserModelId('com.ahm4dd.manverse');
  bootstrap().catch((error) => {
    dialog.showErrorBox('ManVerse startup failed', error.message || String(error));
    app.quit();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createWindow();
  }
});
