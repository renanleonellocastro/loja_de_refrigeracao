import type { FastifyReply } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Storage } from '../../infra/storage/storage.js';
import { notFound } from '../../shared/errors.js';
import { fileResponse, problemSchema } from '../../shared/schemas.js';
import { ORIGINAL_FILE, type VariantFormat } from './images.js';

/** Variants are content addressed, so a URL never changes its bytes and may be cached for a year. */
const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';
/** The original stands in for a variant the worker has not written yet; it must not stick in caches. */
const PROVISIONAL_CACHE_CONTROL = 'no-store';
const CONTENT_TYPES: Record<VariantFormat, string> = { avif: 'image/avif', webp: 'image/webp' };

const paramsSchema = z.object({
  key: z.string().regex(/^[a-f0-9]{32}$/),
  file: z.string().regex(/^\d{3,4}\.(avif|webp)$/),
});

type VariantParams = z.infer<typeof paramsSchema>;

interface ImageFile {
  data: Buffer;
  contentType: string;
  cacheControl: string;
}

const variantRouteOptions = {
  config: { public: true },
  schema: {
    tags: ['Imagens'],
    summary: 'Variante de uma foto (imutável)',
    description:
      'Variantes AVIF e WebP geradas pelo worker. Enquanto o worker não termina, responde com a foto original em WebP, sem cache.',
    params: paramsSchema,
    response: {
      200: {
        description: 'Imagem AVIF ou WebP',
        content: {
          ...fileResponse(CONTENT_TYPES.avif, '').content,
          ...fileResponse(CONTENT_TYPES.webp, '').content,
        },
      },
      404: problemSchema,
      422: problemSchema,
    },
  },
};

function formatOf(file: string): VariantFormat {
  return file.endsWith('.avif') ? 'avif' : 'webp';
}

async function loadOriginal(storage: Storage, key: string): Promise<ImageFile> {
  const data = await storage.get(`${key}/${ORIGINAL_FILE}`);
  if (!data) throw notFound('Imagem não encontrada.');
  return { data, contentType: CONTENT_TYPES.webp, cacheControl: PROVISIONAL_CACHE_CONTROL };
}

async function loadVariant(storage: Storage, params: VariantParams): Promise<ImageFile> {
  const data = await storage.get(`${params.key}/${params.file}`);
  if (!data) return loadOriginal(storage, params.key);
  return { data, contentType: CONTENT_TYPES[formatOf(params.file)], cacheControl: IMMUTABLE_CACHE_CONTROL };
}

function sendImage(reply: FastifyReply, image: ImageFile) {
  return reply
    .header('content-type', image.contentType)
    .header('cache-control', image.cacheControl)
    .send(image.data);
}

export function mediaRoutes(storage: Storage): FastifyPluginAsyncZod {
  return async (app) => {
    app.get('/media/:key/:file', variantRouteOptions, async (request, reply) =>
      sendImage(reply, await loadVariant(storage, request.params)),
    );
  };
}
