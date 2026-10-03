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

export async function listAudit(db: Database, filters: AuditFilters) {
  const conditions: SQL[] = [];
  if (filters.actorId !== undefined) conditions.push(eq(auditLogs.actorId, filters.actorId));
  if (filters.resourceType) conditions.push(eq(auditLogs.resourceType, filters.resourceType));
  if (filters.from) conditions.push(gte(auditLogs.createdAt, filters.from));
  if (filters.to) conditions.push(lte(auditLogs.createdAt, filters.to));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const { limit, offset } = toLimitOffset(filters);
  const [rows, totals] = await Promise.all([
    db
      .select()
      .from(auditLogs)
      .where(where)
      .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(auditLogs).where(where),
  ]);
  return pageOf(rows, filters, totals[0]!.value);
}
