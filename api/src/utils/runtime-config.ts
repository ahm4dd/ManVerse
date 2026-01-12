import fs from 'fs';
import os from 'os';
import path from 'path';

export type RuntimeConfig = {
  anilistClientId?: string;
  anilistClientSecret?: string;
  anilistRedirectUri?: string;
};

const DEFAULT_CONFIG: RuntimeConfig = {
  anilistClientId: '',
  anilistClientSecret: '',
  anilistRedirectUri: '',
};

function resolveConfigDir() {
  if (Bun.env.MANVERSE_CONFIG_DIR) return Bun.env.MANVERSE_CONFIG_DIR;
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA;
    if (appData) return path.join(appData, 'ManVerse');
    return path.join(os.homedir(), 'AppData', 'Roaming', 'ManVerse');
  }
  return path.join(os.homedir(), '.config', 'ManVerse');
}

const configPath = path.join(resolveConfigDir(), 'config.json');
let cachedConfig: RuntimeConfig | null = null;

function readConfigFile(): RuntimeConfig {
  try {
    if (!fs.existsSync(configPath)) return { ...DEFAULT_CONFIG };
    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw) as RuntimeConfig;
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function getRuntimeConfig(): RuntimeConfig {
  if (!cachedConfig) {
    cachedConfig = readConfigFile();
  }
  return cachedConfig;
}

export function updateRuntimeConfig(partial: RuntimeConfig): RuntimeConfig {
  const next = { ...getRuntimeConfig(), ...partial };
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(next, null, 2));
  cachedConfig = next;
  return next;
}

export function getRuntimeConfigValue(name: string): string | undefined {
  const config = getRuntimeConfig();
  if (name === 'ANILIST_CLIENT_ID') return config.anilistClientId;
  if (name === 'ANILIST_CLIENT_SECRET') return config.anilistClientSecret;
  if (name === 'ANILIST_REDIRECT_URI') return config.anilistRedirectUri;
  return undefined;
}
