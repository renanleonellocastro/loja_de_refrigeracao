// Starts the whole system locally: Docker services, packages build, API and web in watch mode.
import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync } from 'node:fs';

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (!existsSync('.env')) copyFileSync('infra/env.sample', '.env');
run('docker', ['compose', '-f', 'infra/compose.yaml', 'up', '-d', '--wait']);
run('pnpm', ['--filter', './packages/*', 'run', 'build']);
run('pnpm', ['--filter', '@rc/api', 'run', 'seed']);

const children = [
  spawn('pnpm', ['--filter', '@rc/api', 'run', 'dev'], { stdio: 'inherit' }),
  spawn('pnpm', ['--filter', '@rc/api', 'run', 'worker'], { stdio: 'inherit' }),
  spawn('pnpm', ['--filter', '@rc/web', 'run', 'dev'], { stdio: 'inherit' }),
];
const stop = () => children.forEach((child) => child.kill('SIGTERM'));
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
console.warn('Site: http://localhost:3000 · API: http://localhost:3001 · Emails: http://localhost:8025');
