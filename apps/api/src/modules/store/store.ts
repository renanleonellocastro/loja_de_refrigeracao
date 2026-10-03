import type { AppContext } from '../../context.js';
import type { Executor } from '../../infra/db/client.js';
import type { OpeningHours } from '../../infra/db/schema.js';
import { recordAudit } from '../audit/service.js';
import * as repo from './repository.js';

const SAO_PAULO_OFFSET_MS = -3 * 3_600_000;

/** Whether the store is open at the instant, by the configured weekly hours in São Paulo time. */
export function isOpenAt(hours: OpeningHours, instant: Date): boolean {
  const local = new Date(instant.getTime() + SAO_PAULO_OFFSET_MS);
  const today = hours[String(local.getUTCDay())];
  if (!today) return false;
  const minutes = local.getUTCHours() * 60 + local.getUTCMinutes();
  const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
  return minutes >= toMinutes(today.opens) && minutes < toMinutes(today.closes);
}

export async function publicStore(ctx: AppContext) {
  const store = await repo.loadStore(ctx.db);
  return {
    name: store.name,
    legalName: store.legalName,
    cnpj: store.cnpj,
    phone: store.phone,
    whatsapp: store.whatsapp,
    email: store.email,
    address: store.address,
    openingHours: store.openingHours,
    openNow: isOpenAt(store.openingHours, ctx.clock.now()),
  };
}

export async function storeSettingsView(ctx: AppContext) {
  const store = await repo.loadStore(ctx.db);
  return {
    ...(await publicStore(ctx)),
    notificationEmails: store.notificationEmails,
    defaultStockMin: store.defaultStockMin,
  };
}

export async function updateStoreSettings(
  ctx: AppContext,
  actorId: number,
  changes: Partial<Omit<repo.StoreRow, 'id' | 'updatedAt'>>,
  ip: string,
) {
  await ctx.db.transaction(async (tx) => {
    const before = await repo.loadStore(tx);
    const after = await repo.updateStore(tx, { ...changes, updatedAt: ctx.clock.now() });
    await recordAudit(tx, {
      actorId,
      action: 'store.update',
      resourceType: 'store',
      resourceId: 1,
      before,
      after,
      ip,
    });
  });
  return storeSettingsView(ctx);
}

export async function storeNotificationEmails(db: Executor): Promise<string[]> {
  return (await repo.loadStore(db)).notificationEmails;
}

export async function defaultStockMin(db: Executor): Promise<number> {
  return (await repo.loadStore(db)).defaultStockMin;
}
