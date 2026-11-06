import { loadConfig } from './config.js';
import type { AppContext } from './context.js';
import { connect } from './infra/db/client.js';
import { createSmtpMailer } from './infra/mail/mailer.js';
import { createStorage } from './infra/storage/factory.js';
import { processOutboxBatch } from './modules/outbox/service.js';
import { expireQuotes } from './modules/quotes/service.js';
import { runRetention } from './modules/retention/service.js';
import { DAY, HOUR, systemClock } from './shared/clock.js';
import { workerHandlers } from './worker-handlers.js';

const config = loadConfig(process.env);
const database = connect(config.DATABASE_URL, 2);
const mailer = createSmtpMailer(config.SMTP_URL, config.MAIL_FROM);
const ctx: AppContext = {
  config,
  db: database.db,
  mailer,
  storage: createStorage(config),
  fetch: globalThis.fetch,
  clock: systemClock,
};
const handlers = workerHandlers(ctx);

let running = true;
const stop = () => {
  running = false;
};
process.on('SIGTERM', stop);
process.on('SIGINT', stop);

/** Scheduled tasks: each runs at start up and then once per interval. */
const scheduledTasks = [
  { name: 'quote expiration', every: HOUR, run: () => expireQuotes(ctx), lastRun: 0 },
  { name: 'data retention', every: DAY, run: () => runRetention(ctx), lastRun: 0 },
];

async function runDueTasks(): Promise<void> {
  for (const task of scheduledTasks) {
    if (Date.now() - task.lastRun < task.every) continue;
    task.lastRun = Date.now();
    await task.run().catch((error: unknown) => {
      console.error(`${task.name} failed`, error);
    });
  }
}

while (running) {
  await runDueTasks();
  const result = await processOutboxBatch(database.db, handlers, systemClock).catch((error: unknown) => {
    console.error('outbox batch failed', error);
    return { processed: 0, failed: 0 };
  });
  if (result.processed + result.failed === 0) await new Promise((resolve) => setTimeout(resolve, 2000));
}
await database.close();
