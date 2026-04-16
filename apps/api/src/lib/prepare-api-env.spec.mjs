import { describe, expect, it, vi } from 'vitest';
import {
  copyExampleFile,
  createPrepareApiEnvPaths,
  prepareApiEnv,
} from '../../../../scripts/prepare-api-env.mjs';

describe('prepare-api-env script', () => {
  it('creates both env files from examples and replaces the secret placeholder', () => {
    const writes = new Map();
    const fileContents = new Map([
      ['/repo/apps/api/.env.example', 'BETTER_AUTH_SECRET=replace-me-with-base64-secret'],
      [
        '/repo/apps/api/.env.test.example',
        'BETTER_AUTH_SECRET=replace-me-with-base64-secret',
      ],
    ]);
    const log = vi.fn();

    const exitCode = prepareApiEnv({
      paths: createPrepareApiEnvPaths('/repo'),
      exists: (filePath) => fileContents.has(filePath) || writes.has(filePath),
      readFile: (filePath) => fileContents.get(filePath),
      writeFile: (filePath, contents) => {
        writes.set(filePath, contents);
      },
      generateSecret: () => 'generated-secret',
      log,
      warn: vi.fn(),
      error: vi.fn(),
    });

    expect(exitCode).toBe(0);
    expect(writes.get('/repo/apps/api/.env')).toContain('generated-secret');
    expect(writes.get('/repo/apps/api/.env.test')).toContain('generated-secret');
    expect(log).toHaveBeenCalledWith(
      'Created apps/api/.env from apps/api/.env.example.',
    );
    expect(log).toHaveBeenCalledWith(
      'Created apps/api/.env.test from apps/api/.env.test.example.',
    );
  });

  it('uses the existing development env file without overwriting it', () => {
    const writes = vi.fn();
    const log = vi.fn();

    const exitCode = prepareApiEnv({
      paths: createPrepareApiEnvPaths('/repo'),
      exists: (filePath) =>
        [
          '/repo/apps/api/.env.example',
          '/repo/apps/api/.env',
          '/repo/apps/api/.env.test.example',
          '/repo/apps/api/.env.test',
        ].includes(filePath),
      readFile: () => '',
      writeFile: writes,
      generateSecret: () => 'generated-secret',
      log,
      warn: vi.fn(),
      error: vi.fn(),
    });

    expect(exitCode).toBe(0);
    expect(writes).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith('Using existing apps/api/.env.');
  });

  it('warns and exits cleanly when the test env example file is missing', () => {
    const warn = vi.fn();

    const exitCode = prepareApiEnv({
      paths: createPrepareApiEnvPaths('/repo'),
      exists: (filePath) =>
        ['/repo/apps/api/.env.example', '/repo/apps/api/.env'].includes(filePath),
      readFile: () => '',
      writeFile: vi.fn(),
      generateSecret: () => 'generated-secret',
      log: vi.fn(),
      warn,
      error: vi.fn(),
    });

    expect(exitCode).toBe(0);
    expect(warn).toHaveBeenCalledWith(
      'apps/api/.env.test is missing and no apps/api/.env.test.example template was found.',
    );
  });

  it('fails when the primary env example file is missing', () => {
    const error = vi.fn();

    const exitCode = prepareApiEnv({
      paths: createPrepareApiEnvPaths('/repo'),
      exists: () => false,
      readFile: () => '',
      writeFile: vi.fn(),
      generateSecret: () => 'generated-secret',
      log: vi.fn(),
      warn: vi.fn(),
      error,
    });

    expect(exitCode).toBe(1);
    expect(error).toHaveBeenCalledWith(
      'Missing apps/api/.env.example, cannot prepare the API environment.',
    );
  });

  it('replaces every secret placeholder in a copied example file', () => {
    let writtenFileContents = '';

    copyExampleFile({
      sourcePath: '/repo/apps/api/.env.example',
      destinationPath: '/repo/apps/api/.env',
      readFile: () =>
        'FIRST=replace-me-with-base64-secret\nSECOND=replace-me-with-base64-secret',
      writeFile: (_filePath, fileContents) => {
        writtenFileContents = fileContents;
      },
      generateSecret: () => 'generated-secret',
    });

    expect(writtenFileContents).toBe(
      'FIRST=generated-secret\nSECOND=generated-secret',
    );
  });
});
