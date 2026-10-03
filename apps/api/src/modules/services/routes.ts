import { can } from '@rc/contracts';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { AppContext } from '../../context.js';
import { actorOf, requireAuth } from '../../plugins/auth.js';
import { paginated } from '../../shared/pagination.js';
import { errorResponses, idParamSchema } from '../../shared/schemas.js';
import { imageSchema } from '../media/schemas.js';
import { readMultipart } from '../media/service.js';
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

export function serviceRoutes(ctx: AppContext): FastifyPluginAsyncZod {
  return async (app) => {
    const typeTags = ['Tipos de serviço'];
    const tags = ['Solicitações de serviço'];

    app.get(
      '/service-types',
      {
        config: { public: true },
        schema: {
          tags: typeTags,
          summary: 'Listar tipos de reparo e manutenção',
          description: 'Inativos só aparecem para o super usuário com includeInactive=true.',
          querystring: serviceTypeListQuerySchema,
          response: { 200: z.array(serviceTypeSchema), ...errorResponses },
        },
      },
      async (request) =>
        types.listServiceTypes(
          ctx,
          request.query.includeInactive === 'true' && can(actorOf(request), 'serviceTypes.manage'),
        ),
    );

    app.get(
      '/service-types/:id',
      {
        config: { public: true },
        schema: {
          tags: typeTags,
          summary: 'Detalhes de um tipo de serviço',
          params: idParamSchema,
          response: { 200: serviceTypeSchema, ...errorResponses },
        },
      },
      async (request) =>
        types.getServiceType(ctx, request.params.id, can(actorOf(request), 'serviceTypes.manage')),
    );

    app.post(
      '/service-types',
      {
        config: { permission: 'serviceTypes.manage' },
        schema: {
          tags: typeTags,
          summary: 'Cadastrar tipo de serviço',
          security,
          body: serviceTypeInputSchema,
          response: { 201: serviceTypeSchema, ...errorResponses },
        },
      },
      async (request, reply) => {
        const created = await types.createServiceType(ctx, requireAuth(request), request.body, request.ip);
        return reply.code(201).header('location', `/api/v1/service-types/${created.id}`).send(created);
      },
    );

    app.patch(
      '/service-types/:id',
      {
        config: { permission: 'serviceTypes.manage' },
        schema: {
          tags: typeTags,
          summary: 'Alterar tipo de serviço',
          security,
          params: idParamSchema,
          body: serviceTypeUpdateSchema,
          response: { 200: serviceTypeSchema, ...errorResponses },
        },
      },
      async (request) =>
        types.updateServiceType(ctx, requireAuth(request), request.params.id, request.body, request.ip),
    );

    app.delete(
      '/service-types/:id',
      {
        config: { permission: 'serviceTypes.manage' },
        schema: {
          tags: typeTags,
          summary: 'Excluir tipo de serviço (desativa quando já foi usado)',
          security,
          params: idParamSchema,
          response: { 200: removalResultSchema, ...errorResponses },
        },
      },
      async (request) => types.removeServiceType(ctx, requireAuth(request), request.params.id, request.ip),
    );

    app.post(
      '/service-requests',
      {
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
      },
      async (request, reply) => {
        const auth = requireAuth(request);
        const created = await requests.createRequest(ctx, auth, request.body, request.ip);
        const detail = await requests.requestDetail(ctx, auth, created.id);
        return reply.code(201).header('location', `/api/v1/service-requests/${created.id}`).send(detail);
      },
    );

    app.get(
      '/service-requests',
      {
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
      },
      async (request) => requests.listVisibleRequests(ctx, requireAuth(request), request.query),
    );

    app.get(
      '/service-requests/:id',
      {
        config: { permission: 'serviceRequests.read' },
        schema: {
          tags,
          summary: 'Detalhes de uma solicitação',
          security,
          params: idParamSchema,
          response: { 200: requestDetailSchema, ...errorResponses },
        },
      },
      async (request) => requests.requestDetail(ctx, requireAuth(request), request.params.id),
    );

    app.post(
      '/service-requests/:id/photos',
      {
        config: { permission: 'serviceRequests.read' },
        schema: {
          tags,
          summary: 'Enviar fotos do problema (multipart, campo de arquivo livre)',
          security,
          params: idParamSchema,
          response: { 201: z.array(imageSchema.extend({ id: z.number().int() })), ...errorResponses },
        },
      },
      async (request, reply) => {
        const auth = requireAuth(request);
        await requests.loadVisible(ctx, ctx.db, auth, request.params.id);
        const form = await readMultipart(request, requests.MAX_REQUEST_PHOTOS);
        return reply.code(201).send(await requests.addPhotos(ctx, auth, request.params.id, form.files));
      },
    );

    app.get(
      '/service-requests/:id/messages',
      {
        config: { permission: 'serviceRequests.read' },
        schema: {
          tags,
          summary: 'Conversa entre a loja e o cliente',
          security,
          params: idParamSchema,
          response: { 200: z.array(messageSchema), ...errorResponses },
        },
      },
      async (request) => requests.listRequestMessages(ctx, requireAuth(request), request.params.id),
    );

    app.post(
      '/service-requests/:id/messages',
      {
        config: { permission: 'serviceRequests.read' },
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
        await requests.postRequestMessage(ctx, auth, request.params.id, request.body.body);
        return reply.code(201).send(await requests.listRequestMessages(ctx, auth, request.params.id));
      },
    );

    app.post(
      '/service-requests/:id/approval',
      {
        config: { permission: 'serviceRequests.manage' },
        schema: {
          tags,
          summary: 'Aprovar a solicitação',
          security,
          params: idParamSchema,
          body: approvalSchema,
          response: { 200: requestDetailSchema, ...errorResponses },
        },
      },
      async (request) => {
        const auth = requireAuth(request);
        await requests.approveRequest(ctx, auth, request.params.id, request.body.message, request.ip);
        return requests.requestDetail(ctx, auth, request.params.id);
      },
    );

    app.post(
      '/service-requests/:id/rejection',
      {
        config: { permission: 'serviceRequests.manage' },
        schema: {
          tags,
          summary: 'Recusar a solicitação com o motivo',
          security,
          params: idParamSchema,
          body: rejectionSchema,
          response: { 200: requestDetailSchema, ...errorResponses },
        },
      },
      async (request) => {
        const auth = requireAuth(request);
        await requests.rejectRequest(ctx, auth, request.params.id, request.body.reason, request.ip);
        return requests.requestDetail(ctx, auth, request.params.id);
      },
    );

    app.post(
      '/service-requests/:id/cancellation',
      {
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
      },
      async (request) => {
        const auth = requireAuth(request);
        await requests.cancelRequest(ctx, auth, request.params.id, request.body.reason, request.ip);
        return requests.requestDetail(ctx, auth, request.params.id);
      },
    );
  };
}
