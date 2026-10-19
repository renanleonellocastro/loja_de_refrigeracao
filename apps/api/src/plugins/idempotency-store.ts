import { and, eq } from 'drizzle-orm';
import type { Database } from '../infra/db/client.js';
import { idempotencyKeys } from '../infra/db/schema.js';

export type StoredResponse = typeof idempotencyKeys.$inferSelect;
export type ResponseRecord = typeof idempotencyKeys.$inferInsert;

/** Who claimed an idempotency key: keys are scoped per user. */
export interface KeyClaim {
  readonly key: string;
  readonly userId: number;
}

export async function findStoredResponse(db: Database, claim: KeyClaim): Promise<StoredResponse | undefined> {
  const [stored] = await db
    .select()
    .from(idempotencyKeys)
    .where(and(eq(idempotencyKeys.userId, claim.userId), eq(idempotencyKeys.key, claim.key)))
    .limit(1);
  return stored;
}

/** The first response wins: a concurrent repeat that stored first is kept. */
export async function storeResponse(db: Database, record: ResponseRecord): Promise<void> {
  await db.insert(idempotencyKeys).values(record).onConflictDoNothing();
}
