# Self-hosting Production Setup

Use this when you want a stable, always-on ManVerse instance, or when you plan to expose it
outside your LAN. This is more complex than the quick start.

If you are new to self-hosting, read `Self-hosting-guide.md` first.

If you are using the desktop app (AppImage/Windows/macOS), use Settings -> Self-hosting
instead of this guide.

## Overview

- Build the UI into static files.
- Serve the UI with a static server or reverse proxy.
- Run the API with production env settings.
- Lock down security (HTTPS, auth, strict CORS).

## Step 1: Set environment variables

Create `api/.env`:

```bash
PORT=3001
FRONTEND_URL=https://your-domain-or-ip
CORS_ORIGIN=https://your-domain-or-ip
JWT_SECRET=change-me
ANILIST_CLIENT_ID=your_id
ANILIST_CLIENT_SECRET=your_secret
ANILIST_REDIRECT_URI=https://your-domain-or-ip/api/auth/anilist/callback
NODE_ENV=production
```

AniList supports one redirect URL at a time. Use the same host you open in the browser,
and update the redirect URL if you switch hosts.

Create `app/.env.local`:

```bash
VITE_API_URL=https://your-domain-or-ip
```

Note: `VITE_API_URL` is baked into the UI build. If you change it, rebuild the UI.

## Step 2: Build the UI

```bash
bun run --cwd app build
```

Output is in `app/dist`.

## Step 3: Serve the UI

Option A: simple static server

```bash
bunx serve -s app/dist -l 3000
```

Option B: reverse proxy (recommended for HTTPS)

- Nginx, Caddy, or Traefik can serve static files and proxy the API.
- Forward `Host`, `X-Forwarded-Host`, and `X-Forwarded-Proto` headers.

## Step 4: Run the API

```bash
bun run --cwd api start
```

## Step 5: Security checklist

- Use HTTPS when exposed outside LAN.
- Do not allow `CORS_ORIGIN=*` in production.
- Keep `JWT_SECRET` strong and private.
- Restrict access with auth or a VPN if possible.

## References

- Full guide: `Self-hosting-guide.md`
- Troubleshooting: `docs/self-hosting-troubleshooting.md`
- Configuration reference: `docs/configuration.md`
