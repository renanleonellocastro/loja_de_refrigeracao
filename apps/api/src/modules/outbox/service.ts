import { and, asc, eq, isNull, lte, or, sql } from 'drizzle-orm';
import type { Database, Executor } from '../../infra/db/client.js';
import { outbox } from '../../infra/db/schema.js';
import type { Clock } from '../../shared/clock.js';
import { MINUTE } from '../../shared/clock.js';

export type OutboxHandler = (payload: Record<string, unknown>) => Promise<void>;
export type OutboxHandlers = Record<string, OutboxHandler>;

export const MAX_ATTEMPTS = 8;

/** Records an event in the same transaction as the change that caused it (outbox pattern, ADR 0009). */
export async function enqueue(db: Executor, topic: string, payload: Record<string, unknown>): Promise<void> {
  await db.insert(outbox).values({ topic, payload });
}

export interface BatchResult {
  processed: number;
  failed: number;
}

/**
 * Processes due events with SKIP LOCKED so several workers can run side by side.
 * Failures are retried with exponential backoff up to MAX_ATTEMPTS.
 */
export async function processOutboxBatch(
  db: Database,
  handlers: OutboxHandlers,
  clock: Clock,
  limit = 20,
): Promise<BatchResult> {
  return db.transaction(async (tx) => {
    const now = clock.now();
    const due = await tx
      .select()
      .from(outbox)
      .where(
        and(
          isNull(outbox.processedAt),
          // New events are due at once (their availableAt comes from the database clock); retries wait.
          or(eq(outbox.attempts, 0), lte(outbox.availableAt, now)),
          sql`${outbox.attempts} < ${MAX_ATTEMPTS}`,
        ),
      )
      .orderBy(asc(outbox.id))
      .limit(limit)
      .for('update', { skipLocked: true });

    const result: BatchResult = { processed: 0, failed: 0 };
    for (const event of due) {
      const handler = handlers[event.topic];
      try {
        if (!handler) throw new Error(`No handler for topic ${event.topic}`);
        await handler(event.payload);
        await tx
          .update(outbox)
          .set({ processedAt: now, attempts: event.attempts + 1 })
          .where(eq(outbox.id, event.id));
        result.processed += 1;
      } catch (error) {
        const attempts = event.attempts + 1;
        await tx
          .update(outbox)
          .set({
            attempts,
            lastError: error instanceof Error ? error.message : String(error),
            availableAt: new Date(now.getTime() + 2 ** attempts * MINUTE),
          })
          .where(eq(outbox.id, event.id));
        result.failed += 1;
      }
    }
    return result;
  });
}
