# ManVerse

ManVerse is a local‑first manga/manhwa reader with AniList sync and provider scraping. It runs on your own machine, tracks your library and progress, and lets you read from providers while keeping AniList in sync.

This repo contains:
- `app/` — React + Vite frontend
- `api/` — Bun + Hono API
- `packages/*` — shared libraries and scrapers
- `desktop/` — Electron desktop wrapper

## Quick start (desktop users)

If you downloaded the desktop app, you do not need Bun or Node.

1) Install the app
- Windows: run the `.exe` installer
- Linux: run the `.AppImage`

2) Launch ManVerse and finish setup
- Click **Continue with AniList** to connect your account
- If you don’t want AniList yet, use **Try Demo Account**

3) One‑time AniList setup (recommended)
- Open **Settings → AniList setup**
- Paste your **Client ID** and **Client Secret**
- Save, then click **Continue with AniList**

The app includes a step‑by‑step setup guide inside the UI.

## Quick start (developers)

You need Bun 1.3+ installed.

```bash
bun install
bun run dev
```

Open `http://localhost:3000`.

If you prefer separate terminals:

```bash
bun run dev:api
bun run dev:app
```

## What you can do

ManVerse is built around a local library and reading workflow:

- **AniList sync**: login, view your library, sync progress, and pull stats
- **Provider scraping**: search and read chapters from providers
- **Manual mapping**: link a provider series to AniList when titles differ
- **Continue reading**: resume from the last chapter you read
- **Recent reads**: local history even without AniList
- **Offline downloads**: queue chapters and read them later
- **Background notifier**: optional checks for new chapter releases
- **Desktop updates**: in‑app update checks and restart‑to‑update

## How it works

- The frontend calls a local API (running on your machine).
- The API fetches AniList data and scrapes providers for chapters/images.
- Your progress, mappings, and history live in a local SQLite database.

No hosted backend is required.

## AniList setup (manual)

You need your own AniList application credentials.

1) Open https://anilist.co/settings/developer
2) Create a new app
3) Set the redirect URL to:

```
http://localhost:3001/api/auth/anilist/callback
```

4) Enter the Client ID and Client Secret in **Settings → AniList setup**

If the redirect URL does not match exactly, AniList login will fail.

## Configuration

Configuration details are documented in `docs/configuration.md`.

Common settings:

API (`api/.env`)
- `PORT` (default: 3001)
- `FRONTEND_URL` (default: http://localhost:3000)
- `FRONTEND_AUTH_PATH` (default: `/`)
- `CORS_ORIGIN` (default: http://localhost:3000)
- `JWT_SECRET` (required)
- `ANILIST_CLIENT_ID` / `ANILIST_CLIENT_SECRET` (required)
- `ANILIST_REDIRECT_URI` (default: http://localhost:3001/api/auth/anilist/callback)
- `ANILIST_RPM` (default: 30)

Frontend (`app/.env.local`)
- `VITE_API_URL` (default: http://localhost:3001)

## Data storage

Local database path:
- Linux: `~/.config/manverse/data.db`
- Windows: `%APPDATA%/manverse/data.db`

Downloads:
- Linux: `~/.config/manverse/downloads`
- Windows: `%APPDATA%/manverse/downloads`

## Provider mapping

Provider titles often differ from AniList titles. You can link them manually:

1) Open a series page
2) Choose **Link to AniList**
3) Search or paste an AniList URL/ID

Once mapped, provider chapters can be fetched without re‑searching each time.

## API docs (Scalar)

The backend serves live API docs:

- Scalar UI: `http://localhost:3001/api/docs`
- OpenAPI JSON: `http://localhost:3001/api/openapi.json`

## Desktop app (Electron)

Run desktop in dev:

```bash
bun run dev:desktop
```

Build desktop locally:

```bash
bun run build:desktop
```

## Troubleshooting

- **AniList login fails**: check Client ID, Secret, and Redirect URL
- **Port already in use**: change `PORT` in `api/.env`
- **CORS errors**: set `CORS_ORIGIN` to your frontend URL
- **Provider scraping issues**: try another provider or refresh

## License

Apache‑2.0. See `LICENSE`.
