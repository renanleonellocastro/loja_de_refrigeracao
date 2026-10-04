import { loadConfig } from './config.js';
import { connect, runMigrations } from './infra/db/client.js';
import { SAMPLE_PASSWORD, SAMPLE_USERS, seedDevelopment } from './infra/db/seed.js';
import { createLocalStorage } from './infra/storage/storage.js';

const config = loadConfig(process.env);
if (config.NODE_ENV === 'production') throw new Error('The development seed never runs in production.');
const database = connect(config.DATABASE_URL, 1);
await runMigrations(database.db);
if (await seedDevelopment(database.db, createLocalStorage(config.STORAGE_PATH))) {
  console.warn(
    `Seeded. Accounts (password ${SAMPLE_PASSWORD}): ${SAMPLE_USERS.map((u) => u.email).join(', ')}`,
  );
}
await database.close();
