import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { AppContext } from '../../context.js';
import { requireAuth } from '../../plugins/auth.js';
import { notFound } from '../../shared/errors.js';
import { pageMetaSchema, pageQuerySchema } from '../../shared/pagination.js';
import { errorResponses, idParamSchema, noContentSchema } from '../../shared/schemas.js';
import * as repo from './repository.js';

const notificationSchema = z
  .object({
    id: z.number().int(),
    type: z.string(),
    title: z.string(),
    body: z.string(),
    link: z.string().nullable(),
    readAt: z.date().nullable(),
    createdAt: z.date(),
  })
  .meta({ id: 'Notification' });

const security = [{ bearerAuth: [] }];

export function notificationRoutes(ctx: AppContext): FastifyPluginAsyncZod {
  return async (app) => {
    const tags = ['Notificações'];

    app.get(
      '/me/notifications',
      {
        config: { permission: 'notifications.read' },
        schema: {
          tags,
          summary: 'Minhas notificações, mais recentes primeiro',
          security,
          querystring: pageQuerySchema.extend({ unread: z.enum(['true', 'false']).optional() }),
          response: {
            200: z.object({
              data: z.array(notificationSchema),
              meta: pageMetaSchema.extend({ unread: z.number().int() }),
            }),
            ...errorResponses,
          },
        },
      },
      async (request) => {
        const { userId } = requireAuth(request);
        const { page, pageSize, unread } = request.query;
        const result = await repo.listNotifications(
          ctx.db,
          userId,
          unread === 'true',
          pageSize,
          (page - 1) * pageSize,
        );
        return { data: result.rows, meta: { page, pageSize, total: result.total, unread: result.unread } };
      },
    );

    app.post(
      '/me/notifications/:id/read',
      {
        config: { permission: 'notifications.read' },
        schema: {
          tags,
          summary: 'Marcar como lida',
          security,
          params: idParamSchema,
          response: { 204: noContentSchema, ...errorResponses },
        },
      },
      async (request, reply) => {
        const found = await repo.markRead(
          ctx.db,
          requireAuth(request).userId,
          request.params.id,
          ctx.clock.now(),
        );
        if (!found) throw notFound('Notificação não encontrada.');
        return reply.code(204).send();
      },
    );

    app.post(
      '/me/notifications/read-all',
      {
        config: { permission: 'notifications.read' },
        schema: {
          tags,
          summary: 'Marcar todas como lidas',
          security,
          response: { 204: noContentSchema, ...errorResponses },
        },
      },
      async (request, reply) => {
        await repo.markAllRead(ctx.db, requireAuth(request).userId, ctx.clock.now());
        return reply.code(204).send();
      },
    );
  };
}
