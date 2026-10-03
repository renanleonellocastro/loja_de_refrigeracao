import { ROLES } from '@rc/contracts';
import { z } from 'zod';
import { imageSchema } from '../media/schemas.js';
import { addressSchema, addressViewSchema } from '../users/schemas.js';
import { REQUEST_STATUSES } from './status.js';

// Service types

export const serviceTypeSchema = z
  .object({
    id: z.number().int(),
    name: z.string(),
    description: z.string(),
    estimatedMinutes: z.number().int(),
    active: z.boolean(),
    position: z.number().int(),
  })
  .meta({ id: 'ServiceType' });

export const serviceTypeInputSchema = z.object({
  name: z.string().trim().min(3, { error: 'Informe o nome do serviço.' }).max(80),
  description: z.string().trim().max(500).default(''),
  estimatedMinutes: z.number().int().min(15, { error: 'Mínimo de 15 minutos.' }).max(1440).default(60),
  active: z.boolean().default(true),
  position: z.number().int().min(0).default(0),
});

export const serviceTypeUpdateSchema = serviceTypeInputSchema.partial();

export const serviceTypeListQuerySchema = z.object({
  includeInactive: z.enum(['true', 'false']).optional(),
});

// Service requests

export const windowSchema = z.object({
  day: z.iso.date({ error: 'Data inválida.' }),
  period: z.enum(['MORNING', 'AFTERNOON']),
});

export const requestCreationSchema = z.object({
  customerId: z.number().int().positive().optional(),
  serviceTypeId: z.number().int().positive(),
  productKind: z.string().trim().min(2, { error: 'Informe o tipo de produto.' }).max(80),
  brand: z.string().trim().max(60).optional(),
  model: z.string().trim().max(60).optional(),
  problem: z
    .string()
    .trim()
    .min(10, { error: 'Descreva o problema com pelo menos 10 caracteres.' })
    .max(2000),
  windows: z
    .array(windowSchema)
    .min(1, { error: 'Escolha pelo menos uma data para a visita.' })
    .max(10, { error: 'Escolha no máximo 10 datas.' }),
  address: addressSchema.optional(),
});

export type RequestCreation = z.infer<typeof requestCreationSchema>;

export const requestListQuerySchema = z.object({
  status: z
    .string()
    .optional()
    .transform((value) => (value ? value.split(',') : undefined))
    .pipe(z.array(z.enum(REQUEST_STATUSES)).optional()),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const personSchema = z.object({ id: z.number().int(), name: z.string() });

export const requestListItemSchema = z
  .object({
    id: z.number().int(),
    status: z.enum(REQUEST_STATUSES),
    statusLabel: z.string(),
    serviceType: z.string(),
    productKind: z.string(),
    customer: personSchema,
    scheduledFor: z.date().nullable(),
    employee: personSchema.nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
  })
  .meta({ id: 'ServiceRequestListItem' });

export const requestDetailSchema = z
  .object({
    id: z.number().int(),
    status: z.enum(REQUEST_STATUSES),
    statusLabel: z.string(),
    serviceType: z.object({ id: z.number().int(), name: z.string() }),
    productKind: z.string(),
    brand: z.string().nullable(),
    model: z.string().nullable(),
    problem: z.string(),
    address: addressViewSchema,
    windows: z.array(z.object({ day: z.string(), period: z.enum(['MORNING', 'AFTERNOON']) })),
    photos: z.array(imageSchema.extend({ id: z.number().int() })),
    customer: personSchema.extend({ email: z.string(), phone: z.string().nullable() }),
    appointment: z
      .object({ id: z.number().int(), employee: personSchema, startsAt: z.date(), endsAt: z.date() })
      .nullable(),
    quoteId: z.number().int().nullable(),
    rejectionReason: z.string().nullable(),
    cancellationReason: z.string().nullable(),
    canCancel: z.boolean(),
    createdAt: z.date(),
    updatedAt: z.date(),
  })
  .meta({ id: 'ServiceRequest' });

export const messageSchema = z
  .object({
    id: z.number().int(),
    body: z.string(),
    author: z.object({ id: z.number().int(), name: z.string(), role: z.enum(ROLES) }),
    mine: z.boolean(),
    createdAt: z.date(),
  })
  .meta({ id: 'Message' });

export const messageInputSchema = z.object({
  body: z.string().trim().min(1, { error: 'Escreva a mensagem.' }).max(2000),
});

export const approvalSchema = z.object({ message: z.string().trim().max(2000).optional() });
export const rejectionSchema = z.object({
  reason: z.string().trim().min(5, { error: 'Explique o motivo para o cliente.' }).max(1000),
});
export const cancellationSchema = z.object({ reason: z.string().trim().max(1000).optional() });
