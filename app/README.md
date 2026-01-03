# ManVerse Frontend

This folder contains the React frontend. The repo is managed as a workspace, so install from the repo root.

## Run locally

From the repo root:

```bash
bun install
bun run dev:app
```

`bun install` downloads all workspace dependencies, including the frontend.

The API defaults to `http://localhost:3001`. If needed, set `VITE_API_URL` in `app/.env.local`.

For full docs, see the root `README.md`.
