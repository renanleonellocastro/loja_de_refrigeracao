import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { connect, runMigrations } from './infra/db/client.js';
import { createSmtpMailer } from './infra/mail/mailer.js';
import { systemClock } from './shared/clock.js';

const config = loadConfig(process.env);
const database = connect(config.DATABASE_URL);
await runMigrations(database.db);
const app = await buildApp({
  config,
  db: database.db,
  mailer: createSmtpMailer(config.SMTP_URL, config.MAIL_FROM),
  clock: systemClock,
});

const shutdown = async (): Promise<void> => {
  await app.close();
  await database.close();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

await app.listen({ host: config.HOST, port: config.PORT });
