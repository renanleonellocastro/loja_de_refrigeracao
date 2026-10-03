import { describe, expect, it } from 'vitest';
import { outbox } from '../../infra/db/schema.js';
import { MINUTE } from '../../shared/clock.js';
import { useTestApp } from '../../../test/harness.js';
import { MAX_ATTEMPTS, enqueue, processOutboxBatch } from './service.js';

describe('outbox', () => {
  const t = useTestApp();

  it('processes events in order and marks them done', async () => {
    const seen: unknown[] = [];
    await enqueue(t.db, 'test', { n: 1 });
    await enqueue(t.db, 'test', { n: 2 });
    const result = await processOutboxBatch(t.db, { test: async (p) => void seen.push(p.n) }, t.clock);
    expect(result).toEqual({ processed: 2, failed: 0 });
    expect(seen).toEqual([1, 2]);
    expect(await processOutboxBatch(t.db, {}, t.clock)).toEqual({ processed: 0, failed: 0 });
  });

  it('retries failures with exponential backoff and gives up after the limit', async () => {
    await enqueue(t.db, 'flaky', {});
    let calls = 0;
    const handlers = {
      flaky: async () => {
        calls += 1;
        throw new Error('smtp down');
      },
    };
    expect(await processOutboxBatch(t.db, handlers, t.clock)).toEqual({ processed: 0, failed: 1 });
    expect(await processOutboxBatch(t.db, handlers, t.clock)).toEqual({ processed: 0, failed: 0 });
    t.clock.advance(2 * MINUTE);
    await processOutboxBatch(t.db, handlers, t.clock);
    for (let i = 0; i < 20; i += 1) {
      t.clock.advance(300 * MINUTE);
      await processOutboxBatch(t.db, handlers, t.clock);
    }
    expect(calls).toBe(MAX_ATTEMPTS);
    const [row] = await t.db.select().from(outbox);
    expect(row).toMatchObject({ attempts: MAX_ATTEMPTS, lastError: 'smtp down', processedAt: null });
  });

  it('records unknown topics and non Error throws as failures', async () => {
    await enqueue(t.db, 'unknown', {});
    await enqueue(t.db, 'weird', {});
    const result = await processOutboxBatch(
      t.db,
      {
        weird: async () => {
          throw 'plain string';
        },
      },
      t.clock,
    );
    expect(result.failed).toBe(2);
    const rows = await t.db.select().from(outbox);
    expect(rows.map((r) => r.lastError).sort()).toEqual(['No handler for topic unknown', 'plain string']);
  });
});
