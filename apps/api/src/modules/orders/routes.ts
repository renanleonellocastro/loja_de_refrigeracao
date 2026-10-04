import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { AppContext } from '../../context.js';
import { requireAuth } from '../../plugins/auth.js';
import { errorResponses, idParamSchema } from '../../shared/schemas.js';
import * as cart from './cart.js';
import { orderLabelPdf } from './label.js';
import * as orders from './orders.js';
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

export function orderRoutes(ctx: AppContext): FastifyPluginAsyncZod {
  return async (app) => {
    const cartTags = ['Carrinho'];
    const tags = ['Pedidos'];

    app.get(
      '/me/cart',
      {
        config: { permission: 'cart.manage' },
        schema: {
          tags: cartTags,
          summary: 'Meu carrinho',
          security,
          response: { 200: cartSchema, ...errorResponses },
        },
      },
      async (request) => cart.cartView(ctx.db, requireAuth(request).userId),
    );

    app.put(
      '/me/cart/items/:productId',
      {
        config: { permission: 'cart.manage' },
        schema: {
          tags: cartTags,
          summary: 'Definir a quantidade de um produto no carrinho',
          security,
          params: productParamSchema,
          body: cartQuantitySchema,
          response: { 200: cartSchema, ...errorResponses },
        },
      },
      async (request) =>
        cart.setQuantity(ctx, requireAuth(request).userId, request.params.productId, request.body.quantity),
    );

    app.delete(
      '/me/cart/items/:productId',
      {
        config: { permission: 'cart.manage' },
        schema: {
          tags: cartTags,
          summary: 'Tirar um produto do carrinho',
          security,
          params: productParamSchema,
          response: { 200: cartSchema, ...errorResponses },
        },
      },
      async (request) => cart.removeItem(ctx, requireAuth(request).userId, request.params.productId),
    );

    app.post(
      '/me/cart/merge',
      {
        config: { permission: 'cart.manage' },
        schema: {
          tags: cartTags,
          summary: 'Unir o carrinho do visitante ao da conta',
          security,
          body: cartMergeSchema,
          response: { 200: cartSchema, ...errorResponses },
        },
      },
      async (request) => cart.mergeCart(ctx, requireAuth(request).userId, request.body.items),
    );

    app.post(
      '/orders',
      {
        config: { permission: 'orders.create', idempotent: true },
        schema: {
          tags,
          summary: 'Fechar pedido (do carrinho, ou pela gerência em nome de um cliente)',
          description: 'Reserva o estoque de forma atômica; itens sem estoque respondem 409 com a lista.',
          security,
          body: orderCreationSchema,
          response: { 201: orderDetailSchema, ...errorResponses },
        },
      },
      async (request, reply) => {
        const auth = requireAuth(request);
        const order = await orders.createOrder(ctx, auth, request.body, request.ip);
        return reply
          .code(201)
          .header('location', `/api/v1/orders/${order.id}`)
          .send(await orders.orderDetail(ctx, auth, order.id));
      },
    );

    app.get(
      '/orders',
      {
        config: { permission: 'orders.read' },
        schema: {
          tags,
          summary: 'Pedidos visíveis: os meus, ou a fila completa para a gerência (com contagem por estado)',
          security,
          querystring: orderListQuerySchema,
          response: { 200: orderListSchema, ...errorResponses },
        },
      },
      async (request) => orders.listVisibleOrders(ctx, requireAuth(request), request.query),
    );

    app.get(
      '/orders/:id',
      {
        config: { permission: 'orders.read' },
        schema: {
          tags,
          summary: 'Detalhes do pedido com a linha do tempo',
          security,
          params: idParamSchema,
          response: { 200: orderDetailSchema, ...errorResponses },
        },
      },
      async (request) => orders.orderDetail(ctx, requireAuth(request), request.params.id),
    );

    const transition = (action: 'markReady' | 'pickup', path: string, summary: string) =>
      app.post(
        `/orders/:id/${path}`,
        {
          config: { permission: 'orders.manage' },
          schema: {
            tags,
            summary,
            security,
            params: idParamSchema,
            response: { 200: orderDetailSchema, ...errorResponses },
          },
        },
        async (request) => {
          const auth = requireAuth(request);
          await orders.changeOrderStatus(ctx, auth, request.params.id, action, undefined, request.ip);
          return orders.orderDetail(ctx, auth, request.params.id);
        },
      );
    transition('markReady', 'ready-for-pickup', 'Marcar como pronto para retirada');
    transition('pickup', 'pickup', 'Marcar como retirado');

    app.post(
      '/orders/:id/cancellation',
      {
        config: { permission: 'orders.cancel' },
        schema: {
          tags,
          summary: 'Cancelar o pedido (cliente enquanto em análise; gerência antes da retirada)',
          security,
          params: idParamSchema,
          body: cancellationSchema,
          response: { 200: orderDetailSchema, ...errorResponses },
        },
      },
      async (request) => {
        const auth = requireAuth(request);
        await orders.changeOrderStatus(
          ctx,
          auth,
          request.params.id,
          'cancel',
          request.body.reason,
          request.ip,
        );
        return orders.orderDetail(ctx, auth, request.params.id);
      },
    );

    app.get(
      '/orders/:id/label',
      {
        config: { permission: 'orders.manage' },
        schema: {
          tags,
          summary: 'Etiqueta de separação em PDF (100 x 150 mm)',
          security,
          params: idParamSchema,
          produces: ['application/pdf'],
        },
      },
      async (request, reply) => {
        const detail = await orders.orderDetail(ctx, requireAuth(request), request.params.id);
        const pdf = await orderLabelPdf({
          number: detail.number,
          customerName: detail.customer.name,
          customerPhone: detail.customer.phone,
          createdAt: detail.createdAt,
          totalCents: detail.totalCents,
          items: detail.items,
        });
        return reply
          .header('content-type', 'application/pdf')
          .header('content-disposition', `inline; filename="etiqueta-${detail.number}.pdf"`)
          .send(pdf);
      },
    );

    app.post(
      '/counter-sales',
      {
        config: { permission: 'counterSales.create', idempotent: true },
        schema: {
          tags,
          summary: 'Venda no balcão (já retirada, baixa o estoque na hora)',
          security,
          body: counterSaleSchema,
          response: { 201: orderDetailSchema, ...errorResponses },
        },
      },
      async (request, reply) => {
        const auth = requireAuth(request);
        const order = await orders.createCounterSale(ctx, auth, request.body, request.ip);
        const detail = await orders.orderDetail(ctx, { ...auth, role: 'ADMIN' }, order.id);
        return reply.code(201).header('location', `/api/v1/orders/${order.id}`).send(detail);
      },
    );
  };
}
