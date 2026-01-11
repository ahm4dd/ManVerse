import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(process.cwd());
const runtimeDir = resolve(root, 'desktop', 'runtime');

const ensureDir = (path: string) => {
  mkdirSync(path, { recursive: true });
};

const copyRecursive = (from: string, to: string) => {
  if (!existsSync(from)) {
    throw new Error(`Missing path: ${from}`);
  }
  ensureDir(dirname(to));
  cpSync(from, to, { recursive: true, dereference: true });
};

const readJson = (path: string) => JSON.parse(readFileSync(path, 'utf8'));

const collectDependencies = (packagePath: string, target: Map<string, string>) => {
  const pkg = readJson(packagePath);
  const deps = pkg.dependencies ?? {};
  for (const [name, version] of Object.entries(deps)) {
    if (name.startsWith('@manverse/')) continue;
    if (!target.has(name)) {
      target.set(name, String(version));
    }
  }
};

const run = () => {
  if (existsSync(runtimeDir)) {
    rmSync(runtimeDir, { recursive: true, force: true });
  }
  ensureDir(runtimeDir);

  copyRecursive(resolve(root, 'app', 'dist'), join(runtimeDir, 'app', 'dist'));
  copyRecursive(resolve(root, 'api', 'src'), join(runtimeDir, 'api', 'src'));
  copyRecursive(resolve(root, 'api', 'package.json'), join(runtimeDir, 'api', 'package.json'));
  copyRecursive(resolve(root, 'shared'), join(runtimeDir, 'shared'));

  const dependencies = new Map<string, string>();
  collectDependencies(resolve(root, 'api', 'package.json'), dependencies);

  const packagesRoot = resolve(root, 'packages');
  const packageDirs = readdirSync(packagesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(packagesRoot, entry.name));

  packageDirs.forEach((pkgDir) => {
    collectDependencies(join(pkgDir, 'package.json'), dependencies);
  });

  const runtimePackageJson = {
    name: 'manverse-runtime',
    private: true,
    version: '1.0.0',
    type: 'module',
    dependencies: Object.fromEntries(dependencies.entries()),
  };

  writeFileSync(join(runtimeDir, 'package.json'), JSON.stringify(runtimePackageJson, null, 2));

  const install = spawnSync('bun', ['install', '--production'], {
    cwd: runtimeDir,
    stdio: 'inherit',
    env: {
      ...process.env,
    },
  });

  if (install.status !== 0) {
    throw new Error('Failed to install runtime dependencies.');
  }

  const scopeDir = join(runtimeDir, 'node_modules', '@manverse');
  ensureDir(scopeDir);

  packageDirs.forEach((pkgDir) => {
    const pkg = readJson(join(pkgDir, 'package.json'));
    const name = String(pkg.name || '');
    const shortName = name.includes('/') ? name.split('/')[1] : name;
    if (!shortName) return;
    copyRecursive(pkgDir, join(scopeDir, shortName));
  });
};

try {
  run();
  console.log('[manverse] prepared runtime resources');
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
