import type { AppContext } from '../../context.js';
import type { Executor } from '../../infra/db/client.js';
import type { OpeningHours } from '../../infra/db/schema.js';
import { recordAudit } from '../audit/service.js';
import * as repo from './repository.js';

const MS_PER_HOUR = 3_600_000;
const MINUTES_PER_HOUR = 60;
const SAO_PAULO_OFFSET_MS = -3 * MS_PER_HOUR;

/** Minutes since midnight of an `HH:MM` time. */
function minutesOfDay(hhmm: string): number {
  return Number(hhmm.slice(0, 2)) * MINUTES_PER_HOUR + Number(hhmm.slice(3, 5));
}

/** Whether the store is open at the instant, by the configured weekly hours in São Paulo time. */
export function isOpenAt(hours: OpeningHours, instant: Date): boolean {
  const local = new Date(instant.getTime() + SAO_PAULO_OFFSET_MS);
  const today = hours[String(local.getUTCDay())];
  if (!today) return false;
  const minutes = local.getUTCHours() * MINUTES_PER_HOUR + local.getUTCMinutes();
  return minutes >= minutesOfDay(today.opens) && minutes < minutesOfDay(today.closes);
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

type StoreChanges = Partial<Omit<repo.StoreRow, 'id' | 'updatedAt'>>;

interface StoreUpdate {
  readonly actorId: number;
  readonly changes: StoreChanges;
  readonly ip: string;
  readonly now: Date;
}

async function applyAuditedUpdate(tx: Executor, update: StoreUpdate): Promise<void> {
  const before = await repo.loadStore(tx);
  const after = await repo.updateStore(tx, { ...update.changes, updatedAt: update.now });
  await recordAudit(tx, {
    actorId: update.actorId,
    action: 'store.update',
    resourceType: 'store',
    resourceId: repo.STORE_SETTINGS_ID,
    before,
    after,
    ip: update.ip,
  });
}

export async function updateStoreSettings(
  ctx: AppContext,
  actorId: number,
  changes: StoreChanges,
  ip: string,
) {
  const update = { actorId, changes, ip, now: ctx.clock.now() };
  await ctx.db.transaction((tx) => applyAuditedUpdate(tx, update));
  return storeSettingsView(ctx);
}

export async function storeNotificationEmails(db: Executor): Promise<string[]> {
  return (await repo.loadStore(db)).notificationEmails;
}

export async function defaultStockMin(db: Executor): Promise<number> {
  return (await repo.loadStore(db)).defaultStockMin;
}
