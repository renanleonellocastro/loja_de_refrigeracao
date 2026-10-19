import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { AppContext } from '../../context.js';
import { requireAuth } from '../../plugins/auth.js';
import { defineRoute, registerRoutes } from '../../shared/routes.js';
import { errorResponses } from '../../shared/schemas.js';
import { publicStoreSchema, settingsSchema, storeUpdateSchema } from './schemas.js';
import * as store from './store.js';

const tags = ['Loja'];
const security = [{ bearerAuth: [] }];
/** The public store data changes rarely; browsers and the CDN may reuse it for five minutes. */
const PUBLIC_STORE_CACHE_CONTROL = 'public, max-age=300';

const publicStoreRoute = defineRoute({
  method: 'GET',
  url: '/store',
  config: { public: true },
  schema: {
    tags,
    summary: 'Dados públicos da loja (endereço, contatos, horários)',
    response: { 200: publicStoreSchema },
  },
  handle: async ({ ctx, reply }) =>
    reply.header('cache-control', PUBLIC_STORE_CACHE_CONTROL).send(await store.publicStore(ctx)),
});

const storeSettingsRoute = defineRoute({
  method: 'GET',
  url: '/store/settings',
  config: { permission: 'store.manage' },
  schema: {
    tags,
    summary: 'Configurações completas da loja',
    security,
    response: { 200: settingsSchema, ...errorResponses },
  },
  handle: async ({ ctx }) => store.storeSettingsView(ctx),
});

const updateStoreRoute = defineRoute({
  method: 'PATCH',
  url: '/store',
  config: { permission: 'store.manage' },
  schema: {
    tags,
    summary: 'Configurar a loja',
    security,
    body: storeUpdateSchema,
    response: { 200: settingsSchema, ...errorResponses },
  },
  handle: async ({ ctx, request }) =>
    store.updateStoreSettings(ctx, requireAuth(request).userId, request.body, request.ip),
});

const STORE_ROUTES = [publicStoreRoute, storeSettingsRoute, updateStoreRoute];

export function storeRoutes(ctx: AppContext): FastifyPluginAsyncZod {
  return async (app) => registerRoutes(app, ctx, STORE_ROUTES);
}
