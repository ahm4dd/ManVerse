import {
  chmodSync,
  existsSync,
  mkdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

type PlatformTarget = 'linux-x64' | 'windows-x64';

const args = process.argv.slice(2);
const getArg = (flag: string) => {
  const index = args.indexOf(flag);
  if (index === -1) return null;
  return args[index + 1] ?? null;
};

const requestedPlatform = getArg('--platform') as PlatformTarget | null;
const isAll = args.includes('--all');
const providedVersion = process.env.BUN_BUNDLE_VERSION ?? getArg('--version');
const runtimeVersion =
  typeof Bun !== 'undefined' && typeof Bun.version === 'string' ? Bun.version : null;
const version = (providedVersion || runtimeVersion || '1.3.5').replace(/^v/, '');

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, '..');
const bundleRoot = resolve(root, 'desktop', 'bundled-bun');

const normalizePlatform = (platform: string): PlatformTarget => {
  if (platform === 'win32') return 'windows-x64';
  if (platform === 'linux') return 'linux-x64';
  throw new Error(`Unsupported platform: ${platform}`);
};

const targets: PlatformTarget[] = isAll
  ? ['linux-x64', 'windows-x64']
  : [requestedPlatform ?? normalizePlatform(process.platform)];

const downloadTo = async (url: string, filePath: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  writeFileSync(filePath, Buffer.from(arrayBuffer));
};

const unzip = (zipPath: string, outputDir: string) => {
  if (process.platform === 'win32') {
    const command = `Expand-Archive -LiteralPath '${zipPath}' -DestinationPath '${outputDir}' -Force`;
    const result = spawnSync('powershell', ['-NoProfile', '-Command', command], {
      stdio: 'inherit',
    });
    if (result.status !== 0) {
      throw new Error('Failed to extract bun zip via PowerShell.');
    }
    return;
  }

  const result = spawnSync('unzip', ['-o', zipPath, '-d', outputDir], { stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error('Failed to extract bun zip via unzip.');
  }
};

const ensureExecutable = (binPath: string) => {
  if (process.platform !== 'win32') {
    chmodSync(binPath, 0o755);
  }
};

const platformToUrl = (target: PlatformTarget) => {
  if (target === 'linux-x64') {
    return `https://github.com/oven-sh/bun/releases/download/bun-v${version}/bun-linux-x64.zip`;
  }
  return `https://github.com/oven-sh/bun/releases/download/bun-v${version}/bun-windows-x64.zip`;
};

const platformToBinary = (target: PlatformTarget) =>
  target === 'windows-x64' ? 'bun.exe' : 'bun';

const platformToFolder = (target: PlatformTarget) => `bun-${target}`;

const bundleFor = async (target: PlatformTarget) => {
  const outputDir = resolve(bundleRoot, target);
  if (existsSync(outputDir)) {
    rmSync(outputDir, { recursive: true, force: true });
  }
  mkdirSync(outputDir, { recursive: true });

  const zipPath = resolve(bundleRoot, `bun-${target}-${version}.zip`);
  const url = platformToUrl(target);

  console.log(`[manverse] downloading bun ${version} (${target})`);
  await downloadTo(url, zipPath);

  console.log(`[manverse] extracting ${zipPath}`);
  unzip(zipPath, outputDir);

  let bunPath = resolve(outputDir, platformToBinary(target));
  if (!existsSync(bunPath)) {
    const nested = resolve(outputDir, platformToFolder(target), platformToBinary(target));
    if (existsSync(nested)) {
      bunPath = resolve(outputDir, platformToBinary(target));
      renameSync(nested, bunPath);
      const nestedDir = resolve(outputDir, platformToFolder(target));
      if (existsSync(nestedDir)) {
        rmSync(nestedDir, { recursive: true, force: true });
      }
    }
  }

  if (!existsSync(bunPath)) {
    throw new Error(`bun binary not found after extraction: ${bunPath}`);
  }

  ensureExecutable(bunPath);
  rmSync(zipPath, { force: true });
};

const run = async () => {
  mkdirSync(bundleRoot, { recursive: true });
  for (const target of targets) {
    await bundleFor(target);
  }
};

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
