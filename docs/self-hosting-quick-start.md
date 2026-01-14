# Self-hosting Quick Start (LAN)

Use this if you want to open ManVerse on a phone or tablet while the API runs on your main
machine. This assumes both devices are on the same Wi-Fi or hotspot.

If you are not sure what any step does, read `Self-hosting-guide.md` first.
That guide also explains how to use a stable `.local` hostname on every OS.

## What you need

- A host machine that stays on.
- The host and phone on the same network.
- Bun installed on the host.

## Steps (run on the host machine)

1) Install dependencies:

```bash
bun install
```

2) Create `api/.env`:

```bash
PORT=3001
FRONTEND_URL=http://YOUR_HOST_IP:3000
CORS_ORIGIN=http://YOUR_HOST_IP:3000
JWT_SECRET=change-me
ANILIST_CLIENT_ID=your_id
ANILIST_CLIENT_SECRET=your_secret
ANILIST_REDIRECT_URI=http://YOUR_HOST_IP:3001/api/auth/anilist/callback
```

3) Create `app/.env.local`:

```bash
VITE_API_URL=http://YOUR_HOST_IP:3001
VITE_ALLOWED_HOSTS=YOUR_HOST_IP,YOUR_HOST_NAME
```

You can replace `YOUR_HOST_IP` with `yourname.local` if you set up a `.local` hostname.

4) Start the API:

```bash
bun run dev:api
```

5) Start the UI:

```bash
bun run dev:app -- --host 0.0.0.0 --port 3000
```

6) On your phone, open:

```
http://YOUR_HOST_IP:3000
```

## Quick verification

- UI loads on phone: `http://YOUR_HOST_IP:3000`
- API health check: `http://YOUR_HOST_IP:3001/health`

## Need more detail?

- Full guide: `Self-hosting-guide.md`
- Production setup: `docs/self-hosting-production.md`
- Troubleshooting: `docs/self-hosting-troubleshooting.md`
