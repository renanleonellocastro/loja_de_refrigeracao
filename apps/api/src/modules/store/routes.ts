import { BRAZILIAN_STATES, digits, isValidCep, isValidPhone } from '@rc/contracts';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { AppContext } from '../../context.js';
import { requireAuth } from '../../plugins/auth.js';
import { emailSchema, errorResponses } from '../../shared/schemas.js';
import { addressViewSchema } from '../users/schemas.js';
import * as store from './store.js';

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, { error: 'Use o formato HH:MM.' });
const dayHours = z
  .object({ opens: hhmm, closes: hhmm })
  .refine((d) => d.closes > d.opens, { error: 'O fechamento deve ser depois da abertura.', path: ['closes'] })
  .nullable();
const openingHoursSchema = z.record(z.enum(['0', '1', '2', '3', '4', '5', '6']), dayHours);

const publicStoreSchema = z
  .object({
    name: z.string(),
    legalName: z.string(),
    cnpj: z.string(),
    phone: z.string(),
    whatsapp: z.string().nullable(),
    email: z.string(),
    address: addressViewSchema,
    openingHours: z.record(z.string(), z.object({ opens: z.string(), closes: z.string() }).nullable()),
    openNow: z.boolean(),
  })
  .meta({ id: 'Store' });

const settingsSchema = publicStoreSchema
  .extend({ notificationEmails: z.array(z.string()), defaultStockMin: z.number().int() })
  .meta({ id: 'StoreSettings' });

const phone = z.string().transform(digits).refine(isValidPhone, { error: 'Telefone inválido.' });

const updateSchema = z.object({
  name: z.string().trim().min(3).max(80).optional(),
  phone: phone.optional(),
  whatsapp: phone.nullable().optional(),
  email: emailSchema.optional(),
  address: z
    .object({
      cep: z.string().transform(digits).refine(isValidCep, { error: 'CEP inválido.' }),
      street: z.string().trim().min(2).max(150),
      number: z.string().trim().min(1).max(20),
      complement: z.string().trim().max(80).nullable(),
      district: z.string().trim().min(2).max(80),
      city: z.string().trim().min(2).max(80),
      state: z.enum(BRAZILIAN_STATES),
    })
    .optional(),
  openingHours: openingHoursSchema.optional(),
  notificationEmails: z.array(emailSchema).max(10).optional(),
  defaultStockMin: z.number().int().min(0).max(1000).optional(),
});

export function storeRoutes(ctx: AppContext): FastifyPluginAsyncZod {
  return async (app) => {
    const tags = ['Loja'];

    app.get(
      '/store',
      {
        config: { public: true },
        schema: {
          tags,
          summary: 'Dados públicos da loja (endereço, contatos, horários)',
          response: { 200: publicStoreSchema },
        },
      },
      async (_request, reply) =>
        reply.header('cache-control', 'public, max-age=300').send(await store.publicStore(ctx)),
    );

    app.get(
      '/store/settings',
      {
        config: { permission: 'store.manage' },
        schema: {
          tags,
          summary: 'Configurações completas da loja',
          security: [{ bearerAuth: [] }],
          response: { 200: settingsSchema, ...errorResponses },
        },
      },
      async () => store.storeSettingsView(ctx),
    );

    app.patch(
      '/store',
      {
        config: { permission: 'store.manage' },
        schema: {
          tags,
          summary: 'Configurar a loja',
          security: [{ bearerAuth: [] }],
          body: updateSchema,
          response: { 200: settingsSchema, ...errorResponses },
        },
      },
      async (request) =>
        store.updateStoreSettings(ctx, requireAuth(request).userId, request.body, request.ip),
    );
  };
}
