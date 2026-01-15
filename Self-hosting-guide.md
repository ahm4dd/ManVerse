# ManVerse Self-Hosting Guide

This guide is for running ManVerse on your own machine and opening it from other devices
(phones, tablets, other computers). It is intentionally detailed and beginner-friendly,
with OS-specific steps, security warnings, and explanations for each command.

If you just want to run ManVerse locally on one machine, you do NOT need this guide.

---

## Quick glossary

- Host machine: The computer that runs the ManVerse API and UI.
- Client device: The phone/tablet/other computer that connects to the host.
- UI: The web frontend (React + Vite or built static files).
- API: The Bun + Hono backend that fetches AniList data and provider chapters.
- LAN: Your local network (same Wi-Fi or same hotspot).

---

## Which self-hosting mode should you use?

### 1) Desktop app (recommended for most people)
The Electron desktop app runs both the API and UI locally. It is easiest to set up
on a single machine. For LAN access, you still need to expose the UI and API to your
local network and update config.

### 2) Headless self-host (no Electron)
You run the API and UI yourself, typically for phones/tablets or multiple devices.
You control where it runs and how it is exposed.

### 3) Production server (advanced)
You run the API on a server and serve the UI through a static server or reverse proxy
(Nginx/Caddy/Traefik). This is more complex and requires extra security measures.

---

## High-level flow (what needs to happen)

1) The API must be reachable from the client device.
2) The UI must be reachable from the client device.
3) The UI must call the correct API base URL.
4) AniList redirect URLs must match the API address that clients can reach.
5) CORS must allow the UI origin.

If any of these are wrong, the app will look like it loads, but actions will fail.

---

## Security warnings (read before you start)

- Do NOT forward ManVerse ports to the public internet unless you know what you are doing.
- If you do expose it publicly, use HTTPS, authentication, and restrict origins.
- AniList credentials should never be exposed. Protect your API.
- The API runs scrapers and can read data locally on the host.
- Running on a private LAN is safest for beginners.

---

## Prerequisites (all modes)

- A host machine that stays on while you use ManVerse.
- The host and client must be on the same network (LAN or hotspot).
- Basic terminal access on the host.

If you plan to run the API and UI manually (headless mode):
- Bun 1.3+ installed on the host.

---

## Find your host machine IP address

You need a LAN IP to open the UI from your phone.

### Windows (PowerShell)

```powershell
ipconfig
```

Look for IPv4 Address on your active adapter (e.g. 192.168.1.25).

### macOS (Terminal)

```bash
ipconfig getifaddr en0
```

If you use Ethernet, use `en1` instead of `en0`.

### Linux (Terminal)

```bash
ip -4 addr show
```

Look for an IP under the active interface (e.g. wlan0 or eth0).

---

## Optional: Use a stable hostname (.local)

If you do not want to memorize IP addresses, you can use a local hostname like:

```
http://your-machine-name.local:3000
```

This uses mDNS (Bonjour/Avahi). It works on the same LAN and updates as your IP changes.
It is not a public address and will not work on cellular or across unrelated networks.

### macOS (built-in)

1) System Settings -> General -> About -> Name (set your computer name).
2) System Settings -> General -> Sharing -> Local hostname (set if needed).
3) Use `http://yourname.local:3000` on your phone.

Check your hostname:

```bash
scutil --get LocalHostName
```

### Windows (requires Bonjour)

1) Settings -> System -> About -> Rename this PC.
2) Install Bonjour (included with iTunes) or "Bonjour Print Services".
3) Reboot or restart the Bonjour service.
4) Use `http://yourname.local:3000`.

If `.local` does not resolve, use the LAN IP or set a router DNS entry.

### Linux (Avahi + mDNS)

1) Set your hostname:

```bash
sudo hostnamectl set-hostname yourname
```

2) Install and enable Avahi:

Debian/Ubuntu:

```bash
sudo apt install avahi-daemon
sudo systemctl enable --now avahi-daemon
```

Fedora/RHEL/Alma/Rocky:

```bash
sudo dnf install avahi nss-mdns
sudo systemctl enable --now avahi-daemon
```

Arch:

```bash
sudo pacman -S avahi nss-mdns
sudo systemctl enable --now avahi-daemon
```

openSUSE:

```bash
sudo zypper install avahi nss-mdns
sudo systemctl enable --now avahi-daemon
```

3) Make sure `/etc/nsswitch.conf` includes `mdns` in the hosts line:

```
hosts: files mdns4_minimal [NOTFOUND=return] dns mdns4
```

4) Use `http://yourname.local:3000`.

### Alternative: DHCP reservation

You can also reserve a fixed LAN IP in your router's DHCP settings. This keeps the same
IP on that network only. It does not follow you across different networks.

---

## Mode 1: Desktop app + LAN access (recommended for most people)

This mode uses the Electron app and exposes it to your LAN using the built-in LAN Access toggle.

### What this does
- The desktop app runs the API (default 3001) and UI (default 3000).
- LAN Access binds the UI/API to your LAN so phones/tablets can reach it.
- AniList redirects must use the same host your clients use.

### Steps (desktop app)
1) Open Settings -> Self-hosting -> LAN Access.
2) Choose an advertised host (LAN IP or `.local`), then enable LAN access.
3) Copy the LAN UI URL and open it on your phone/tablet.
4) In AniList developer settings, add redirect URLs for:
   - Desktop app: `http://127.0.0.1:3001/api/auth/anilist/callback` (or `http://localhost:3001/...`)
   - LAN devices: `http://YOUR_HOST_IP:3001/api/auth/anilist/callback`
5) Sign in from each device using the matching UI URL.

Note: AniList allows multiple redirect URLs per app. Use the same host you open in the browser
(IP vs `.local` vs `localhost`).

---

## Mode 2: Headless self-host (LAN) - recommended for phones/tablets

This is the most reliable way to access ManVerse from a phone.
You run API and UI yourself on the host machine.

### Step A: Install Bun

#### Windows

1) Open PowerShell.
2) Run:

```powershell
irm https://bun.sh/install.ps1 | iex
```

3) Close and reopen PowerShell.
4) Confirm:

```powershell
bun --version
```

#### macOS

```bash
curl -fsSL https://bun.sh/install | bash
```

Then restart your terminal and run:

```bash
bun --version
```

#### Linux (Debian/Ubuntu)

```bash
curl -fsSL https://bun.sh/install | bash
```

#### Linux (Fedora)

```bash
curl -fsSL https://bun.sh/install | bash
```

#### Linux (Arch)

```bash
curl -fsSL https://bun.sh/install | bash
```

#### Linux (openSUSE)

```bash
curl -fsSL https://bun.sh/install | bash
```

#### Linux (RHEL/CentOS/Alma/Rocky)

```bash
curl -fsSL https://bun.sh/install | bash
```

All Linux distros use the same installer. Make sure the shell profile is updated.
If bun is not found, reopen your terminal or manually add bun to PATH.

### Step B: Install dependencies

From the repo root:

```bash
bun install
```

This downloads frontend, API, and scraper dependencies.

### Step C: Configure the API

Create `api/.env` and set minimum values:

```bash
PORT=3001
FRONTEND_URL=http://YOUR_HOST_IP:3000
CORS_ORIGIN=http://YOUR_HOST_IP:3000
JWT_SECRET=change-me-please
ANILIST_CLIENT_ID=your_id
ANILIST_CLIENT_SECRET=your_secret
ANILIST_REDIRECT_URI=http://YOUR_HOST_IP:3001/api/auth/anilist/callback
```

Explanation:
- PORT: where the API listens.
- FRONTEND_URL: where the UI lives (used for login redirects).
- CORS_ORIGIN: which UI origins can call the API.
- JWT_SECRET: signs user sessions. Must not be empty.
- ANILIST_*: AniList credentials and redirect URI.

### Step D: Configure the UI

Create `app/.env.local`:

```bash
VITE_API_URL=http://YOUR_HOST_IP:3001
VITE_ALLOWED_HOSTS=YOUR_HOST_IP,YOUR_HOST_NAME
```

Explanation:
- VITE_API_URL is the API base URL used by the frontend.
- VITE_ALLOWED_HOSTS is only for the Vite dev server.
- VITE_API_URL is baked into the UI build. If you change it, rebuild the UI.

### Step E: Run the API

```bash
bun run dev:api
```

Effect:
- Starts the API on `PORT` (default 3001).
- Handles AniList auth and provider scraping.

### Step F: Run the UI

```bash
bun run dev:app -- --host 0.0.0.0 --port 3000
```

Effect:
- Starts the Vite dev server.
- `--host 0.0.0.0` makes it reachable from other devices on your LAN.
- `--port 3000` sets the UI port.

### Step G: Open from your phone

On the phone browser:

```
http://YOUR_HOST_IP:3000
```

If it does not load, check firewall and network sections below.

---

## Mode 3: Production self-host (advanced)

Use this if you want a stable service (not dev server) or if you plan to expose it.

### Step A: Build the UI

```bash
bun run --cwd app build
```

Effect:
- Produces static files in `app/dist`.
- The API URL is baked into the build from `VITE_API_URL`.

### Step B: Serve the UI

Option 1: Static server (simple)

```bash
bunx serve -s app/dist -l 3000
```

Effect:
- Serves static UI on port 3000.

Option 2: Reverse proxy (Nginx, Caddy, Traefik)
- Recommended for HTTPS and domain names.
- Ensure the proxy forwards `Host`, `X-Forwarded-Host`, and `X-Forwarded-Proto`
  so AniList redirects are correct.

### Step C: Run the API in production

```bash
bun run --cwd api start
```

Effect:
- Runs the API with production defaults.

### Step D: Update environment for production

- Set `NODE_ENV=production` for the API.
- Set `CORS_ORIGIN` to the UI origin.
- Ensure `FRONTEND_URL` and `ANILIST_REDIRECT_URI` match your public/lan host.
- If you change `VITE_API_URL`, rebuild the UI.

---

## Firewall and network configuration

### Windows Firewall

1) Open "Windows Defender Firewall with Advanced Security".
2) Create inbound rules for ports 3000 and 3001.
3) Allow TCP on Private networks.

### macOS Firewall

1) System Settings -> Network -> Firewall -> Options.
2) Allow incoming connections for Terminal or Bun.

### Linux (UFW - Ubuntu/Debian)

```bash
sudo ufw allow 3000/tcp
sudo ufw allow 3001/tcp
sudo ufw status
```

### Linux (Firewalld - Fedora)

```bash
sudo firewall-cmd --add-port=3000/tcp --permanent
sudo firewall-cmd --add-port=3001/tcp --permanent
sudo firewall-cmd --reload
```

### Linux (iptables - advanced)

```bash
sudo iptables -A INPUT -p tcp --dport 3000 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 3001 -j ACCEPT
```

### Router considerations

- Keep the host and client on the same network.
- Do NOT enable port forwarding unless you intend to expose it publicly.

---

## Run at startup (optional)

If you want ManVerse to start automatically after a reboot, use one of these:

### Windows (Task Scheduler)

1) Open Task Scheduler.
2) Create Task -> Run whether user is logged in or not.
3) Action: start a program.
4) Program/script: a batch file that starts API and UI.

Example batch file (save as `start-manverse.bat`):

```bat
@echo off
cd C:\\path\\to\\manverse
start /B bun run dev:api
start /B bun run dev:app -- --host 0.0.0.0 --port 3000
```

### macOS (launchd)

Create a LaunchAgent plist to run the API and UI. You can run them in separate
plists or a small shell script.

Example script (save as `~/manverse/start.sh`):

```bash
#!/bin/sh
cd /path/to/manverse
nohup bun run dev:api >/tmp/manverse-api.log 2>&1 &
nohup bun run dev:app -- --host 0.0.0.0 --port 3000 >/tmp/manverse-ui.log 2>&1 &
```

Then create a LaunchAgent plist to run the script at login.

### Linux (systemd)

Create two services or a single service that runs a script. Example service:

```ini
[Unit]
Description=ManVerse API
After=network.target

[Service]
Type=simple
WorkingDirectory=/path/to/manverse
ExecStart=/usr/bin/bun run dev:api
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Repeat for the UI with `bun run dev:app -- --host 0.0.0.0 --port 3000`.

---

## AniList setup details (important)

AniList uses redirect URLs. If the redirect URL does not match exactly,
login will fail.

If you self-host on LAN, add the LAN redirect URL:

```
http://YOUR_HOST_IP:3001/api/auth/anilist/callback
```

If you also use the desktop app locally, add the local redirect URL too:

```
http://127.0.0.1:3001/api/auth/anilist/callback
```

Make sure these are set in:
- `ANILIST_REDIRECT_URI` (API env, if you manage it manually)
- Your AniList developer app settings (you can add multiple entries)

---

## Common edge cases and fixes

### 1) Phone is on cellular, not Wi-Fi
- It will NOT reach your LAN unless your phone is a hotspot and the host is
  connected to that hotspot (this does work).

### 2) "This site cannot be reached" from phone
- Check host IP, firewall rules, and that UI is bound to 0.0.0.0.
- Ensure host and phone are on the same network.

### 3) API calls fail (login or chapters)
- Check `VITE_API_URL` points to correct host:port.
- Check CORS (`CORS_ORIGIN`) includes the UI origin.

### 4) AniList login fails
- Redirect URL mismatch is the most common cause.
- Update `ANILIST_REDIRECT_URI` and AniList app settings.

### 5) mDNS (.local) not working
- Some routers block mDNS. Use raw IP instead.

### 6) Port already in use
- Another process is using 3000/3001. Pick new ports and update env.

### 7) Images fail to load on phone
- The API must be reachable. Ensure it is not restricted to localhost only.

### 8) Docker or VM host
- Ensure the container exposes ports and the host firewall allows them.

### 9) Multiple network adapters
- Use the IP from the adapter the phone can reach (Wi-Fi vs Ethernet).

### 10) AniList credentials cannot be saved from the UI
- If `MANVERSE_SETTINGS_TOKEN` is set on the API, the UI must send
  `X-Settings-Token` or credential saves will fail.

---

## What each command actually does

- `bun install`
  - Downloads all dependencies for app and api.

- `bun run dev:api`
  - Runs the API in development mode on `PORT`.

- `bun run dev:app -- --host 0.0.0.0 --port 3000`
  - Runs the UI dev server and exposes it to LAN.

- `bun run --cwd app build`
  - Builds the UI into static files under `app/dist`.

- `bunx serve -s app/dist -l 3000`
  - Serves the built UI on port 3000.

---

## Recommended safe defaults

For LAN-only setups:

- API port: 3001
- UI port: 3000
- CORS_ORIGIN: http://YOUR_HOST_IP:3000
- FRONTEND_URL: http://YOUR_HOST_IP:3000
- ANILIST_REDIRECT_URI: http://YOUR_HOST_IP:3001/api/auth/anilist/callback

---

## Ports and URL changes (important)

If you change ports or move to HTTPS, update ALL of these:

- `VITE_API_URL` (UI build-time)
- `FRONTEND_URL` (API)
- `CORS_ORIGIN` (API)
- `ANILIST_REDIRECT_URI` (API + AniList app settings)

If the scheme is HTTPS, use HTTPS everywhere. Mixed HTTP/HTTPS breaks login.

---

## Storage and backups

The API stores a SQLite database and downloads locally. You can override paths with:

- `MANVERSE_DB_PATH`
- `MANVERSE_DOWNLOAD_PATH`

If you care about your library and history, back up those paths regularly.

---

## Troubleshooting checklist

- Can the phone ping the host IP?
- Is the UI reachable at http://HOST:3000 from the host machine itself?
- Is the UI reachable at http://HOST:3000 from the phone?
- Does http://HOST:3001/health respond?
- Can you open http://HOST:3001/api/docs from a browser on the host?
- Are environment variables correct?
- Is the firewall open?

---

## Where to go next

- Quick start (LAN): `docs/self-hosting-quick-start.md`
- Production setup: `docs/self-hosting-production.md`
- Troubleshooting: `docs/self-hosting-troubleshooting.md`
- Configuration reference: `docs/configuration.md`
- Desktop app settings: see `desktop/main.cjs`
- If you get stuck, collect logs from API and UI and share them.
