import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { AppContext } from '../../context.js';
import { requireAuth } from '../../plugins/auth.js';
import { paginated } from '../../shared/pagination.js';
import { errorResponses, idParamSchema } from '../../shared/schemas.js';
import { imageSchema } from '../media/schemas.js';
import { readMultipart } from '../media/service.js';
import { messageInputSchema, messageSchema } from '../services/schemas.js';
import * as quotes from './quotes.js';
import {
  acceptanceResultSchema,
  acceptanceSchema,
  answerSchema,
  declineSchema,
  quoteCancellationSchema,
  quoteCreationSchema,
  quoteDetailSchema,
  quoteListItemSchema,
  quoteListQuerySchema,
} from './schemas.js';

const security = [{ bearerAuth: [] }];

export function quoteRoutes(ctx: AppContext): FastifyPluginAsyncZod {
  return async (app) => {
    const tags = ['Orçamentos'];

    app.post(
      '/quotes',
      {
        config: { permission: 'quotes.create', idempotent: true },
        schema: {
          tags,
          summary: 'Solicitar orçamento',
          description:
            'A gerência informa customerId para solicitar em nome de um cliente. Fotos vão em seguida em /photos.',
          security,
          body: quoteCreationSchema,
          response: { 201: quoteDetailSchema, ...errorResponses },
        },
      },
      async (request, reply) => {
        const auth = requireAuth(request);
        const created = await quotes.createQuote(ctx, auth, request.body, request.ip);
        const detail = await quotes.quoteDetail(ctx, auth, created.id);
        return reply.code(201).header('location', `/api/v1/quotes/${created.id}`).send(detail);
      },
    );

    app.get(
      '/quotes',
      {
        config: { permission: 'quotes.read' },
        schema: {
          tags,
          summary: 'Orçamentos visíveis para quem pergunta',
          description:
            'Cliente: os seus. Gerência: todos, com filtro de estado e busca por cliente ou número.',
          security,
          querystring: quoteListQuerySchema,
          response: { 200: paginated(quoteListItemSchema), ...errorResponses },
        },
      },
      async (request) => quotes.listVisibleQuotes(ctx, requireAuth(request), request.query),
    );

    app.get(
      '/quotes/:id',
      {
        config: { permission: 'quotes.read' },
        schema: {
          tags,
          summary: 'Detalhes de um orçamento',
          security,
          params: idParamSchema,
          response: { 200: quoteDetailSchema, ...errorResponses },
        },
      },
      async (request) => quotes.quoteDetail(ctx, requireAuth(request), request.params.id),
    );

    app.post(
      '/quotes/:id/photos',
      {
        config: { permission: 'quotes.read' },
        schema: {
          tags,
          summary: 'Enviar fotos (multipart, até 6)',
          description:
            'O cliente envia enquanto o orçamento não foi respondido; a gerência enquanto está aberto.',
          security,
          params: idParamSchema,
          response: { 201: z.array(imageSchema.extend({ id: z.number().int() })), ...errorResponses },
        },
      },
      async (request, reply) => {
        const auth = requireAuth(request);
        await quotes.loadVisible(ctx.db, auth, request.params.id);
        const form = await readMultipart(request, quotes.MAX_QUOTE_PHOTOS);
        return reply.code(201).send(await quotes.addPhotos(ctx, auth, request.params.id, form.files));
      },
    );

    app.get(
      '/quotes/:id/messages',
      {
        config: { permission: 'quotes.read' },
        schema: {
          tags,
          summary: 'Conversa entre a loja e o cliente',
          security,
          params: idParamSchema,
          response: { 200: z.array(messageSchema), ...errorResponses },
        },
      },
      async (request) => quotes.listQuoteMessages(ctx, requireAuth(request), request.params.id),
    );

    app.post(
      '/quotes/:id/messages',
      {
        config: { permission: 'quotes.read' },
        schema: {
          tags,
          summary: 'Enviar mensagem (pergunta da loja ou resposta do cliente)',
          security,
          params: idParamSchema,
          body: messageInputSchema,
          response: { 201: z.array(messageSchema), ...errorResponses },
        },
      },
      async (request, reply) => {
        const auth = requireAuth(request);
        await quotes.postQuoteMessage(ctx, auth, request.params.id, request.body.body);
        return reply.code(201).send(await quotes.listQuoteMessages(ctx, auth, request.params.id));
      },
    );

    app.post(
      '/quotes/:id/answer',
      {
        config: { permission: 'quotes.answer' },
        schema: {
          tags,
          summary: 'Responder com valor, validade e o que está incluído',
          description: 'A validade conta em dias corridos a partir de hoje no horário de São Paulo.',
          security,
          params: idParamSchema,
          body: answerSchema,
          response: { 200: quoteDetailSchema, ...errorResponses },
        },
      },
      async (request) => {
        const auth = requireAuth(request);
        await quotes.answerQuote(ctx, auth, request.params.id, request.body, request.ip);
        return quotes.quoteDetail(ctx, auth, request.params.id);
      },
    );

    app.post(
      '/quotes/:id/acceptance',
      {
        config: { permission: 'quotes.decide' },
        schema: {
          tags,
          summary: 'Aceitar o orçamento e pedir a visita',
          description:
            'Aceita até o último dia da validade e cria uma solicitação de agendamento ligada ao orçamento, com as datas e o endereço da visita.',
          security,
          params: idParamSchema,
          body: acceptanceSchema,
          response: { 200: acceptanceResultSchema, ...errorResponses },
        },
      },
      async (request) => {
        const auth = requireAuth(request);
        const serviceRequestId = await quotes.acceptQuote(
          ctx,
          auth,
          request.params.id,
          request.body,
          request.ip,
        );
        return { quote: await quotes.quoteDetail(ctx, auth, request.params.id), serviceRequestId };
      },
    );

    app.post(
      '/quotes/:id/decline',
      {
        config: { permission: 'quotes.decide' },
        schema: {
          tags,
          summary: 'Recusar o orçamento',
          security,
          params: idParamSchema,
          body: declineSchema,
          response: { 200: quoteDetailSchema, ...errorResponses },
        },
      },
      async (request) => {
        const auth = requireAuth(request);
        await quotes.declineQuote(ctx, auth, request.params.id, request.body.reason);
        return quotes.quoteDetail(ctx, auth, request.params.id);
      },
    );

    app.post(
      '/quotes/:id/cancellation',
      {
        config: { permission: 'quotes.read' },
        schema: {
          tags,
          summary: 'Cancelar o orçamento',
          description:
            'O cliente cancela enquanto o orçamento não foi respondido; a gerência enquanto está aberto.',
          security,
          params: idParamSchema,
          body: quoteCancellationSchema,
          response: { 200: quoteDetailSchema, ...errorResponses },
        },
      },
      async (request) => {
        const auth = requireAuth(request);
        await quotes.cancelQuote(ctx, auth, request.params.id, request.body.reason, request.ip);
        return quotes.quoteDetail(ctx, auth, request.params.id);
      },
    );
  };
}
