#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const apiDir = path.join(rootDir, 'apps', 'api');
const envExamplePath = path.join(apiDir, '.env.example');
const envPath = path.join(apiDir, '.env');
const testEnvExamplePath = path.join(apiDir, '.env.test.example');
const testEnvPath = path.join(apiDir, '.env.test');
const secretPlaceholder = 'replace-me-with-base64-secret';

function copyExampleFile(sourcePath, destinationPath) {
  const fileContents = readFileSync(sourcePath, 'utf8');
  const generatedSecret = randomBytes(48).toString('base64');
  const nextContents = fileContents.replaceAll(secretPlaceholder, generatedSecret);

  writeFileSync(destinationPath, nextContents, 'utf8');
}

if (!existsSync(envExamplePath)) {
  console.error('Missing apps/api/.env.example, cannot prepare the API environment.');
  process.exit(1);
}

if (!existsSync(envPath)) {
  copyExampleFile(envExamplePath, envPath);
  console.log('Created apps/api/.env from apps/api/.env.example.');
} else {
  console.log('Using existing apps/api/.env.');
}

if (!existsSync(testEnvPath)) {
  if (!existsSync(testEnvExamplePath)) {
    console.warn(
      'apps/api/.env.test is missing and no apps/api/.env.test.example template was found.',
    );
    process.exit(0);
  }

  copyExampleFile(testEnvExamplePath, testEnvPath);
  console.log('Created apps/api/.env.test from apps/api/.env.test.example.');
}
