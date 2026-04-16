#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const args = new Set(process.argv.slice(2));
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

export function printUsage(log = console.log) {
  log(`Usage: node ./scripts/setup-api.mjs [--skip-install]

Bootstraps the workspace for apps/api by:
1. installing workspace dependencies
2. running the API setup task through Turbo`);
}

export function runCommand({
  command,
  commandArgs,
  cwd = rootDir,
  spawn = spawnSync,
  error = console.error,
}) {
  const result = spawn(command, commandArgs, {
    cwd,
    stdio: 'inherit',
  });

  if (result.error) {
    error(`Failed to run ${command}: ${result.error.message}`);
    return 1;
  }

  if (result.status !== 0) {
    return result.status ?? 1;
  }

  return 0;
}

export function setupApi({
  argv = process.argv.slice(2),
  cwd = rootDir,
  spawn = spawnSync,
  log = console.log,
  error = console.error,
  platform = process.platform,
} = {}) {
  const parsedArgs = new Set(argv);
  const shouldSkipInstall = parsedArgs.has('--skip-install');
  const shouldShowHelp = parsedArgs.has('--help') || parsedArgs.has('-h');
  const resolvedPnpmCommand = platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

  if (shouldShowHelp) {
    printUsage(log);
    return 0;
  }

  if (!shouldSkipInstall) {
    const installExitCode = runCommand({
      command: resolvedPnpmCommand,
      commandArgs: ['install'],
      cwd,
      spawn,
      error,
    });

    if (installExitCode !== 0) {
      return installExitCode;
    }
  }

  return runCommand({
    command: resolvedPnpmCommand,
    commandArgs: ['exec', 'turbo', 'run', 'setup', '--filter=api'],
    cwd,
    spawn,
    error,
  });
}

export function main() {
  process.exit(setupApi({ argv: process.argv.slice(2) }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main();
}
