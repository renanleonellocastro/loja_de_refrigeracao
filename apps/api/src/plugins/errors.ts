import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { expectedProblem, INTERNAL_PROBLEM, ROUTE_NOT_FOUND, type ProblemReply } from './problems.js';

const PROBLEM = 'application/problem+json; charset=utf-8';

function sendProblem(request: FastifyRequest, reply: FastifyReply, { problem, headers = {} }: ProblemReply) {
  return reply
    .code(problem.status)
    .headers(headers)
    .type(PROBLEM)
    .send({ ...problem, instance: request.url, requestId: request.id });
}

function unexpectedProblem(error: FastifyError, request: FastifyRequest): ProblemReply {
  // Query errors carry the bound parameters (personal data); log only the driver's own error.
  request.log.error({ err: error.cause ?? error }, 'unhandled error');
  return { problem: INTERNAL_PROBLEM };
}

/** Every error leaves the API as an RFC 9457 problem; unexpected ones never leak details. */
export function registerErrorHandling(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError, request, reply) =>
    sendProblem(request, reply, expectedProblem(error) ?? unexpectedProblem(error, request)),
  );
  app.setNotFoundHandler((request, reply) => sendProblem(request, reply, { problem: ROUTE_NOT_FOUND }));
}
