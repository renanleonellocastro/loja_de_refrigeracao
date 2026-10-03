import type { AppContext } from '../../context.js';
import { conflict, notFound } from '../../shared/errors.js';
import { recordAudit } from '../audit/service.js';
import * as repo from './repository.js';

interface Actor {
  userId: number;
}

const nameTaken = () =>
  conflict('service-type-exists', 'Serviço já cadastrado', 'Já existe um tipo de serviço com este nome.', {
    errors: [{ path: 'name', message: 'Já existe um serviço com este nome.' }],
  });

export function listServiceTypes(ctx: AppContext, includeInactive: boolean) {
  return repo.listServiceTypes(ctx.db, includeInactive);
}

export async function getServiceType(ctx: AppContext, id: number, includeInactive: boolean) {
  const type = await repo.findServiceType(ctx.db, id);
  if (!type || (!type.active && !includeInactive)) throw notFound('Serviço não encontrado.');
  return type;
}

export async function createServiceType(
  ctx: AppContext,
  actor: Actor,
  input: { name: string; description: string; estimatedMinutes: number; active: boolean; position: number },
  ip: string,
) {
  return ctx.db.transaction(async (tx) => {
    if (await repo.findServiceTypeByName(tx, input.name)) throw nameTaken();
    const created = await repo.insertServiceType(tx, input);
    await recordAudit(tx, {
      actorId: actor.userId,
      action: 'serviceType.create',
      resourceType: 'serviceType',
      resourceId: created.id,
      after: created,
      ip,
    });
    return created;
  });
}

export async function updateServiceType(
  ctx: AppContext,
  actor: Actor,
  id: number,
  changes: Partial<{
    name: string;
    description: string;
    estimatedMinutes: number;
    active: boolean;
    position: number;
  }>,
  ip: string,
) {
  return ctx.db.transaction(async (tx) => {
    const before = await repo.findServiceType(tx, id);
    if (!before) throw notFound('Serviço não encontrado.');
    if (changes.name) {
      const same = await repo.findServiceTypeByName(tx, changes.name);
      if (same && same.id !== id) throw nameTaken();
    }
    const after = await repo.updateServiceType(tx, id, { ...changes, updatedAt: ctx.clock.now() });
    await recordAudit(tx, {
      actorId: actor.userId,
      action: 'serviceType.update',
      resourceType: 'serviceType',
      resourceId: id,
      before,
      after,
      ip,
    });
    return after;
  });
}

/** A type already used by requests or quotes is deactivated instead of deleted (history stays readable). */
export async function removeServiceType(ctx: AppContext, actor: Actor, id: number, ip: string) {
  return ctx.db.transaction(async (tx) => {
    const before = await repo.findServiceType(tx, id);
    if (!before) throw notFound('Serviço não encontrado.');
    if (await repo.isServiceTypeInUse(tx, id)) {
      await repo.updateServiceType(tx, id, { active: false, updatedAt: ctx.clock.now() });
      await recordAudit(tx, {
        actorId: actor.userId,
        action: 'serviceType.deactivate',
        resourceType: 'serviceType',
        resourceId: id,
        before,
        ip,
      });
      return { result: 'deactivated' as const };
    }
    await repo.deleteServiceType(tx, id);
    await recordAudit(tx, {
      actorId: actor.userId,
      action: 'serviceType.delete',
      resourceType: 'serviceType',
      resourceId: id,
      before,
      ip,
    });
    return { result: 'deleted' as const };
  });
}
