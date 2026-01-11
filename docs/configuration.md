# Configuration Reference

This document lists every environment variable and build-time flag currently read by ManVerse.
Use it to configure the API, frontend, desktop app, downloads, and build pipeline.

## Frontend (app/)

Set these in `app/.env.local`.

- `VITE_API_URL`
  - Base URL for the API.
  - Default: `http://localhost:3001`

## API (api/)

Set these in `api/.env`.

- `PORT`
  - API server port.
  - Default: `3001`
- `FRONTEND_URL`
  - Used by auth redirects and CORS defaults.
  - Default: `http://localhost:3000`
- `FRONTEND_AUTH_PATH`
  - Path to your frontend auth callback screen.
  - Default: `/`
- `CORS_ORIGIN`
  - Allowed origin for the frontend. Falls back to `FRONTEND_URL` when unset.
  - Default: `http://localhost:3000`
- `JWT_SECRET`
  - Required. Used to sign and verify JWTs.
- `ANILIST_CLIENT_ID`
  - Required. Your AniList app client ID.
- `ANILIST_CLIENT_SECRET`
  - Required. Your AniList app client secret.
- `ANILIST_REDIRECT_URI`
  - Must match your AniList app settings.
  - Default: `http://localhost:3001/api/auth/anilist/callback`
- `ANILIST_RPM`
  - AniList request-per-minute cap.
  - Default: `30`
- `ANILIST_RATE_LIMIT`
  - Alternative rate limit value (requests per window).
  - Default: uses `ANILIST_RPM` or internal defaults
- `ANILIST_RATE_LIMIT_WINDOW_MS`
  - Rate limit window in milliseconds.
  - Default: `60000`
- `MANVERSE_DB_PATH`
  - Absolute path to the SQLite database.
  - Default: `./manverse.db` (internal default)

## Downloads

Set these in `api/.env` if you want to override download behavior.

- `MANVERSE_DOWNLOAD_PATH`
  - Absolute path where downloads are stored.
  - Default: `./downloads` (internal default)
- `DOWNLOAD_CONCURRENCY`
  - Number of concurrent download jobs.
  - Default: `1`
- `DOWNLOAD_IMAGE_CONCURRENCY`
  - Concurrent image downloads per chapter.
  - Default: `5`
- `DOWNLOAD_JOB_INTERVAL_MS`
  - Delay between download queue checks.
  - Default: `1500`
- `DOWNLOAD_RETRY_LIMIT`
  - Retry attempts per download.
  - Default: `2`
- `DOWNLOAD_SERIES_BUDGET_MB`
  - Per-series storage budget.
  - Default: `1024`

## Scraper / Puppeteer (API)

Set these in `api/.env` to tweak Puppeteer.

- `PUPPETEER_EXECUTABLE_PATH`
  - Custom Chrome/Chromium binary path.
- `PUPPETEER_HEADLESS`
  - Set to `false` to run in headed mode.
  - Default: headless (`new`)
- `PUPPETEER_DISABLE_GPU`
  - Set to `true` to disable GPU usage.

## Desktop App (Electron)

Set these when launching the desktop app.

- `MANVERSE_DEV`
  - Enables dev mode when running Electron.
  - Used by `bun run dev:desktop`.
- `MANVERSE_API_PORT`
  - Port for the bundled API.
  - Default: `3001`
- `MANVERSE_UI_PORT`
  - Port for the bundled UI server.
  - Default: `3000`
- `MANVERSE_EXTERNAL_UI`
  - Set to `true` to prevent Electron from starting the UI dev server.
- `MANVERSE_DISABLE_UPDATES`
  - Set to `true` to disable auto-update checks.
- `BUN_PATH`
  - Override the Bun binary used by the desktop app.
  - Useful to force a system Bun install instead of the bundled runtime.

## Build + CI

- `BUN_BUNDLE_VERSION`
  - Version of Bun to bundle into desktop builds.
  - Example: `BUN_BUNDLE_VERSION=1.3.6 bun ./scripts/bundle-bun.ts`

## Standard Node/Bun Environment

- `NODE_ENV`
  - Used to toggle dev behavior (CORS, etc).

## Quick examples

```bash
# API env
PORT=3001
FRONTEND_URL=http://localhost:3000
FRONTEND_AUTH_PATH=/
CORS_ORIGIN=http://localhost:3000
JWT_SECRET=change-me
ANILIST_CLIENT_ID=...
ANILIST_CLIENT_SECRET=...
ANILIST_REDIRECT_URI=http://localhost:3001/api/auth/anilist/callback
ANILIST_RPM=30
MANVERSE_DB_PATH=/absolute/path/to/manverse.db

# Frontend env
VITE_API_URL=http://localhost:3001
```
