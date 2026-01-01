import React from 'react';
import { render } from 'ink';
import App from './App.js';
import { initDatabase, migrate } from '@manverse/database';
import { loadConfig, saveConfig } from './config/index.js';

// Initialize database
console.log('📦 Initializing database...');
initDatabase();
migrate();
console.log('✅ Database ready\n');

// Load or create config
const config = loadConfig();

// Check first launch
if (config.firstLaunch) {
  config.firstLaunch = false;
  saveConfig(config);
}

// Render app
const { clear } = render(<App config={config} />);

// Cleanup on exit
process.on('SIGINT', () => {
  clear();
  process.exit(0);
});

process.on('SIGTERM', () => {
  clear();
  process.exit(0);
});
