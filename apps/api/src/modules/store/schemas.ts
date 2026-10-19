import { BRAZILIAN_STATES, digits, isValidCep, isValidPhone } from '@rc/contracts';
import { z } from 'zod';
import { emailSchema } from '../../shared/schemas.js';
import { addressViewSchema } from '../users/schemas.js';

const MAX_NOTIFICATION_EMAILS = 10;
const MAX_DEFAULT_STOCK_MIN = 1000;

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, { error: 'Use o formato HH:MM.' });
const dayHours = z
  .object({ opens: hhmm, closes: hhmm })
  .refine((d) => d.closes > d.opens, { error: 'O fechamento deve ser depois da abertura.', path: ['closes'] })
  .nullable();
const openingHoursSchema = z.record(z.enum(['0', '1', '2', '3', '4', '5', '6']), dayHours);

export const publicStoreSchema = z
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

export const settingsSchema = publicStoreSchema
  .extend({ notificationEmails: z.array(z.string()), defaultStockMin: z.number().int() })
  .meta({ id: 'StoreSettings' });

const phone = z.string().transform(digits).refine(isValidPhone, { error: 'Telefone inválido.' });

const addressInputSchema = z.object({
  cep: z.string().transform(digits).refine(isValidCep, { error: 'CEP inválido.' }),
  street: z.string().trim().min(2).max(150),
  number: z.string().trim().min(1).max(20),
  complement: z.string().trim().max(80).nullable(),
  district: z.string().trim().min(2).max(80),
  city: z.string().trim().min(2).max(80),
  state: z.enum(BRAZILIAN_STATES),
});

export const storeUpdateSchema = z.object({
  name: z.string().trim().min(3).max(80).optional(),
  phone: phone.optional(),
  whatsapp: phone.nullable().optional(),
  email: emailSchema.optional(),
  address: addressInputSchema.optional(),
  openingHours: openingHoursSchema.optional(),
  notificationEmails: z.array(emailSchema).max(MAX_NOTIFICATION_EMAILS).optional(),
  defaultStockMin: z.number().int().min(0).max(MAX_DEFAULT_STOCK_MIN).optional(),
});
