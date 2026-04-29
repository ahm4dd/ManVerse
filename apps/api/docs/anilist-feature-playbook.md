# Manverse — AniList Client Playbook

> **Audience**: An agent or developer adding AniList functionality after the API AniList proxy layer was removed.

## Current Architecture

- `packages/anilist-client` is the only place where AniList GraphQL operations should be implemented.
- Browser or frontend clients should call AniList through `@manverse/anilist-client` so AniList sees the user IP, not the Manverse API egress IP.
- `apps/api` keeps only:
  - Better Auth session handling
  - AniList OAuth linking
  - encrypted AniList token storage and retrieval

There should be no new `/api/v1/anilist/*` routes unless a server-side AniList flow is explicitly required.

## When To Change `apps/api`

Only touch `apps/api` for AniList work when the change is about:

- OAuth provider wiring in `src/lib/auth.ts`
- AniList OAuth identity mapping in `src/lib/anilist-oauth.ts`
- provider/account metadata surfaced through existing user/account APIs

Do not add API DTOs, controllers, or services just to proxy AniList reads or writes.

## Adding A Feature To `@manverse/anilist-client`

Each AniList feature lives under `packages/anilist-client/src/features/<feature>/` with:

- `schemas.ts`
- `queries.ts`
- `operations.ts`
- `operations.spec.ts`
- `index.ts`

Implementation rules:

- keep `AnilistClient` as a thin facade that delegates to feature operations
- validate caller input with Zod before any request
- validate AniList response payloads with Zod after each request
- use `requireAccessToken()` for authenticated AniList operations
- export runtime values and type-only values through the feature barrel and the package root barrel

## Tests

For `packages/anilist-client`, add or update:

- operation unit tests for happy path
- auth rejection tests for authenticated operations
- invalid input rejection tests
- invalid response rejection tests
- default-value tests where defaults are part of the schema

For `apps/api`, add or update tests only if AniList linking behavior changes:

- Better Auth configuration tests in `src/lib/auth.spec.ts`
- AniList OAuth helper tests in `src/lib/anilist-oauth.spec.ts`
- e2e coverage for OAuth callback/token persistence in `test/anilist/anilist.e2e-spec.ts`

## Checklist

- [ ] Feature added under `packages/anilist-client/src/features/<feature>/`
- [ ] `AnilistClient` facade updated if the feature is public
- [ ] package root barrel exports updated
- [ ] `pnpm --filter @manverse/anilist-client test`
- [ ] `pnpm --filter @manverse/anilist-client check-types`
- [ ] if OAuth linking changed: `pnpm --filter api test`
- [ ] if OAuth callback behavior changed: `pnpm --filter api test:e2e`
