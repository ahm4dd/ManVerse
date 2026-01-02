# ManVerse

Full-stack workspace for the ManVerse frontend and production API.

## Structure

- `app/` - Google AI Studio frontend (React + Tailwind + Framer Motion)
- `api/` - Hono-based API (Bun)
- `ManVerse/packages/` - ManVerse shared packages (core, anilist, scrapers, downloader, pdf)
- `shared/` - Shared types (frontend + backend)

## Quickstart

- Frontend: `npm --prefix app run dev`
- API: `bun --cwd api run dev`

