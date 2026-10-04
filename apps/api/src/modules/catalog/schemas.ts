import { z } from 'zod';
import { imageSchema } from '../media/schemas.js';
import { pageQuerySchema } from '../../shared/pagination.js';

export const PRODUCT_CONDITIONS = ['NEW', 'USED'] as const;
export const PRODUCT_SORTS = ['relevance', 'name', 'newest', 'priceAsc', 'priceDesc'] as const;
export const MANUAL_MOVEMENT_TYPES = ['IN', 'ADJUSTMENT', 'LOSS'] as const;
export const STOCK_MOVEMENT_TYPES = ['IN', 'ADJUSTMENT', 'LOSS', 'RESERVATION', 'RELEASE', 'SALE'] as const;

/** Photos per upload request and per product (RF-13). */
export const MAX_IMAGES_PER_REQUEST = 10;
export const MAX_IMAGES_PER_PRODUCT = 20;
export const MAX_STOCK_QUANTITY = 100_000;

export type ProductCondition = (typeof PRODUCT_CONDITIONS)[number];
export type ProductSort = (typeof PRODUCT_SORTS)[number];
export type ManualMovementType = (typeof MANUAL_MOVEMENT_TYPES)[number];

// Input schemas (may have transforms; not registered as named components).

const categoryNameSchema = z
  .string({ error: 'Informe o nome da categoria.' })
  .trim()
  .min(2, { error: 'Informe o nome da categoria.' })
  .max(60, { error: 'Nome longo demais.' });

export const categoryInputSchema = z.object({ name: categoryNameSchema });

export const categoryDeletionQuerySchema = z.object({
  moveTo: z.coerce.number().int().positive().optional(),
});

export const categoryOrderSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1, { error: 'Informe a ordem das categorias.' }).max(200),
});

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: 'Texto longo demais.' })
    .transform((value) => (value === '' ? null : value))
    .nullable();

const priceSchema = z
  .number({ error: 'Informe o preço em centavos.' })
  .int({ error: 'O preço deve estar em centavos.' })
  .min(0, { error: 'O preço não pode ser negativo.' })
  .max(100_000_000, { error: 'Preço alto demais.' });

const stockMinSchema = z
  .number()
  .int({ error: 'Informe um número inteiro.' })
  .min(0, { error: 'O estoque mínimo não pode ser negativo.' })
  .max(MAX_STOCK_QUANTITY)
  .nullable();

const productFields = {
  name: z
    .string({ error: 'Informe o nome do produto.' })
    .trim()
    .min(3, { error: 'Informe o nome do produto.' })
    .max(120, { error: 'Nome longo demais.' }),
  categoryId: z.number({ error: 'Escolha a categoria.' }).int().positive({ error: 'Escolha a categoria.' }),
  brand: optionalText(60),
  model: optionalText(60),
  condition: z.enum(PRODUCT_CONDITIONS, { error: 'Escolha novo ou usado.' }),
  description: z.string().trim().max(5000, { error: 'Descrição longa demais.' }),
  priceCents: priceSchema,
  stockMin: stockMinSchema,
};

export const productCreationSchema = z.object({
  name: productFields.name,
  categoryId: productFields.categoryId,
  brand: productFields.brand.optional().transform((value) => value ?? null),
  model: productFields.model.optional().transform((value) => value ?? null),
  condition: productFields.condition.default('NEW'),
  description: productFields.description.default(''),
  priceCents: productFields.priceCents,
  initialStock: z
    .number()
    .int({ error: 'Informe um número inteiro.' })
    .min(0, { error: 'A quantidade não pode ser negativa.' })
    .max(MAX_STOCK_QUANTITY)
    .default(0),
  stockMin: productFields.stockMin.optional().transform((value) => value ?? null),
});

export type ProductCreation = z.infer<typeof productCreationSchema>;

export const productUpdateSchema = z.object({
  name: productFields.name.optional(),
  categoryId: productFields.categoryId.optional(),
  brand: productFields.brand.optional(),
  model: productFields.model.optional(),
  condition: productFields.condition.optional(),
  description: productFields.description.optional(),
  priceCents: productFields.priceCents.optional(),
  stockMin: productFields.stockMin.optional(),
});

export type ProductUpdate = z.infer<typeof productUpdateSchema>;

const booleanQuery = z
  .enum(['true', 'false'], { error: 'Use true ou false.' })
  .transform((value) => value === 'true');

const catalogFilters = {
  q: z.string().trim().max(100).optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  condition: z.enum(PRODUCT_CONDITIONS).optional(),
  brand: z.string().trim().min(1).max(60).optional(),
  minPriceCents: z.coerce.number().int().min(0).optional(),
  maxPriceCents: z.coerce.number().int().min(0).optional(),
  available: booleanQuery.optional(),
  includeArchived: booleanQuery
    .optional()
    .describe('Somente para gerente e super usuário: inclui produtos arquivados.'),
};

function priceRangeIsValid(value: {
  minPriceCents?: number | undefined;
  maxPriceCents?: number | undefined;
}) {
  return (
    value.minPriceCents === undefined ||
    value.maxPriceCents === undefined ||
    value.minPriceCents <= value.maxPriceCents
  );
}

const priceRangeIssue = {
  path: ['maxPriceCents'],
  error: 'O preço máximo deve ser maior que o mínimo.',
};

export const catalogFilterSchema = z.object(catalogFilters).refine(priceRangeIsValid, priceRangeIssue);

export const productListQuerySchema = pageQuerySchema
  .extend({ ...catalogFilters, sort: z.enum(PRODUCT_SORTS).optional() })
  .refine(priceRangeIsValid, priceRangeIssue);

export type CatalogFilters = z.infer<typeof catalogFilterSchema>;
export type ProductListQuery = z.infer<typeof productListQuerySchema>;

/** Same path as the other product routes (`/products/{id}`), accepting the id or the slug. */
export const idOrSlugParamsSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(160)
    .regex(/^[a-z0-9-]+$/, { error: 'Produto inválido.' }),
});

export const imageParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  imageId: z.coerce.number().int().positive(),
});

export const imageOrderSchema = z.object({
  imageIds: z
    .array(z.number().int().positive())
    .min(1, { error: 'Informe a ordem das fotos.' })
    .max(MAX_IMAGES_PER_PRODUCT),
  coverId: z.number().int().positive().optional(),
});

export const stockMovementInputSchema = z
  .object({
    type: z.enum(MANUAL_MOVEMENT_TYPES, { error: 'Escolha entrada, ajuste ou perda.' }),
    quantity: z
      .number({ error: 'Informe a quantidade.' })
      .int({ error: 'Informe um número inteiro.' })
      .min(-MAX_STOCK_QUANTITY, { error: 'Quantidade grande demais.' })
      .max(MAX_STOCK_QUANTITY, { error: 'Quantidade grande demais.' }),
    reason: z
      .string()
      .trim()
      .max(300, { error: 'Motivo longo demais.' })
      .optional()
      .transform((value) => (value ? value : null)),
  })
  .superRefine((value, ctx) => {
    if (value.type === 'ADJUSTMENT' ? value.quantity === 0 : value.quantity <= 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['quantity'],
        message:
          value.type === 'ADJUSTMENT'
            ? 'Informe uma quantidade diferente de zero (negativa para retirar).'
            : 'Informe uma quantidade maior que zero.',
      });
    }
    if (value.type !== 'IN' && value.reason === null) {
      ctx.addIssue({ code: 'custom', path: ['reason'], message: 'Informe o motivo.' });
    }
  });

export type StockMovementInput = z.infer<typeof stockMovementInputSchema>;

// Output schemas (no transforms).

export const categorySchema = z
  .object({
    id: z.number().int(),
    name: z.string(),
    position: z.number().int(),
    productCount: z.number().int().describe('Produtos não arquivados na categoria'),
  })
  .meta({ id: 'Category' });

export const productImageSchema = imageSchema
  .extend({
    id: z.number().int(),
    position: z.number().int(),
    isCover: z.boolean(),
  })
  .meta({ id: 'ProductImage' });

const productBase = {
  id: z.number().int(),
  slug: z.string(),
  name: z.string(),
  categoryId: z.number().int(),
  categoryName: z.string(),
  brand: z.string().nullable(),
  model: z.string().nullable(),
  condition: z.enum(PRODUCT_CONDITIONS),
  priceCents: z.number().int(),
  stockAvailable: z.number().int(),
  stockMin: z.number().int().nullable(),
  available: z.boolean().describe('Há estoque disponível'),
  lowStock: z.boolean().describe('Estoque abaixo do mínimo do produto ou do padrão da loja'),
  archived: z.boolean(),
};

export const productSummarySchema = z
  .object({ ...productBase, cover: productImageSchema.nullable() })
  .meta({ id: 'ProductSummary' });

export const productDetailSchema = z
  .object({
    ...productBase,
    description: z.string(),
    images: z.array(productImageSchema).describe('Capa primeiro, depois na ordem escolhida'),
    version: z.number().int(),
    archivedAt: z.date().nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
  })
  .meta({ id: 'ProductDetail' });

export const productDeletionSchema = z
  .object({
    result: z
      .enum(['archived', 'deleted'])
      .describe('archived quando o produto já foi vendido (decisão D9); deleted quando apagado de fato'),
  })
  .meta({ id: 'ProductDeletion' });

const countSchema = z.number().int();

export const catalogFacetsSchema = z
  .object({
    brands: z.array(z.object({ brand: z.string(), count: countSchema })),
    categories: z.array(z.object({ categoryId: z.number().int(), name: z.string(), count: countSchema })),
    conditions: z.array(z.object({ condition: z.enum(PRODUCT_CONDITIONS), count: countSchema })),
    price: z.object({ minCents: z.number().int(), maxCents: z.number().int() }).nullable(),
    availability: z.object({ available: countSchema, unavailable: countSchema }),
  })
  .meta({ id: 'CatalogFacets' });

export const stockMovementSchema = z
  .object({
    id: z.number().int(),
    type: z.enum(STOCK_MOVEMENT_TYPES),
    quantity: z.number().int().describe('Com sinal: positiva entra, negativa sai'),
    reason: z.string().nullable(),
    authorId: z.number().int().nullable(),
    authorName: z.string().nullable(),
    orderId: z.number().int().nullable(),
    createdAt: z.date(),
  })
  .meta({ id: 'StockMovement' });

export const stockMovementResultSchema = z
  .object({
    movement: stockMovementSchema,
    stockAvailable: z.number().int(),
    lowStock: z.boolean(),
  })
  .meta({ id: 'StockMovementResult' });
