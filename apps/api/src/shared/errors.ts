export const PROBLEM_BASE_URL = 'https://refrigeracaocastro.com.br/problems/';

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  [extension: string]: unknown;
}

/** An expected failure that becomes an RFC 9457 problem response. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly slug: string,
    public readonly title: string,
    public readonly detail?: string,
    public readonly extensions: Record<string, unknown> = {},
    public readonly headers: Record<string, string> = {},
  ) {
    super(detail ?? title);
    this.name = 'AppError';
  }

  toProblem(): ProblemDetails {
    return {
      type: `${PROBLEM_BASE_URL}${this.slug}`,
      title: this.title,
      status: this.status,
      ...(this.detail === undefined ? {} : { detail: this.detail }),
      ...this.extensions,
    };
  }
}

export const unauthorized = (detail = 'Faça login para continuar.') =>
  new AppError(401, 'unauthorized', 'Não autenticado', detail);

export const forbidden = (detail = 'Você não tem permissão para esta ação.') =>
  new AppError(403, 'forbidden', 'Sem permissão', detail);

export const notFound = (detail = 'O recurso não foi encontrado.') =>
  new AppError(404, 'not-found', 'Não encontrado', detail);

export const conflict = (
  slug: string,
  title: string,
  detail?: string,
  extensions?: Record<string, unknown>,
) => new AppError(409, slug, title, detail, extensions);

export const unprocessable = (
  slug: string,
  title: string,
  detail?: string,
  extensions?: Record<string, unknown>,
) => new AppError(422, slug, title, detail, extensions);

export const preconditionFailed = () =>
  new AppError(
    412,
    'precondition-failed',
    'Registro alterado por outra pessoa',
    'Este registro foi alterado depois que você o abriu. Recarregue para ver a versão atual.',
  );

export const preconditionRequired = () =>
  new AppError(428, 'precondition-required', 'Versão do registro ausente', 'Envie o cabeçalho If-Match.');

export const tooManyRequests = (
  retryAfterSeconds: number,
  detail = 'Muitas tentativas. Aguarde e tente de novo.',
) =>
  new AppError(
    429,
    'too-many-requests',
    'Muitas tentativas',
    detail,
    {},
    { 'retry-after': String(retryAfterSeconds) },
  );
