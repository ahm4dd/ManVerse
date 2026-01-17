# Scraper Reliability Roadmap

Goal: improve scraper reliability, observability, and UX without slowing the app.

## Step 1: Logging + Health Panel (current focus)
- Add structured scraper logging (provider, operation, request id, duration, error reason).
- Expose health + recent error APIs.
- Add a lightweight health panel in Settings (success rate, avg duration, recent failures).
- Keep data in-memory (ring buffer) to avoid DB overhead.
- Optional file logging (JSONL) with rotation + export.

## Step 2: Scraper hardening (queues + caps)
- Per-provider concurrency caps (especially MangaFire).
- Short queue + drop policy for stale requests.
- Backoff for repeated failures / rate limit signs.

## Step 3: Provider UX polish
- Clear provider status badges (success/failed/pending).
- Friendly error copy + "try again" hints for rate-limits.
- Provider-specific notes in the UI (e.g., MangaFire rate-limited).

## Step 4: Caching strategy
- Unified in-memory + disk caching.
- TTL per provider and per operation (search/details/chapters/images).
- Optional "force refresh" on demand.

## Step 5: Provider expansion
- Only after Steps 1-4 stabilize.
- Add new providers with a shared checklist: search, details, chapters, images, rate limits, UX.
