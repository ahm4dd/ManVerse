import fs from 'fs';
import path from 'path';
import os from 'os';
import type { Config } from './types.js';

const CONFIG_DIR = path.join(os.homedir(), '.config', 'manverse');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

const DEFAULT_CONFIG: Config = {
  firstLaunch: true,
  downloadPath: path.join(os.homedir(), 'Downloads', 'ManVerse'),
  concurrentDownloads: 5,
  pdfQuality: 'high',
  theme: 'dark',
  language: 'en',
  notifications: {
    newChapters: true,
    downloadCompleted: true,
    syncCompleted: false,
  },
  sync: {
    autoSyncOnStart: true,
    autoSyncAfterDownload: true,
    syncInterval: 30, // minutes
    conflictResolution: 'prefer-local',
  },
};

export function loadConfig(): Config {
  try {
    // Ensure config directory exists
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }

    // Load existing config or create default
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
    } else {
      saveConfig(DEFAULT_CONFIG);
      return DEFAULT_CONFIG;
    }
  } catch (error) {
    console.error('Error loading config:', error);
    return DEFAULT_CONFIG;
  }
}

export function saveConfig(config: Config): void {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error('Error saving config:', error);
  }
}
