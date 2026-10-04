// Starts the API for the end to end tests: recreates a dedicated database, migrates it, loads the development
// seed and runs the HTTP server and the outbox worker (emails go to Mailpit). Stops both on SIGTERM.
import { spawn } from 'node:child_process';
import pg from 'pg';
import { connect, runMigrations } from '../src/infra/db/client.js';
import { seedDevelopment } from '../src/infra/db/seed.js';

const databaseUrl = process.env.E2E_DATABASE_URL ?? 'postgres://castro:castro@localhost:5433/castro_e2e';
const target = new URL(databaseUrl);
const name = target.pathname.slice(1);
if (!/^[a-z0-9_]+$/.test(name) || !name.includes('e2e')) {
  throw new Error(`Refusing to recreate "${name}": the E2E database name must contain "e2e".`);
}

const maintenance = new URL(databaseUrl);
maintenance.pathname = '/postgres';
const admin = new pg.Client({ connectionString: maintenance.toString() });
await admin.connect();
await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
await admin.query(`CREATE DATABASE ${name}`);
await admin.end();

const database = connect(databaseUrl, 1);
await runMigrations(database.db);
await seedDevelopment(database.db);
await database.close();

const env = {
  ...process.env,
  NODE_ENV: 'development',
  DATABASE_URL: databaseUrl,
  PORT: process.env.E2E_API_PORT ?? '3001',
  APP_ORIGIN: process.env.E2E_APP_ORIGIN ?? 'http://localhost:3000',
  LOG_LEVEL: process.env.E2E_API_LOG_LEVEL ?? 'warn',
  STORAGE_PATH: process.env.E2E_STORAGE_PATH ?? './storage/e2e',
};
const children = ['src/server.ts', 'src/worker.ts'].map((entry) =>
  spawn(process.execPath, ['--import', 'tsx', '--conditions=@rc/source', entry], { env, stdio: 'inherit' }),
);
const stop = () => children.forEach((child) => child.kill('SIGTERM'));
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
for (const child of children) child.on('exit', (code) => code && process.exit(code));
