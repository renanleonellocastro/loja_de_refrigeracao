import { eq } from 'drizzle-orm';
import type { Executor } from '../../infra/db/client.js';
import { storeSettings } from '../../infra/db/schema.js';

export type StoreRow = typeof storeSettings.$inferSelect;

/** The single settings row, created by migration 0004 with the real store data. */
export async function loadStore(db: Executor): Promise<StoreRow> {
  const [row] = await db.select().from(storeSettings).where(eq(storeSettings.id, 1)).limit(1);
  return row!;
}

export async function updateStore(
  db: Executor,
  values: Partial<typeof storeSettings.$inferInsert>,
): Promise<StoreRow> {
  const [row] = await db.update(storeSettings).set(values).where(eq(storeSettings.id, 1)).returning();
  return row!;
}
