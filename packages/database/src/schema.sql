-- ManVerse Database Schema
-- SQLite database for local storage of manga metadata, mappings, and user library

-- AniList manga metadata cache
CREATE TABLE IF NOT EXISTS anilist_manga (
  id INTEGER PRIMARY KEY,
  title_romaji TEXT NOT NULL,
  title_english TEXT,
  title_native TEXT,
  synonyms TEXT,
  description TEXT,
  cover_image_url TEXT,
  banner_image_url TEXT,
  status TEXT NOT NULL,
  format TEXT,
  chapters INTEGER,
  volumes INTEGER,
  start_date TEXT,
  end_date TEXT,
  genres TEXT NOT NULL,
  tags TEXT,
  average_score REAL,
  mean_score REAL,
  popularity INTEGER,
  favorites INTEGER,
  is_adult INTEGER DEFAULT 0,
  site_url TEXT,
  last_updated INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_anilist_title ON anilist_manga(title_romaji);
CREATE INDEX IF NOT EXISTS idx_anilist_status ON anilist_manga(status);

-- Provider manga entries (scraped from Asura, MangaDex, etc.)
CREATE TABLE IF NOT EXISTS provider_manga (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  provider_url TEXT NOT NULL,
  title TEXT NOT NULL,
  alt_titles TEXT,
  cover_url TEXT,
  status TEXT,
  latest_chapter TEXT,
  total_chapters INTEGER,
  description TEXT,
  genres TEXT,
  last_scraped INTEGER NOT NULL,
  is_active INTEGER DEFAULT 1,
  domain_changed_from TEXT,
  last_checked INTEGER,
  failed_checks INTEGER DEFAULT 0,
  UNIQUE(provider, provider_id)
);

CREATE INDEX IF NOT EXISTS idx_provider_title ON provider_manga(provider, title);
CREATE INDEX IF NOT EXISTS idx_provider_lookup ON provider_manga(provider, provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_active ON provider_manga(is_active) WHERE is_active = 1;

-- Links between AniList manga and provider entries
CREATE TABLE IF NOT EXISTS manga_mappings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  anilist_id INTEGER NOT NULL,
  provider TEXT NOT NULL,
  provider_manga_id INTEGER NOT NULL,
  confidence TEXT DEFAULT 'manual',
  verified INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  created_by TEXT DEFAULT 'user',
  replaced_by INTEGER,
  is_active INTEGER DEFAULT 1,
  notes TEXT,
  FOREIGN KEY (anilist_id) REFERENCES anilist_manga(id) ON DELETE CASCADE,
  FOREIGN KEY (provider_manga_id) REFERENCES provider_manga(id) ON DELETE CASCADE,
  FOREIGN KEY (replaced_by) REFERENCES manga_mappings(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mapping_unique ON manga_mappings(anilist_id, provider, is_active) WHERE is_active = 1;
CREATE INDEX IF NOT EXISTS idx_mapping_anilist ON manga_mappings(anilist_id);
CREATE INDEX IF NOT EXISTS idx_mapping_provider ON manga_mappings(provider, provider_manga_id);
CREATE INDEX IF NOT EXISTS idx_mapping_active ON manga_mappings(is_active) WHERE is_active = 1;

-- User's reading library (supports both AniList users and guests)
CREATE TABLE IF NOT EXISTS user_library (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  anilist_id INTEGER,
  provider TEXT NOT NULL,
  provider_manga_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'reading',
  progress INTEGER DEFAULT 0,
  score REAL,
  notes TEXT,
  is_favorite INTEGER DEFAULT 0,
  added_at INTEGER NOT NULL,
  last_read INTEGER,
  started_at INTEGER,
  completed_at INTEGER,
  FOREIGN KEY (anilist_id) REFERENCES anilist_manga(id) ON DELETE SET NULL,
  FOREIGN KEY (provider_manga_id) REFERENCES provider_manga(id) ON DELETE CASCADE,
  UNIQUE(provider, provider_manga_id)
);

CREATE INDEX IF NOT EXISTS idx_library_status ON user_library(status);
CREATE INDEX IF NOT EXISTS idx_library_anilist ON user_library(anilist_id);
CREATE INDEX IF NOT EXISTS idx_library_last_read ON user_library(last_read DESC);

-- Track downloaded PDF chapters
CREATE TABLE IF NOT EXISTS downloaded_chapters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_manga_id INTEGER NOT NULL,
  chapter_number TEXT NOT NULL,
  chapter_title TEXT,
  chapter_url TEXT,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  page_count INTEGER,
  downloaded_at INTEGER NOT NULL,
  FOREIGN KEY (provider_manga_id) REFERENCES provider_manga(id) ON DELETE CASCADE,
  UNIQUE(provider_manga_id, chapter_number)
);

CREATE INDEX IF NOT EXISTS idx_downloaded_manga ON downloaded_chapters(provider_manga_id);
CREATE INDEX IF NOT EXISTS idx_downloaded_date ON downloaded_chapters(downloaded_at DESC);

-- Sync state between local and AniList
CREATE TABLE IF NOT EXISTS anilist_sync_state (
  anilist_id INTEGER PRIMARY KEY,
  local_progress INTEGER NOT NULL,
  anilist_progress INTEGER NOT NULL,
  local_status TEXT,
  anilist_status TEXT,
  local_score REAL,
  anilist_score REAL,
  last_synced INTEGER NOT NULL,
  last_local_update INTEGER,
  last_anilist_update INTEGER,
  needs_sync INTEGER DEFAULT 0,
  sync_direction TEXT,
  FOREIGN KEY (anilist_id) REFERENCES anilist_manga(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_needs_sync ON anilist_sync_state(needs_sync) WHERE needs_sync = 1;

-- Provider domain management (for handling site migrations)
CREATE TABLE IF NOT EXISTS provider_domains (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL UNIQUE,
  current_domain TEXT NOT NULL,
  previous_domains TEXT,
  last_updated INTEGER NOT NULL,
  is_active INTEGER DEFAULT 1,
  notes TEXT
);

-- Custom user-added providers
CREATE TABLE IF NOT EXISTS custom_providers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  base_url TEXT NOT NULL,
  scraper_type TEXT DEFAULT 'generic',
  selector_config TEXT,
  created_at INTEGER NOT NULL,
  is_active INTEGER DEFAULT 1
);

-- Seed default provider domains
INSERT OR IGNORE INTO provider_domains (provider, current_domain, last_updated, notes) VALUES
  ('asura', 'asuracomic.net', strftime('%s', 'now'), 'AsuraScans official domain');
