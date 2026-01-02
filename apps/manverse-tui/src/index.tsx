#!/usr/bin/env bun
import React from 'react';
import { render } from 'ink';
import puppeteer from 'puppeteer';
import { initDatabase, migrate, closeDatabase } from '@manverse/database';
import { defaultBrowserConfig } from '@manverse/core';
import { useAppStore } from './state/store.js';
import { DownloadService } from './services/download-service.js';
import { App } from './App.js';

/**
 * Initialize the ManVerse TUI
 */
async function main() {
  try {
    // 1. Initialize database
    console.log('📦 Initializing database...');
    initDatabase();
    migrate();

    // 2. Launch browser
    console.log('🌐 Launching browser...');
    const browser = await puppeteer.launch(defaultBrowserConfig);

    // Store browser in Zustand
    useAppStore.getState().setBrowser(browser);

    // Initialize Services
    DownloadService.getInstance();

    // 3. Set up cleanup handlers
    const cleanup = async () => {
      console.log('\\n🧹 Cleaning up...');
      await browser.close();
      closeDatabase();
      process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    // 4. Render Ink app
    console.clear();
    render(<App />);
  } catch (error) {
    console.error('❌ Failed to start ManVerse TUI:', error);
    process.exit(1);
  }
}

// Run the app
main();
