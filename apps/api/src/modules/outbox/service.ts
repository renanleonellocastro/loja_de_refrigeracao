import { and, asc, eq, isNull, lte, or, sql } from 'drizzle-orm';
import type { Database, Executor, Transaction } from '../../infra/db/client.js';
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

type OutboxEvent = typeof outbox.$inferSelect;
type Outcome = keyof BatchResult;

const RETRY_BACKOFF_BASE = 2;

function isDue(now: Date) {
  return and(
    isNull(outbox.processedAt),
    // New events are due at once (their availableAt comes from the database clock); retries wait.
    or(eq(outbox.attempts, 0), lte(outbox.availableAt, now)),
    sql`${outbox.attempts} < ${MAX_ATTEMPTS}`,
  );
}

function dueEvents(tx: Transaction, now: Date, limit: number) {
  return tx
    .select()
    .from(outbox)
    .where(isDue(now))
    .orderBy(asc(outbox.id))
    .limit(limit)
    .for('update', { skipLocked: true });
}

async function runHandler(handlers: OutboxHandlers, event: OutboxEvent): Promise<void> {
  const handler = handlers[event.topic];
  if (!handler) throw new Error(`No handler for topic ${event.topic}`);
  await handler(event.payload);
}

async function markProcessed(tx: Transaction, event: OutboxEvent, now: Date): Promise<void> {
  await tx
    .update(outbox)
    .set({ processedAt: now, attempts: event.attempts + 1 })
    .where(eq(outbox.id, event.id));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function scheduleRetry(tx: Transaction, event: OutboxEvent, now: Date, error: unknown): Promise<void> {
  const attempts = event.attempts + 1;
  const availableAt = new Date(now.getTime() + RETRY_BACKOFF_BASE ** attempts * MINUTE);
  await tx
    .update(outbox)
    .set({ attempts, lastError: errorMessage(error), availableAt })
    .where(eq(outbox.id, event.id));
}

async function processEvent(
  tx: Transaction,
  handlers: OutboxHandlers,
  event: OutboxEvent,
  now: Date,
): Promise<Outcome> {
  try {
    await runHandler(handlers, event);
    await markProcessed(tx, event, now);
    return 'processed';
  } catch (error) {
    await scheduleRetry(tx, event, now, error);
    return 'failed';
  }
}

async function processDueEvents(
  tx: Transaction,
  handlers: OutboxHandlers,
  clock: Clock,
  limit: number,
): Promise<BatchResult> {
  const now = clock.now();
  const result: BatchResult = { processed: 0, failed: 0 };
  for (const event of await dueEvents(tx, now, limit)) {
    result[await processEvent(tx, handlers, event, now)] += 1;
  }
  return result;
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
  return db.transaction((tx) => processDueEvents(tx, handlers, clock, limit));
}
