import { BRAZILIAN_STATES, digits, isValidCep, isValidPhone } from '@rc/contracts';
import { z } from 'zod';
import { emailSchema, trimmedText } from '../../shared/schemas.js';
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
  street: trimmedText(150).min(2),
  number: trimmedText(20).min(1),
  complement: trimmedText(80).nullable(),
  district: trimmedText(80).min(2),
  city: trimmedText(80).min(2),
  state: z.enum(BRAZILIAN_STATES),
});

export const storeUpdateSchema = z.object({
  name: trimmedText(80).min(3).optional(),
  phone: phone.optional(),
  whatsapp: phone.nullable().optional(),
  email: emailSchema.optional(),
  address: addressInputSchema.optional(),
  openingHours: openingHoursSchema.optional(),
  notificationEmails: z.array(emailSchema).max(MAX_NOTIFICATION_EMAILS).optional(),
  defaultStockMin: z.number().int().min(0).max(MAX_DEFAULT_STOCK_MIN).optional(),
});
