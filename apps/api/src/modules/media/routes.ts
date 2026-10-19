import type { FastifyReply } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Storage } from '../../infra/storage/storage.js';
import { notFound } from '../../shared/errors.js';
import { fileResponse, problemSchema } from '../../shared/schemas.js';

/** Variants are content addressed, so a URL never changes its bytes and may be cached for a year. */
const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';
const WEBP_CONTENT_TYPE = 'image/webp';

const paramsSchema = z.object({
  key: z.string().regex(/^[a-f0-9]{32}$/),
  file: z.string().regex(/^\d{3,4}\.webp$/),
});

type VariantParams = z.infer<typeof paramsSchema>;

const variantRouteOptions = {
  config: { public: true },
  schema: {
    tags: ['Imagens'],
    summary: 'Variante de uma foto (imutável)',
    params: paramsSchema,
    response: {
      200: fileResponse(WEBP_CONTENT_TYPE, 'Imagem WebP'),
      404: problemSchema,
      422: problemSchema,
    },
  },
};

async function loadVariant(storage: Storage, params: VariantParams): Promise<Buffer> {
  const data = await storage.get(`${params.key}/${params.file}`);
  if (!data) throw notFound('Imagem não encontrada.');
  return data;
}

function sendImmutableWebp(reply: FastifyReply, data: Buffer) {
  return reply
    .header('content-type', WEBP_CONTENT_TYPE)
    .header('cache-control', IMMUTABLE_CACHE_CONTROL)
    .send(data);
}

export function mediaRoutes(storage: Storage): FastifyPluginAsyncZod {
  return async (app) => {
    app.get('/media/:key/:file', variantRouteOptions, async (request, reply) =>
      sendImmutableWebp(reply, await loadVariant(storage, request.params)),
    );
  };
}
