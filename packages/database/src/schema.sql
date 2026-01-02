PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS anilist_manga (
  id INTEGER PRIMARY KEY,
  title_romaji TEXT NOT NULL,
  title_english TEXT,
  title_native TEXT,
  description TEXT,
  cover_large TEXT,
  cover_medium TEXT,
  banner_image TEXT,
  status TEXT,
  format TEXT,
  chapters INTEGER,
  volumes INTEGER,
  genres TEXT,
  average_score REAL,
  popularity INTEGER,
  favourites INTEGER,
  updated_at INTEGER,
  cached_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_anilist_title_romaji ON anilist_manga (title_romaji);
CREATE INDEX IF NOT EXISTS idx_anilist_status ON anilist_manga (status);

CREATE TABLE IF NOT EXISTS provider_manga (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  title TEXT NOT NULL,
  image TEXT,
  status TEXT,
  rating TEXT,
  chapters TEXT,
  genres TEXT,
  description TEXT,
  author TEXT,
  artist TEXT,
  serialization TEXT,
  updated_on TEXT,
  is_active INTEGER DEFAULT 1,
  domain_changed_from TEXT,
  last_scraped INTEGER,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  UNIQUE(provider, provider_id)
);

CREATE INDEX IF NOT EXISTS idx_provider_title ON provider_manga (title);

CREATE TABLE IF NOT EXISTS manga_mappings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  anilist_id INTEGER NOT NULL,
  provider TEXT NOT NULL,
  provider_manga_id INTEGER NOT NULL,
  mapping_source TEXT DEFAULT 'manual',
  is_active INTEGER DEFAULT 1,
  replaced_by INTEGER,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (anilist_id) REFERENCES anilist_manga (id) ON DELETE CASCADE,
  FOREIGN KEY (provider_manga_id) REFERENCES provider_manga (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mapping_active
  ON manga_mappings (anilist_id, provider)
  WHERE is_active = 1;

CREATE TABLE IF NOT EXISTS user_library (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  anilist_id INTEGER,
  provider TEXT,
  provider_manga_id INTEGER,
  status TEXT NOT NULL,
  progress REAL DEFAULT 0,
  score REAL,
  notes TEXT,
  is_favorite INTEGER DEFAULT 0,
  started_at INTEGER,
  completed_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (anilist_id) REFERENCES anilist_manga (id) ON DELETE SET NULL,
  FOREIGN KEY (provider_manga_id) REFERENCES provider_manga (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_library_user ON user_library (user_id);
CREATE INDEX IF NOT EXISTS idx_library_status ON user_library (status);

CREATE TABLE IF NOT EXISTS downloaded_chapters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_manga_id INTEGER NOT NULL,
  chapter_number TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  downloaded_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (provider_manga_id) REFERENCES provider_manga (id) ON DELETE CASCADE,
  UNIQUE(provider_manga_id, chapter_number)
);

CREATE TABLE IF NOT EXISTS anilist_sync_state (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  anilist_id INTEGER NOT NULL,
  local_status TEXT,
  local_progress REAL,
  local_score REAL,
  anilist_status TEXT,
  anilist_progress REAL,
  anilist_score REAL,
  needs_sync INTEGER DEFAULT 0,
  conflict_state TEXT,
  updated_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (anilist_id) REFERENCES anilist_manga (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sync_user ON anilist_sync_state (user_id);

CREATE TABLE IF NOT EXISTS provider_domains (
  provider TEXT PRIMARY KEY,
  current_domain TEXT NOT NULL,
  previous_domains TEXT,
  is_active INTEGER DEFAULT 1,
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS custom_providers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  selectors TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);
