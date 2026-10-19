import type { Role } from '@rc/contracts';
import type { Executor } from '../../infra/db/client.js';
import { notFound } from '../../shared/errors.js';
import type { AccessClaims } from '../auth/service.js';
import * as repo from './repository.js';
import { nextOrderStatus, type OrderActor } from './status.js';

export function isManagement(role: Role): boolean {
  return role === 'MANAGER' || role === 'ADMIN';
}

export function orderActorOf(role: Role): OrderActor {
  return isManagement(role) ? 'staff' : 'customer';
}

function canSee(viewer: AccessClaims, order: repo.OrderRow): boolean {
  return isManagement(viewer.role) || order.customerId === viewer.userId;
}

/** A customer sees their own orders; management sees every order. */
export async function loadVisible(db: Executor, viewer: AccessClaims, id: number): Promise<repo.OrderRow> {
  const order = await repo.findOrder(db, id);
  if (!order || !canSee(viewer, order)) throw notFound('Pedido não encontrado.');
  return order;
}

/** Only customers and management cancel orders, and only where the state machine allows it. */
export function canCancel(viewer: AccessClaims, order: repo.OrderRow): boolean {
  if (!isManagement(viewer.role) && viewer.role !== 'CLIENT') return false;
  return nextOrderStatus(order.status, 'cancel', orderActorOf(viewer.role)) !== null;
}
