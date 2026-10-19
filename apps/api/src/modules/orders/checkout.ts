import type { AppContext } from '../../context.js';
import type { Executor } from '../../infra/db/client.js';
import { unprocessable } from '../../shared/errors.js';
import { recordAudit } from '../audit/service.js';
import type { AccessClaims } from '../auth/service.js';
import * as users from '../users/service.js';
import { isManagement } from './access.js';
import { announcePlacement } from './notices.js';
import { placeOrder, type ItemRequest, type OrderChannel, type Placement } from './placement.js';
import * as repo from './repository.js';

export interface OrderCreation {
  customerId?: number | undefined;
  items?: ItemRequest[] | undefined;
  notes?: string | undefined;
}

export interface CounterSale {
  customerId: number;
  items: ItemRequest[];
  notes?: string | undefined;
}

interface PlacementOrigin {
  actor: AccessClaims;
  channel: OrderChannel;
  notes?: string | undefined;
}

/** An order the store places for a chosen customer: on behalf (online) or at the counter. */
interface StaffPlacement extends PlacementOrigin {
  ip: string;
  customerId: number;
  items?: ItemRequest[] | undefined;
}

const CREATION_AUDIT_ACTIONS: Readonly<Record<OrderChannel, string>> = {
  ONLINE: 'order.create',
  COUNTER: 'counterSale.create',
};

async function customerFor(db: Executor, customerId: number): Promise<users.UserRow> {
  const customer = await users.findActiveUserById(db, customerId);
  if (customer && customer.role === 'CLIENT') return customer;
  throw unprocessable('invalid-customer', 'Cliente inválido', 'Escolha um cliente cadastrado.', {
    errors: [{ path: 'customerId', message: 'Escolha um cliente cadastrado.' }],
  });
}

function requireItems(items: ItemRequest[] | undefined): ItemRequest[] {
  if (items) return items;
  throw unprocessable('items-required', 'Itens obrigatórios', 'Informe os produtos do pedido.', {
    errors: [{ path: 'items', message: 'Informe os produtos do pedido.' }],
  });
}

async function cartItemsOrFail(db: Executor, userId: number): Promise<ItemRequest[]> {
  const items = await repo.cartOf(db, userId);
  if (items.length > 0) return items;
  throw unprocessable(
    'empty-cart',
    'Carrinho vazio',
    'Adicione produtos ao carrinho antes de fechar o pedido.',
  );
}

function auditCreation(tx: Executor, request: StaffPlacement, order: repo.OrderRow) {
  return recordAudit(tx, {
    actorId: request.actor.userId,
    action: CREATION_AUDIT_ACTIONS[request.channel],
    resourceType: 'order',
    resourceId: order.id,
    after: order,
    ip: request.ip,
  });
}

function placementOf(origin: PlacementOrigin, customerId: number, items: ItemRequest[]): Placement {
  return {
    customerId,
    createdById: origin.actor.userId,
    items,
    channel: origin.channel,
    notes: origin.notes,
  };
}

async function placeForCustomer(ctx: AppContext, tx: Executor, request: StaffPlacement) {
  const customer = await customerFor(tx, request.customerId);
  const items = requireItems(request.items);
  const placed = await placeOrder(ctx, tx, placementOf(request, customer.id, items));
  await announcePlacement(ctx, tx, customer, placed, request.actor.userId);
  await auditCreation(tx, request, placed.order);
  return placed.order;
}

async function checkoutCart(ctx: AppContext, tx: Executor, actor: AccessClaims, notes: string | undefined) {
  const customer = (await users.findActiveUserById(tx, actor.userId))!;
  const items = await cartItemsOrFail(tx, actor.userId);
  const placed = await placeOrder(
    ctx,
    tx,
    placementOf({ actor, channel: 'ONLINE', notes }, customer.id, items),
  );
  await repo.clearCart(tx, actor.userId);
  await announcePlacement(ctx, tx, customer, placed, actor.userId);
  return placed.order;
}

/** UC Comprar Produto: from the cart, or by management on behalf of a customer with explicit items. */
export async function createOrder(ctx: AppContext, actor: AccessClaims, input: OrderCreation, ip: string) {
  const { customerId } = input;
  if (isManagement(actor.role) && customerId !== undefined) {
    const request: StaffPlacement = { ...input, customerId, actor, ip, channel: 'ONLINE' };
    return ctx.db.transaction((tx) => placeForCustomer(ctx, tx, request));
  }
  return ctx.db.transaction((tx) => checkoutCart(ctx, tx, actor, input.notes));
}

/** UC Vender Produto: counter sale, immediately picked up, stock taken out at once. */
export async function createCounterSale(
  ctx: AppContext,
  actor: AccessClaims,
  input: CounterSale,
  ip: string,
) {
  const request: StaffPlacement = { ...input, actor, ip, channel: 'COUNTER' };
  return ctx.db.transaction((tx) => placeForCustomer(ctx, tx, request));
}
