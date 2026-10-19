import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type FastifyPluginAsyncZod,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Config } from './config.js';
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
import { registerProbes } from './plugins/probes.js';
import { registerSecurityHeaders } from './plugins/security.js';

z.config(z.locales.pt());

export const API_PREFIX = '/api/v1';
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

const MAX_BODY_BYTES = 1024 * 1024;
const MAX_UPLOAD_FILES = 10;
/** Long enough for every documented parameter, so an oversized one gets the 422 of the schema. */
const MAX_PARAM_LENGTH = 500;
const REDACTED_HEADERS = ['req.headers.authorization', 'req.headers.cookie'];

type ModuleRoutes = (ctx: AppContext) => FastifyPluginAsyncZod;

/** The API modules in the order their routes appear in the OpenAPI document. */
const API_MODULES: readonly ModuleRoutes[] = [
  authRoutes,
  auditRoutes,
  (ctx) => mediaRoutes(ctx.storage),
  userRoutes,
  serviceRoutes,
  catalogRoutes,
  agendaRoutes,
  orderRoutes,
  quoteRoutes,
  notificationRoutes,
  storeRoutes,
  dashboardRoutes,
];

function loggerOptions(config: Config) {
  if (config.LOG_LEVEL === 'silent') return false;
  return { level: config.LOG_LEVEL, redact: REDACTED_HEADERS };
}

function createServer(config: Config) {
  return Fastify({
    logger: loggerOptions(config),
    genReqId: () => crypto.randomUUID(),
    trustProxy: config.TRUST_PROXY,
    bodyLimit: MAX_BODY_BYTES,
    routerOptions: { maxParamLength: MAX_PARAM_LENGTH },
  }).withTypeProvider<ZodTypeProvider>();
}

function useZodSchemas(app: FastifyInstance): void {
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
}

async function registerTransport(app: FastifyInstance, config: Config): Promise<void> {
  await app.register(cors, {
    origin: config.APP_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    exposedHeaders: ['ETag', 'Location', 'Retry-After'],
  });
  await app.register(cookie);
  await app.register(rateLimit, { global: false });
  await app.register(multipart, { limits: { fileSize: MAX_UPLOAD_BYTES, files: MAX_UPLOAD_FILES } });
}

async function registerRequestPlugins(app: FastifyInstance, ctx: AppContext): Promise<void> {
  await app.register(authPlugin, { ctx });
  await app.register(idempotencyPlugin, { ctx });
  await registerOpenApi(app);
}

async function registerApiModules(app: FastifyInstance, ctx: AppContext): Promise<void> {
  const registerAll = async (api: FastifyInstance) => {
    for (const moduleRoutes of API_MODULES) await api.register(moduleRoutes(ctx));
  };
  await app.register(registerAll, { prefix: API_PREFIX });
}

export async function buildApp(ctx: AppContext): Promise<FastifyInstance> {
  const app = createServer(ctx.config);
  useZodSchemas(app);
  registerErrorHandling(app);
  await registerSecurityHeaders(app, ctx.config);
  await registerTransport(app, ctx.config);
  await registerRequestPlugins(app, ctx);
  registerProbes(app, ctx);
  await registerApiModules(app, ctx);
  return app;
}
