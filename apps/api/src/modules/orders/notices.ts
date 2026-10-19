import type { AppContext } from '../../context.js';
import type { Executor } from '../../infra/db/client.js';
import { formatMoney } from '../../shared/format.js';
import * as notifications from '../notifications/service.js';
import type * as users from '../users/service.js';
import type { OrderChannel, OrderLine, PlacedOrder } from './placement.js';
import type * as repo from './repository.js';
import { orderNumber, type OrderAction, type OrderActor } from './status.js';

const ORDER_NOTICE_TYPE = 'order';

type NoticeContent = Omit<notifications.Notice, 'type' | 'path'>;

interface PlacementFacts {
  number: string;
  summary: string;
  customerName: string;
}

const customerOrderPath = (id: number) => `/minha-conta/pedidos/${id}`;
const managementOrderPath = (id: number) => `/pedidos/${id}`;

function itemsSummary(lines: OrderLine[]): string {
  return lines.map((line) => `${line.quantity} × ${line.productName}`).join(', ');
}

function placementFacts(placed: PlacedOrder, customerName: string): PlacementFacts {
  const summary = `${itemsSummary(placed.snapshot)}. Total: ${formatMoney(placed.totalCents)}.`;
  return { number: orderNumber(placed.order.id), summary, customerName };
}

const PICKUP_AND_PAYMENT =
  'Vamos separar os produtos e avisar quando estiverem prontos para retirada na loja. O pagamento é feito na retirada.';

const CUSTOMER_PLACEMENT_NOTICES: Readonly<Record<OrderChannel, (facts: PlacementFacts) => NoticeContent>> = {
  ONLINE: ({ number, summary }) => ({
    subject: `Pedido ${number} recebido`,
    heading: 'Recebemos seu pedido',
    paragraphs: [summary, PICKUP_AND_PAYMENT],
    actionLabel: 'Acompanhar pedido',
  }),
  COUNTER: ({ number, summary }) => ({
    subject: `Sua compra ${number}`,
    heading: 'Obrigado pela compra!',
    paragraphs: [summary],
    actionLabel: 'Ver compra',
  }),
};

const MANAGEMENT_PLACEMENT_NOTICES: Readonly<Record<OrderChannel, (facts: PlacementFacts) => NoticeContent>> =
  {
    ONLINE: ({ number, summary, customerName }) => ({
      subject: `Novo pedido ${number}`,
      paragraphs: [`${customerName}: ${summary}`],
      actionLabel: 'Separar pedido',
    }),
    COUNTER: ({ number, summary, customerName }) => ({
      subject: `Venda no balcão ${number}`,
      paragraphs: [`${customerName}: ${summary}`],
    }),
  };

function notifyCustomerOfPlacement(
  ctx: AppContext,
  tx: Executor,
  customer: users.UserRow,
  { order }: PlacedOrder,
  facts: PlacementFacts,
) {
  return notifications.notifyUser(ctx, tx, customer, {
    type: ORDER_NOTICE_TYPE,
    ...CUSTOMER_PLACEMENT_NOTICES[order.channel](facts),
    path: customerOrderPath(order.id),
  });
}

function notifyManagementOfPlacement(
  ctx: AppContext,
  tx: Executor,
  authorId: number,
  { order }: PlacedOrder,
  facts: PlacementFacts,
) {
  return notifications.notifyManagement(ctx, tx, authorId, {
    type: ORDER_NOTICE_TYPE,
    ...MANAGEMENT_PLACEMENT_NOTICES[order.channel](facts),
    path: managementOrderPath(order.id),
  });
}

/** Tells the customer and the management (except the author) about a new order or counter sale. */
export async function announcePlacement(
  ctx: AppContext,
  tx: Executor,
  customer: users.UserRow,
  placed: PlacedOrder,
  authorId: number,
) {
  const facts = placementFacts(placed, customer.name);
  await notifyCustomerOfPlacement(ctx, tx, customer, placed, facts);
  await notifyManagementOfPlacement(ctx, tx, authorId, placed, facts);
}

type ProgressAction = Exclude<OrderAction, 'cancel'>;

const PROGRESS_MESSAGES: Readonly<
  Record<ProgressAction, { subject: string; heading: string; text: string }>
> = {
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

/** Tells the customer the order moved forward (ready for pickup or picked up). */
export function announceProgress(
  ctx: AppContext,
  tx: Executor,
  order: repo.OrderRow,
  action: ProgressAction,
) {
  const message = PROGRESS_MESSAGES[action];
  return notifications.notifyUserById(ctx, tx, order.customerId, {
    type: ORDER_NOTICE_TYPE,
    subject: `Pedido ${orderNumber(order.id)} ${message.subject}`,
    heading: message.heading,
    paragraphs: [message.text],
    path: customerOrderPath(order.id),
    actionLabel: 'Ver pedido',
  });
}

type CancellationNotice = (
  ctx: AppContext,
  tx: Executor,
  order: repo.OrderRow,
  reason: string | undefined,
) => Promise<void>;

/** A cancellation is told to the other side: the customer cancels to the store, the store to the customer. */
export const CANCELLATION_NOTICES: Readonly<Record<OrderActor, CancellationNotice>> = {
  customer: (ctx, tx, order, reason) =>
    notifications.notifyManagement(ctx, tx, null, {
      type: ORDER_NOTICE_TYPE,
      subject: `Pedido ${orderNumber(order.id)} cancelado pelo cliente`,
      paragraphs: [reason || 'O cliente não informou o motivo.'],
      path: managementOrderPath(order.id),
    }),
  staff: (ctx, tx, order, reason) =>
    notifications.notifyUserById(ctx, tx, order.customerId, {
      type: ORDER_NOTICE_TYPE,
      subject: `Pedido ${orderNumber(order.id)} cancelado`,
      paragraphs: [reason || 'A loja cancelou este pedido. Fale com a gente se tiver dúvidas.'],
      path: customerOrderPath(order.id),
    }),
};
