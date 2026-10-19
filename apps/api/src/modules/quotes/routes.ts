import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { AppContext } from '../../context.js';
import { defineRoute, registerRoutes } from '../../shared/routes.js';
import { requireAuth } from '../../plugins/auth.js';
import { paginated } from '../../shared/pagination.js';
import { errorResponses, idParamSchema } from '../../shared/schemas.js';
import { imageSchema } from '../media/schemas.js';
import { readMultipart } from '../media/service.js';
import { messageInputSchema, messageSchema } from '../services/schemas.js';
import { loadVisible } from './access.js';
import { addPhotos, listQuoteMessages, MAX_QUOTE_PHOTOS, postQuoteMessage } from './conversation.js';
import { createQuote } from './creation.js';
import { acceptQuote, answerQuote, cancelQuote, declineQuote } from './decisions.js';
import { listVisibleQuotes, quoteDetail } from './quotes.js';
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

const tags = ['Orçamentos'];

const createQuoteRoute = defineRoute({
  method: 'POST',
  url: '/quotes',
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
  handle: async ({ ctx, request, reply }) => {
    const auth = requireAuth(request);
    const created = await createQuote(ctx, auth, request.body, request.ip);
    const detail = await quoteDetail(ctx, auth, created.id);
    return reply.code(201).header('location', `/api/v1/quotes/${created.id}`).send(detail);
  },
});

const listVisibleQuotesRoute = defineRoute({
  method: 'GET',
  url: '/quotes',
  config: { permission: 'quotes.read' },
  schema: {
    tags,
    summary: 'Orçamentos visíveis para quem pergunta',
    description: 'Cliente: os seus. Gerência: todos, com filtro de estado e busca por cliente ou número.',
    security,
    querystring: quoteListQuerySchema,
    response: { 200: paginated(quoteListItemSchema), ...errorResponses },
  },
  handle: async ({ ctx, request }) => listVisibleQuotes(ctx, requireAuth(request), request.query),
});

const quoteDetailRoute = defineRoute({
  method: 'GET',
  url: '/quotes/:id',
  config: { permission: 'quotes.read' },
  schema: {
    tags,
    summary: 'Detalhes de um orçamento',
    security,
    params: idParamSchema,
    response: { 200: quoteDetailSchema, ...errorResponses },
  },
  handle: async ({ ctx, request }) => quoteDetail(ctx, requireAuth(request), request.params.id),
});

const addQuotePhotosRoute = defineRoute({
  method: 'POST',
  url: '/quotes/:id/photos',
  config: { permission: 'quotes.read' },
  schema: {
    tags,
    summary: 'Enviar fotos (multipart, até 6)',
    description: 'O cliente envia enquanto o orçamento não foi respondido; a gerência enquanto está aberto.',
    security,
    params: idParamSchema,
    response: { 201: z.array(imageSchema.extend({ id: z.number().int() })), ...errorResponses },
  },
  handle: async ({ ctx, request, reply }) => {
    const auth = requireAuth(request);
    await loadVisible(ctx.db, auth, request.params.id);
    const form = await readMultipart(request, MAX_QUOTE_PHOTOS);
    return reply.code(201).send(await addPhotos(ctx, auth, request.params.id, form.files));
  },
});

const listQuoteMessagesRoute = defineRoute({
  method: 'GET',
  url: '/quotes/:id/messages',
  config: { permission: 'quotes.read' },
  schema: {
    tags,
    summary: 'Conversa entre a loja e o cliente',
    security,
    params: idParamSchema,
    response: { 200: z.array(messageSchema), ...errorResponses },
  },
  handle: async ({ ctx, request }) => listQuoteMessages(ctx, requireAuth(request), request.params.id),
});

const postQuoteMessageRoute = defineRoute({
  method: 'POST',
  url: '/quotes/:id/messages',
  config: { permission: 'quotes.read' },
  schema: {
    tags,
    summary: 'Enviar mensagem (pergunta da loja ou resposta do cliente)',
    security,
    params: idParamSchema,
    body: messageInputSchema,
    response: { 201: z.array(messageSchema), ...errorResponses },
  },
  handle: async ({ ctx, request, reply }) => {
    const auth = requireAuth(request);
    await postQuoteMessage(ctx, auth, request.params.id, request.body.body);
    return reply.code(201).send(await listQuoteMessages(ctx, auth, request.params.id));
  },
});

const answerQuoteRoute = defineRoute({
  method: 'POST',
  url: '/quotes/:id/answer',
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
  handle: async ({ ctx, request }) => {
    const auth = requireAuth(request);
    await answerQuote(ctx, auth, request.params.id, request.body, request.ip);
    return quoteDetail(ctx, auth, request.params.id);
  },
});

const acceptQuoteRoute = defineRoute({
  method: 'POST',
  url: '/quotes/:id/acceptance',
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
  handle: async ({ ctx, request }) => {
    const auth = requireAuth(request);
    const serviceRequestId = await acceptQuote(ctx, auth, request.params.id, request.body, request.ip);
    return { quote: await quoteDetail(ctx, auth, request.params.id), serviceRequestId };
  },
});

const declineQuoteRoute = defineRoute({
  method: 'POST',
  url: '/quotes/:id/decline',
  config: { permission: 'quotes.decide' },
  schema: {
    tags,
    summary: 'Recusar o orçamento',
    security,
    params: idParamSchema,
    body: declineSchema,
    response: { 200: quoteDetailSchema, ...errorResponses },
  },
  handle: async ({ ctx, request }) => {
    const auth = requireAuth(request);
    await declineQuote(ctx, auth, request.params.id, request.body.reason);
    return quoteDetail(ctx, auth, request.params.id);
  },
});

const cancelQuoteRoute = defineRoute({
  method: 'POST',
  url: '/quotes/:id/cancellation',
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
  handle: async ({ ctx, request }) => {
    const auth = requireAuth(request);
    await cancelQuote(ctx, auth, request.params.id, request.body.reason, request.ip);
    return quoteDetail(ctx, auth, request.params.id);
  },
});

const QUOTE_ROUTES = [
  createQuoteRoute,
  listVisibleQuotesRoute,
  quoteDetailRoute,
  addQuotePhotosRoute,
  listQuoteMessagesRoute,
  postQuoteMessageRoute,
  answerQuoteRoute,
  acceptQuoteRoute,
  declineQuoteRoute,
  cancelQuoteRoute,
];

export function quoteRoutes(ctx: AppContext): FastifyPluginAsyncZod {
  return async (app) => registerRoutes(app, ctx, QUOTE_ROUTES);
}
