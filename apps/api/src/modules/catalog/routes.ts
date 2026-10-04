import { can } from '@rc/contracts';
import type { FastifyRequest } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { AppContext } from '../../context.js';
import { requireAuth } from '../../plugins/auth.js';
import { etagFor } from '../../shared/concurrency.js';
import { pageQuerySchema, paginated } from '../../shared/pagination.js';
import { errorResponses, idParamSchema, noContentSchema, problemSchema } from '../../shared/schemas.js';
import { readMultipart } from '../media/service.js';
import { productFacets, listProducts } from './browse.js';
import * as categories from './categories.js';
import * as gallery from './gallery.js';
import * as products from './products.js';
import {
  MAX_IMAGES_PER_PRODUCT,
  MAX_IMAGES_PER_REQUEST,
  catalogFacetsSchema,
  catalogFilterSchema,
  categoryDeletionQuerySchema,
  categoryInputSchema,
  categoryOrderSchema,
  categorySchema,
  idOrSlugParamsSchema,
  imageOrderSchema,
  imageParamsSchema,
  productCreationSchema,
  productDeletionSchema,
  productDetailSchema,
  productImageSchema,
  productListQuerySchema,
  productSummarySchema,
  productUpdateSchema,
  stockMovementInputSchema,
  stockMovementResultSchema,
  stockMovementSchema,
} from './schemas.js';
import * as stock from './stock.js';

const security = [{ bearerAuth: [] }];

function meta(request: FastifyRequest): categories.AuditMeta {
  return { actor: requireAuth(request), ip: request.ip };
}

/** Public routes show archived products only to who manages products. */
function isStaff(request: FastifyRequest): boolean {
  return request.auth !== null && can(request.auth.role, 'products.manage');
}

const ifMatchHeaders = z
  .object({ 'if-match': z.string().optional().describe('ETag recebido no GET do produto') })
  .loose();

export function catalogRoutes(ctx: AppContext): FastifyPluginAsyncZod {
  return async (app) => {
    const categoryTags = ['Categorias'];
    const productTags = ['Produtos'];
    const stockTags = ['Estoque'];

    app.get(
      '/categories',
      {
        config: { public: true },
        schema: {
          tags: categoryTags,
          summary: 'Listar categorias com a quantidade de produtos',
          response: { 200: z.array(categorySchema), ...errorResponses },
        },
      },
      async () => categories.listCategories(ctx.db),
    );

    app.post(
      '/categories',
      {
        config: { permission: 'categories.manage' },
        schema: {
          tags: categoryTags,
          summary: 'Cadastrar categoria',
          security,
          body: categoryInputSchema,
          response: { 201: categorySchema, ...errorResponses },
        },
      },
      async (request, reply) => {
        const category = await categories.createCategory(ctx, request.body.name, meta(request));
        return reply.code(201).header('location', `/api/v1/categories/${category.id}`).send(category);
      },
    );

    app.put(
      '/categories/order',
      {
        config: { permission: 'categories.manage' },
        schema: {
          tags: categoryTags,
          summary: 'Reordenar as categorias',
          description: 'Envie os ids de todas as categorias na ordem desejada.',
          security,
          body: categoryOrderSchema,
          response: { 200: z.array(categorySchema), ...errorResponses },
        },
      },
      async (request) => categories.reorderCategories(ctx, request.body.ids, meta(request)),
    );

    app.patch(
      '/categories/:id',
      {
        config: { permission: 'categories.manage' },
        schema: {
          tags: categoryTags,
          summary: 'Renomear categoria',
          security,
          params: idParamSchema,
          body: categoryInputSchema,
          response: { 200: categorySchema, ...errorResponses },
        },
      },
      async (request) => categories.renameCategory(ctx, request.params.id, request.body.name, meta(request)),
    );

    app.delete(
      '/categories/:id',
      {
        config: { permission: 'categories.manage' },
        schema: {
          tags: categoryTags,
          summary: 'Excluir categoria',
          description:
            'Categoria com produtos responde 409 (category-in-use) com productCount, a menos que moveTo indique a categoria que recebe os produtos.',
          security,
          params: idParamSchema,
          querystring: categoryDeletionQuerySchema,
          response: { 204: noContentSchema, ...errorResponses },
        },
      },
      async (request, reply) => {
        await categories.deleteCategory(ctx, request.params.id, request.query.moveTo, meta(request));
        return reply.code(204).send();
      },
    );

    app.get(
      '/products',
      {
        config: { public: true },
        schema: {
          tags: productTags,
          summary: 'Catálogo com busca, filtros, ordenação e paginação',
          description:
            'A busca ignora acentos e maiúsculas e tolera erros de digitação; com q a ordenação padrão é por relevância.',
          querystring: productListQuerySchema,
          response: { 200: paginated(productSummarySchema), ...errorResponses },
        },
      },
      async (request) => listProducts(ctx.db, request.query, isStaff(request)),
    );

    app.get(
      '/products/facets',
      {
        config: { public: true },
        schema: {
          tags: productTags,
          summary: 'Contagens para os filtros do catálogo',
          description: 'Cada faceta aplica os demais filtros e ignora o próprio.',
          querystring: catalogFilterSchema,
          response: { 200: catalogFacetsSchema, ...errorResponses },
        },
      },
      async (request) => productFacets(ctx.db, request.query, isStaff(request)),
    );

    app.get(
      '/products/:id',
      {
        config: { public: true },
        schema: {
          tags: productTags,
          summary: 'Detalhes do produto por id ou slug',
          description: 'O parâmetro aceita o id numérico ou o slug do produto.',
          params: idOrSlugParamsSchema,
          response: { 200: productDetailSchema, ...errorResponses },
        },
      },
      async (request, reply) => {
        const product = await products.getProduct(ctx, request.params.id, isStaff(request));
        return reply.header('etag', etagFor(product.version)).send(product);
      },
    );

    app.post(
      '/products',
      {
        config: { permission: 'products.manage' },
        schema: {
          tags: productTags,
          summary: 'Cadastrar produto',
          security,
          body: productCreationSchema,
          response: { 201: productDetailSchema, ...errorResponses },
        },
      },
      async (request, reply) => {
        const product = await products.createProduct(ctx, request.body, meta(request));
        return reply
          .code(201)
          .header('location', `/api/v1/products/${product.id}`)
          .header('etag', etagFor(product.version))
          .send(product);
      },
    );

    app.patch(
      '/products/:id',
      {
        config: { permission: 'products.manage' },
        schema: {
          tags: productTags,
          summary: 'Editar produto',
          description:
            'Exige If-Match com o ETag do produto: 428 sem ele, 412 se outra pessoa alterou antes.',
          security,
          params: idParamSchema,
          headers: ifMatchHeaders,
          body: productUpdateSchema,
          response: { 200: productDetailSchema, 412: problemSchema, 428: problemSchema, ...errorResponses },
        },
      },
      async (request, reply) => {
        const product = await products.updateProduct(
          ctx,
          request.params.id,
          request.headers['if-match'],
          request.body,
          meta(request),
        );
        return reply.header('etag', etagFor(product.version)).send(product);
      },
    );

    app.delete(
      '/products/:id',
      {
        config: { permission: 'products.delete' },
        schema: {
          tags: productTags,
          summary: 'Excluir produto (arquiva quando já foi vendido)',
          security,
          params: idParamSchema,
          response: { 200: productDeletionSchema, ...errorResponses },
        },
      },
      async (request) => products.deleteProduct(ctx, request.params.id, meta(request)),
    );

    app.post(
      '/products/:id/unarchive',
      {
        config: { permission: 'products.delete' },
        schema: {
          tags: productTags,
          summary: 'Desarquivar produto',
          security,
          params: idParamSchema,
          response: { 200: productDetailSchema, ...errorResponses },
        },
      },
      async (request) => products.unarchiveProduct(ctx, request.params.id, meta(request)),
    );

    app.post(
      '/products/:id/images',
      {
        config: { permission: 'products.manage' },
        schema: {
          tags: productTags,
          summary: 'Enviar fotos do produto (multipart)',
          description: `Até ${MAX_IMAGES_PER_REQUEST} fotos por envio e ${MAX_IMAGES_PER_PRODUCT} por produto, em JPEG, PNG, WebP ou HEIC de até 8 MB. A primeira foto do produto vira a capa. Responde a galeria completa.`,
          consumes: ['multipart/form-data'],
          security,
          params: idParamSchema,
          response: {
            201: z.array(productImageSchema),
            413: problemSchema,
            415: problemSchema,
            ...errorResponses,
          },
        },
      },
      async (request, reply) => {
        const form = await readMultipart(request, MAX_IMAGES_PER_REQUEST);
        const images = await gallery.addImages(ctx, request.params.id, form.files, meta(request));
        return reply.code(201).header('location', `/api/v1/products/${request.params.id}`).send(images);
      },
    );

    app.put(
      '/products/:id/images/order',
      {
        config: { permission: 'products.manage' },
        schema: {
          tags: productTags,
          summary: 'Ordenar fotos e escolher a capa',
          security,
          params: idParamSchema,
          body: imageOrderSchema,
          response: { 200: z.array(productImageSchema), ...errorResponses },
        },
      },
      async (request) => gallery.reorderImages(ctx, request.params.id, request.body, meta(request)),
    );

    app.delete(
      '/products/:id/images/:imageId',
      {
        config: { permission: 'products.manage' },
        schema: {
          tags: productTags,
          summary: 'Remover foto do produto',
          security,
          params: imageParamsSchema,
          response: { 204: noContentSchema, ...errorResponses },
        },
      },
      async (request, reply) => {
        await gallery.removeImage(ctx, request.params.id, request.params.imageId, meta(request));
        return reply.code(204).send();
      },
    );

    app.get(
      '/products/:id/stock-movements',
      {
        config: { permission: 'products.manage' },
        schema: {
          tags: stockTags,
          summary: 'Histórico de movimentações e reservas, do mais recente ao mais antigo',
          security,
          params: idParamSchema,
          querystring: pageQuerySchema,
          response: { 200: paginated(stockMovementSchema), ...errorResponses },
        },
      },
      async (request) => stock.listMovements(ctx, request.params.id, request.query),
    );

    app.post(
      '/products/:id/stock-movements',
      {
        config: { permission: 'products.manage' },
        schema: {
          tags: stockTags,
          summary: 'Registrar entrada, ajuste ou perda',
          description:
            'IN soma, LOSS subtrai e ADJUSTMENT aplica a quantidade com sinal. Motivo obrigatório para ajuste e perda. 409 (insufficient-stock) se o estoque ficaria negativo.',
          security,
          params: idParamSchema,
          body: stockMovementInputSchema,
          response: { 201: stockMovementResultSchema, ...errorResponses },
        },
      },
      async (request, reply) => {
        const result = await stock.recordMovement(ctx, request.params.id, request.body, meta(request));
        return reply
          .code(201)
          .header('location', `/api/v1/products/${request.params.id}/stock-movements`)
          .send(result);
      },
    );
  };
}
