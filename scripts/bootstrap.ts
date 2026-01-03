import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

function ensureFile(targetPath: string, content: string) {
  if (existsSync(targetPath)) {
    return;
  }

  mkdirSync(dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, content, { encoding: 'utf8' });
  console.log(`[manverse] created ${targetPath}`);
}

const root = process.cwd();

const apiEnvPath = resolve(root, 'api', '.env');
const apiEnvContent = [
  'PORT=3001',
  'FRONTEND_URL=http://localhost:3000',
  'FRONTEND_AUTH_PATH=/',
  'CORS_ORIGIN=http://localhost:3000',
  'JWT_SECRET=dev-secret',
  'ANILIST_CLIENT_ID=',
  'ANILIST_CLIENT_SECRET=',
  'ANILIST_REDIRECT_URI=http://localhost:3001/api/auth/anilist/callback',
  'ANILIST_RPM=30',
  '',
].join('\n');

const appEnvPath = resolve(root, 'app', '.env.local');
const appEnvContent = ['VITE_API_URL=http://localhost:3001', ''].join('\n');

ensureFile(apiEnvPath, apiEnvContent);
ensureFile(appEnvPath, appEnvContent);
