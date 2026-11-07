// Starts the API for the manual screenshots (docs/MANUAL.md): recreates a dedicated database, loads the full
// development seed (product photos and sample activity included) and runs the HTTP server and the outbox worker.
// Stops both on SIGTERM. The capture itself is apps/e2e/manual (pnpm --filter @rc/e2e manual:screenshots).
import { spawn, spawnSync } from 'node:child_process';
import { recreateDatabase } from './database.js';

const databaseUrl =
  process.env.MANUAL_DATABASE_URL ?? 'postgres://castro:castro@localhost:5433/castro_manual';
await recreateDatabase(databaseUrl, 'manual');

const env = {
  ...process.env,
  NODE_ENV: 'development',
  DATABASE_URL: databaseUrl,
  PORT: process.env.MANUAL_API_PORT ?? '3001',
  APP_ORIGIN: process.env.MANUAL_APP_ORIGIN ?? 'http://localhost:3000',
  LOG_LEVEL: process.env.MANUAL_API_LOG_LEVEL ?? 'warn',
  STORAGE_PATH: process.env.MANUAL_STORAGE_PATH ?? './storage/manual',
};
const node = (entry: string) =>
  [process.execPath, ['--import', 'tsx', '--conditions=@rc/source', entry]] as const;
const seed = spawnSync(...node('src/seed.ts'), { env, stdio: 'inherit' });
if (seed.status !== 0) process.exit(seed.status ?? 1);
const children = ['src/server.ts', 'src/worker.ts'].map((entry) =>
  spawn(...node(entry), { env, stdio: 'inherit' }),
);
const stop = () => children.forEach((child) => child.kill('SIGTERM'));
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
for (const child of children) child.on('exit', (code) => code && process.exit(code));
