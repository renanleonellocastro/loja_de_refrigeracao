import { z } from 'zod';
import { imageSchema } from '../media/schemas.js';
import { ORDER_STATUSES } from './status.js';

const itemInput = z.object({
  productId: z.number().int().positive(),
  quantity: z
    .number()
    .int()
    .min(1, { error: 'Quantidade mínima é 1.' })
    .max(99, { error: 'Quantidade máxima é 99.' }),
});

export const cartQuantitySchema = z.object({
  quantity: z
    .number()
    .int()
    .min(1, { error: 'Quantidade mínima é 1.' })
    .max(99, { error: 'Quantidade máxima é 99.' }),
});

export const cartMergeSchema = z.object({ items: z.array(itemInput).max(50) });

export const productParamSchema = z.object({ productId: z.coerce.number().int().positive() });

const cartProduct = z.object({
  id: z.number().int(),
  name: z.string(),
  slug: z.string(),
  priceCents: z.number().int(),
  stockAvailable: z.number().int(),
  cover: imageSchema.nullable(),
});

export const cartSchema = z
  .object({
    items: z.array(
      z.object({
        product: cartProduct,
        quantity: z.number().int(),
        subtotalCents: z.number().int(),
        problem: z.enum(['unavailable', 'insufficient']).nullable(),
      }),
    ),
    itemCount: z.number().int(),
    totalCents: z.number().int(),
    ready: z.boolean(),
  })
  .meta({ id: 'Cart' });

export const orderCreationSchema = z.object({
  customerId: z.number().int().positive().optional(),
  items: z.array(itemInput).min(1).max(50).optional(),
  notes: z.string().trim().max(500).optional(),
});

export const counterSaleSchema = z.object({
  customerId: z.number().int().positive(),
  items: z.array(itemInput).min(1, { error: 'Adicione pelo menos um produto.' }).max(50),
  notes: z.string().trim().max(500).optional(),
});

export const cancellationSchema = z.object({ reason: z.string().trim().max(500).optional() });

export const orderListQuerySchema = z.object({
  status: z
    .string()
    .optional()
    .transform((value) => (value ? value.split(',') : undefined))
    .pipe(z.array(z.enum(ORDER_STATUSES)).optional()),
  q: z.string().trim().max(100).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const person = z.object({ id: z.number().int(), name: z.string() });

export const orderListItemSchema = z
  .object({
    id: z.number().int(),
    number: z.string(),
    status: z.enum(ORDER_STATUSES),
    statusLabel: z.string(),
    channel: z.enum(['ONLINE', 'COUNTER']),
    customer: person,
    totalCents: z.number().int(),
    itemCount: z.number().int(),
    createdAt: z.date(),
    updatedAt: z.date(),
  })
  .meta({ id: 'OrderListItem' });

export const orderListSchema = z.object({
  data: z.array(orderListItemSchema),
  meta: z.object({
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
    counts: z.record(z.enum(ORDER_STATUSES), z.number().int()),
  }),
});

export const orderDetailSchema = z
  .object({
    id: z.number().int(),
    number: z.string(),
    status: z.enum(ORDER_STATUSES),
    statusLabel: z.string(),
    channel: z.enum(['ONLINE', 'COUNTER']),
    customer: person.extend({ email: z.string(), phone: z.string().nullable() }),
    items: z.array(
      z.object({
        productId: z.number().int(),
        productName: z.string(),
        unitPriceCents: z.number().int(),
        quantity: z.number().int(),
        subtotalCents: z.number().int(),
      }),
    ),
    totalCents: z.number().int(),
    notes: z.string().nullable(),
    events: z.array(
      z.object({
        fromStatus: z.enum(ORDER_STATUSES).nullable(),
        toStatus: z.enum(ORDER_STATUSES),
        label: z.string(),
        actor: person.nullable(),
        reason: z.string().nullable(),
        createdAt: z.date(),
      }),
    ),
    canCancel: z.boolean(),
    createdAt: z.date(),
    updatedAt: z.date(),
  })
  .meta({ id: 'Order' });
