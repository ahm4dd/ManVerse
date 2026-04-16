#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const secretPlaceholder = 'replace-me-with-base64-secret';

export function createPrepareApiEnvPaths(baseDir = rootDir) {
  const apiDir = path.join(baseDir, 'apps', 'api');

  return {
    envExamplePath: path.join(apiDir, '.env.example'),
    envPath: path.join(apiDir, '.env'),
    testEnvExamplePath: path.join(apiDir, '.env.test.example'),
    testEnvPath: path.join(apiDir, '.env.test'),
  };
}

export function copyExampleFile({
  sourcePath,
  destinationPath,
  readFile = readFileSync,
  writeFile = writeFileSync,
  generateSecret = () => randomBytes(48).toString('base64'),
}) {
  const fileContents = readFile(sourcePath, 'utf8');
  const nextContents = fileContents.replaceAll(
    secretPlaceholder,
    generateSecret(),
  );

  writeFile(destinationPath, nextContents, 'utf8');
}

export function prepareApiEnv({
  paths = createPrepareApiEnvPaths(),
  exists = existsSync,
  readFile = readFileSync,
  writeFile = writeFileSync,
  generateSecret = () => randomBytes(48).toString('base64'),
  log = console.log,
  warn = console.warn,
  error = console.error,
} = {}) {
  if (!exists(paths.envExamplePath)) {
    error('Missing apps/api/.env.example, cannot prepare the API environment.');
    return 1;
  }

  if (!exists(paths.envPath)) {
    copyExampleFile({
      sourcePath: paths.envExamplePath,
      destinationPath: paths.envPath,
      readFile,
      writeFile,
      generateSecret,
    });
    log('Created apps/api/.env from apps/api/.env.example.');
  } else {
    log('Using existing apps/api/.env.');
  }

  if (exists(paths.testEnvPath)) {
    return 0;
  }

  if (!exists(paths.testEnvExamplePath)) {
    warn(
      'apps/api/.env.test is missing and no apps/api/.env.test.example template was found.',
    );
    return 0;
  }

  copyExampleFile({
    sourcePath: paths.testEnvExamplePath,
    destinationPath: paths.testEnvPath,
    readFile,
    writeFile,
    generateSecret,
  });
  log('Created apps/api/.env.test from apps/api/.env.test.example.');

  return 0;
}

export function main() {
  process.exit(prepareApiEnv());
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main();
}
