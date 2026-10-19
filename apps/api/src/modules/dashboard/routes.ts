import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { AppContext } from '../../context.js';
import { requireAuth } from '../../plugins/auth.js';
import { defineRoute, registerRoutes } from '../../shared/routes.js';
import { errorResponses } from '../../shared/schemas.js';
import { dashboard } from './dashboard.js';
import { dashboardSchema } from './schemas.js';

const dashboardRoute = defineRoute({
  method: 'GET',
  url: '/dashboard',
  config: { permission: 'dashboard.read' },
  schema: {
    tags: ['Painel'],
    summary: 'Painel da equipe',
    description:
      'Gerente e super usuário recebem os indicadores da loja; o colaborador recebe as próprias visitas de hoje e as finalizações pendentes.',
    security: [{ bearerAuth: [] }],
    response: { 200: dashboardSchema, ...errorResponses },
  },
  handle: async ({ ctx, request }) => dashboard(ctx, requireAuth(request)),
});

const DASHBOARD_ROUTES = [dashboardRoute];

export function dashboardRoutes(ctx: AppContext): FastifyPluginAsyncZod {
  return async (app) => registerRoutes(app, ctx, DASHBOARD_ROUTES);
}
