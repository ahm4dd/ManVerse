# MVP Plan

## Purpose

ManVerse should be a backend-heavy platform project, not a thin client around AniList or a redirect layer to third-party providers.

The MVP should help us learn:

1. Product and domain modeling
2. Backend architecture and modular design
3. Background jobs and asynchronous workflows
4. Object storage and media delivery
5. Search, cataloging, and content publishing
6. Authentication, authorization, and moderation
7. Testing, logging, and production-minded engineering

The portfolio story should be:

> ManVerse is a manhwa platform with its own catalog, publishing workflow, reader progress system, comments, moderation, and optional AniList sync.

AniList is an integration, not the core of the system.

## Target Duration

The MVP target remains **3-4 months**, with a preference for a version that is truly finished over a larger version that is half-built.

## Product Definition

ManVerse is a platform where:

1. We own the catalog metadata in our database.
2. We can host and serve chapter/page manifests backed by object storage such as S3 or R2.
3. Staff can manage works and publish chapters.
4. Users can read, track progress, bookmark, comment, and build a library.
5. Users can optionally link AniList and sync progress to it.

This means the source of truth is always our platform database.

AniList is used for:

1. Account linking
2. Import or enrichment of metadata
3. Progress sync
4. External mapping

AniList is not used as the primary catalog or runtime dependency for core reading flows.

## Core Principles

1. Our database is the source of truth for catalog, chapters, progress, and community data.
2. External providers are adapters, not the foundation of the product.
3. The MVP must feel like a platform, not a proof of concept.
4. We build for future scale, but we do not force distributed complexity too early.
5. We prefer strong module boundaries, async jobs, and good contracts over premature microservices.
6. Every major feature should teach a real backend engineering lesson.

## Architecture Decision

### MVP architecture

The MVP should be built as a **modular monolith with asynchronous workers**.

That means:

1. One main API application
2. Clear internal domain modules
3. Shared database
4. Redis-backed queueing with BullMQ
5. Background workers for slow or retryable tasks
6. Object storage integration for chapter assets
7. Internal events and outbox-style patterns where useful

### Why not full microservices immediately

A full microservices architecture in the MVP would introduce:

1. More deployment and operational complexity
2. More networking and failure modes
3. More duplicated boilerplate
4. Harder local development
5. Less time spent on real domain features

That would be good learning eventually, but it is likely too expensive at the current project stage.

### How we stay microservice-ready

We should still design the system so it can evolve into microservices later:

1. Strong domain boundaries
2. Provider interfaces
3. Queue-driven async workflows
4. Events for cross-module side effects
5. Minimal direct module coupling
6. Separate infrastructure adapters from domain logic

The likely future extraction path is:

1. `catalog` and `publishing` remain close to the main API at first
2. `sync` becomes its own worker or service
3. `notifications` becomes its own worker or service
4. `search indexing` becomes its own worker or service
5. `media ingestion` becomes its own worker or service

## MVP Scope

### In scope

#### 1. Auth and identity

1. Email and password auth
2. Session management
3. AniList OAuth link and unlink
4. Role-based authorization

#### 2. Roles

The MVP should include roles from the start because they support the platform story and affect many later decisions.

Roles:

1. `admin`
2. `staff`
3. `mod`
4. `member`
5. `subscriber`

Suggested meaning:

1. `admin`: full platform control
2. `staff`: manage catalog and publishing
3. `mod`: moderate comments and users
4. `member`: normal authenticated user
5. `subscriber`: a member with premium entitlements

Important note:

`subscriber` should be modeled as a permission or entitlement layer, even if it is represented as a role initially. This avoids painting ourselves into a corner when billing or subscriptions become more complex.

#### 3. Catalog

The platform should own a first-party catalog for works.

Core features:

1. Work records in our database
2. Title variants and aliases
3. Cover image and banner metadata
4. Genres, tags, authors, artists
5. Status, type, language, country of origin
6. Search by title and aliases
7. External mappings to AniList and future providers

#### 4. Publishing

The MVP should support staff-managed publishing.

Core features:

1. Create and edit works
2. Create seasons or volumes only if needed later
3. Create chapters
4. Attach ordered page manifests to chapters
5. Store page asset references in object storage
6. Publish and unpublish chapters
7. Basic audit trail for publishing actions

#### 5. Reading platform

Users should be able to:

1. Browse works from our catalog
2. Read published chapters
3. Track reading progress per chapter and per work
4. Bookmark or save works to a library
5. Continue reading from last position

#### 6. AniList sync

AniList becomes an optional provider integration.

MVP features:

1. Link AniList account
2. Map a work in our catalog to an AniList media entry
3. Import selected AniList metadata into our catalog during onboarding or admin actions
4. Push progress updates from our platform to AniList
5. Pull current AniList library status for linked entries when needed

Important constraint:

Our progress model is primary. AniList sync is eventually consistent.

#### 7. Community

The MVP should include platform-native comments.

Core features:

1. Comments on works or chapters
2. Replies only if implementation stays simple, otherwise flat comments first
3. Reports
4. Moderation actions
5. Soft deletion or hidden state

#### 8. Notifications

The MVP should include at least one useful async notification flow:

1. Notify interested users when a tracked work gets a new published chapter

This can begin as in-app notifications or stored notification records without email.

#### 9. Background jobs

The MVP should use jobs for:

1. AniList sync
2. Metadata import or enrichment
3. Notification fan-out
4. Search indexing if needed
5. Media validation or processing hooks

#### 10. Observability and testing

Required in MVP:

1. Structured logging
2. Good error handling
3. Unit tests
4. Integration tests
5. E2E tests for core flows

Deferred:

1. Full tracing
2. Full metrics dashboards
3. Complex observability stack

## Explicitly Out of Scope for MVP

To protect the project from scope creep, the following are out of scope:

1. Full microservices deployment
2. Real-time messaging or chat
3. Community groups or forums
4. Billing and real payment processing
5. Recommendation engine
6. Full text search infrastructure beyond what is needed for a good MVP
7. Multi-provider scraping as a core reading strategy
8. Mirroring third-party comments
9. User-generated publishing by the public
10. Complex social features such as following users, DMs, or feeds

## Content Strategy

This is one of the most important product decisions.

### Recommended approach

Use a **hybrid content strategy**:

1. Seed a first-party catalog with metadata records
2. Publish a small, controlled set of readable demo content
3. Let staff manage and publish content manually
4. Support metadata enrichment and mapping from AniList

### Why this is the right compromise

1. It keeps the platform real
2. It gives us something fully owned to build around
3. It avoids making scraping the center of the product
4. It teaches publishing workflows and media handling
5. It makes the project presentable in a portfolio

### What about scraping

Scraping should not be the MVP identity.

If included later, it should be limited to:

1. Metadata discovery
2. Internal staff tooling
3. Experimental ingestion pipelines

It should not define the main public architecture or narrative of the MVP.

## Data Ownership Rules

The following rules should guide implementation:

1. A work in ManVerse has its own internal ID.
2. External systems are connected through mapping tables.
3. We never depend on AniList IDs as our primary identifiers.
4. We store our own normalized titles and aliases.
5. We store our own user progress and library state.
6. We store our own comments, moderation state, and publishing data.

## Suggested Domain Model

The exact schema will evolve, but the MVP should roughly include:

### Identity and access

1. `users`
2. `roles`
3. `user_roles`
4. `linked_accounts`
5. `sessions`
6. `subscriber_entitlements`

### Catalog

1. `works`
2. `work_titles`
3. `work_aliases`
4. `work_images`
5. `work_tags`
6. `work_people`
7. `work_relationships`
8. `external_mappings`

### Publishing

1. `chapters`
2. `chapter_pages`
3. `chapter_assets`
4. `publishing_revisions`
5. `publishing_events`

### Reader data

1. `libraries`
2. `bookmarks`
3. `reading_progress`
4. `reading_sessions`

### Community

1. `comments`
2. `comment_reports`
3. `moderation_actions`
4. `user_sanctions`

### Platform and async

1. `jobs` or queue payloads
2. `notifications`
3. `audit_logs`
4. `ingestion_runs`
5. `sync_runs`

## Module Plan

The backend should be organized around domain modules, not around controllers alone.

Suggested API modules:

1. `auth`
2. `identity`
3. `catalog`
4. `publishing`
5. `reader`
6. `library`
7. `community`
8. `moderation`
9. `sync`
10. `notifications`
11. `admin`

Suggested package boundaries in the monorepo:

1. `packages/anilist-client` for the AniList integration client
2. A future `packages/provider-contracts` for external provider interfaces
3. A future `packages/domain-types` or shared validation utilities if needed

## External Provider Strategy

AniList should be treated as the first provider implementation under a generic provider model.

Provider categories:

1. `identity providers`: OAuth and linked accounts
2. `metadata providers`: import and enrichment
3. `sync providers`: progress and library sync
4. `content providers`: optional future ingestion sources

MVP requirement:

Only AniList needs to be implemented.

Future requirement:

The interface should make it possible to add MyAnimeList or others later.

## API Strategy

The MVP should remain REST-first.

Why:

1. The repo already uses NestJS controllers cleanly
2. REST is enough for the MVP
3. It keeps the focus on domain and backend behavior
4. GraphQL can be explored later after the platform domain is stable

## Storage Strategy

For chapter pages and media references:

1. Support S3-compatible object storage
2. Store object keys and metadata in the database
3. Use presigned or proxied access patterns later if needed
4. Keep storage provider swappable

MVP approach:

1. Store metadata about assets in the DB
2. Assume the deployment team hosts the actual assets
3. Build the integration like a real product, even if local development uses mock or local-compatible storage

## Search Strategy

MVP search should focus on catalog usability, not search infrastructure complexity.

Start with:

1. Postgres-backed title and alias search
2. Normalized search fields
3. Ranking by exact match, alias match, and popularity fields if available

Defer:

1. Elasticsearch or OpenSearch
2. Advanced typo-tolerant search
3. Complex recommendation systems

## Authorization Strategy

Use role-based access control in the MVP.

Core authorization rules:

1. Only `admin` and `staff` can manage catalog and publishing
2. Only `admin` and `mod` can moderate comments and reports
3. Only authenticated users can comment, bookmark, and sync
4. Subscriber-only features should be guarded behind entitlements

## Testing Strategy

The MVP should be test-heavy because learning and confidence are major goals.

Required coverage areas:

1. Unit tests for domain services and adapters
2. Integration tests for database-backed modules
3. E2E tests for major user flows

Critical flows to test:

1. Sign up and sign in
2. AniList account link
3. Create and publish a work and chapter
4. Read a chapter and save progress
5. Sync progress to AniList
6. Post and moderate comments
7. Notification creation for new chapter releases

## Logging Strategy

MVP logging should be practical and consistent.

Log:

1. Auth events
2. Publishing actions
3. Moderation actions
4. Sync jobs
5. Failed provider requests
6. Background job retries and failures

Avoid:

1. Logging sensitive tokens
2. Over-logging noisy request internals

## Delivery Plan and Build Order

This is the recommended implementation order.

### Phase 0: Foundation

Goal:

Set the project foundation so later modules are easy to add.

Deliverables:

1. Clean app structure by domain
2. Prisma baseline refactor away from auth-only schema
3. Environment configuration cleanup
4. Shared error handling and logging approach
5. Queue and Redis foundation

Exit criteria:

1. The project has clear module boundaries
2. The DB can represent users, roles, and catalog entities
3. Background jobs can be enqueued and processed

### Phase 1: Identity and roles

Goal:

Finish identity as a platform feature, not just auth scaffolding.

Deliverables:

1. Email and password auth
2. User profile endpoint
3. Roles and guards
4. Admin seeding strategy
5. Linked account records for AniList

Exit criteria:

1. We can create users
2. We can assign roles
3. We can authorize admin and staff actions

### Phase 2: Catalog core

Goal:

Own the content metadata layer.

Deliverables:

1. Work model
2. Title aliases
3. Search endpoint
4. Work detail endpoint
5. External mapping model
6. Admin CRUD for works

Exit criteria:

1. We can create and search works in our DB
2. Works are independent from AniList
3. Works can be mapped to AniList entries

### Phase 3: Publishing and storage

Goal:

Make the platform capable of serving first-party readable content.

Deliverables:

1. Chapter model
2. Page manifest model
3. Object storage abstraction
4. Admin chapter publishing flow
5. Publish and unpublish states

Exit criteria:

1. Staff can create works and chapters
2. Chapters can reference stored page assets
3. Published chapters are readable through the platform

### Phase 4: Reader and library

Goal:

Make the product feel like a real reader platform.

Deliverables:

1. Library or bookmark model
2. Reading progress tracking
3. Continue reading endpoint
4. Reading history

Exit criteria:

1. A member can save a work
2. A member can read chapters
3. Progress is persisted and queryable

### Phase 5: AniList sync

Goal:

Integrate AniList as an optional sync provider.

Deliverables:

1. AniList account link
2. Work-to-AniList mapping
3. Progress sync job
4. Metadata import or enrichment flow
5. Retryable queue-backed sync pipeline

Exit criteria:

1. A linked user can sync progress to AniList
2. Sync failures are observable and retryable
3. The platform still works if AniList is unavailable

### Phase 6: Community and moderation

Goal:

Turn the product into a platform, not just a reader.

Deliverables:

1. Comments
2. Comment reports
3. Moderation actions
4. User sanction model

Exit criteria:

1. Users can comment on works or chapters
2. Mods can report, hide, and moderate content
3. Moderation state is persisted and auditable

### Phase 7: Notifications and polish

Goal:

Close the MVP with the right platform loops and quality bar.

Deliverables:

1. New chapter notifications
2. Better audit logs
3. Test coverage improvements
4. Documentation and API cleanup
5. Seed data for demo and portfolio presentation

Exit criteria:

1. Users can receive release notifications
2. The main flows are tested
3. The project is demoable and portfolio-ready

## Recommended MVP Milestones

The MVP is complete when the following user story is possible:

1. A guest creates an account
2. The user browses a first-party ManVerse catalog
3. A staff member has already published a readable work with chapters
4. The user reads chapters and progress is saved
5. The user saves the work to their library
6. The user links AniList
7. The user syncs progress for mapped works
8. The user comments on a chapter
9. A moderator can handle abusive comments
10. The user receives a notification when a followed work gets a new chapter

If that story works end to end, the MVP is strong.

## Future Phases After MVP

These are good follow-up projects after the MVP is stable:

1. Billing and real subscriptions
2. Premium features for subscribers
3. Advanced search and recommendation systems
4. Internal admin analytics
5. Search indexing workers
6. Metadata ingestion pipelines
7. Provider scraping experiments for staff tooling
8. GraphQL API
9. Service extraction into microservices
10. Real-time systems and messaging

## Final Scope Guardrails

If a feature does not clearly strengthen one of these pillars, it should be deferred:

1. Owned catalog
2. Publishing workflow
3. Reading platform
4. Optional AniList sync
5. Community and moderation
6. Backend engineering depth

## Summary

The MVP is no longer:

1. A thin AniList search and redirect project
2. A provider-scraping wrapper
3. A client-led experiment

The MVP is:

1. A backend-heavy manhwa platform
2. A first-party catalog and publishing system
3. A real reader product with progress and community features
4. A provider-integrated system where AniList is optional and swappable
5. A foundation that can later evolve into more distributed architecture
