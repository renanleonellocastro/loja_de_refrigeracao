import type { Executor } from '../../infra/db/client.js';
import { recordAudit, type AuditEntry } from '../audit/service.js';
import type { AccessClaims } from '../auth/service.js';

/** Who changed the catalog and from where, for the audit trail. */
export interface AuditMeta {
  actor: AccessClaims;
  ip: string;
}

/** What changed: the action plus the state before and after, when they matter. */
export type CatalogChange = Pick<AuditEntry, 'action' | 'before' | 'after'>;

function auditChange(
  tx: Executor,
  meta: AuditMeta,
  entry: Omit<AuditEntry, 'actorId' | 'ip'>,
): Promise<void> {
  return recordAudit(tx, { ...entry, actorId: meta.actor.userId, ip: meta.ip });
}

/** Audits a change to one category, or to all of them when `categoryId` is null. */
export function auditCategoryChange(
  tx: Executor,
  meta: AuditMeta,
  categoryId: number | null,
  change: CatalogChange,
): Promise<void> {
  return auditChange(tx, meta, { ...change, resourceType: 'category', resourceId: categoryId });
}

export function auditProductChange(
  tx: Executor,
  meta: AuditMeta,
  productId: number,
  change: CatalogChange,
): Promise<void> {
  return auditChange(tx, meta, { ...change, resourceType: 'product', resourceId: productId });
}
