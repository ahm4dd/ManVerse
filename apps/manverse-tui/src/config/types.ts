export interface Config {
  firstLaunch: boolean;
  downloadPath: string;
  concurrentDownloads: number;
  pdfQuality: 'low' | 'medium' | 'high';
  theme: 'light' | 'dark' | 'auto';
  language: string;
  notifications: {
    newChapters: boolean;
    downloadCompleted: boolean;
    syncCompleted: boolean;
  };
  sync: {
    autoSyncOnStart: boolean;
    autoSyncAfterDownload: boolean;
    syncInterval: number; // minutes
    conflictResolution: 'prefer-local' | 'prefer-remote' | 'ask';
  };
}
