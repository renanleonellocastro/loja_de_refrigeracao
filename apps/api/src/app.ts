import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from 'fastify-type-provider-zod';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import type { AppContext } from './context.js';
import { agendaRoutes } from './modules/agenda/routes.js';
import { auditRoutes } from './modules/audit/routes.js';
import { catalogRoutes } from './modules/catalog/routes.js';
import { dashboardRoutes } from './modules/dashboard/routes.js';
import { mediaRoutes } from './modules/media/routes.js';
import { orderRoutes } from './modules/orders/routes.js';
import { notificationRoutes } from './modules/notifications/routes.js';
import { quoteRoutes } from './modules/quotes/routes.js';
import { serviceRoutes } from './modules/services/routes.js';
import { storeRoutes } from './modules/store/routes.js';
import { userRoutes } from './modules/users/routes.js';
import { authRoutes } from './modules/auth/routes.js';
import { authPlugin } from './plugins/auth.js';
import { registerErrorHandling } from './plugins/errors.js';
import { idempotencyPlugin } from './plugins/idempotency.js';
import { registerOpenApi } from './plugins/openapi.js';

z.config(z.locales.pt());

export const API_PREFIX = '/api/v1';
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export async function buildApp(ctx: AppContext): Promise<FastifyInstance> {
  const { config } = ctx;
  const app = Fastify({
    logger:
      config.LOG_LEVEL === 'silent'
        ? false
        : { level: config.LOG_LEVEL, redact: ['req.headers.authorization', 'req.headers.cookie'] },
    genReqId: () => crypto.randomUUID(),
    trustProxy: config.TRUST_PROXY,
    bodyLimit: 1024 * 1024,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandling(app);

  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'same-site' },
  });
  await app.register(cors, {
    origin: config.APP_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    exposedHeaders: ['ETag', 'Location', 'Retry-After'],
  });
  await app.register(cookie);
  await app.register(rateLimit, { global: false });
  await app.register(multipart, { limits: { fileSize: MAX_UPLOAD_BYTES, files: 10 } });
  await app.register(authPlugin, { ctx });
  await app.register(idempotencyPlugin, { ctx });
  await registerOpenApi(app);

  app.get('/health', { schema: { hide: true } }, async () => ({ status: 'ok' }));
  app.get('/ready', { schema: { hide: true } }, async (_request, reply) => {
    try {
      await ctx.db.execute(sql`select 1`);
      return { status: 'ready' };
    } catch {
      return reply.code(503).send({ status: 'unavailable' });
    }
  });

  await app.register(
    async (api) => {
      await api.register(authRoutes(ctx));
      await api.register(auditRoutes(ctx));
      await api.register(mediaRoutes(ctx.storage));
      await api.register(userRoutes(ctx));
      await api.register(serviceRoutes(ctx));
      await api.register(catalogRoutes(ctx));
      await api.register(agendaRoutes(ctx));
      await api.register(orderRoutes(ctx));
      await api.register(quoteRoutes(ctx));
      await api.register(notificationRoutes(ctx));
      await api.register(storeRoutes(ctx));
      await api.register(dashboardRoutes(ctx));
    },
    { prefix: API_PREFIX },
  );

  return app;
}
