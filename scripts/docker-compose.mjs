#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

export function createComposeTargets(baseDir = rootDir) {
  const dockerDir = path.join(baseDir, 'docker');

  return {
    dev: {
      composeFile: path.join(dockerDir, 'compose.dev.yaml'),
      envFile: path.join(dockerDir, '.env.development'),
      exampleFile: path.join(dockerDir, '.env.development.example'),
    },
    development: {
      composeFile: path.join(dockerDir, 'compose.dev.yaml'),
      envFile: path.join(dockerDir, '.env.development'),
      exampleFile: path.join(dockerDir, '.env.development.example'),
    },
    test: {
      composeFile: path.join(dockerDir, 'compose.test.yaml'),
      envFile: path.join(dockerDir, '.env.test'),
      exampleFile: path.join(dockerDir, '.env.test.example'),
    },
  };
}

export function printUsage(error = console.error) {
  error(`Usage: node ./scripts/docker-compose.mjs <dev|test> [docker compose args...]

Examples:
  pnpm docker:dev
  pnpm docker:dev -- down -v
  pnpm docker:test -- up -d
  pnpm docker:test -- logs -f api-db-test`);
}

export function ensureComposeFiles({
  composeTarget,
  baseDir = rootDir,
  exists = existsSync,
  copyFile = copyFileSync,
  log = console.log,
  error = console.error,
}) {
  for (const filePath of [composeTarget.composeFile, composeTarget.envFile]) {
    if (filePath === composeTarget.envFile && !exists(filePath)) {
      if (!exists(composeTarget.exampleFile)) {
        error(`Missing required file: ${path.relative(baseDir, filePath)}`);
        return 1;
      }

      copyFile(composeTarget.exampleFile, composeTarget.envFile);
      log(
        `Created ${path.relative(baseDir, composeTarget.envFile)} from ${path.relative(baseDir, composeTarget.exampleFile)}.`,
      );
    }

    if (!exists(filePath)) {
      error(`Missing required file: ${path.relative(baseDir, filePath)}`);
      return 1;
    }
  }

  return 0;
}

export function dockerCompose({
  argv = process.argv.slice(2),
  baseDir = rootDir,
  exists = existsSync,
  copyFile = copyFileSync,
  spawn = spawnSync,
  log = console.log,
  error = console.error,
  platform = process.platform,
} = {}) {
  const [target, ...composeArgsInput] = argv;

  if (!target || target === '--help' || target === '-h') {
    printUsage(error);
    return target ? 0 : 1;
  }

  const composeTarget = createComposeTargets(baseDir)[target];

  if (!composeTarget) {
    error(`Unknown Docker target "${target}". Use "dev" or "test".`);
    printUsage(error);
    return 1;
  }

  const fileExitCode = ensureComposeFiles({
    composeTarget,
    baseDir,
    exists,
    copyFile,
    log,
    error,
  });

  if (fileExitCode !== 0) {
    return fileExitCode;
  }

  const composeArgs =
    composeArgsInput.length > 0 ? composeArgsInput : ['up', '-d'];
  const dockerCommand = platform === 'win32' ? 'docker.exe' : 'docker';

  const result = spawn(
    dockerCommand,
    [
      'compose',
      '--env-file',
      composeTarget.envFile,
      '-f',
      composeTarget.composeFile,
      ...composeArgs,
    ],
    {
      cwd: baseDir,
      stdio: 'inherit',
    },
  );

  if (result.error) {
    error(
      `Failed to run Docker Compose: ${result.error.message}. Is Docker installed and available on PATH?`,
    );
    return 1;
  }

  return result.status ?? 1;
}

export function main() {
  process.exit(dockerCompose({ argv: process.argv.slice(2) }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main();
}
