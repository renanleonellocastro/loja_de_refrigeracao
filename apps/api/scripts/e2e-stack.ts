// Starts the API for the end to end tests: recreates a dedicated database, migrates it, loads the development
// seed and runs the HTTP server and the outbox worker (emails go to Mailpit). Stops both on SIGTERM.
import { spawn } from 'node:child_process';
import { prepareSeededDatabase } from './database.js';

const databaseUrl = process.env.E2E_DATABASE_URL ?? 'postgres://castro:castro@localhost:5433/castro_e2e';
await prepareSeededDatabase(databaseUrl, 'e2e');

const env = {
  ...process.env,
  NODE_ENV: 'development',
  DATABASE_URL: databaseUrl,
  PORT: process.env.E2E_API_PORT ?? '3001',
  APP_ORIGIN: process.env.E2E_APP_ORIGIN ?? 'http://localhost:3000',
  LOG_LEVEL: process.env.E2E_API_LOG_LEVEL ?? 'warn',
  STORAGE_PATH: process.env.E2E_STORAGE_PATH ?? './storage/e2e',
  // Every run creates accounts on the same address; the production limit of 10 per hour would fail the suite (#140).
  SIGN_UP_LIMIT_PER_HOUR: process.env.E2E_SIGN_UP_LIMIT_PER_HOUR ?? '1000',
};
const children = ['src/server.ts', 'src/worker.ts'].map((entry) =>
  spawn(process.execPath, ['--import', 'tsx', '--conditions=@rc/source', entry], { env, stdio: 'inherit' }),
);
const stop = () => children.forEach((child) => child.kill('SIGTERM'));
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
for (const child of children) child.on('exit', (code) => code && process.exit(code));
