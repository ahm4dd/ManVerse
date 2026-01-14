# Self-hosting Troubleshooting

Use this checklist when the UI loads but features do not work, or when the UI does not load at all.

## UI does not load on phone

- Confirm the host and phone are on the same Wi-Fi or hotspot.
- Make sure the UI server is bound to `0.0.0.0` (or `::` for IPv6).
- Check the host firewall allows the UI port (default 3000).
- Try opening the UI from the host machine itself first.

## API calls fail or show errors

- Check `VITE_API_URL` points to the correct host and port.
- Ensure `CORS_ORIGIN` includes the UI origin.
- Test API health: `http://HOST:3001/health`.

## AniList login fails

- Redirect URI mismatch is the most common cause.
- Update `ANILIST_REDIRECT_URI` and the AniList app settings.
- Make sure the scheme and port match exactly (HTTP vs HTTPS).

## Chapters or images do not load

- The API must be reachable from the phone.
- Check the API logs for scraper errors.
- Confirm the host has internet access.

## Port already in use

- Another process is using 3000 or 3001.
- Change ports in `api/.env` and `app/.env.local`, then restart.

## mDNS hostname does not resolve

- Some routers block `.local` names.
- On Windows, install Bonjour so `.local` resolves.
- On Linux, ensure Avahi and `nss-mdns` are installed and enabled.
- Use the raw LAN IP instead if needed.

## Phone on cellular data

- LAN access will not work unless the host is on the phone's hotspot.
- Public exposure requires HTTPS and extra security.

## Still stuck?

- Read the full guide: `Self-hosting-guide.md`
- Review env variables: `docs/configuration.md`
- Collect logs from the API and UI before asking for help.
