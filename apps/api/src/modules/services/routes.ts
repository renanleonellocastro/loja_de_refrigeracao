import { can } from '@rc/contracts';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { AppContext } from '../../context.js';
import { defineRoute, registerRoutes } from '../../shared/routes.js';
import { actorOf, requireAuth } from '../../plugins/auth.js';
import { paginated } from '../../shared/pagination.js';
import { errorResponses, idParamSchema } from '../../shared/schemas.js';
import { imageSchema } from '../media/schemas.js';
import { readMultipart } from '../media/service.js';
import { loadVisible } from './request-access.js';
import { createRequest } from './request-creation.js';
import * as decisions from './request-decisions.js';
import * as requests from './requests.js';
import {
  approvalSchema,
  cancellationSchema,
  messageInputSchema,
  messageSchema,
  rejectionSchema,
  requestCreationSchema,
  requestDetailSchema,
  requestListItemSchema,
  requestListQuerySchema,
  serviceTypeInputSchema,
  serviceTypeListQuerySchema,
  serviceTypeSchema,
  serviceTypeUpdateSchema,
} from './schemas.js';
import * as types from './service-types.js';

const security = [{ bearerAuth: [] }];
const removalResultSchema = z.object({ result: z.enum(['deleted', 'deactivated']) });

const typeTags = ['Tipos de serviço'];
const tags = ['Solicitações de serviço'];

const listServiceTypesRoute = defineRoute({
  method: 'GET',
  url: '/service-types',
  config: { public: true },
  schema: {
    tags: typeTags,
    summary: 'Listar tipos de reparo e manutenção',
    description: 'Inativos só aparecem para o super usuário com includeInactive=true.',
    querystring: serviceTypeListQuerySchema,
    response: { 200: z.array(serviceTypeSchema), ...errorResponses },
  },
  handle: async ({ ctx, request }) =>
    types.listServiceTypes(
      ctx,
      request.query.includeInactive === 'true' && can(actorOf(request), 'serviceTypes.manage'),
    ),
});

const getServiceTypeRoute = defineRoute({
  method: 'GET',
  url: '/service-types/:id',
  config: { public: true },
  schema: {
    tags: typeTags,
    summary: 'Detalhes de um tipo de serviço',
    params: idParamSchema,
    response: { 200: serviceTypeSchema, ...errorResponses },
  },
  handle: async ({ ctx, request }) =>
    types.getServiceType(ctx, request.params.id, can(actorOf(request), 'serviceTypes.manage')),
});

const createServiceTypeRoute = defineRoute({
  method: 'POST',
  url: '/service-types',
  config: { permission: 'serviceTypes.manage' },
  schema: {
    tags: typeTags,
    summary: 'Cadastrar tipo de serviço',
    security,
    body: serviceTypeInputSchema,
    response: { 201: serviceTypeSchema, ...errorResponses },
  },
  handle: async ({ ctx, request, reply }) => {
    const created = await types.createServiceType(ctx, requireAuth(request), request.body, request.ip);
    return reply.code(201).header('location', `/api/v1/service-types/${created.id}`).send(created);
  },
});

const updateServiceTypeRoute = defineRoute({
  method: 'PATCH',
  url: '/service-types/:id',
  config: { permission: 'serviceTypes.manage' },
  schema: {
    tags: typeTags,
    summary: 'Alterar tipo de serviço',
    security,
    params: idParamSchema,
    body: serviceTypeUpdateSchema,
    response: { 200: serviceTypeSchema, ...errorResponses },
  },
  handle: async ({ ctx, request }) =>
    types.updateServiceType(ctx, requireAuth(request), request.params.id, request.body, request.ip),
});

const removeServiceTypeRoute = defineRoute({
  method: 'DELETE',
  url: '/service-types/:id',
  config: { permission: 'serviceTypes.manage' },
  schema: {
    tags: typeTags,
    summary: 'Excluir tipo de serviço (desativa quando já foi usado)',
    security,
    params: idParamSchema,
    response: { 200: removalResultSchema, ...errorResponses },
  },
  handle: async ({ ctx, request }) =>
    types.removeServiceType(ctx, requireAuth(request), request.params.id, request.ip),
});

const createRequestRoute = defineRoute({
  method: 'POST',
  url: '/service-requests',
  config: { permission: 'serviceRequests.create', idempotent: true },
  schema: {
    tags,
    summary: 'Solicitar agendamento de reparo ou manutenção',
    description:
      'A equipe informa customerId para solicitar em nome de um cliente. Fotos vão em seguida em /photos.',
    security,
    body: requestCreationSchema,
    response: { 201: requestDetailSchema, ...errorResponses },
  },
  handle: async ({ ctx, request, reply }) => {
    const auth = requireAuth(request);
    const created = await createRequest(ctx, auth, request.body, request.ip);
    const detail = await requests.requestDetail(ctx, auth, created.id);
    return reply.code(201).header('location', `/api/v1/service-requests/${created.id}`).send(detail);
  },
});

const listVisibleRequestsRoute = defineRoute({
  method: 'GET',
  url: '/service-requests',
  config: { permission: 'serviceRequests.read' },
  schema: {
    tags,
    summary: 'Solicitações visíveis para quem pergunta',
    description:
      'Cliente: as suas. Colaborador: as atribuídas a ele. Gerência: todas, com busca por cliente ou número.',
    security,
    querystring: requestListQuerySchema,
    response: { 200: paginated(requestListItemSchema), ...errorResponses },
  },
  handle: async ({ ctx, request }) => requests.listVisibleRequests(ctx, requireAuth(request), request.query),
});

const requestDetailRoute = defineRoute({
  method: 'GET',
  url: '/service-requests/:id',
  config: { permission: 'serviceRequests.read' },
  schema: {
    tags,
    summary: 'Detalhes de uma solicitação',
    security,
    params: idParamSchema,
    response: { 200: requestDetailSchema, ...errorResponses },
  },
  handle: async ({ ctx, request }) => requests.requestDetail(ctx, requireAuth(request), request.params.id),
});

const addRequestPhotosRoute = defineRoute({
  method: 'POST',
  url: '/service-requests/:id/photos',
  config: { permission: 'serviceRequests.read' },
  schema: {
    tags,
    summary: 'Enviar fotos do problema (multipart, campo de arquivo livre)',
    security,
    params: idParamSchema,
    response: { 201: z.array(imageSchema.extend({ id: z.number().int() })), ...errorResponses },
  },
  handle: async ({ ctx, request, reply }) => {
    const auth = requireAuth(request);
    await loadVisible(ctx.db, auth, request.params.id);
    const form = await readMultipart(request, requests.MAX_REQUEST_PHOTOS);
    return reply.code(201).send(await requests.addPhotos(ctx, auth, request.params.id, form.files));
  },
});

const listRequestMessagesRoute = defineRoute({
  method: 'GET',
  url: '/service-requests/:id/messages',
  config: { permission: 'serviceRequests.read' },
  schema: {
    tags,
    summary: 'Conversa entre a loja e o cliente',
    security,
    params: idParamSchema,
    response: { 200: z.array(messageSchema), ...errorResponses },
  },
  handle: async ({ ctx, request }) =>
    requests.listRequestMessages(ctx, requireAuth(request), request.params.id),
});

const postRequestMessageRoute = defineRoute({
  method: 'POST',
  url: '/service-requests/:id/messages',
  config: { permission: 'serviceRequests.read' },
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
    await decisions.postRequestMessage(ctx, auth, request.params.id, request.body.body);
    return reply.code(201).send(await requests.listRequestMessages(ctx, auth, request.params.id));
  },
});

const approveRequestRoute = defineRoute({
  method: 'POST',
  url: '/service-requests/:id/approval',
  config: { permission: 'serviceRequests.manage' },
  schema: {
    tags,
    summary: 'Aprovar a solicitação',
    security,
    params: idParamSchema,
    body: approvalSchema,
    response: { 200: requestDetailSchema, ...errorResponses },
  },
  handle: async ({ ctx, request }) => {
    const auth = requireAuth(request);
    await decisions.approveRequest(ctx, auth, request.params.id, request.body.message, request.ip);
    return requests.requestDetail(ctx, auth, request.params.id);
  },
});

const rejectRequestRoute = defineRoute({
  method: 'POST',
  url: '/service-requests/:id/rejection',
  config: { permission: 'serviceRequests.manage' },
  schema: {
    tags,
    summary: 'Recusar a solicitação com o motivo',
    security,
    params: idParamSchema,
    body: rejectionSchema,
    response: { 200: requestDetailSchema, ...errorResponses },
  },
  handle: async ({ ctx, request }) => {
    const auth = requireAuth(request);
    await decisions.rejectRequest(ctx, auth, request.params.id, request.body.reason, request.ip);
    return requests.requestDetail(ctx, auth, request.params.id);
  },
});

const cancelRequestRoute = defineRoute({
  method: 'POST',
  url: '/service-requests/:id/cancellation',
  config: { permission: 'serviceRequests.cancel' },
  schema: {
    tags,
    summary: 'Cancelar a solicitação',
    description:
      'O cliente cancela até as 18h da véspera da visita; a gerência a qualquer momento antes da finalização.',
    security,
    params: idParamSchema,
    body: cancellationSchema,
    response: { 200: requestDetailSchema, ...errorResponses },
  },
  handle: async ({ ctx, request }) => {
    const auth = requireAuth(request);
    await decisions.cancelRequest(ctx, auth, request.params.id, request.body.reason, request.ip);
    return requests.requestDetail(ctx, auth, request.params.id);
  },
});

const SERVICE_ROUTES = [
  listServiceTypesRoute,
  getServiceTypeRoute,
  createServiceTypeRoute,
  updateServiceTypeRoute,
  removeServiceTypeRoute,
  createRequestRoute,
  listVisibleRequestsRoute,
  requestDetailRoute,
  addRequestPhotosRoute,
  listRequestMessagesRoute,
  postRequestMessageRoute,
  approveRequestRoute,
  rejectRequestRoute,
  cancelRequestRoute,
];

export function serviceRoutes(ctx: AppContext): FastifyPluginAsyncZod {
  return async (app) => registerRoutes(app, ctx, SERVICE_ROUTES);
}
