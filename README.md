# ManVerse

ManVerse is a local-first manga/manhwa reader. It uses AniList for metadata and library status, and uses providers (currently Asura) to fetch chapters and images. Everything runs on your own machine.

This repo contains:
- A React + Vite frontend (`app/`)
- A Bun + Hono API (`api/`)
- Shared packages (`packages/*`)

## Table of contents

- [What you get](#what-you-get)
- [How it works](#how-it-works)
- [Quick start (fastest path)](#quick-start-fastest-path)
- [AniList OAuth setup](#anilist-oauth-setup)
- [Developer setup](#developer-setup)
- [Configuration](#configuration)
- [API docs (Scalar)](#api-docs-scalar)
- [Frontend documentation](#frontend-documentation)
- [Local data and storage](#local-data-and-storage)
- [Provider mapping](#provider-mapping)
- [Rate limits](#rate-limits)
- [Troubleshooting](#troubleshooting)
- [Desktop app (Electron)](#desktop-app-electron)
- [License](#license)

## What you get

### Reading and library
- AniList OAuth login with local JWT sessions
- Trending / popular / top-rated discovery
- Search across AniList and provider sources
- Library filters (Reading, Planning, Completed, etc.)
- Continue Reading (AniList + local progress)
- Recent Reads (local-only history, even without AniList)

### Providers and mapping
- Asura provider scraping (chapters + images)
- Manual mapping between provider series and AniList entries
- Resume chapters from where you left off
- Provider-aware progress tracking

### Local-first behavior
- SQLite database stored locally
- Optional custom database path
- No telemetry or hosted backend

## How it works

- The frontend calls the local API for data.
- The API calls AniList for metadata and uses scrapers for chapter lists and pages.
- Your progress, mappings, and local history live in SQLite on your machine.

## Quick start (fastest path)

This is the quickest way to see ManVerse running locally. You can use Demo mode without AniList credentials.

### 1) Install prerequisites

- Node.js 18+
- Bun 1.3+

### 2) Install dependencies

```bash
bun install
```

This single command downloads dependencies for the API and frontend (workspaces).

On first install, a local `.env` file is created for the API and frontend with safe defaults:

- `api/.env`
- `app/.env.local`

AniList credentials are optional if you only want Demo mode.

### 3) Run the app

```bash
bun run dev
```

This starts both the API and the frontend.

If you prefer separate terminals:

```bash
bun run dev:api
bun run dev:app
```

Open `http://localhost:3000`.

Click **Try Demo Account** on the login screen to explore without AniList.
If your API runs on a different URL, set `VITE_API_URL` in `app/.env.local`.

## AniList OAuth setup

AniList requires your own application credentials.

1) Go to https://anilist.co/settings/developer
2) Create a new application
3) Set the redirect URI to:

```
http://localhost:3001/api/auth/anilist/callback
```

4) Copy the Client ID and Client Secret into `api/.env`

If the redirect URI does not match exactly, login will fail.

## Developer setup

This is a workspace repo. Use Bun at the root.

Use:

```bash
bun install
```

That one command installs everything needed for both `app/` and `api/`.

Useful scripts:

```bash
bun run dev
bun run dev:app
bun run dev:api
```

## Configuration

These files are created automatically on first `bun install` if missing. Edit them anytime.

### API (`api/.env`)

- `PORT` (default: 3001)
- `FRONTEND_URL` (default: http://localhost:3000)
- `FRONTEND_AUTH_PATH` (optional, default: `/`)
- `CORS_ORIGIN` (default: http://localhost:3000)
- `JWT_SECRET` (required)
- `ANILIST_CLIENT_ID` (required)
- `ANILIST_CLIENT_SECRET` (required)
- `ANILIST_REDIRECT_URI` (default: http://localhost:3001/api/auth/anilist/callback)
- `ANILIST_RPM` (default: 30)

### Frontend (`app/.env.local`)

- `VITE_API_URL` (optional, default: http://localhost:3001)

### Optional

- `MANVERSE_DB_PATH` (absolute path to SQLite DB)

If not set, the DB is stored at:

```
~/.config/manverse/data.db
```

## API docs (Scalar)

Interactive API docs are served by the backend and generated from Zod schemas via `@hono/zod-openapi`:

- Scalar UI: `http://localhost:3001/api/docs`
- OpenAPI spec: `http://localhost:3001/api/openapi.json`

## Frontend documentation

The frontend is a single-page app in `app/`.

### Entry points

- `app/index.tsx` mounts the app
- `app/App.tsx` contains the main view router

Routing is internal (no React Router). Views are swapped in `App.tsx` using local state.

### Pages

- `app/pages/Home.tsx` — browse, search, continue reading
- `app/pages/Details.tsx` — series details, provider mapping
- `app/pages/Reader.tsx` — chapter reader
- `app/pages/Library.tsx` — library overview, stats, lists
- `app/pages/RecentReads.tsx` — local read history
- `app/pages/Recommendations.tsx` — curated discovery
- `app/pages/Login.tsx` — login view

### Key frontend modules

- `app/lib/api-client.ts` — HTTP wrapper + token storage
- `app/lib/api.ts` — API calls for providers and manga
- `app/lib/anilist.ts` — AniList integration + sync helpers
- `app/lib/history.ts` — local read history
- `app/lib/theme.ts` — theming

### Token handling

- The frontend receives `?token=` after AniList OAuth.
- The token is stored locally and sent via `Authorization: Bearer <token>`.

## Local data and storage

- SQLite database lives at `~/.config/manverse/data.db` by default.
- Provider mappings and local history are stored there.
- You can override the path using `MANVERSE_DB_PATH`.

## Provider mapping

AniList titles and provider titles don’t always match. ManVerse supports manual linking:

1) Open a series page
2) Use “Link to AniList”
3) Search by title or paste an AniList URL/ID

Once mapped, provider chapters can be fetched without re-searching.

## Rate limits

AniList limits requests. The API is aware of the limit and will return 429 when exceeded.

You can adjust the local limit:

```env
ANILIST_RPM=30
```

## Troubleshooting

- **CORS errors**: set `CORS_ORIGIN` to the frontend URL
- **Port in use**: change `PORT` in `api/.env`
- **AniList login fails**: check client ID, secret, and redirect URI
- **Puppeteer errors**: your OS may need Chromium dependencies (see Puppeteer docs)

## Desktop app (Electron)

The Electron wrapper lives in `desktop/`. It reuses the same frontend and API and starts them automatically.

### Run desktop in dev

```bash
bun install
bun run dev:desktop
```

If you already have the Vite dev server running and don’t want Electron to start it:

```bash
MANVERSE_EXTERNAL_UI=true bun run dev:desktop
```

### Build desktop locally

```bash
bun run --cwd app build
bun run --cwd desktop build
```

Note: Packaging is in progress; the current build expects Bun to be available on the host machine.

## License

Apache-2.0. See `LICENSE`.
