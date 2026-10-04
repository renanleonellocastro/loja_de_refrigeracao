import type { Role } from '@rc/contracts';
import type { AppContext } from '../../context.js';
import type { Executor } from '../../infra/db/client.js';
import { conflict, notFound, unprocessable } from '../../shared/errors.js';
import { formatMoney } from '../../shared/format.js';
import { recordAudit } from '../audit/service.js';
import type { AccessClaims } from '../auth/service.js';
import * as catalog from '../catalog/service.js';
import * as notifications from '../notifications/service.js';
import * as users from '../users/service.js';
import * as repo from './repository.js';
import {
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  nextOrderStatus,
  orderNumber,
  type OrderAction,
  type OrderStatus,
} from './status.js';

interface ItemRequest {
  productId: number;
  quantity: number;
}

const isManagement = (role: Role) => role === 'MANAGER' || role === 'ADMIN';

/** A customer sees their own orders; management sees every order. */
async function loadVisible(db: Executor, viewer: AccessClaims, id: number): Promise<repo.OrderRow> {
  const order = await repo.findOrder(db, id);
  if (!order || (!isManagement(viewer.role) && order.customerId !== viewer.userId)) {
    throw notFound('Pedido não encontrado.');
  }
  return order;
}

function canCancel(viewer: AccessClaims, order: repo.OrderRow) {
  if (!isManagement(viewer.role) && viewer.role !== 'CLIENT') return false;
  return nextOrderStatus(order.status, 'cancel', isManagement(viewer.role) ? 'staff' : 'customer') !== null;
}

export async function orderDetail(ctx: AppContext, viewer: AccessClaims, id: number) {
  const order = await loadVisible(ctx.db, viewer, id);
  const [items, events, customer] = await Promise.all([
    repo.itemsOf(ctx.db, id),
    repo.eventsOf(ctx.db, id),
    users.findActiveUserById(ctx.db, order.customerId),
  ]);
  return {
    id: order.id,
    number: orderNumber(order.id),
    status: order.status,
    statusLabel: ORDER_STATUS_LABELS[order.status],
    channel: order.channel,
    customer: customer
      ? { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone }
      : { id: order.customerId, name: 'Conta removida', email: '', phone: null },
    items: items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      unitPriceCents: item.unitPriceCents,
      quantity: item.quantity,
      subtotalCents: item.unitPriceCents * item.quantity,
    })),
    totalCents: order.totalCents,
    notes: order.notes,
    events: events.map((event) => ({
      fromStatus: event.fromStatus,
      toStatus: event.toStatus,
      label: ORDER_STATUS_LABELS[event.toStatus],
      actor: event.actorId === null ? null : { id: event.actorId, name: event.actorName! },
      reason: event.reason,
      createdAt: event.createdAt,
    })),
    canCancel: canCancel(viewer, order),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

export async function listVisibleOrders(
  ctx: AppContext,
  viewer: AccessClaims,
  query: {
    status?: OrderStatus[] | undefined;
    q?: string | undefined;
    from?: Date | undefined;
    to?: Date | undefined;
    page: number;
    pageSize: number;
  },
) {
  const management = isManagement(viewer.role);
  const { rows, total, counts } = await repo.listOrders(ctx.db, {
    customerId: management ? undefined : viewer.userId,
    statuses: query.status,
    q: management ? query.q : undefined,
    from: query.from,
    to: query.to,
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
  });
  return {
    data: rows.map((row) => ({
      id: row.order.id,
      number: orderNumber(row.order.id),
      status: row.order.status,
      statusLabel: ORDER_STATUS_LABELS[row.order.status],
      channel: row.order.channel,
      customer: { id: row.order.customerId, name: row.customerDeleted ? 'Conta removida' : row.customerName },
      totalCents: row.order.totalCents,
      itemCount: row.itemCount,
      createdAt: row.order.createdAt,
      updatedAt: row.order.updatedAt,
    })),
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      counts: Object.fromEntries(
        ORDER_STATUSES.map((s) => [s, counts.find((c) => c.status === s)?.value ?? 0]),
      ) as Record<OrderStatus, number>,
    },
  };
}

function itemsSummary(items: Array<{ productName: string; quantity: number }>) {
  return items.map((i) => `${i.quantity} × ${i.productName}`).join(', ');
}

/**
 * Creates an order with frozen prices and an atomic stock reservation (decision D2).
 * Any item without stock rolls everything back with a 409 listing the items.
 */
async function placeOrder(
  ctx: AppContext,
  tx: Executor,
  input: {
    customerId: number;
    createdById: number;
    items: ItemRequest[];
    channel: 'ONLINE' | 'COUNTER';
    notes?: string | undefined;
  },
) {
  const now = ctx.clock.now();
  const products = await catalog.productsForOrder(
    tx,
    input.items.map((i) => i.productId),
  );
  const missing = input.items.filter((i) => !products.some((p) => p.id === i.productId && !p.archived));
  if (missing.length > 0) {
    throw catalog.insufficientStock(
      missing.map((i) => ({ productId: i.productId, requested: i.quantity, available: 0 })),
    );
  }
  const lines = new Map<number, number>();
  for (const item of input.items) lines.set(item.productId, (lines.get(item.productId) ?? 0) + item.quantity);
  const snapshot = [...lines].map(([productId, quantity]) => {
    const product = products.find((p) => p.id === productId)!;
    return { productId, quantity, productName: product.name, unitPriceCents: product.priceCents };
  });
  const totalCents = snapshot.reduce((total, line) => total + line.unitPriceCents * line.quantity, 0);
  const status: OrderStatus = input.channel === 'COUNTER' ? 'PICKED_UP' : 'PENDING_REVIEW';
  const order = await repo.insertOrder(tx, {
    customerId: input.customerId,
    channel: input.channel,
    status,
    totalCents,
    createdById: input.createdById,
    notes: input.notes || null,
    createdAt: now,
    updatedAt: now,
  });
  const unavailable = await catalog.reserveStock(
    tx,
    snapshot,
    { orderId: order.id, authorId: input.createdById },
    now,
  );
  if (unavailable.length > 0) throw catalog.insufficientStock(unavailable);
  await repo.insertOrderItems(
    tx,
    snapshot.map((line) => ({ orderId: order.id, ...line })),
  );
  await repo.insertOrderEvent(tx, {
    orderId: order.id,
    fromStatus: null,
    toStatus: status,
    actorId: input.createdById,
    createdAt: now,
  });
  return { order, snapshot, totalCents };
}

async function customerFor(db: Executor, customerId: number) {
  const customer = await users.findActiveUserById(db, customerId);
  if (!customer || customer.role !== 'CLIENT') {
    throw unprocessable('invalid-customer', 'Cliente inválido', 'Escolha um cliente cadastrado.', {
      errors: [{ path: 'customerId', message: 'Escolha um cliente cadastrado.' }],
    });
  }
  return customer;
}

/** UC Comprar Produto: from the cart, or by management on behalf of a customer with explicit items. */
export async function createOrder(
  ctx: AppContext,
  actor: AccessClaims,
  input: { customerId?: number | undefined; items?: ItemRequest[] | undefined; notes?: string | undefined },
  ip: string,
) {
  const onBehalf = isManagement(actor.role) && input.customerId !== undefined;
  return ctx.db.transaction(async (tx) => {
    let items: ItemRequest[];
    let customer: users.UserRow;
    if (onBehalf) {
      customer = await customerFor(tx, input.customerId!);
      if (!input.items) {
        throw unprocessable('items-required', 'Itens obrigatórios', 'Informe os produtos do pedido.', {
          errors: [{ path: 'items', message: 'Informe os produtos do pedido.' }],
        });
      }
      items = input.items;
    } else {
      customer = (await users.findActiveUserById(tx, actor.userId))!;
      items = await repo.cartOf(tx, actor.userId);
      if (items.length === 0)
        throw unprocessable(
          'empty-cart',
          'Carrinho vazio',
          'Adicione produtos ao carrinho antes de fechar o pedido.',
        );
    }
    const { order, snapshot, totalCents } = await placeOrder(ctx, tx, {
      customerId: customer.id,
      createdById: actor.userId,
      items,
      channel: 'ONLINE',
      notes: input.notes,
    });
    if (!onBehalf) await repo.clearCart(tx, actor.userId);
    const number = orderNumber(order.id);
    await notifications.notifyUser(ctx, tx, customer, {
      type: 'order',
      subject: `Pedido ${number} recebido`,
      heading: 'Recebemos seu pedido',
      paragraphs: [
        `${itemsSummary(snapshot)}. Total: ${formatMoney(totalCents)}.`,
        'Vamos separar os produtos e avisar quando estiverem prontos para retirada na loja. O pagamento é feito na retirada.',
      ],
      path: `/minha-conta/pedidos/${order.id}`,
      actionLabel: 'Acompanhar pedido',
    });
    await notifications.notifyManagement(ctx, tx, actor.userId, {
      type: 'order',
      subject: `Novo pedido ${number}`,
      paragraphs: [`${customer.name}: ${itemsSummary(snapshot)}. Total: ${formatMoney(totalCents)}.`],
      path: `/pedidos/${order.id}`,
      actionLabel: 'Separar pedido',
    });
    if (onBehalf) {
      await recordAudit(tx, {
        actorId: actor.userId,
        action: 'order.create',
        resourceType: 'order',
        resourceId: order.id,
        after: order,
        ip,
      });
    }
    return order;
  });
}

/** UC Vender Produto: counter sale, immediately picked up, stock taken out at once. */
export async function createCounterSale(
  ctx: AppContext,
  actor: AccessClaims,
  input: { customerId: number; items: ItemRequest[]; notes?: string | undefined },
  ip: string,
) {
  return ctx.db.transaction(async (tx) => {
    const customer = await customerFor(tx, input.customerId);
    const { order, snapshot, totalCents } = await placeOrder(ctx, tx, {
      customerId: customer.id,
      createdById: actor.userId,
      items: input.items,
      channel: 'COUNTER',
      notes: input.notes,
    });
    const number = orderNumber(order.id);
    await notifications.notifyUser(ctx, tx, customer, {
      type: 'order',
      subject: `Sua compra ${number}`,
      heading: 'Obrigado pela compra!',
      paragraphs: [`${itemsSummary(snapshot)}. Total: ${formatMoney(totalCents)}.`],
      path: `/minha-conta/pedidos/${order.id}`,
      actionLabel: 'Ver compra',
    });
    await notifications.notifyManagement(ctx, tx, actor.userId, {
      type: 'order',
      subject: `Venda no balcão ${number}`,
      paragraphs: [`${customer.name}: ${itemsSummary(snapshot)}. Total: ${formatMoney(totalCents)}.`],
      path: `/pedidos/${order.id}`,
    });
    await recordAudit(tx, {
      actorId: actor.userId,
      action: 'counterSale.create',
      resourceType: 'order',
      resourceId: order.id,
      after: order,
      ip,
    });
    return order;
  });
}

const MESSAGES: Record<Exclude<OrderAction, 'cancel'>, { subject: string; heading: string; text: string }> = {
  markReady: {
    subject: 'pronto para retirada',
    heading: 'Pode retirar seu pedido',
    text: 'Seu pedido está separado e esperando por você na loja, de segunda a sexta, das 9h às 18h.',
  },
  pickup: {
    subject: 'retirado',
    heading: 'Pedido retirado',
    text: 'Obrigado pela compra! Qualquer dúvida, fale com a loja.',
  },
};

/** Moves an order along the state machine with a timeline event and a notice. */
export async function changeOrderStatus(
  ctx: AppContext,
  actor: AccessClaims,
  id: number,
  action: OrderAction,
  reason: string | undefined,
  ip: string,
) {
  return ctx.db.transaction(async (tx) => {
    const order = await loadVisible(tx, actor, id);
    const kind = isManagement(actor.role) ? 'staff' : 'customer';
    const next = nextOrderStatus(order.status, action, kind);
    if (next === null) {
      throw conflict(
        'invalid-transition',
        'Ação indisponível',
        `O pedido está ${ORDER_STATUS_LABELS[order.status].toLowerCase()}.`,
      );
    }
    const now = ctx.clock.now();
    const updated = await repo.updateOrderStatus(tx, id, next, now);
    await repo.insertOrderEvent(tx, {
      orderId: id,
      fromStatus: order.status,
      toStatus: next,
      actorId: actor.userId,
      reason: reason || null,
      createdAt: now,
    });
    const number = orderNumber(id);
    if (action === 'cancel') {
      const items = await repo.itemsOf(tx, id);
      await catalog.releaseStock(tx, items, { orderId: id, authorId: actor.userId }, now);
      if (kind === 'customer') {
        await notifications.notifyManagement(ctx, tx, null, {
          type: 'order',
          subject: `Pedido ${number} cancelado pelo cliente`,
          paragraphs: [reason || 'O cliente não informou o motivo.'],
          path: `/pedidos/${id}`,
        });
      } else {
        await notifications.notifyUserById(ctx, tx, order.customerId, {
          type: 'order',
          subject: `Pedido ${number} cancelado`,
          paragraphs: [reason || 'A loja cancelou este pedido. Fale com a gente se tiver dúvidas.'],
          path: `/minha-conta/pedidos/${id}`,
        });
      }
    } else {
      const message = MESSAGES[action];
      await notifications.notifyUserById(ctx, tx, order.customerId, {
        type: 'order',
        subject: `Pedido ${number} ${message.subject}`,
        heading: message.heading,
        paragraphs: [message.text],
        path: `/minha-conta/pedidos/${id}`,
        actionLabel: 'Ver pedido',
      });
    }
    if (kind === 'staff') {
      await recordAudit(tx, {
        actorId: actor.userId,
        action: `order.${action}`,
        resourceType: 'order',
        resourceId: id,
        before: order,
        after: updated,
        ip,
      });
    }
    return updated;
  });
}
