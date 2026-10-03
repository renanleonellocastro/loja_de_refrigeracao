import createClient, { type Client } from 'openapi-fetch';
import type { paths } from './generated/api.js';

export type ApiPaths = paths;
export type ApiClient = Client<paths>;

export interface ApiClientOptions {
  /** Origin of the API, for example http://localhost:3001 (paths already include /api/v1). */
  baseUrl: string;
  /** Current access token, sent as a bearer token when present. */
  getAccessToken?: () => string | null | undefined;
  fetch?: typeof globalThis.fetch;
}

/** Typed client generated from the OpenAPI document. Cookies are included for the refresh flow. */
export function createApiClient(options: ApiClientOptions): ApiClient {
  const client = createClient<paths>({
    baseUrl: options.baseUrl,
    credentials: 'include',
    ...(options.fetch ? { fetch: options.fetch } : {}),
  });
  client.use({
    onRequest({ request }) {
      const token = options.getAccessToken?.();
      if (token) request.headers.set('authorization', `Bearer ${token}`);
      return request;
    },
  });
  return client;
}
