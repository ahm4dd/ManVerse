import { describe, expect, it, vi } from 'vitest';
import {
  createComposeTargets,
  dockerCompose,
  ensureComposeFiles,
} from '../../../../scripts/docker-compose.mjs';

describe('docker-compose script', () => {
  it('prints usage and exits with 0 when help is requested', () => {
    const error = vi.fn();

    const exitCode = dockerCompose({
      argv: ['--help'],
      error,
    });

    expect(exitCode).toBe(0);
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('Usage: node ./scripts/docker-compose.mjs <dev|test>'),
    );
  });

  it('fails for an unknown compose target', () => {
    const error = vi.fn();

    const exitCode = dockerCompose({
      argv: ['staging'],
      error,
    });

    expect(exitCode).toBe(1);
    expect(error).toHaveBeenCalledWith(
      'Unknown Docker target "staging". Use "dev" or "test".',
    );
  });

  it('copies the env example when the target env file is missing', () => {
    const log = vi.fn();
    const copyFile = vi.fn();
    const copiedFiles = new Set();
    const composeTarget = createComposeTargets('/repo').test;

    const exitCode = ensureComposeFiles({
      composeTarget,
      baseDir: '/repo',
      exists: (filePath) =>
        filePath === composeTarget.composeFile ||
        filePath === composeTarget.exampleFile ||
        copiedFiles.has(filePath),
      copyFile: (sourcePath, destinationPath) => {
        copiedFiles.add(destinationPath);
        copyFile(sourcePath, destinationPath);
      },
      log,
      error: vi.fn(),
    });

    expect(exitCode).toBe(0);
    expect(copyFile).toHaveBeenCalledWith(
      composeTarget.exampleFile,
      composeTarget.envFile,
    );
    expect(log).toHaveBeenCalledWith(
      'Created docker/.env.test from docker/.env.test.example.',
    );
  });

  it('runs docker compose with default up arguments', () => {
    const spawn = vi.fn().mockReturnValue({ status: 0 });

    const exitCode = dockerCompose({
      argv: ['test'],
      baseDir: '/repo',
      exists: () => true,
      copyFile: vi.fn(),
      spawn,
      log: vi.fn(),
      error: vi.fn(),
      platform: 'linux',
    });

    expect(exitCode).toBe(0);
    expect(spawn).toHaveBeenCalledWith(
      'docker',
      [
        'compose',
        '--env-file',
        '/repo/docker/.env.test',
        '-f',
        '/repo/docker/compose.test.yaml',
        'up',
        '-d',
      ],
      {
        cwd: '/repo',
        stdio: 'inherit',
      },
    );
  });

  it('returns 1 when docker compose cannot start', () => {
    const error = vi.fn();
    const spawn = vi.fn().mockReturnValue({
      error: new Error('docker missing'),
      status: null,
    });

    const exitCode = dockerCompose({
      argv: ['dev', 'ps'],
      baseDir: '/repo',
      exists: () => true,
      copyFile: vi.fn(),
      spawn,
      log: vi.fn(),
      error,
      platform: 'linux',
    });

    expect(exitCode).toBe(1);
    expect(error).toHaveBeenCalledWith(
      'Failed to run Docker Compose: docker missing. Is Docker installed and available on PATH?',
    );
  });
});
