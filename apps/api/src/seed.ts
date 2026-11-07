import { loadConfig } from './config.js';
import { connect, runMigrations } from './infra/db/client.js';
import { SAMPLE_PASSWORD, SAMPLE_USERS, seedDevelopment } from './infra/db/seed.js';
import { SAMPLE_CUSTOMERS } from './infra/db/seed-activity-data.js';
import { seedSampleActivity } from './infra/db/seed-activity.js';
import { createStorage } from './infra/storage/factory.js';

const config = loadConfig(process.env);
if (config.NODE_ENV === 'production') throw new Error('The development seed never runs in production.');
const database = connect(config.DATABASE_URL, 1);
await runMigrations(database.db);
const storage = createStorage(config);
const seededBase = await seedDevelopment(database.db, storage);
// Only the development database gets the sample activity; the E2E stack seeds the base data alone.
const seededActivity = await seedSampleActivity(database.db, storage);
if (seededBase || seededActivity) {
  const emails = new Set([...SAMPLE_USERS, ...SAMPLE_CUSTOMERS].map((user) => user.email));
  console.warn(`Seeded. Accounts (password ${SAMPLE_PASSWORD}): ${[...emails].join(', ')}`);
}
await database.close();
