import { and, count, desc, eq, gte, lte, type SQL } from 'drizzle-orm';
import type { Database, Executor } from '../../infra/db/client.js';
import { auditLogs } from '../../infra/db/schema.js';
import { pageOf, toLimitOffset, type PageQuery } from '../../shared/pagination.js';

export interface AuditEntry {
  actorId: number | null;
  action: string;
  resourceType: string;
  resourceId?: string | number | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
}

/** Appends to the audit trail; call inside the transaction of the change being audited. */
export async function recordAudit(db: Executor, entry: AuditEntry): Promise<void> {
  await db.insert(auditLogs).values({
    actorId: entry.actorId,
    action: entry.action,
    resourceType: entry.resourceType,
    resourceId: entry.resourceId === undefined || entry.resourceId === null ? null : String(entry.resourceId),
    before: entry.before ?? null,
    after: entry.after ?? null,
    ip: entry.ip ?? null,
  });
}

export interface AuditFilters extends PageQuery {
  actorId?: number | undefined;
  resourceType?: string | undefined;
  from?: Date | undefined;
  to?: Date | undefined;
}

type FilterCondition = (filters: AuditFilters) => SQL | undefined;

/** One condition per filter; a filter left out matches every entry. */
const FILTER_CONDITIONS: readonly FilterCondition[] = [
  ({ actorId }) => (actorId === undefined ? undefined : eq(auditLogs.actorId, actorId)),
  ({ resourceType }) => (resourceType ? eq(auditLogs.resourceType, resourceType) : undefined),
  ({ from }) => (from ? gte(auditLogs.createdAt, from) : undefined),
  ({ to }) => (to ? lte(auditLogs.createdAt, to) : undefined),
];

function whereOf(filters: AuditFilters): SQL | undefined {
  const conditions = FILTER_CONDITIONS.map((condition) => condition(filters)).filter(
    (condition): condition is SQL => condition !== undefined,
  );
  return conditions.length > 0 ? and(...conditions) : undefined;
}

function newestFirst(
  db: Database,
  where: SQL | undefined,
  { limit, offset }: { limit: number; offset: number },
) {
  return db
    .select()
    .from(auditLogs)
    .where(where)
    .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
    .limit(limit)
    .offset(offset);
}

export async function listAudit(db: Database, filters: AuditFilters) {
  const where = whereOf(filters);
  const [rows, totals] = await Promise.all([
    newestFirst(db, where, toLimitOffset(filters)),
    db.select({ value: count() }).from(auditLogs).where(where),
  ]);
  return pageOf(rows, filters, totals[0]!.value);
}
