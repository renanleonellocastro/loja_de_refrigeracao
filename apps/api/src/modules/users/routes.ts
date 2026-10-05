import type { FastifyRequest } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { AppContext } from '../../context.js';
import { requireAuth } from '../../plugins/auth.js';
import { clearSessionCookie, sendSession } from '../../plugins/session.js';
import { paginated } from '../../shared/pagination.js';
import { errorResponses, idParamSchema, noContentSchema } from '../../shared/schemas.js';
import { sessionResponseSchema } from '../auth/schemas.js';
import * as accounts from './accounts.js';
import { lookupCep } from './cep.js';
import {
  accountDeletionSchema,
  cepLookupSchema,
  cepQuerySchema,
  customerRegistrationSchema,
  profileUpdateSchema,
  userCreationSchema,
  userDetailSchema,
  userListItemSchema,
  userListQuerySchema,
  userWithActivitySchema,
} from './schemas.js';

const security = [{ bearerAuth: [] }];

function meta(request: FastifyRequest) {
  return { ip: request.ip, userAgent: request.headers['user-agent'] };
}

export function userRoutes(ctx: AppContext): FastifyPluginAsyncZod {
  return async (app) => {
    const tags = ['Usuários'];

    app.post(
      '/customers',
      {
        config: { public: true, rateLimit: { max: 10, timeWindow: '1 hour' } },
        schema: {
          tags,
          summary: 'Criar conta de cliente (autocadastro)',
          body: customerRegistrationSchema,
          response: { 201: sessionResponseSchema, ...errorResponses },
        },
      },
      async (request, reply) =>
        sendSession(
          ctx.config,
          reply,
          await accounts.registerCustomer(ctx, request.body, meta(request)),
          201,
        ),
    );

    app.post(
      '/users',
      {
        config: { permission: 'users.create' },
        schema: {
          tags,
          summary: 'Cadastrar cliente, colaborador ou gerente (com convite por email)',
          security,
          body: userCreationSchema,
          response: { 201: userDetailSchema, ...errorResponses },
        },
      },
      async (request, reply) => {
        const user = await accounts.createUser(ctx, requireAuth(request), request.body, request.ip);
        return reply.code(201).header('location', `/api/v1/users/${user.id}`).send(user);
      },
    );

    app.get(
      '/users',
      {
        config: { permission: 'customers.read' },
        schema: {
          tags,
          summary: 'Listar e buscar usuários por papel',
          security,
          querystring: userListQuerySchema,
          response: { 200: paginated(userListItemSchema), ...errorResponses },
        },
      },
      async (request) => accounts.listUsers(ctx, requireAuth(request).role, request.query),
    );

    app.get(
      '/users/:id',
      {
        config: { permission: 'customers.read' },
        schema: {
          tags,
          summary: 'Detalhes de um usuário',
          description:
            'Inclui os 5 últimos pedidos e solicitações de serviço (clientes) ou os 5 últimos atendimentos (colaboradores).',
          security,
          params: idParamSchema,
          response: { 200: userWithActivitySchema, ...errorResponses },
        },
      },
      async (request) => accounts.getUser(ctx, requireAuth(request).role, request.params.id),
    );

    app.patch(
      '/users/:id',
      {
        config: { permission: 'users.manage' },
        schema: {
          tags,
          summary: 'Editar um usuário',
          security,
          params: idParamSchema,
          body: profileUpdateSchema,
          response: { 200: userDetailSchema, ...errorResponses },
        },
      },
      async (request) =>
        accounts.adminUpdateUser(ctx, requireAuth(request), request.params.id, request.body, request.ip),
    );

    app.delete(
      '/users/:id',
      {
        config: { permission: 'users.manage' },
        schema: {
          tags,
          summary: 'Excluir um usuário (anonimiza os dados pessoais)',
          security,
          params: idParamSchema,
          response: { 204: noContentSchema, ...errorResponses },
        },
      },
      async (request, reply) => {
        await accounts.deleteUser(ctx, requireAuth(request), request.params.id, request.ip);
        return reply.code(204).send();
      },
    );

    app.get(
      '/me',
      {
        config: { permission: 'profile.manage' },
        schema: {
          tags,
          summary: 'Meu perfil',
          security,
          response: { 200: userDetailSchema, ...errorResponses },
        },
      },
      async (request) => accounts.getProfile(ctx, requireAuth(request).userId),
    );

    app.patch(
      '/me',
      {
        config: { permission: 'profile.manage' },
        schema: {
          tags,
          summary: 'Editar meu perfil',
          description: 'Um novo email só vale depois de confirmado pelo link enviado a ele.',
          security,
          body: profileUpdateSchema,
          response: {
            200: z.object({ profile: userDetailSchema, emailVerificationPending: z.boolean() }),
            ...errorResponses,
          },
        },
      },
      async (request) => accounts.updateProfile(ctx, requireAuth(request).userId, request.body),
    );

    app.get(
      '/me/data-export',
      {
        config: { permission: 'account.delete' },
        schema: {
          tags,
          summary: 'Baixar meus dados (LGPD)',
          security,
          response: {
            200: z.record(z.string(), z.unknown()).describe('Arquivo JSON com os dados da conta'),
            ...errorResponses,
          },
        },
      },
      async (request, reply) => {
        const data = await accounts.exportOwnData(ctx, requireAuth(request).userId);
        return reply.header('content-disposition', 'attachment; filename="meus-dados.json"').send(data);
      },
    );

    app.delete(
      '/me',
      {
        config: { permission: 'account.delete' },
        schema: {
          tags,
          summary: 'Excluir minha conta (LGPD)',
          security,
          body: accountDeletionSchema,
          response: { 204: noContentSchema, ...errorResponses },
        },
      },
      async (request, reply) => {
        await accounts.deleteOwnAccount(ctx, requireAuth(request), request.body.password, request.ip);
        clearSessionCookie(reply);
        return reply.code(204).send();
      },
    );

    app.get(
      '/addresses/lookup',
      {
        config: { public: true, rateLimit: { max: 30, timeWindow: '1 minute' } },
        schema: {
          tags,
          summary: 'Consultar endereço pelo CEP',
          querystring: cepQuerySchema,
          response: { 200: cepLookupSchema, ...errorResponses },
        },
      },
      async (request) => lookupCep(ctx.fetch, request.query.cep),
    );
  };
}
