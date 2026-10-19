import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { AppContext } from '../../context.js';
import { defineRoute, registerRoutes } from '../../shared/routes.js';
import { requireAuth } from '../../plugins/auth.js';
import { errorResponses, fileResponse, idParamSchema } from '../../shared/schemas.js';
import * as cart from './cart.js';
import { orderLabelPdf, type LabelData } from './label.js';
import { createCounterSale, createOrder } from './checkout.js';
import * as orders from './orders.js';
import { changeOrderStatus } from './transitions.js';
import {
  cancellationSchema,
  cartMergeSchema,
  cartQuantitySchema,
  cartSchema,
  counterSaleSchema,
  orderCreationSchema,
  orderDetailSchema,
  orderListQuerySchema,
  orderListSchema,
  productParamSchema,
} from './schemas.js';

const security = [{ bearerAuth: [] }];

const cartTags = ['Carrinho'];
const tags = ['Pedidos'];
const orderDetailResponse = { 200: orderDetailSchema, ...errorResponses };

type OrderDetail = Awaited<ReturnType<typeof orders.orderDetail>>;

/** The staff steps after the order is ready share one shape: change the status, answer the detail. */
function statusTransitionRoute(action: 'markReady' | 'pickup', path: string, summary: string) {
  return defineRoute({
    method: 'POST',
    url: `/orders/:id/${path}`,
    config: { permission: 'orders.manage' },
    schema: { tags, summary, security, params: idParamSchema, response: orderDetailResponse },
    handle: async ({ ctx, request }) => {
      const auth = requireAuth(request);
      await changeOrderStatus(ctx, auth, request.params.id, action, undefined, request.ip);
      return orders.orderDetail(ctx, auth, request.params.id);
    },
  });
}

function labelDataOf(detail: OrderDetail): LabelData {
  return {
    number: detail.number,
    customerName: detail.customer.name,
    customerPhone: detail.customer.phone,
    createdAt: detail.createdAt,
    totalCents: detail.totalCents,
    items: detail.items,
  };
}

const cartViewRoute = defineRoute({
  method: 'GET',
  url: '/me/cart',
  config: { permission: 'cart.manage' },
  schema: {
    tags: cartTags,
    summary: 'Meu carrinho',
    security,
    response: { 200: cartSchema, ...errorResponses },
  },
  handle: async ({ ctx, request }) => cart.cartView(ctx.db, requireAuth(request).userId),
});

const setQuantityRoute = defineRoute({
  method: 'PUT',
  url: '/me/cart/items/:productId',
  config: { permission: 'cart.manage' },
  schema: {
    tags: cartTags,
    summary: 'Definir a quantidade de um produto no carrinho',
    security,
    params: productParamSchema,
    body: cartQuantitySchema,
    response: { 200: cartSchema, ...errorResponses },
  },
  handle: async ({ ctx, request }) =>
    cart.setQuantity(ctx, requireAuth(request).userId, request.params.productId, request.body.quantity),
});

const removeItemRoute = defineRoute({
  method: 'DELETE',
  url: '/me/cart/items/:productId',
  config: { permission: 'cart.manage' },
  schema: {
    tags: cartTags,
    summary: 'Tirar um produto do carrinho',
    security,
    params: productParamSchema,
    response: { 200: cartSchema, ...errorResponses },
  },
  handle: async ({ ctx, request }) =>
    cart.removeItem(ctx, requireAuth(request).userId, request.params.productId),
});

const mergeCartRoute = defineRoute({
  method: 'POST',
  url: '/me/cart/merge',
  config: { permission: 'cart.manage' },
  schema: {
    tags: cartTags,
    summary: 'Unir o carrinho do visitante ao da conta',
    security,
    body: cartMergeSchema,
    response: { 200: cartSchema, ...errorResponses },
  },
  handle: async ({ ctx, request }) => cart.mergeCart(ctx, requireAuth(request).userId, request.body.items),
});

const createOrderRoute = defineRoute({
  method: 'POST',
  url: '/orders',
  config: { permission: 'orders.create', idempotent: true },
  schema: {
    tags,
    summary: 'Fechar pedido (do carrinho, ou pela gerência em nome de um cliente)',
    description: 'Reserva o estoque de forma atômica; itens sem estoque respondem 409 com a lista.',
    security,
    body: orderCreationSchema,
    response: { 201: orderDetailSchema, ...errorResponses },
  },
  handle: async ({ ctx, request, reply }) => {
    const auth = requireAuth(request);
    const order = await createOrder(ctx, auth, request.body, request.ip);
    return reply
      .code(201)
      .header('location', `/api/v1/orders/${order.id}`)
      .send(await orders.orderDetail(ctx, auth, order.id));
  },
});

const listVisibleOrdersRoute = defineRoute({
  method: 'GET',
  url: '/orders',
  config: { permission: 'orders.read' },
  schema: {
    tags,
    summary: 'Pedidos visíveis: os meus, ou a fila completa para a gerência (com contagem por estado)',
    security,
    querystring: orderListQuerySchema,
    response: { 200: orderListSchema, ...errorResponses },
  },
  handle: async ({ ctx, request }) => orders.listVisibleOrders(ctx, requireAuth(request), request.query),
});

const orderDetailRoute = defineRoute({
  method: 'GET',
  url: '/orders/:id',
  config: { permission: 'orders.read' },
  schema: {
    tags,
    summary: 'Detalhes do pedido com a linha do tempo',
    security,
    params: idParamSchema,
    response: { 200: orderDetailSchema, ...errorResponses },
  },
  handle: async ({ ctx, request }) => orders.orderDetail(ctx, requireAuth(request), request.params.id),
});

const markReadyRoute = statusTransitionRoute(
  'markReady',
  'ready-for-pickup',
  'Marcar como pronto para retirada',
);

const pickupRoute = statusTransitionRoute('pickup', 'pickup', 'Marcar como retirado');

const cancelOrderRoute = defineRoute({
  method: 'POST',
  url: '/orders/:id/cancellation',
  config: { permission: 'orders.cancel' },
  schema: {
    tags,
    summary: 'Cancelar o pedido (cliente enquanto em análise; gerência antes da retirada)',
    security,
    params: idParamSchema,
    body: cancellationSchema,
    response: { 200: orderDetailSchema, ...errorResponses },
  },
  handle: async ({ ctx, request }) => {
    const auth = requireAuth(request);
    await changeOrderStatus(ctx, auth, request.params.id, 'cancel', request.body.reason, request.ip);
    return orders.orderDetail(ctx, auth, request.params.id);
  },
});

const orderLabelRoute = defineRoute({
  method: 'GET',
  url: '/orders/:id/label',
  config: { permission: 'orders.manage' },
  schema: {
    tags,
    summary: 'Etiqueta de separação em PDF (100 x 150 mm)',
    security,
    params: idParamSchema,
    response: { 200: fileResponse('application/pdf', 'Etiqueta em PDF'), ...errorResponses },
  },
  handle: async ({ ctx, request, reply }) => {
    const detail = await orders.orderDetail(ctx, requireAuth(request), request.params.id);
    const pdf = await orderLabelPdf(labelDataOf(detail));
    return reply
      .header('content-type', 'application/pdf')
      .header('content-disposition', `inline; filename="etiqueta-${detail.number}.pdf"`)
      .send(pdf);
  },
});

const createCounterSaleRoute = defineRoute({
  method: 'POST',
  url: '/counter-sales',
  config: { permission: 'counterSales.create', idempotent: true },
  schema: {
    tags,
    summary: 'Venda no balcão (já retirada, baixa o estoque na hora)',
    security,
    body: counterSaleSchema,
    response: { 201: orderDetailSchema, ...errorResponses },
  },
  handle: async ({ ctx, request, reply }) => {
    const auth = requireAuth(request);
    const order = await createCounterSale(ctx, auth, request.body, request.ip);
    const detail = await orders.orderDetail(ctx, { ...auth, role: 'ADMIN' }, order.id);
    return reply.code(201).header('location', `/api/v1/orders/${order.id}`).send(detail);
  },
});

const ORDER_ROUTES = [
  cartViewRoute,
  setQuantityRoute,
  removeItemRoute,
  mergeCartRoute,
  createOrderRoute,
  listVisibleOrdersRoute,
  orderDetailRoute,
  markReadyRoute,
  pickupRoute,
  cancelOrderRoute,
  orderLabelRoute,
  createCounterSaleRoute,
];

export function orderRoutes(ctx: AppContext): FastifyPluginAsyncZod {
  return async (app) => registerRoutes(app, ctx, ORDER_ROUTES);
}
