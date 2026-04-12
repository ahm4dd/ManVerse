#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = new Set(process.argv.slice(2));
const skipInstall = args.has('--skip-install');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

if (args.has('--help') || args.has('-h')) {
  console.log(`Usage: node ./scripts/setup-api.mjs [--skip-install]

Bootstraps the workspace for apps/api by:
1. installing workspace dependencies
2. running the API setup task through Turbo`);
  process.exit(0);
}

const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    cwd: rootDir,
    stdio: 'inherit',
  });

  if (result.error) {
    console.error(`Failed to run ${command}: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (!skipInstall) {
  run(pnpmCommand, ['install']);
}

run(pnpmCommand, ['exec', 'turbo', 'run', 'setup', '--filter=api']);
