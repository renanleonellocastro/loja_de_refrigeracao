import { loadConfig } from './config.js';
import { connect } from './infra/db/client.js';
import { createSmtpMailer } from './infra/mail/mailer.js';
import { EMAIL_TOPIC, emailHandler } from './modules/mail/service.js';
import { processOutboxBatch } from './modules/outbox/service.js';
import { systemClock } from './shared/clock.js';

const config = loadConfig(process.env);
const database = connect(config.DATABASE_URL, 2);
const mailer = createSmtpMailer(config.SMTP_URL, config.MAIL_FROM);
const handlers = { [EMAIL_TOPIC]: emailHandler({ mailer, config }) };

let running = true;
const stop = () => {
  running = false;
};
process.on('SIGTERM', stop);
process.on('SIGINT', stop);

while (running) {
  const result = await processOutboxBatch(database.db, handlers, systemClock).catch((error: unknown) => {
    console.error('outbox batch failed', error);
    return { processed: 0, failed: 0 };
  });
  if (result.processed + result.failed === 0) await new Promise((resolve) => setTimeout(resolve, 2000));
}
await database.close();
