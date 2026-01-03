# ManVerse

ManVerse is a local-first, full-stack manga/manhwa reader that combines AniList metadata with provider scraping for chapters and reading progress.
It runs entirely on your machine: a React (Vite) frontend, a Bun + Hono API, and a shared package workspace.

## Features

- AniList OAuth login with JWT session handling
- Trending / popular / top-rated discovery via AniList
- Provider scraping (Asura) for chapters and images
- Provider <-> AniList mapping (manual search or URL/ID linking)
- Continue Reading (AniList) and Recent Reads (local-only)
- Reader with progress sync, resume, and mark-as-read
- Library management and sync status
- Rate-limit aware AniList requests

## Repo Structure

- `app/` - Frontend (React + Tailwind + Framer Motion)
- `api/` - API server (Bun + Hono)
- `packages/` - Shared packages (`core`, `anilist`, `scrapers`, `downloader`, `pdf`, `database`)
- `shared/` - Shared types
- `legacy/` - Legacy code (kept for reference)

## Requirements

- Node.js 18+ (for the frontend)
- Bun 1.3+ (for the API and workspace packages)

## Installation

1) Install dependencies

```bash
npm --prefix app install
bun --cwd api install
```

2) Configure environment variables

Create `api/.env` from the template:

```bash
cp api/.env.example api/.env
```

Set values in `api/.env`:

- `ANILIST_CLIENT_ID` and `ANILIST_CLIENT_SECRET`
- `ANILIST_REDIRECT_URI` (default: `http://localhost:3001/api/auth/anilist/callback`)
- `JWT_SECRET` (set to a strong secret)
- `CORS_ORIGIN` (usually `http://localhost:3000`)

For the frontend, set the API base URL:

```bash
cp app/.env.local.example app/.env.local  # if you add a template later
# or create manually
```

```env
VITE_API_URL=http://localhost:3001
```

Optional database location override:

```env
MANVERSE_DB_PATH=/absolute/path/to/data.db
```

By default, the database is stored at:

```
~/.config/manverse/data.db
```

## Running the App

```bash
# API
bun --cwd api run dev

# Frontend
npm --prefix app run dev
```

- Frontend: `http://localhost:3000`
- API: `http://localhost:3001`

## Usage

1) Login with AniList (top right)
2) Browse or search for a series
3) Open a series
4) If it is AniList-only, use “Find on Provider” to load chapters
5) If it is provider-only, use “Link to AniList” to attach the AniList entry
6) Read chapters, resume from history, and track progress

## Provider <-> AniList Mapping

You can map any provider series to an AniList entry:

- Search AniList by title
- Or paste the AniList URL / ID
- Once linked, progress sync is enabled

Mappings are stored locally in SQLite and can be changed at any time.

## Recent Reads vs Continue Reading

- **Continue Reading**: AniList library + local progress merged
- **Recent Reads**: Local-only history (even without AniList library)

Recent Reads supports sorting by tracked vs local, plus search and filtering.

## Rate Limits

AniList enforces rate limiting. Configure in `api/.env`:

```env
ANILIST_RPM=30
```

The API will surface 429 responses when the limit is reached.

## Security & Secrets

Sensitive values are stored in `.env` files and **must not** be committed.

Ignored by git:

- `.env`
- `api/.env`
- `app/.env.local`

The `.env.example` files are safe to commit but should not contain secrets.

## Troubleshooting

- **CORS errors**: Ensure `CORS_ORIGIN` matches the Vite URL
- **EADDRINUSE**: Another process is already using port 3001
- **AniList 429**: Reduce request frequency or wait for the reset window

## Publishing / Distribution

Packaging (Docker, desktop app, installers) is planned but not included yet.
For public releases, rotate secrets and validate `.gitignore` before pushing.

## License

Apache-2.0. See `LICENSE`.
