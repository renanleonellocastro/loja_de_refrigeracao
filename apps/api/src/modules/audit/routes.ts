import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { AppContext } from '../../context.js';
import { pageQuerySchema, paginated } from '../../shared/pagination.js';
import { errorResponses } from '../../shared/schemas.js';
import { listAudit } from './service.js';

const auditLogSchema = z
  .object({
    id: z.number().int(),
    actorId: z.number().int().nullable(),
    action: z.string(),
    resourceType: z.string(),
    resourceId: z.string().nullable(),
    before: z.unknown(),
    after: z.unknown(),
    ip: z.string().nullable(),
    createdAt: z.date(),
  })
  .meta({ id: 'AuditLog' });

const querySchema = pageQuerySchema.extend({
  actorId: z.coerce.number().int().positive().optional(),
  resourceType: z.string().max(50).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export function auditRoutes(ctx: AppContext): FastifyPluginAsyncZod {
  return async (app) => {
    app.get(
      '/audit-logs',
      {
        config: { permission: 'audit.read' },
        schema: {
          tags: ['Auditoria'],
          summary: 'Trilha de auditoria das ações administrativas',
          security: [{ bearerAuth: [] }],
          querystring: querySchema,
          response: { 200: paginated(auditLogSchema), ...errorResponses },
        },
      },
      async (request) => listAudit(ctx.db, request.query),
    );
  };
}
