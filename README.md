# Manverse

Manverse is a `pnpm` workspace powered by Turbo. The current app surface is a NestJS API in `apps/api` plus shared packages under `packages/`, including `@manverse/anilist-client`.

## Prerequisites

- Node.js `>=18`
- `pnpm@9` via Corepack
- Docker with the Compose plugin

If you do not already have `pnpm@9` active:

```bash
corepack enable
corepack prepare pnpm@9.0.0 --activate
```

## First-Time API Setup

Run these commands from the repository root:

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp docker/.env.development.example docker/.env.development
pnpm docker:dev
pnpm setup:api
pnpm --filter api prisma:migrate
pnpm dev:api
```

On Windows, use your shell's equivalent copy command instead of `cp`.

What each step does:

- `pnpm install` installs the entire workspace. Turbo does not install dependencies for you.
- `apps/api/.env` configures the API, Prisma, and Better Auth.
- `docker/.env.development` configures the local Postgres container used by `docker/compose.dev.yaml`.
- `pnpm docker:dev` starts the development database with Docker Compose.
- `pnpm setup:api` runs the API setup task through Turbo. Turbo builds `@manverse/anilist-client` first, then runs Prisma code generation and Better Auth generation for `apps/api`.
- `pnpm --filter api prisma:migrate` creates or updates the local database schema.
- `pnpm dev:api` starts the API and keeps `@manverse/anilist-client` compiling in watch mode alongside it.

When the API is running:

- API base URL: `http://localhost:3000/api/v1`
- API reference: `http://localhost:3000/reference`
- Better Auth reference: `http://localhost:3000/api/auth/reference`

## Environment Files

`apps/api/.env`

- `DATABASE_URL` must point at the same Postgres instance started by Docker.
- `BETTER_AUTH_SECRET` must be base64.
- Leave `ANILIST_OAUTH_ENABLED='false'` unless you are actively wiring AniList OAuth credentials.

`docker/.env.development`

- `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, and `DB_DATABASE_NAME` must match the values used to build `DATABASE_URL` in `apps/api/.env`.

## Common Commands

- `pnpm setup:api` builds `@manverse/anilist-client`, then generates Prisma and Better Auth artifacts for the API.
- `pnpm dev:api` starts the API in watch mode.
- `pnpm docker:dev` starts the development Postgres container.
- `pnpm docker:dev:down` stops the development Postgres container and removes its volume.
- `pnpm lint` runs workspace linting.
- `pnpm check-types` runs workspace TypeScript checks.
- `pnpm build` builds all buildable packages.
- `pnpm test` runs workspace tests.

## Troubleshooting

- If `pnpm setup:api` fails, check that `apps/api/.env` exists and contains a valid `DATABASE_URL` and `BETTER_AUTH_SECRET`.
- If the API says the schema is not ready, run `pnpm --filter api prisma:migrate`.
- If Docker Compose complains about a missing env file, create `docker/.env.development` from `docker/.env.development.example` before running `pnpm docker:dev`.
