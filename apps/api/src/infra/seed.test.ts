import { count } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../test/database.js';
import { categories, serviceTypes, storeSettings, users } from './db/schema.js';
import { CATEGORIES, SAMPLE_USERS, SERVICE_TYPES, seedDevelopment } from './db/seed.js';

describe('development seed', () => {
  const database = useTestDatabase();

  it('fills an empty database once', async () => {
    expect(await seedDevelopment(database.db)).toBe(true);
    expect(await seedDevelopment(database.db)).toBe(false);
    const total = async (
      table: typeof users | typeof categories | typeof serviceTypes | typeof storeSettings,
    ) => (await database.db.select({ value: count() }).from(table))[0]!.value;
    expect(await total(storeSettings)).toBe(1);
    expect(await total(users)).toBe(SAMPLE_USERS.length);
    expect(await total(categories)).toBe(CATEGORIES.length);
    expect(await total(serviceTypes)).toBe(SERVICE_TYPES.length);
  });
});
