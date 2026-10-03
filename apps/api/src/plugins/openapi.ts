import fastifySwagger from '@fastify/swagger';
import scalar from '@scalar/fastify-api-reference';
import type { FastifyInstance } from 'fastify';
import { jsonSchemaTransform, jsonSchemaTransformObject } from 'fastify-type-provider-zod';

export const OPENAPI_INFO = {
  title: 'Refrigeração Castro API',
  version: '1.0.0',
  description:
    'API RESTful do sistema da Refrigeração Castro (Mogi Mirim/SP). Erros no formato RFC 9457 (application/problem+json). Convenções em docs/API.md.',
};

export async function registerOpenApi(app: FastifyInstance): Promise<void> {
  await app.register(fastifySwagger, {
    openapi: {
      openapi: '3.1.0',
      info: OPENAPI_INFO,
      servers: [{ url: '/' }],
      components: {
        securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
      },
    },
    transform: jsonSchemaTransform,
    transformObject: jsonSchemaTransformObject,
  });
  app.get('/api/v1/openapi.json', { config: { public: true }, schema: { hide: true } }, async () =>
    app.swagger(),
  );
  await app.register(scalar, { routePrefix: '/api/docs', configuration: { url: '/api/v1/openapi.json' } });
}
