import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

type BumpKind = 'major' | 'minor' | 'patch';

const args = process.argv.slice(2);
const getArgValue = (flag: string) => {
  const index = args.indexOf(flag);
  if (index === -1) return null;
  return args[index + 1] ?? null;
};

const bumpKind = getArgValue('--bump') as BumpKind | null;
const setVersion = getArgValue('--set');
const dryRun = args.includes('--dry-run');

const root = process.cwd();
const desktopPackagePath = resolve(root, 'desktop', 'package.json');

const semverPattern = /^\d+\.\d+\.\d+$/;

const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;

const bumpVersion = (current: string, kind: BumpKind): string => {
  if (!semverPattern.test(current)) {
    throw new Error(`Invalid current version: ${current}`);
  }
  const [major, minor, patch] = current.split('.').map((part) => Number(part));
  if (kind === 'major') return `${major + 1}.0.0`;
  if (kind === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
};

const getPackageJsonPaths = () => {
  const paths = [
    resolve(root, 'package.json'),
    resolve(root, 'app', 'package.json'),
    resolve(root, 'api', 'package.json'),
    resolve(root, 'desktop', 'package.json'),
  ];
  const packagesDir = resolve(root, 'packages');
  if (existsSync(packagesDir)) {
    const entries = readdirSync(packagesDir, { withFileTypes: true });
    entries.forEach((entry) => {
      if (!entry.isDirectory()) return;
      const pkgPath = resolve(packagesDir, entry.name, 'package.json');
      if (existsSync(pkgPath)) {
        paths.push(pkgPath);
      }
    });
  }
  return paths;
};

const updatePackageVersion = (path: string, version: string) => {
  const pkg = readJson<{ version?: string }>(path);
  if (!pkg.version || pkg.version === version) return false;
  pkg.version = version;
  if (!dryRun) {
    writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
  }
  return true;
};

const updateApiOpenApiVersion = (version: string) => {
  const indexPath = resolve(root, 'api', 'src', 'index.ts');
  if (!existsSync(indexPath)) return false;
  const file = readFileSync(indexPath, 'utf8');
  const updated = file.replace(
    /version:\s*['"]\d+\.\d+\.\d+['"]/,
    `version: '${version}'`,
  );
  if (updated === file) return false;
  if (!dryRun) {
    writeFileSync(indexPath, updated, 'utf8');
  }
  return true;
};

const currentDesktop = readJson<{ version?: string }>(desktopPackagePath).version;
if (!currentDesktop) {
  throw new Error('desktop/package.json is missing a version.');
}

const nextVersion = setVersion
  ? setVersion
  : bumpKind
    ? bumpVersion(currentDesktop, bumpKind)
    : currentDesktop;

if (!semverPattern.test(nextVersion)) {
  throw new Error(`Invalid version "${nextVersion}". Use x.y.z`);
}

const packagePaths = getPackageJsonPaths();
const changed = packagePaths.filter((path) => updatePackageVersion(path, nextVersion));
const openApiChanged = updateApiOpenApiVersion(nextVersion);

if (!dryRun) {
  console.log(`[manverse] version -> ${nextVersion}`);
  if (changed.length) {
    console.log(`[manverse] updated ${changed.length} package.json files`);
  }
  if (openApiChanged) {
    console.log('[manverse] updated api/src/index.ts OpenAPI version');
  }
}
