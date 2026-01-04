const { spawn } = require('node:child_process');
const path = require('node:path');

const electronBinary = require('electron');
const env = { ...process.env };

delete env.ELECTRON_RUN_AS_NODE;
const args = process.argv.slice(2);

const child = spawn(electronBinary, ['.'].concat(args), {
  stdio: 'inherit',
  cwd: path.resolve(__dirname),
  env,
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
