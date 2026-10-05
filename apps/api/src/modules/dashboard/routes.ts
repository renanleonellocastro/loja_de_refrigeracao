import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { AppContext } from '../../context.js';
import { requireAuth } from '../../plugins/auth.js';
import { errorResponses } from '../../shared/schemas.js';
import { dashboard } from './dashboard.js';
import { dashboardSchema } from './schemas.js';

export function dashboardRoutes(ctx: AppContext): FastifyPluginAsyncZod {
  return async (app) => {
    app.get(
      '/dashboard',
      {
        config: { permission: 'dashboard.read' },
        schema: {
          tags: ['Painel'],
          summary: 'Painel da equipe',
          description:
            'Gerente e super usuário recebem os indicadores da loja; o colaborador recebe as próprias visitas de hoje e as finalizações pendentes.',
          security: [{ bearerAuth: [] }],
          response: { 200: dashboardSchema, ...errorResponses },
        },
      },
      async (request) => dashboard(ctx, requireAuth(request)),
    );
  };
}
