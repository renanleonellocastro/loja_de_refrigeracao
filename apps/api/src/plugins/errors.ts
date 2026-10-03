import type { FastifyError, FastifyInstance } from 'fastify';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';
import { AppError, PROBLEM_BASE_URL } from '../shared/errors.js';

const PROBLEM = 'application/problem+json; charset=utf-8';

function fieldPath(context: string | undefined, instancePath: string): string {
  const path = instancePath.replace(/^\//, '').replaceAll('/', '.');
  return path || String(context);
}

/** Every error leaves the API as an RFC 9457 problem; unexpected ones never leak details. */
export function registerErrorHandling(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError, request, reply) => {
    const base = { instance: request.url, requestId: request.id };

    if (error instanceof AppError) {
      return reply
        .code(error.status)
        .headers(error.headers)
        .type(PROBLEM)
        .send({ ...error.toProblem(), ...base });
    }

    if (hasZodFastifySchemaValidationErrors(error)) {
      return reply
        .code(422)
        .type(PROBLEM)
        .send({
          type: `${PROBLEM_BASE_URL}validation`,
          title: 'Dados inválidos',
          status: 422,
          detail: 'Confira os campos destacados.',
          errors: error.validation.map((issue) => ({
            path: fieldPath(error.validationContext, issue.instancePath),
            message: String(issue.message),
          })),
          ...base,
        });
    }

    const status = error.statusCode ?? 500;
    if (status >= 400 && status < 500) {
      return reply
        .code(status)
        .type(PROBLEM)
        .send({
          type: `${PROBLEM_BASE_URL}${status === 413 ? 'payload-too-large' : status === 415 ? 'unsupported-media-type' : 'bad-request'}`,
          title:
            status === 413
              ? 'Arquivo grande demais'
              : status === 415
                ? 'Tipo não aceito'
                : 'Requisição inválida',
          status,
          detail: error.message,
          ...base,
        });
    }

    request.log.error({ err: error }, 'unhandled error');
    return reply
      .code(500)
      .type(PROBLEM)
      .send({
        type: `${PROBLEM_BASE_URL}internal`,
        title: 'Erro interno',
        status: 500,
        detail: 'Algo deu errado do nosso lado. Tente de novo em instantes.',
        ...base,
      });
  });

  app.setNotFoundHandler((request, reply) =>
    reply
      .code(404)
      .type(PROBLEM)
      .send({
        type: `${PROBLEM_BASE_URL}not-found`,
        title: 'Não encontrado',
        status: 404,
        detail: 'Rota inexistente.',
        instance: request.url,
        requestId: request.id,
      }),
  );
}
