import fastifySwagger, { type FastifyDynamicSwaggerOptions } from '@fastify/swagger';
import scalar from '@scalar/fastify-api-reference';
import type { FastifyInstance } from 'fastify';
import { jsonSchemaTransform, jsonSchemaTransformObject } from 'fastify-type-provider-zod';

export const OPENAPI_INFO = {
  title: 'Refrigeração Castro API',
  version: '1.0.0',
  description:
    'API RESTful do sistema da Refrigeração Castro (Mogi Mirim/SP). Erros no formato RFC 9457 (application/problem+json). Convenções em docs/API.md.',
};

type Response = { content?: Record<string, { schema: { $ref?: string } }> };
type Operation = { responses: Record<string, Response> };
type OpenApiDocument = ReturnType<typeof jsonSchemaTransformObject>;

const PROBLEM_REF = '#/components/schemas/Problem';
const OPENAPI_JSON_URL = '/api/v1/openapi.json';
const DOCS_PREFIX = '/api/docs';

function responsesOf(document: OpenApiDocument): Response[] {
  const { paths } = document as unknown as { paths: Record<string, Record<string, Operation>> };
  return Object.values(paths)
    .flatMap((operations) => Object.values(operations))
    .flatMap((operation) => Object.values(operation.responses));
}

function useProblemContentType(response: Response): void {
  const json = response.content?.['application/json'];
  if (json?.schema.$ref === PROBLEM_REF) response.content = { 'application/problem+json': json };
}

/** Error responses leave the API as application/problem+json (RFC 9457); the contract says so. */
export function documentProblemContentType(document: OpenApiDocument): OpenApiDocument {
  responsesOf(document).forEach(useProblemContentType);
  return document;
}

const SWAGGER_OPTIONS: FastifyDynamicSwaggerOptions = {
  openapi: {
    openapi: '3.1.0',
    info: OPENAPI_INFO,
    servers: [{ url: '/' }],
    components: {
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    },
  },
  transform: jsonSchemaTransform,
  transformObject: (input) => documentProblemContentType(jsonSchemaTransformObject(input)),
};

export async function registerOpenApi(app: FastifyInstance): Promise<void> {
  await app.register(fastifySwagger, SWAGGER_OPTIONS);
  app.get(OPENAPI_JSON_URL, { config: { public: true }, schema: { hide: true } }, async () => app.swagger());
  await app.register(scalar, { routePrefix: DOCS_PREFIX, configuration: { url: OPENAPI_JSON_URL } });
}
