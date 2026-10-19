import type { AppContext } from '../../context.js';
import type { Executor } from '../../infra/db/client.js';
import { conflict, notFound } from '../../shared/errors.js';
import { recordAudit } from '../audit/service.js';
import * as repo from './repository.js';

interface Actor {
  readonly userId: number;
}

export interface ServiceTypeInput {
  readonly name: string;
  readonly description: string;
  readonly estimatedMinutes: number;
  readonly active: boolean;
  readonly position: number;
}

/** Who changes a service type, inside which transaction, from which address. */
interface ServiceTypeChange {
  readonly ctx: AppContext;
  readonly tx: Executor;
  readonly actor: Actor;
  readonly ip: string;
}

interface ServiceTypeAuditEntry {
  readonly action: string;
  readonly id: number;
  readonly before?: repo.ServiceTypeRow;
  readonly after?: repo.ServiceTypeRow;
}

const nameTaken = () =>
  conflict('service-type-exists', 'Serviço já cadastrado', 'Já existe um tipo de serviço com este nome.', {
    errors: [{ path: 'name', message: 'Já existe um serviço com este nome.' }],
  });

const serviceTypeNotFound = () => notFound('Serviço não encontrado.');

function auditServiceType(change: ServiceTypeChange, entry: ServiceTypeAuditEntry) {
  const { action, id, before, after } = entry;
  return recordAudit(change.tx, {
    actorId: change.actor.userId,
    action,
    resourceType: 'serviceType',
    resourceId: id,
    before,
    after,
    ip: change.ip,
  });
}

async function findServiceTypeOrFail(tx: Executor, id: number): Promise<repo.ServiceTypeRow> {
  const type = await repo.findServiceType(tx, id);
  if (!type) throw serviceTypeNotFound();
  return type;
}

/** Fails when another service type already uses the name. */
async function assertNameAvailable(tx: Executor, name: string, ownId?: number): Promise<void> {
  const sameName = await repo.findServiceTypeByName(tx, name);
  if (sameName && sameName.id !== ownId) throw nameTaken();
}

export function listServiceTypes(ctx: AppContext, includeInactive: boolean) {
  return repo.listServiceTypes(ctx.db, includeInactive);
}

export async function getServiceType(ctx: AppContext, id: number, includeInactive: boolean) {
  const type = await repo.findServiceType(ctx.db, id);
  if (!type || (!type.active && !includeInactive)) throw serviceTypeNotFound();
  return type;
}

async function insertServiceType(change: ServiceTypeChange, input: ServiceTypeInput) {
  await assertNameAvailable(change.tx, input.name);
  const created = await repo.insertServiceType(change.tx, input);
  await auditServiceType(change, { action: 'serviceType.create', id: created.id, after: created });
  return created;
}

export async function createServiceType(ctx: AppContext, actor: Actor, input: ServiceTypeInput, ip: string) {
  return ctx.db.transaction((tx) => insertServiceType({ ctx, tx, actor, ip }, input));
}

async function changeServiceType(change: ServiceTypeChange, id: number, changes: Partial<ServiceTypeInput>) {
  const before = await findServiceTypeOrFail(change.tx, id);
  if (changes.name) await assertNameAvailable(change.tx, changes.name, id);
  const after = await repo.updateServiceType(change.tx, id, {
    ...changes,
    updatedAt: change.ctx.clock.now(),
  });
  await auditServiceType(change, { action: 'serviceType.update', id, before, after });
  return after;
}

export async function updateServiceType(
  ctx: AppContext,
  actor: Actor,
  id: number,
  changes: Partial<ServiceTypeInput>,
  ip: string,
) {
  return ctx.db.transaction((tx) => changeServiceType({ ctx, tx, actor, ip }, id, changes));
}

async function deactivateServiceType(change: ServiceTypeChange, before: repo.ServiceTypeRow) {
  await repo.updateServiceType(change.tx, before.id, { active: false, updatedAt: change.ctx.clock.now() });
  await auditServiceType(change, { action: 'serviceType.deactivate', id: before.id, before });
  return { result: 'deactivated' as const };
}

async function deleteServiceType(change: ServiceTypeChange, before: repo.ServiceTypeRow) {
  await repo.deleteServiceType(change.tx, before.id);
  await auditServiceType(change, { action: 'serviceType.delete', id: before.id, before });
  return { result: 'deleted' as const };
}

/** A type already used by requests or quotes is deactivated instead of deleted (history stays readable). */
async function retireServiceType(change: ServiceTypeChange, id: number) {
  const before = await findServiceTypeOrFail(change.tx, id);
  if (await repo.isServiceTypeInUse(change.tx, id)) return deactivateServiceType(change, before);
  return deleteServiceType(change, before);
}

export async function removeServiceType(ctx: AppContext, actor: Actor, id: number, ip: string) {
  return ctx.db.transaction((tx) => retireServiceType({ ctx, tx, actor, ip }, id));
}
