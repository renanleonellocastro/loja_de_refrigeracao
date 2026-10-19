import type { AppContext } from '../../context.js';
import type { Executor } from '../../infra/db/client.js';
import { conflict } from '../../shared/errors.js';
import { recordAudit } from '../audit/service.js';
import type { AccessClaims } from '../auth/service.js';
import * as catalog from '../catalog/service.js';
import { loadVisible, orderActorOf } from './access.js';
import { CANCELLATION_NOTICES, announceProgress } from './notices.js';
import * as repo from './repository.js';
import {
  ORDER_STATUS_LABELS,
  nextOrderStatus,
  type OrderAction,
  type OrderActor,
  type OrderStatus,
} from './status.js';

interface OrderActionRequest {
  actor: AccessClaims;
  id: number;
  action: OrderAction;
  reason: string | undefined;
  ip: string;
}

/** What an applied action needs to carry out its side effects. */
interface OrderChange {
  order: repo.OrderRow;
  actorKind: OrderActor;
  request: OrderActionRequest;
  now: Date;
}

type ActionEffect = (ctx: AppContext, tx: Executor, change: OrderChange) => Promise<void>;

function nextOrFail(order: repo.OrderRow, action: OrderAction, actor: OrderActor): OrderStatus {
  const next = nextOrderStatus(order.status, action, actor);
  if (next !== null) return next;
  throw conflict(
    'invalid-transition',
    'Ação indisponível',
    `O pedido está ${ORDER_STATUS_LABELS[order.status].toLowerCase()}.`,
  );
}

/** A cancelled order gives its reserved units back to the stock and tells the other side. */
async function cancelOrder(ctx: AppContext, tx: Executor, { order, actorKind, request, now }: OrderChange) {
  const items = await repo.itemsOf(tx, order.id);
  await catalog.releaseStock(tx, items, { orderId: order.id, authorId: request.actor.userId }, now);
  await CANCELLATION_NOTICES[actorKind](ctx, tx, order, request.reason);
}

const ACTION_EFFECTS: Readonly<Record<OrderAction, ActionEffect>> = {
  markReady: (ctx, tx, change) => announceProgress(ctx, tx, change.order, 'markReady'),
  pickup: (ctx, tx, change) => announceProgress(ctx, tx, change.order, 'pickup'),
  cancel: cancelOrder,
};

function recordTransition(tx: Executor, change: OrderChange, next: OrderStatus) {
  return repo.insertOrderEvent(tx, {
    orderId: change.order.id,
    fromStatus: change.order.status,
    toStatus: next,
    actorId: change.request.actor.userId,
    reason: change.request.reason || null,
    createdAt: change.now,
  });
}

function auditTransition(tx: Executor, change: OrderChange, updated: repo.OrderRow) {
  return recordAudit(tx, {
    actorId: change.request.actor.userId,
    action: `order.${change.request.action}`,
    resourceType: 'order',
    resourceId: change.order.id,
    before: change.order,
    after: updated,
    ip: change.request.ip,
  });
}

/** Moves an order along the state machine with a timeline event, its side effects and, for staff, an audit. */
async function applyOrderAction(ctx: AppContext, tx: Executor, request: OrderActionRequest) {
  const order = await loadVisible(tx, request.actor, request.id);
  const actorKind = orderActorOf(request.actor.role);
  const next = nextOrFail(order, request.action, actorKind);
  const change: OrderChange = { order, actorKind, request, now: ctx.clock.now() };
  const updated = await repo.updateOrderStatus(tx, order.id, next, change.now);
  await recordTransition(tx, change, next);
  await ACTION_EFFECTS[request.action](ctx, tx, change);
  if (actorKind === 'staff') await auditTransition(tx, change, updated);
  return updated;
}

export async function changeOrderStatus(
  ctx: AppContext,
  actor: AccessClaims,
  id: number,
  action: OrderAction,
  reason: string | undefined,
  ip: string,
) {
  return ctx.db.transaction((tx) => applyOrderAction(ctx, tx, { actor, id, action, reason, ip }));
}
