# API

`apps/api` is the NestJS API for Manverse.

## Local Development

Use the workspace-level onboarding flow from the repository root:

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

`pnpm setup:api` builds `@manverse/anilist-client` before it runs Prisma and Better Auth generation for the API.

## API URLs

- Base API: `http://localhost:3000/api/v1`
- API reference: `http://localhost:3000/reference`
- Better Auth reference: `http://localhost:3000/api/auth/reference`

## Commands

Run these from the repository root unless you have a specific reason to scope into `apps/api`:

- `pnpm setup:api`
- `pnpm --filter api prisma:migrate`
- `pnpm --filter api prisma:seed`
- `pnpm --filter api test`
- `pnpm --filter api test:e2e`
