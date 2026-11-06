import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { asc, count, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../test/database.js';
import {
  addresses,
  appointments,
  media,
  orderEvents,
  orders,
  products,
  quotes,
  serviceReports,
  serviceRequests,
  stockMovements,
  users,
} from './db/schema.js';
import { SAMPLE_USERS, seedDevelopment } from './db/seed.js';
import { seedSampleActivity, storeTime } from './db/seed-activity.js';
import { SAMPLE_CUSTOMERS, SAMPLE_ORDERS, SAMPLE_QUOTES, SAMPLE_REQUESTS } from './db/seed-activity-data.js';
import { createLocalStorage } from './storage/storage.js';

/** Encoding every sample photo to AVIF and WebP takes well over the default timeout on CI runners. */
const PHOTO_SEED_TIMEOUT_MS = 90_000;

const NOW = new Date('2026-11-06T13:00:00Z');

describe('development sample activity', () => {
  const database = useTestDatabase();
  const statuses = async (table: typeof orders | typeof quotes | typeof serviceRequests) =>
    new Set((await database.db.select({ status: table.status }).from(table)).map((row) => row.status));
  const total = async (table: typeof media | typeof users | typeof addresses) =>
    (await database.db.select({ value: count() }).from(table))[0]!.value;
  const stockOf = async (name: string) =>
    (await database.db.select().from(products).where(eq(products.name, name)))[0]!.stockAvailable;

  beforeEach(() => database.reset());

  it('adds customers with orders, quotes and service requests in every state, once', async () => {
    const storage = createLocalStorage(mkdtempSync(join(tmpdir(), 'rc-activity-')));
    await seedDevelopment(database.db, storage);
    expect(await seedSampleActivity(database.db, storage, NOW)).toBe(true);
    expect(await seedSampleActivity(database.db, storage, NOW)).toBe(false);

    expect(await total(users)).toBe(SAMPLE_USERS.length + SAMPLE_CUSTOMERS.length - 1);
    expect(await total(addresses)).toBe(SAMPLE_CUSTOMERS.length);
    expect(await statuses(orders)).toEqual(
      new Set(['PENDING_REVIEW', 'READY_FOR_PICKUP', 'PICKED_UP', 'CANCELED']),
    );
    expect(await statuses(quotes)).toEqual(
      new Set(['REQUESTED', 'ANSWERED', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELED']),
    );
    expect((await statuses(serviceRequests)).size).toBe(8);
    const photos = [
      ...SAMPLE_REQUESTS.flatMap((r) => [r.photo, r.visit?.report?.photo]),
      ...SAMPLE_QUOTES.map((q) => q.photo),
    ];
    expect(await total(media)).toBe(photos.filter(Boolean).length);
  }, PHOTO_SEED_TIMEOUT_MS);

  it('keeps the stock, the order history and the visits consistent', async () => {
    await seedDevelopment(database.db);
    await seedSampleActivity(database.db, undefined, NOW);

    expect(await total(media)).toBe(0);
    // Compressor: 8 in stock, 1 online and 2 at the counter.
    expect(await stockOf('Compressor Embraco 1/4 HP')).toBe(5);
    // Freezer: the only order was canceled, so the reservation came back.
    expect(await stockOf('Freezer Horizontal Metalfrio 419L')).toBe(2);
    const releases = await database.db
      .select()
      .from(stockMovements)
      .where(eq(stockMovements.type, 'RELEASE'));
    expect(releases).toHaveLength(1);

    const [canceled] = await database.db.select().from(orders).where(eq(orders.status, 'CANCELED'));
    const history = await database.db
      .select()
      .from(orderEvents)
      .where(eq(orderEvents.orderId, canceled!.id))
      .orderBy(asc(orderEvents.id));
    expect(history.map((event) => [event.fromStatus, event.toStatus, event.actorId])).toEqual([
      [null, 'PENDING_REVIEW', canceled!.customerId],
      ['PENDING_REVIEW', 'CANCELED', canceled!.customerId],
    ]);
    expect(history[1]!.reason).toBe('Comprei um modelo maior.');
    const [counter] = await database.db.select().from(orders).where(eq(orders.channel, 'COUNTER'));
    expect(counter!.createdById).not.toBe(counter!.customerId);
    expect(await database.db.select().from(orders)).toHaveLength(SAMPLE_ORDERS.length);

    const visits = await database.db.select().from(appointments).orderBy(asc(appointments.startsAt));
    expect(visits.map((visit) => visit.startsAt.toISOString())).toEqual([
      '2026-10-28T17:00:00.000Z',
      '2026-11-05T12:00:00.000Z',
      '2026-11-06T17:00:00.000Z',
      '2026-11-07T11:00:00.000Z',
    ]);
    const reports = await database.db.select().from(serviceReports).orderBy(asc(serviceReports.status));
    expect(reports.map((report) => [report.status, report.approvedAt !== null])).toEqual([
      ['SUBMITTED', false],
      ['APPROVED', true],
    ]);

    const [accepted] = await database.db.select().from(quotes).where(eq(quotes.status, 'ACCEPTED'));
    const [installation] = await database.db
      .select()
      .from(serviceRequests)
      .where(eq(serviceRequests.quoteId, accepted!.id));
    expect(installation!.status).toBe('SCHEDULED');
    const [expired] = await database.db.select().from(quotes).where(eq(quotes.status, 'EXPIRED'));
    expect(expired!.validUntil! < '2026-11-06').toBe(true);
  });

  it('places a store hour in São Paulo time', () => {
    expect(storeTime(new Date('2026-11-07T01:30:00Z'), 0, 9).toISOString()).toBe('2026-11-06T12:00:00.000Z');
  });
});
