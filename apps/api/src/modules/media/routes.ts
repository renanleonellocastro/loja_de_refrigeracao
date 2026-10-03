import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Storage } from '../../infra/storage/storage.js';
import { notFound } from '../../shared/errors.js';

const paramsSchema = z.object({
  key: z.string().regex(/^[a-f0-9]{32}$/),
  file: z.string().regex(/^\d{3,4}\.webp$/),
});

export function mediaRoutes(storage: Storage): FastifyPluginAsyncZod {
  return async (app) => {
    app.get(
      '/media/:key/:file',
      {
        config: { public: true },
        schema: { tags: ['Imagens'], summary: 'Variante de uma foto (imutável)', params: paramsSchema },
      },
      async (request, reply) => {
        const data = await storage.get(`${request.params.key}/${request.params.file}`);
        if (!data) throw notFound('Imagem não encontrada.');
        return reply
          .header('content-type', 'image/webp')
          .header('cache-control', 'public, max-age=31536000, immutable')
          .send(data);
      },
    );
  };
}
