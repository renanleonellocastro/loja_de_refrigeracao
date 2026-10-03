import { and, count, desc, eq, ilike, inArray, lt, sql, type SQL } from 'drizzle-orm';
import type { Executor } from '../../infra/db/client.js';
import { quotes, serviceRequests, serviceTypes, users } from '../../infra/db/schema.js';
import { normalizeText } from '../../shared/text.js';
import type { QuoteStatus } from './status.js';

export type QuoteRow = typeof quotes.$inferSelect;

export async function insertQuote(db: Executor, values: typeof quotes.$inferInsert): Promise<QuoteRow> {
  const [row] = await db.insert(quotes).values(values).returning();
  return row!;
}

export async function findQuote(db: Executor, id: number): Promise<QuoteRow | undefined> {
  const [row] = await db.select().from(quotes).where(eq(quotes.id, id)).limit(1);
  return row;
}

/** Locks the quote row until the transaction ends, so two decisions cannot race. */
export async function findQuoteForUpdate(db: Executor, id: number): Promise<QuoteRow | undefined> {
  const [row] = await db.select().from(quotes).where(eq(quotes.id, id)).limit(1).for('update');
  return row;
}

export async function updateQuote(db: Executor, id: number, values: Partial<typeof quotes.$inferInsert>) {
  const [row] = await db.update(quotes).set(values).where(eq(quotes.id, id)).returning();
  return row!;
}

/** Moves every answered quote valid only until before `today` to EXPIRED and returns them. */
export async function expireAnsweredBefore(db: Executor, today: string, at: Date): Promise<QuoteRow[]> {
  return db
    .update(quotes)
    .set({ status: 'EXPIRED', updatedAt: at })
    .where(and(eq(quotes.status, 'ANSWERED'), lt(quotes.validUntil, today)))
    .returning();
}

/** A person shown on a quote; removed accounts keep their anonymized name and show no email. */
export async function findPerson(db: Executor, id: number) {
  const [row] = await db
    .select({
      id: users.id,
      name: users.name,
      email: sql<string>`case when ${users.deletedAt} is null then ${users.email} else '' end`,
      phone: users.phone,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return row!;
}

/** The service request created when the customer accepted the quote. */
export async function findRequestIdForQuote(db: Executor, quoteId: number): Promise<number | null> {
  const [row] = await db
    .select({ id: serviceRequests.id })
    .from(serviceRequests)
    .where(eq(serviceRequests.quoteId, quoteId))
    .limit(1);
  return row?.id ?? null;
}

export interface QuoteFilters {
  customerId?: number | undefined;
  statuses?: QuoteStatus[] | undefined;
  q?: string | undefined;
  limit: number;
  offset: number;
}

export async function listQuotes(db: Executor, filters: QuoteFilters) {
  const conditions: SQL[] = [];
  if (filters.customerId !== undefined) conditions.push(eq(quotes.customerId, filters.customerId));
  if (filters.statuses?.length) conditions.push(inArray(quotes.status, filters.statuses));
  if (filters.q) {
    // A number searches the quote number; anything else searches the customer.
    conditions.push(
      /^\d+$/.test(filters.q)
        ? eq(quotes.id, Number(filters.q))
        : ilike(users.searchText, `%${normalizeText(filters.q).replace(/[%_]/g, '')}%`),
    );
  }
  const where = conditions.length ? and(...conditions) : undefined;
  const rows = await db
    .select({
      id: quotes.id,
      status: quotes.status,
      serviceType: serviceTypes.name,
      customerId: users.id,
      customerName: users.name,
      amountCents: quotes.amountCents,
      validUntil: quotes.validUntil,
      createdAt: quotes.createdAt,
      updatedAt: quotes.updatedAt,
    })
    .from(quotes)
    .innerJoin(serviceTypes, eq(serviceTypes.id, quotes.serviceTypeId))
    .innerJoin(users, eq(users.id, quotes.customerId))
    .where(where)
    .orderBy(desc(quotes.updatedAt), desc(quotes.id))
    .limit(filters.limit)
    .offset(filters.offset);
  const totals = await db
    .select({ value: count() })
    .from(quotes)
    .innerJoin(users, eq(users.id, quotes.customerId))
    .where(where);
  return { rows, total: totals[0]!.value };
}
