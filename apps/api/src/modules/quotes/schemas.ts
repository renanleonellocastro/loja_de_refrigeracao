import { z } from 'zod';
import { imageSchema } from '../media/schemas.js';
import { windowSchema } from '../services/schemas.js';
import { addressSchema } from '../users/schemas.js';
import { QUOTE_STATUSES } from './status.js';

export const MAX_VALIDITY_DAYS = 90;

export const quoteCreationSchema = z.object({
  customerId: z.number().int().positive().optional(),
  serviceTypeId: z.number().int().positive(),
  description: z
    .string()
    .trim()
    .min(10, { error: 'Descreva o que precisa com pelo menos 10 caracteres.' })
    .max(2000, { error: 'Use no máximo 2000 caracteres.' }),
});

export type QuoteCreation = z.infer<typeof quoteCreationSchema>;

export const quoteListQuerySchema = z.object({
  status: z
    .string()
    .optional()
    .transform((value) => (value ? value.split(',') : undefined))
    .pipe(z.array(z.enum(QUOTE_STATUSES)).optional()),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const answerSchema = z.object({
  amountCents: z
    .number({ error: 'Informe o valor em centavos.' })
    .int({ error: 'Informe o valor em centavos.' })
    .positive({ error: 'O valor precisa ser maior que zero.' }),
  validityDays: z
    .number({ error: 'Informe a validade em dias.' })
    .int({ error: 'Informe a validade em dias inteiros.' })
    .min(1, { error: 'A validade mínima é de 1 dia.' })
    .max(MAX_VALIDITY_DAYS, { error: `A validade máxima é de ${MAX_VALIDITY_DAYS} dias.` }),
  included: z
    .string()
    .trim()
    .min(3, { error: 'Descreva o que está incluído no orçamento.' })
    .max(2000, { error: 'Use no máximo 2000 caracteres.' }),
  notes: z.string().trim().max(2000, { error: 'Use no máximo 2000 caracteres.' }).optional(),
});

export type QuoteAnswer = z.infer<typeof answerSchema>;

export const acceptanceSchema = z.object({
  windows: z
    .array(windowSchema)
    .min(1, { error: 'Escolha pelo menos uma data para a visita.' })
    .max(10, { error: 'Escolha no máximo 10 datas.' }),
  address: addressSchema.optional(),
  productKind: z.string().trim().min(2, { error: 'Informe o tipo de produto.' }).max(80).optional(),
  brand: z.string().trim().max(60).optional(),
  model: z.string().trim().max(60).optional(),
});

export type QuoteAcceptance = z.infer<typeof acceptanceSchema>;

export const declineSchema = z.object({ reason: z.string().trim().max(1000).optional() });
export const quoteCancellationSchema = z.object({ reason: z.string().trim().max(1000).optional() });

const personSchema = z.object({ id: z.number().int(), name: z.string() });

export const quoteListItemSchema = z
  .object({
    id: z.number().int(),
    status: z.enum(QUOTE_STATUSES),
    statusLabel: z.string(),
    serviceType: z.string(),
    customer: personSchema,
    amountCents: z.number().int().nullable(),
    validUntil: z.string().nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
  })
  .meta({ id: 'QuoteListItem' });

export const quoteDetailSchema = z
  .object({
    id: z.number().int(),
    status: z.enum(QUOTE_STATUSES),
    statusLabel: z.string(),
    serviceType: z.object({ id: z.number().int(), name: z.string() }),
    description: z.string(),
    photos: z.array(imageSchema.extend({ id: z.number().int() })),
    customer: personSchema.extend({ email: z.string(), phone: z.string().nullable() }),
    amountCents: z.number().int().nullable(),
    validUntil: z.string().nullable().describe('Último dia (São Paulo) em que o orçamento pode ser aceito.'),
    included: z.string().nullable(),
    notes: z.string().nullable(),
    answeredBy: personSchema.nullable(),
    answeredAt: z.date().nullable(),
    decidedAt: z.date().nullable(),
    declineReason: z.string().nullable(),
    serviceRequestId: z.number().int().nullable(),
    canAccept: z.boolean(),
    canDecline: z.boolean(),
    canCancel: z.boolean(),
    createdAt: z.date(),
    updatedAt: z.date(),
  })
  .meta({ id: 'Quote' });

export const acceptanceResultSchema = z
  .object({ quote: quoteDetailSchema, serviceRequestId: z.number().int() })
  .meta({ id: 'QuoteAcceptance' });
