#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const dockerDir = path.join(rootDir, "docker");
const dockerCommand = process.platform === "win32" ? "docker.exe" : "docker";

const composeTargets = {
  dev: {
    composeFile: path.join(dockerDir, "compose.dev.yaml"),
    envFile: path.join(dockerDir, ".env.development"),
    exampleFile: path.join(dockerDir, ".env.development.example"),
  },
  development: {
    composeFile: path.join(dockerDir, "compose.dev.yaml"),
    envFile: path.join(dockerDir, ".env.development"),
    exampleFile: path.join(dockerDir, ".env.development.example"),
  },
  test: {
    composeFile: path.join(dockerDir, "compose.test.yaml"),
    envFile: path.join(dockerDir, ".env.test"),
    exampleFile: path.join(dockerDir, ".env.test.example"),
  },
};

function printUsage() {
  console.error(`Usage: node ./scripts/docker-compose.mjs <dev|test> [docker compose args...]

Examples:
  pnpm docker:dev
  pnpm docker:dev -- down -v
  pnpm docker:test -- up -d
  pnpm docker:test -- logs -f api-db-test`);
}

const [target, ...composeArgsInput] = process.argv.slice(2);

if (!target || target === "--help" || target === "-h") {
  printUsage();
  process.exit(target ? 0 : 1);
}

const composeTarget = composeTargets[target];

if (!composeTarget) {
  console.error(`Unknown Docker target "${target}". Use "dev" or "test".`);
  printUsage();
  process.exit(1);
}

for (const filePath of [composeTarget.composeFile, composeTarget.envFile]) {
  if (filePath === composeTarget.envFile && !existsSync(filePath)) {
    if (!existsSync(composeTarget.exampleFile)) {
      console.error(
        `Missing required file: ${path.relative(rootDir, filePath)}`,
      );
      process.exit(1);
    }

    copyFileSync(composeTarget.exampleFile, composeTarget.envFile);
    console.log(
      `Created ${path.relative(rootDir, composeTarget.envFile)} from ${path.relative(rootDir, composeTarget.exampleFile)}.`,
    );
  }

  if (!existsSync(filePath)) {
    console.error(`Missing required file: ${path.relative(rootDir, filePath)}`);
    process.exit(1);
  }
}

const composeArgs =
  composeArgsInput.length > 0 ? composeArgsInput : ["up", "-d"];

const result = spawnSync(
  dockerCommand,
  [
    "compose",
    "--env-file",
    composeTarget.envFile,
    "-f",
    composeTarget.composeFile,
    ...composeArgs,
  ],
  {
    cwd: rootDir,
    stdio: "inherit",
  },
);

if (result.error) {
  console.error(
    `Failed to run Docker Compose: ${result.error.message}. Is Docker installed and available on PATH?`,
  );
  process.exit(1);
}

process.exit(result.status ?? 1);
