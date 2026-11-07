// Starts the API for the k6 load test (docs/TESTES.md): recreates a dedicated database, loads the development seed
// plus the RNF-10 volume (scripts/load-volume.sql) and runs the HTTP server in production mode. Stops on SIGTERM.
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { prepareSeededDatabase } from './database.js';

const databaseUrl = process.env.LOAD_DATABASE_URL ?? 'postgres://castro:castro@localhost:5433/castro_load';
await prepareSeededDatabase(databaseUrl, 'load');

const volume = new pg.Client({ connectionString: databaseUrl });
await volume.connect();
await volume.query(readFileSync(new URL('./load-volume.sql', import.meta.url), 'utf8'));
await volume.end();

const env = {
  ...process.env,
  NODE_ENV: 'production',
  DATABASE_URL: databaseUrl,
  JWT_SECRET: randomBytes(32).toString('hex'),
  PORT: process.env.LOAD_API_PORT ?? '3001',
  LOG_LEVEL: process.env.LOAD_API_LOG_LEVEL ?? 'info',
  STORAGE_PATH: process.env.LOAD_STORAGE_PATH ?? './storage/load',
  // Plain HTTP on localhost: no proxy in front, so the client address is the socket address.
  TRUST_PROXY: 'false',
};
const server = spawn(process.execPath, ['--import', 'tsx', '--conditions=@rc/source', 'src/server.ts'], {
  env,
  stdio: 'inherit',
});
const stop = () => server.kill('SIGTERM');
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
server.on('exit', (code) => process.exit(code ?? 0));
