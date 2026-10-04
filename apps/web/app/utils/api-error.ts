/** RFC 9457 problem as answered by the API (docs/API.md section 1). */
export interface Problem {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  errors?: Array<{ path: string; message: string }>;
}

/** Field path of the API (for example `address.cep`) mapped to its Portuguese message. */
export type FieldErrors = Record<string, string>;

export const NETWORK_MESSAGE = 'Não conseguimos falar com a loja agora. Confira sua conexão e tente de novo.';
const SERVER_MESSAGE = 'Algo deu errado do nosso lado. Tente de novo em instantes.';

/** A failed API call with a message ready to show and the errors of each form field. */
export class ApiError extends Error {
  readonly status: number;
  /** Last segment of the problem type, for example `email-taken` or `link-expired`. */
  readonly code: string;
  readonly fields: FieldErrors;

  constructor(status: number, message: string, code = '', fields: FieldErrors = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }

  get hasFieldErrors(): boolean {
    return Object.keys(this.fields).length > 0;
  }
}

function isProblem(value: unknown): value is Problem {
  return typeof value === 'object' && value !== null;
}

/** Builds the typed error from the status and the body of a failed response. */
export function problemToError(status: number, body: unknown): ApiError {
  const problem: Problem = isProblem(body) ? body : {};
  const fields: FieldErrors = {};
  for (const error of problem.errors ?? []) fields[error.path] ??= error.message;
  const message = status >= 500 ? SERVER_MESSAGE : (problem.detail ?? problem.title ?? SERVER_MESSAGE);
  const code = problem.type?.split('/').pop() ?? '';
  return new ApiError(status, message, code, fields);
}

/** Anything thrown while calling the API becomes an ApiError; fetch failures mean no connection. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  return new ApiError(0, NETWORK_MESSAGE, 'network');
}

/** Result of an openapi-fetch call. */
export interface ApiResult<T> {
  data?: T;
  error?: unknown;
  response: Response;
}

/** Waits for a typed client call and returns its data, or throws an ApiError ready for the screen. */
export async function unwrap<T>(pending: Promise<ApiResult<T>>): Promise<T> {
  let result: ApiResult<T>;
  try {
    result = await pending;
  } catch (error) {
    throw toApiError(error);
  }
  if (!result.response.ok) throw problemToError(result.response.status, result.error);
  return result.data as T;
}
