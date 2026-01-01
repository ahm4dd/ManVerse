# @manverse/anilist

AniList API integration for ManVerse. Provides OAuth authentication, manga search, user list management, and favorites functionality.

## Features

✅ **OAuth 2.0 Authentication** - Local callback server for easy authorization  
✅ **Guest Mode** - Search and browse without authentication  
✅ **Manga Search** - Find manga with filters and pagination  
✅ **List Management** - Add, update, remove manga from your lists  
✅ **Progress Tracking** - Update chapters read and ratings  
✅ **Favorites** - Toggle favorite status  
✅ **Rate Limiting** - Automatic 90 req/min compliance  
✅ **Retry Logic** - Exponential backoff for failed requests  
✅ **Type Safe** - Full TypeScript with Zod validation

## Installation

```bash
bun install
```

## Setup

### 1. Register AniList Application

1. Go to https://anilist.co/settings/developer
2. Click "Create New Client"
3. Fill in:
   - **Name**: ManVerse
   - **Redirect URI**: `http://localhost:8888/callback`
4. Copy Client ID and Client Secret

### 2. Configure Environment

Create `.env` file in project root:

```bash
ANILIST_CLIENT_ID=your_client_id
ANILIST_CLIENT_SECRET=your_client_secret
```

## Usage

### Guest Mode (No Authentication)

```typescript
import { AniListClient } from '@manverse/anilist';

const client = AniListClient.create();

// Search manga
const results = await client.searchManga('Solo Leveling');
console.log(`Found ${results.media.length} results`);

// Get details
const manga = await client.getMangaDetails(results.media[0].id);
console.log(manga.title.romaji);
```

### Authenticated Mode

```typescript
import { AniListClient } from '@manverse/anilist';

const client = AniListClient.create({
  clientId: process.env.ANILIST_CLIENT_ID!,
  clientSecret: process.env.ANILIST_CLIENT_SECRET!,
});

// Start OAuth flow
await client.authenticate();
// Browser opens → user authorizes → token received

// Get current user
const user = await client.getCurrentUser();
console.log(`Welcome, ${user.name}!`);

// Get reading list
const reading = await client.getUserMangaList(user.id, 'CURRENT');

// Add to list
await client.addToList(mangaId, 'PLANNING');

// Update progress
await client.updateProgress(mangaId, 45);

// Update rating
await client.updateScore(mangaId, 85);

// Toggle favorite
await client.toggleFavorite(mangaId);
```

## Running Tests

```bash
# Set credentials in .env first
cd apps/manverse-tui
bun run src/test-anilist.ts
```

## Architecture

Follows ManVerse patterns:

- **Zod schemas** for all data types
- **Interface-based design** (`IAniListClient`)
- **Rate limiting** with sliding window
- **Retry logic** with exponential backoff
- **Error handling** with custom error classes

## License

See main project LICENSE
