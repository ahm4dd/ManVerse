const fs = require('node:fs');
const path = require('node:path');

const buildAppRunScript = (executablePath) => `#!/bin/sh
APPDIR="$(dirname "$(readlink -f "$0")")"
export TMPDIR="\${XDG_CONFIG_HOME:-$HOME/.config}/ManVerse/tmp"
mkdir -p "$TMPDIR"
exec "$APPDIR/${executablePath}" --disable-dev-shm-usage --no-sandbox "$@"
`;

const resolveExecutablePath = (context) => {
  const binDirs = [
    path.join(context.appOutDir, 'usr', 'bin'),
    context.appOutDir,
  ];

  const preferred = [
    context.packager?.appInfo?.productFilename,
    context.packager?.executableName,
    context.packager?.appInfo?.name,
  ].filter(Boolean);

  for (const binDir of binDirs) {
    let entries = [];
    try {
      entries = fs.readdirSync(binDir);
    } catch {
      continue;
    }

    const executables = entries
      .map((name) => {
        const full = path.join(binDir, name);
        try {
          const stat = fs.statSync(full);
          if (!stat.isFile()) return null;
          if ((stat.mode & 0o111) === 0) return null;
          return { name, size: stat.size, full };
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .filter((entry) => {
        const name = entry.name;
        if (!name) return false;
        if (name === 'AppRun') return false;
        if (name.includes('chrome') || name.includes('crashpad')) return false;
        if (name.startsWith('lib') || name.endsWith('.so')) return false;
        if (name.endsWith('.pak') || name.endsWith('.bin')) return false;
        return true;
      });

    const preferredMatch = preferred.find((name) =>
      executables.some((entry) => entry.name === name),
    );
    if (preferredMatch) {
      const entry = executables.find((item) => item.name === preferredMatch);
      return path.relative(context.appOutDir, entry.full);
    }

    if (executables.length > 0) {
      const entry = executables.sort((a, b) => b.size - a.size)[0];
      return path.relative(context.appOutDir, entry.full);
    }
  }

  const fallbackName = preferred[0] || 'ManVerse';
  return fallbackName;
};

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'linux') {
    return;
  }

  const appOutDir = context.appOutDir;
  const executablePath = resolveExecutablePath(context);
  const appRunPath = path.join(appOutDir, 'AppRun');

  fs.writeFileSync(appRunPath, buildAppRunScript(executablePath), {
    mode: 0o755,
  });
};
