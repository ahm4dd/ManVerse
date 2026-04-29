# Repository Guidelines

## Project Structure & Module Organization

This repo is a `pnpm` workspace powered by Turbo. The NestJS API lives in `apps/api`, with source in `apps/api/src`, e2e coverage in `apps/api/test`, and Prisma schema, migrations, and seed files in `apps/api/prisma`. Shared code lives in `packages/`: `anilist-client` for AniList GraphQL logic, `ui` for shared React components, and config packages such as `eslint-config`, `typescript-config`, and `types`. Workspace automation lives in the root `package.json` and `turbo.json`; local infrastructure lives in `docker/`.

## Build, Test, and Development Commands

Use `pnpm install` to install the workspace. For the API, copy `apps/api/.env.example` to `apps/api/.env`, copy `docker/.env.development.example` to `docker/.env.development`, start Docker with `pnpm docker:dev`, and run `pnpm setup:api` to prepare Prisma codegen and Better Auth artifacts. Common root commands:

- `pnpm dev:api` runs the API in watch mode
- `pnpm docker:dev` starts local development services
- `pnpm format` formats `ts`, `tsx`, and `md`
- `pnpm lint` runs workspace linting
- `pnpm check-types` runs TypeScript checks
- `pnpm build` builds all buildable packages
- `pnpm test` runs workspace tests

## Coding Style & Naming Conventions

This is a TypeScript-first ESM monorepo. Follow the existing 2-space indentation, single quotes, and trailing commas enforced by Prettier. Keep explicit `.js` import extensions where the repo already uses them. In `apps/api`, follow NestJS file naming such as `*.module.ts`, `*.controller.ts`, `*.service.ts`, and place Zod DTOs under `dto/`. In `packages/anilist-client`, keep code feature-oriented under `src/features/<feature>/` and export public values and types through package barrels.

## Agent Workflow

For non-trivial tasks, write a short feature plan before editing. Prefer additive changes that preserve public exports, DTO names, routes, and existing behavior unless a breaking change is explicitly requested. If you are implementing AniList functionality, consult `docs/anilist-feature-playbook.md` when it exists; that file should hold the detailed recipe, while this file defines the guardrails.

After implementing a change, agents must verify it before calling the task done. Run the narrowest relevant checks first, then broaden when shared surfaces changed:

- `pnpm format`
- `pnpm lint`
- `pnpm check-types`
- `pnpm build` or the affected package/app build command
- run the affected program when runtime wiring matters

Static checks are not enough. Agents must add or update real tests for the changed behavior, run them, and report whether they passed.

## Testing Guidelines

Vitest is the standard test runner. Keep unit tests near the implementation as `*.spec.ts`; keep API e2e tests in `apps/api/test/**/*.e2e-spec.ts`. AniList-related changes should usually touch the relevant client tests, API DTO tests, controller tests, and e2e tests when HTTP behavior changes.

Common test commands:

- `pnpm --filter @manverse/anilist-client test`
- `pnpm --filter api test`
- `pnpm --filter api test:e2e`
- `pnpm --filter api test:cov` for critical API paths

Do not mark a feature complete until the relevant tests exist and pass.

## AniList Feature Rules

Keep `@manverse/anilist-client` framework-agnostic. Validate AniList inputs and responses with Zod, keep `AnilistClient` methods as thin delegations, and export new runtime values and types through `packages/anilist-client/index.ts`.

AniList provider traffic should run client-side by default so upstream rate limits are distributed by end-user IPs instead of the API server egress IP. In `apps/api`, keep only AniList account-linking and token-custody concerns unless a server-side AniList endpoint is explicitly requested.

When adding or updating AniList features, aim for safe upgrades:

- preserve stable response shapes unless the task requires a contract change
- add coverage before relying on the change
- verify formatter, linter, type checker, build, and runtime behavior as needed
- finish by running the real tests that prove the feature works

## Commit & Pull Request Guidelines

Recent history follows Conventional Commits with scopes, for example `feat(api, anilist-client): ...`, `test(anilist): ...`, and `chore(auth): ...`. Keep commit subjects imperative and scope them to the touched workspace packages. Pull requests should include a short problem/solution summary, the commands you ran locally, related issue links when applicable, and API examples or screenshots when endpoints or docs change.

## Configuration & Safety

Keep secrets in `.env*` files and out of Git. Prefer the checked-in package scripts, Turbo tasks, and Compose files over ad hoc setup. When changing Prisma schema or Better Auth configuration, rerun the relevant setup and generation commands before opening a PR.
