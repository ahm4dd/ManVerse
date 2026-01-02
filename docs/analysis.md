# ManVerse - Current State Scan

## Frontend (Google AI Studio)
- Location: `app/`
- Stack: React + Tailwind (via CDN) + Framer Motion
- Data access: direct AniList GraphQL calls and local mock Asura scraper
- Auth: implicit AniList token stored in localStorage (reworked to backend JWT in this migration)

## Backend Packages (migrated under `packages/`)
- `@manverse/core`: Zod-first domain schemas and shared types
- `@manverse/anilist`: AniList OAuth + GraphQL client
- `@manverse/scrapers`: Puppeteer-based Asura scraper (server-side)
- `@manverse/downloader`: Chapter image downloader
- `@manverse/pdf`: PDF generation
- `@manverse/database`: SQLite layer (scaffolded, schema + db setup)

## Dependency Map (by package)
- `@manverse/core` -> `zod`
- `@manverse/anilist` -> `@manverse/core`, `graphql`, `graphql-request`, `zod`
- `@manverse/scrapers` -> `@manverse/core`, `axios`, `defu`, `zod`, `puppeteer`
- `@manverse/downloader` -> `@manverse/core`, `p-limit`
- `@manverse/pdf` -> `@manverse/core`, `p-limit`, `pdfkit`, `sharp`
- `@manverse/database` -> `@manverse/core`, `zod`

## Broken / Risky Items Found
- `@manverse/database` missing from repo (scaffold added, full ops TBD)
- `@manverse/scrapers` exported `AsuraScansScarper` (typo), and factory imported class as a value while interface was used (fixed)
- `@manverse/downloader` missing `p-limit` dependency (fixed)
- `@manverse/scrapers` had no `tsconfig.json` (added)
- `ManVerse` legacy repo referenced apps that are no longer present
- `drizzle.config.ts` in legacy repo points to `./src/db/schema.ts` which doesn't exist
- `bun test` in legacy repo reports no tests (non-zero exit)

## api.origin References
- No `api.origin` or `API_ORIGIN` references found in frontend source.
