import { describe, expect, it, vi } from 'vitest';
import { setupApi } from '../../../../scripts/setup-api.mjs';

describe('setup-api script', () => {
  it('prints usage and exits cleanly for help', () => {
    const log = vi.fn();

    const exitCode = setupApi({
      argv: ['--help'],
      log,
      error: vi.fn(),
      spawn: vi.fn(),
    });

    expect(exitCode).toBe(0);
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('Usage: node ./scripts/setup-api.mjs [--skip-install]'),
    );
  });

  it('skips dependency installation when --skip-install is provided', () => {
    const spawn = vi.fn().mockReturnValue({ status: 0 });

    const exitCode = setupApi({
      argv: ['--skip-install'],
      spawn,
      cwd: '/repo',
      log: vi.fn(),
      error: vi.fn(),
      platform: 'linux',
    });

    expect(exitCode).toBe(0);
    expect(spawn).toHaveBeenCalledTimes(1);
    expect(spawn).toHaveBeenCalledWith(
      'pnpm',
      ['exec', 'turbo', 'run', 'setup', '--filter=api'],
      {
        cwd: '/repo',
        stdio: 'inherit',
      },
    );
  });

  it('installs dependencies before running turbo setup by default', () => {
    const spawn = vi.fn().mockReturnValue({ status: 0 });

    const exitCode = setupApi({
      argv: [],
      spawn,
      cwd: '/repo',
      log: vi.fn(),
      error: vi.fn(),
      platform: 'linux',
    });

    expect(exitCode).toBe(0);
    expect(spawn).toHaveBeenNthCalledWith(1, 'pnpm', ['install'], {
      cwd: '/repo',
      stdio: 'inherit',
    });
    expect(spawn).toHaveBeenNthCalledWith(
      2,
      'pnpm',
      ['exec', 'turbo', 'run', 'setup', '--filter=api'],
      {
        cwd: '/repo',
        stdio: 'inherit',
      },
    );
  });

  it('returns a failing exit code when a spawned command cannot start', () => {
    const error = vi.fn();
    const spawn = vi.fn().mockReturnValue({
      error: new Error('spawn failed'),
      status: null,
    });

    const exitCode = setupApi({
      argv: ['--skip-install'],
      spawn,
      cwd: '/repo',
      log: vi.fn(),
      error,
      platform: 'linux',
    });

    expect(exitCode).toBe(1);
    expect(error).toHaveBeenCalledWith(
      'Failed to run pnpm: spawn failed',
    );
  });
});
