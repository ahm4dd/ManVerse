# ManVerse Desktop (Electron)

This folder hosts the Electron wrapper for the ManVerse web app. It reuses the same frontend and API, but runs them locally and opens a native window.

## Development

From the repo root:

```bash
bun install
bun run dev:desktop
```

This starts:
- the API (Bun)
- the Vite dev server
- the Electron window

If you already have the web UI running and don’t want Electron to start it, use:

```bash
MANVERSE_EXTERNAL_UI=true bun run dev:desktop
```

## Production build (local)

Build the frontend first, then build the Electron app:

```bash
bun run --cwd app build
bun run --cwd desktop build
```

The build step downloads a Bun runtime for the current platform and bundles it into the app. If you
want to force a specific Bun binary (or use your system install), set `BUN_PATH` when launching.
