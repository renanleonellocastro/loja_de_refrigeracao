// Writes the OpenAPI document of the API to packages/contracts/openapi.json (no database needed).
import { writeFileSync } from 'node:fs';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import type { Database } from '../src/infra/db/client.js';
import { MemoryMailer } from '../src/infra/mail/mailer.js';
import { systemClock } from '../src/shared/clock.js';

const app = await buildApp({
  config: loadConfig({ LOG_LEVEL: 'silent' }),
  db: {} as Database,
  mailer: new MemoryMailer(),
  clock: systemClock,
});
await app.ready();
const target = new URL('../../../packages/contracts/openapi.json', import.meta.url);
writeFileSync(target, `${JSON.stringify(app.swagger(), null, 2)}\n`);
await app.close();
