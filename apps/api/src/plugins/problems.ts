import type { FastifyError } from 'fastify';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';
import { AppError, PROBLEM_BASE_URL, type ProblemDetails } from '../shared/errors.js';

/** The problem body of an error response plus the headers it must carry. */
export interface ProblemReply {
  readonly problem: ProblemDetails;
  readonly headers?: Readonly<Record<string, string>>;
}

/** Turns the errors it knows into a problem and answers undefined for every other error. */
type ErrorMapper = (error: FastifyError) => ProblemReply | undefined;

interface ProblemKind {
  readonly slug: string;
  readonly title: string;
}

const UNPROCESSABLE_STATUS = 422;
const INTERNAL_STATUS = 500;
const CLIENT_ERROR_STATUSES = { from: 400, below: 500 } as const;
const INVALID_DATA_TITLE = 'Dados inválidos';

/**
 * PostgreSQL data exceptions caused by input the schemas let through (text too long, number out of the
 * column range, NUL bytes): the request is wrong, not the server.
 */
const INVALID_INPUT_CODES: ReadonlySet<unknown> = new Set(['22001', '22003', '22021', '22P05']);

const CLIENT_ERROR_KINDS: Readonly<Record<number, ProblemKind>> = {
  413: { slug: 'payload-too-large', title: 'Arquivo grande demais' },
  415: { slug: 'unsupported-media-type', title: 'Tipo não aceito' },
};

const BAD_REQUEST: ProblemKind = { slug: 'bad-request', title: 'Requisição inválida' };

export function problemOf(slug: string, title: string, status: number, detail: string): ProblemDetails {
  return { type: `${PROBLEM_BASE_URL}${slug}`, title, status, detail };
}

export const ROUTE_NOT_FOUND = problemOf('not-found', 'Não encontrado', 404, 'Rota inexistente.');

export const INTERNAL_PROBLEM = problemOf(
  'internal',
  'Erro interno',
  INTERNAL_STATUS,
  'Algo deu errado do nosso lado. Tente de novo em instantes.',
);

function appErrorProblem(error: FastifyError): ProblemReply | undefined {
  if (!(error instanceof AppError)) return undefined;
  return { problem: error.toProblem(), headers: error.headers };
}

function fieldPath(context: string | undefined, instancePath: string): string {
  const path = instancePath.replace(/^\//, '').replaceAll('/', '.');
  return path || String(context);
}

function validationProblem(error: FastifyError): ProblemReply | undefined {
  if (!hasZodFastifySchemaValidationErrors(error)) return undefined;
  const errors = error.validation.map((issue) => ({
    path: fieldPath(error.validationContext, issue.instancePath),
    message: String(issue.message),
  }));
  const summary = problemOf(
    'validation',
    INVALID_DATA_TITLE,
    UNPROCESSABLE_STATUS,
    'Confira os campos destacados.',
  );
  return { problem: { ...summary, errors } };
}

function databaseCode(error: Error): unknown {
  return (error.cause as { code?: unknown } | undefined)?.code;
}

function invalidInputProblem(error: FastifyError): ProblemReply | undefined {
  if (!INVALID_INPUT_CODES.has(databaseCode(error))) return undefined;
  const detail = 'Algum campo tem caracteres ou valores fora do aceito.';
  return { problem: problemOf('invalid-input', INVALID_DATA_TITLE, UNPROCESSABLE_STATUS, detail) };
}

function isClientErrorStatus(status: number): boolean {
  return status >= CLIENT_ERROR_STATUSES.from && status < CLIENT_ERROR_STATUSES.below;
}

function clientErrorProblem(error: FastifyError): ProblemReply | undefined {
  const status = error.statusCode ?? INTERNAL_STATUS;
  if (!isClientErrorStatus(status)) return undefined;
  const { slug, title } = CLIENT_ERROR_KINDS[status] ?? BAD_REQUEST;
  return { problem: problemOf(slug, title, status, error.message) };
}

/** Tried in order: the first mapper that knows the error answers; none answering means an unexpected error. */
const ERROR_MAPPERS: readonly ErrorMapper[] = [
  appErrorProblem,
  validationProblem,
  invalidInputProblem,
  clientErrorProblem,
];

/** The problem for an expected error, or undefined when the error is unexpected. */
export function expectedProblem(error: FastifyError): ProblemReply | undefined {
  for (const mapper of ERROR_MAPPERS) {
    const reply = mapper(error);
    if (reply) return reply;
  }
  return undefined;
}
