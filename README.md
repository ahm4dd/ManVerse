# ManVerse

A project that was initially aiming to aggregate mulitple manhwa/manga providers, providing features like tracking, downloading, etc. We make reading more accessible and easier for everyone.

**Read and track your favorite manhwa/manga from multiple providers in one place, download chapters for offline reading, and more!**

> Note: This project is currently in development and is not yet ready for production use.

## Goals

We aim to provide a seamless experience for our users to read and track their favorite manhwa/manga with the following features:

- Provide a way to aggregate content from multiple manhwa/manga providers.
- Provide a way to track the progress of the user.
- Provide a way to download chapters for offline reading.
- Provide a way to get updates along with the new chapter sent to the user.
- Provide a way to rate and review the content.
- Provide a way to search for content.
- Provide a way to filter content based on genre, author, rating, popularity, or whatever the provider provides.

## Methodology and Architecture

This project is a **monorepo**, meaning all the code is in a single repository.

For the project architecture, we will use a `Modular Monolith Architecture`.

### Technology

#### Tech Stack

- Bun (Runtime)
- TypeScript (Language)
- Sqlite or Postgres (Database)

#### Libraries

- Puppeteer (For web scraping)
- Zod (For schema validation)
- Ink (Terminal UI with React)
- Drizzle (Database)
- Vitest (Testing)
- Bun (Testing)

### Why Modular Monolith Architecture?

#### Pros

- **User Experience**: A Modular Monolithic Architecture provides a better user experience as it allows for a more seamless experience for the user. The user is **more likely** to use the application on their device (meaning everything is client side and not dependent on the server).

- **Performance**: A Modular Monolithic Architecture provides better performance as it allows for a more efficient use of resources. Imagine if you have to run a server, a client, bunch of services, all on one machine. It would be a lot of resources to use and it would be a lot of work to maintain.

- **Clearer Code**: A Modular Monolithic Architecture provides a clearer codebase as it allows for a more organized and structured codebase, and easier to understand and maintain the codebase.

- **Modularity**: A Modular Monolithic Architecture provides modularity as it allows for a more modular codebase, and easier to understand and maintain the codebase. Making us able to transition to a microservices architecture in the future.

#### Cons

- **Scalability**: A Modular Monolithic Architecture is not as scalable. What if you want to deploy the application on multiple machines? What if you want an API running somewhere and the services running somewhere else?.

- **Tightly Coupled**: A Modular Monolithic Architecture is tightly coupled in a way (Not as much as a pure Monolithic Architecture, that one can be painful to maintain). Meaning that things are put together in one place. What if you want to change the UI? What if you want to change the backend? What if you want to change the database? What if you want to change the services? What if you want to change the API? What if you want to change the client? What if you want to change the server?

> Note: The project is as **Modular Monolith Architecture**. It means that it still keeps a single deployment but organizes the code into loosely-coupled, domain-specific modules. This allows for a more maintainable architecture.

### Proposed Project Structure

```bash
manverse/
├── apps/ # Each app is a separate project that should be deployed separately.
├────── manverse-api/
├────── manverse-scraper/
├────── manverse-tui/
├────── uploader/
├── packages/ # Each package is a separate project. that can be used by other projects.
├────── core/
├────── pdf/
├────── scrapers/
├── package.json
├── README.md
├── tsconfig.json
├── LICENCE
├── vitest.config.ts # Maybe we will use Bun test instead.
├── drizzle.config.ts # Maybe will remove because we are not using a database yet
├── eslink.config.ts
├── .gitignore
├── .prettierrc
└── bun.lock
```

## Installation

Probably none of this work at the moment, we are still in the planning phase.

### Install dependencies

```bash
bun install
```

### Running the project

```bash
bun run dev
```

### Running TUI

```bash
bun run tui
```

## Future Plans

### Short Term

- Add more providers
- Make the TUI, and make it beautiful, please.
- Make the scraper more efficient.
- Follow Architecture principles and best practices.
- Make the PDF generator library.
- Make the core library.
- Make the scraper library.
- Make sure the packages (libraries) are well structured and easy to use, and not dependent on the other packages (libraries).
- Make sure libraries could be reused by other projects and not a single project (easy to swap things out and add new things or replace things).
- Package it to a single binary/deployable unit for linux, windows, and macos.

### Medium Term

- Add tests, not full coverage, but important tests.
- Add Telegram upload option.
- Cron job for daily updates for your manhwa/manga.

### Long Term (Avoid for now)

- Change to a microservices architecture while maintaining the monorepo structure, but also keep the single deployment option. (Adding API, adding database, etc. But still keep the single deployment option).
- Add a web interface.
- Add a mobile interface.
- Add a desktop interface.
- Add a CLI interface.
