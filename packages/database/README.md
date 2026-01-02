# @manverse/database

SQLite-based persistence layer for ManVerse using Bun's native SQLite. Handles manga metadata caching, provider mappings, user library, downloaded chapters, and AniList sync state.

## Features

- **Zero Dependencies**: Uses Bun's native `bun:sqlite` (no external DB required)
- **Type-Safe**: Complete Zod validation for all database operations
- **Provider Matching**: Links AniList manga to provider entries with remap support
- **Progress Sync**: Tracks sync state between local library and AniList
- **Download Tracking**: Records downloaded chapters with file paths
- **Dead Provider Handling**: Domain change support with history preservation

## Installation

```bash
cd packages/database
bun install
```

## Database Schema

8 tables for complete manga management:

1. **`anilist_manga`** - AniList metadata cache (reduces API calls)
2. **`provider_manga`** - Scraped manga from providers (Asura, etc.)
3. **`manga_mappings`** - Links AniList ↔ Provider (core of matching)
4. **`user_library`** - User's reading list (supports guests)
5. **`downloaded_chapters`** - Downloaded PDF tracking
6. **`anilist_sync_state`** - Sync status between local + AniList
7. **`provider_domains`** - Domain management for dead sites
8. **`custom_providers`** - User-added scraping sources

## Quick Start

```typescript
import {
  initDatabase,
  migrate,
  saveAnilistManga,
  addToLibrary,
  recordDownload,
} from '@manverse/database';

// Initialize (creates ~/.config/manverse/data.db)
initDatabase();
migrate();

// Cache AniList manga
await saveAnilistManga({
  id: 105398,
  title_romaji: 'Solo Leveling',
  status: 'FINISHED',
  genres: JSON.stringify(['Action', 'Fantasy']),
  last_updated: Date.now(),
});

// Add to reading library
addToLibrary({
  provider: 'asura',
  provider_manga_id: 42,
  status: 'reading',
  progress: 25,
  added_at: Date.now(),
});

// Track downloaded chapter
recordDownload({
  provider_manga_id: 42,
  chapter_number: '25',
  file_path: '/downloads/solo-leveling-ch25.pdf',
  downloaded_at: Date.now(),
});
```

## API Reference

### Connection Management

```typescript
initDatabase(dbPath?: string): Database
migrate(): void
getDatabase(): Database
closeDatabase(): void
resetDatabase(): void // Testing only
```

### AniList Operations

```typescript
saveAnilistManga(manga: AniListMangaInput): void
getAnilistManga(id: number): AniListMangaDb | null
searchLocalAnilist(query: string, limit?: number): AniListMangaDb[]
bulkInsertAnilist(mangas: AniListMangaInput[]): void
isAnilistDataStale(id: number, maxAge: number): boolean
```

### Provider Operations

```typescript
saveProviderManga(manga: ProviderMangaInput): number
getProviderManga(provider: string, providerId: string): ProviderMangaDb | null
searchProviderLocal(provider: string, query: string): ProviderMangaDb[]
deactivateProvider(provider: string): void
```

### Mapping Operations

```typescript
createMapping(anilistId: number, provider: string, providerMangaId: number): void
getMapping(anilistId: number, provider: string): MangaMappingDb | null
getAllMappings(anilistId: number): MangaMappingDb[]
deleteMapping(anilistId: number, provider: string): void
remapManga(anilistId: number, provider: string, newId: number, reason?: string): void
```

### Library Operations

```typescript
addToLibrary(entry: UserLibraryInput): number
getLibrary(status?: string): UserLibraryDb[]
updateProgress(id: number, progress: number): void
updateStatus(id: number, status: string): void
toggleFavorite(id: number): void
getRecentlyRead(limit?: number): UserLibraryDb[]
getLibraryStats(): LibraryStats
searchLibrary(query: string): UserLibraryDb[]
```

### Chapter Operations

```typescript
recordDownload(chapter: DownloadedChapterInput): number
getDownloadedChapters(providerMangaId: number): DownloadedChapterDb[]
isChapterDownloaded(providerMangaId: number, chapterNumber: string): boolean
getChapterPath(providerMangaId: number, chapterNumber: string): string | null
deleteChapter(id: number, deleteFile?: boolean): void
getDownloadStats(): DownloadStats
```

### Sync Operations

```typescript
getSyncState(anilistId: number): AniListSyncStateDb | null
updateSyncState(anilistId: number, state: Partial<AniListSyncStateInput>): void
markNeedsSync(anilistId: number, direction: 'push' | 'pull' | 'conflict'): void
getNeedsSyncList(): AniListSyncStateDb[]
recordLocalUpdate(anilistId: number, progress: number, status?, score?): void
recordAnilistUpdate(anilistId: number, progress: number, status?, score?): void
```

## Provider Matching Workflow

```typescript
// 1. User finds manga on AniList
const anilistManga = await anilistClient.search('Solo Leveling');
saveAnilistManga(anilistManga);

// 2. Search provider
const asuraResults = await asuraScraper.search('Solo Leveling');
const providerMangaId = saveProviderManga(asuraResults[0]);

// 3. User manually confirms match
createMapping(anilistManga.id, 'asura', providerMangaId);

// 4. Future lookups are instant
const mapping = getMapping(anilistManga.id, 'asura'); // ✅ Found!
```

## Dead Provider Handling

```typescript
// Provider domain changed
deactivateProvider('old-asura');

// Remap all manga to new provider
const mappings = getAllMappings(anilistId);
for (const mapping of mappings) {
  if (mapping.provider === 'old-asura') {
    const newProviderMangaId = saveProviderManga({ ...newData });
    remapManga(anilistId, 'new-asura', newProviderMangaId, 'Domain changed');
  }
}
```

## Testing

```bash
bun test
```

**Current Coverage**: 39/39 tests passing

## Architecture Decisions

- **Bun Native SQLite**: Zero dependencies, compiles to single binary
- **Soft Deletes**: `is_active` flags preserve history
- **Manual Matching**: No auto-fuzzy (user confirms all mappings)
- **Prepared Statements**: All queries use `db.prepare()` for safety
- **Zod Validation**: All inputs validated before database operations

## Database Location

Default: `~/.config/manverse/data.db`

Override:

```typescript
initDatabase('/custom/path/to/database.db');
```

## License

Part of ManVerse project
